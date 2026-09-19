(function(g){'use strict';
 const fallback={creatorName:'김기훈',notice:'© 2026 김기훈 · 허가 없는 복제·재배포 금지',licenseId:'FR42-PUBLIC',visible:true,opacity:.06};
 let policy={...fallback};
 function clean(v){const x={...fallback,...(v||{})};return{creatorName:String(x.creatorName||fallback.creatorName).slice(0,60),notice:String(x.notice||fallback.notice).slice(0,180),licenseId:String(x.licenseId||fallback.licenseId).replace(/[^A-Z0-9-]/gi,'').slice(0,40),visible:x.visible!==false,opacity:Math.max(.03,Math.min(.12,Number(x.opacity)||.06))}}
 function apply(v){policy=clean(v);document.querySelectorAll('.copyright-watermark,.copyright-stamp').forEach(x=>x.remove());if(!policy.visible)return policy;const w=document.createElement('div');w.className='copyright-watermark';w.setAttribute('aria-hidden','true');w.style.setProperty('--copyright-opacity',String(policy.opacity));const mark=policy.creatorName+' · '+policy.licenseId;for(let i=0;i<5;i++){const row=document.createElement('span');row.textContent=Array(6).fill(mark).join('   ');w.append(row)}const s=document.createElement('div');s.className='copyright-stamp';s.setAttribute('aria-hidden','true');s.textContent=policy.notice+' · 배포 식별 '+policy.licenseId;document.body.append(w,s);return policy}
 g.HistoryCopyright={apply,get policy(){return policy}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>apply());else apply();
})(window);
