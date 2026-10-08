import fs from 'node:fs';import assert from 'node:assert/strict';
import {ROOT as root} from '../src/common.mjs';
const checks=[];
for(const scope of ['demo','atlas','meridian','helios']){
 const dir=`${root}/runs/${scope}-2026-q3-v2/build/site/data/d/weekly`;
 const query=n=>Object.values(JSON.parse(fs.readFileSync(`${dir}/${n}.json`)).results)[0].result.rows;
 // Seven independently rounded kW terms across 6 × 672 intervals: bounded cumulative error < .005 kWh.
 const flow=query('flow'),incoming=flow.filter(r=>r.target==='站內匯流排').reduce((s,r)=>s+r.energy_kwh,0),outgoing=flow.filter(r=>r.source==='站內匯流排').reduce((s,r)=>s+r.energy_kwh,0);assert.ok(Math.abs(incoming-outgoing)<.005);
 const bridge=query('cost_bridge');assert.ok(Math.abs(bridge[0].value+bridge[1].value+bridge[2].value-bridge[3].value)<1e-6);
 const story=query('report_story')[0];assert.ok(Number.isFinite(story.cost_change));assert.equal(query('kpis')[0].site_count,scope==='demo'?6:2);
 if(scope==='helios'){assert.ok(story.pue_current>story.pue_previous);assert.ok(story.cooling_current/story.cooling_previous>1.3);}
 if(scope==='meridian'){assert.ok(story.availability_current<.99);assert.ok(story.ev_current>story.ev_previous);}
 checks.push({scope,flow_balance:true,cost_bridge:true,cost_change:story.cost_change,pue:story.pue_current,availability:story.availability_current});
}
fs.writeFileSync(`${root}/test-results/energy-loop-data.json`,JSON.stringify({ok:true,checks},null,2));console.log(checks);
