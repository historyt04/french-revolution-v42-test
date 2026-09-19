// Local-only QA server backed by a fresh in-memory PostgreSQL-compatible database.
// Not deployed and never uses remote secrets or real student records.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {makeDB,api} from './trial-db.mjs';
const db=await makeDB(),root=path.resolve(import.meta.dirname,'..');
const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost:8000');
  try {
    if(url.pathname==='/functions/v1/history-trial-api'){
      const body=JSON.parse(await Array.fromAsync(req).then(b=>Buffer.concat(b).toString()));
      const out=await api(db,body.action,body.payload,body.token);
      res.writeHead(out.ok?200:401,{'Content-Type':'application/json'});res.end(JSON.stringify(out));return;
    }
    const target=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    let file=await fs.readFile(target);
    // Same client/UI, transport URL only points at the local test database.
    if(url.pathname==='/supabase-trial/client.mjs')file=file.toString().replace('https://mrrvuknoxkpowlqcwahk.supabase.co','http://localhost:8000');
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(file);
  }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,code:e.message,message:e.message}));}
}).listen(8000,'0.0.0.0',()=>console.log('Local trial preview: http://localhost:8000/supabase-student.html'));
