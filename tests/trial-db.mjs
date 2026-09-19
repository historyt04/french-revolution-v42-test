import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export async function makeDB(){
  const base=process.env.HISTORY_TEST_DEPS;
  const resolve=p=>base?pathToFileURL(require.resolve(p,{paths:[base]})).href:p;
  const {PGlite}=await import(resolve('@electric-sql/pglite'));
  const {pgcrypto}=await import(resolve('@electric-sql/pglite/contrib/pgcrypto'));
  const db=new PGlite({extensions:{pgcrypto}});
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema extensions; create extension pgcrypto with schema extensions;');
  const root=path.resolve(import.meta.dirname,'../supabase/migrations');
  for(const f of (await fs.readdir(root)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await fs.readFile(path.join(root,f),'utf8'));
  return db;
}
export async function api(db,action,payload={},token=''){
  const r=await db.query('select public.trial_api($1,$2::jsonb,$3) as result',[action,JSON.stringify(payload),token]);
  return r.rows[0].result;
}
export const credentials={schoolId:'dongju-middle',schoolYear:2026,grade:2,classNo:4,number:4,code:'12345',rememberDevice:true};
