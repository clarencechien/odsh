import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RUNS = path.resolve(process.env.SNAPREPORT_RUNS || path.join(ROOT, 'runs'));
export function runPath(id) { if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id)) throw Error('Invalid run_id'); return path.join(RUNS, id); }
export const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export function writeJSON(p, v) { fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, JSON.stringify(v, (_,x) => typeof x === 'bigint' ? Number(x) : x, 2)+'\n'); }
export const hash = data => createHash('sha256').update(data).digest('hex');
export const fileHash = p => hash(fs.readFileSync(p));
export const sqlString = s => "'"+s.replaceAll("'", "''")+"'";
export function canonical(v) { if (Array.isArray(v)) return v.map(canonical); if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter(k => !['ranAt','elapsedMs'].includes(k)).map(k => [k, canonical(v[k])])); return v; }
export const stableJSON = v => JSON.stringify(canonical(v));
export const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function filesUnder(dir) { return fs.readdirSync(dir, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e => e.isDirectory() ? filesUnder(path.join(dir,e.name)) : e.isFile() ? [path.join(dir,e.name)] : []); }
