import path from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { sqlString, readJSON, writeJSON } from './common.mjs';
export async function validateData(dir) {
  const instance=await DuckDBInstance.create(':memory:'), db=await instance.connect();
  const checks=[];
  try {
    for(const table of ['meters','sites','telemetry','events','assets']) await db.run(`CREATE VIEW ${table} AS SELECT * FROM read_parquet(${sqlString(path.join(dir,'input',table+'.parquet'))})`);
    const gen=readJSON(path.join(dir,'generation.json'));
    const scalar=async sql=>Object.values((await db.runAndReadAll(sql)).getRowObjectsJS()[0])[0];
    const check=async(name,sql,expected=0,tolerance=0)=>{const actual=Number(await scalar(sql));checks.push({name,actual,expected,pass:Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance});};
    await check('meter row count','SELECT count(*) FROM meters',gen.meter_rows);
    await check('telemetry row count','SELECT count(*) FROM telemetry',gen.telemetry_rows);
    await check('unique interval keys','SELECT count(*)-count(DISTINCT (site_id,ts)) FROM meters');
    await check('energy balance kW','SELECT max(abs(grid_import_kw+solar_kw+battery_discharge_kw-load_kw-battery_charge_kw-grid_export_kw)) FROM meters',0,.00001);
    await check('end use balance','SELECT max(abs(load_kw-building_kw-datacenter_kw-ev_kw)) FROM meters',0,.00001);
    await check('battery SOC transition','SELECT max(abs(soc_kwh-soc_start_kwh-battery_charge_kw*.25*sqrt(.9)+battery_discharge_kw*.25/sqrt(.9))) FROM meters',0,.00001);
    await check('SOC continuity',`SELECT coalesce(max(abs(soc_start_kwh-previous_soc)),0) FROM (SELECT soc_start_kwh,lag(soc_kwh) OVER(PARTITION BY site_id ORDER BY ts) previous_soc FROM meters)`,0,.00001);
    await check('SOC bounds',`SELECT count(*) FROM meters m JOIN sites s USING(site_id) WHERE soc_kwh < s.battery_capacity_kwh*.15-.00001 OR soc_kwh > s.battery_capacity_kwh*.9+.00001`);
    await check('no simultaneous charge/discharge','SELECT count(*) FROM meters WHERE battery_charge_kw>0 AND battery_discharge_kw>0');
    await check('no simultaneous import/export','SELECT count(*) FROM meters WHERE grid_import_kw>0 AND grid_export_kw>0');
    await check('tariff ledger','SELECT max(abs(energy_cost_twd-(grid_import_kw*tariff_twd_kwh-grid_export_kw*2)*.25)) FROM meters',0,.00001);
    await check('emissions ledger','SELECT max(abs(grid_co2_kg-grid_import_kw*.25*.474)) FROM meters',0,.00001);
    await check('valid PUE and ports','SELECT count(*) FROM meters WHERE datacenter_kw<it_kw OR available_ports<0 OR available_ports>total_ports');
    await check('regular interval cadence',`SELECT count(*) FROM (SELECT ts-lag(ts) OVER(PARTITION BY site_id ORDER BY ts) gap FROM meters) WHERE gap != INTERVAL 15 MINUTE`);
    await check('night solar','SELECT count(*) FROM meters WHERE (hour(ts)<6 OR hour(ts)>=18) AND solar_kw>.000001');
    await check('telemetry reconciles with meters',`SELECT max(abs(m.load_kw-t.load_kw)) FROM meters m JOIN (SELECT site_id,ts,sum(power_kw) AS load_kw FROM telemetry WHERE domain IN ('building','datacenter','charging') GROUP BY 1,2) t USING(site_id,ts)`,0,.00001);
    await check('declared events present','SELECT count(*) FROM events',gen.events.length);
    if(gen.tenant)for(const table of ['meters','sites','assets','telemetry','events'])await check(`tenant isolation ${table}`,`SELECT count(*) FROM ${table} WHERE tenant<>${sqlString(gen.tenant)}`);
    await check('no null meter observations',`SELECT count(*) FROM meters WHERE ts IS NULL OR site_id IS NULL OR load_kw IS NULL OR soc_kwh IS NULL`);
    const report={ok:checks.every(c=>c.pass),checks};writeJSON(path.join(dir,'quality.json'),report);return report;
  } finally {db.closeSync();instance.closeSync();}
}
