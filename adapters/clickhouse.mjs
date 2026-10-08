/** Optional server-side ingestion seam. Browser artifacts never receive credentials or SQL. */
export async function readClickHouse({url,sql,username,password,fetchImpl=fetch}) {
 const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))throw Error('Expected HTTP(S) ClickHouse endpoint');
 // Production uses HTTPS; HTTP is only supported for a loopback development instance.
 if(parsed.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(parsed.hostname))throw Error('Use HTTPS for remote ClickHouse');
 if(!/^\s*SELECT\b/i.test(sql)||/;/.test(sql))throw Error('Adapter accepts a single SELECT');
 const headers={'Content-Type':'text/plain'};
 if(username)headers['X-ClickHouse-User']=username;
 if(password)headers['X-ClickHouse-Key']=password;
 const response=await fetchImpl(parsed,{method:'POST',headers,body:sql+' FORMAT JSONEachRow',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`ClickHouse read failed: HTTP ${response.status}`);
 return (await response.text()).split('\n').filter(Boolean).map(line=>JSON.parse(line));
}
// Preserve the Parquet contracts described in databases/energy/database.md.
// Query through a read-only account, pin an absolute half-open window and tenant,
// materialize all five tables in a new run, then execute the same check/build path.
// Live ClickHouse dashboards can use @open-dashboard/core's native datasource;
// DuckDB SQL dialect (strftime/interval/casts) must be ported explicitly.
