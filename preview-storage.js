/* Local review storage: read original v4 keys, write only namespaced copies. */
(function(g){
 const prefix='fr-v42-ui-cache:';let persistent=true;
 function wrap(native,readOriginal){const memory=new Map();return {
  getItem(k){if(memory.has(k))return memory.get(k);try{const v=native.getItem(prefix+k);return v!==null?v:(readOriginal?native.getItem(k):null)}catch{persistent=false;return null}},
  setItem(k,v){try{native.setItem(prefix+k,String(v))}catch(e){persistent=false;memory.set(k,String(v));g.dispatchEvent(new CustomEvent('previewstorageerror',{detail:e.name}))}},
  removeItem(k){try{native.removeItem(prefix+k)}catch{}memory.delete(k)},
  snapshot(){const out={};try{for(let i=0;i<native.length;i++){const k=native.key(i);if(k?.startsWith(prefix))out[k.slice(prefix.length)]=native.getItem(k)}}catch{}return {...out,...Object.fromEntries(memory)}}
 }}
 let local,session;try{local=g.localStorage;session=g.sessionStorage}catch{local=session={getItem(){throw Error('storage unavailable')},setItem(){throw Error('storage unavailable')}}}
 g.PreviewStore41=wrap(local,false);g.PreviewSession41=wrap(session,false);
 g.PreviewStorageStatus41=()=>({persistent,prefix});
})(window);
