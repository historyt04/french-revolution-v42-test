/* Shared touch, IME and dialog helpers. No student or teacher data is stored here. */
(function(g){'use strict';
 let composing=false,lastOutside=null,dialogKey='',focusedAction='';
 const dialog=()=>Array.from(document.querySelectorAll('[role="dialog"]')).filter(x=>!x.hidden).at(-1);
 const focusables=p=>Array.from(p.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea,[tabindex="0"]')).filter(x=>!x.closest('[inert]'));
 document.addEventListener('compositionstart',()=>{composing=true},true);
 document.addEventListener('compositionend',()=>{composing=false},true);
 document.addEventListener('submit',e=>{if(composing&&e.target?.querySelector('#ans')){e.preventDefault();e.stopImmediatePropagation()}},true);
 document.addEventListener('focusin',e=>{const d=dialog();if(!d||!d.contains(e.target)){lastOutside={id:e.target.id,action:e.target.getAttribute?.('onclick')};}else focusedAction=e.target.getAttribute?.('onclick')||'';});
 document.addEventListener('keydown',e=>{
  if(e.target?.id==='ans'&&e.key==='Enter'&&(composing||e.isComposing||e.keyCode===229)){e.preventDefault();e.stopImmediatePropagation();return;}
  if(e.repeat&&e.target?.closest('.reveal-modal28')&&['Enter',' '].includes(e.key)){e.preventDefault();return;}
  const d=dialog();if(!d)return;const f=focusables(d);
  if(e.key==='Tab'&&f.length){const i=f.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();f.at(-1).focus()}else if(!e.shiftKey&&(i<0||i===f.length-1)){e.preventDefault();f[0].focus()}}
  if(e.key==='Escape'&&!d.classList.contains('celebration25')){const close=d.querySelector('.inspectclose,[data-close28],button[onclick="closePackV38()"],button[onclick="stage2Dialog=null;render42()"]');if(close){e.preventDefault();close.click()}}
 },true);
 function enhance(){
  const css=document.querySelector('link[href="stage28.css"]');if(css)document.head.appendChild(css);
  const host=document.querySelector('.wrap,.layout main,.v42-login,.login');
  if(host&&!host.querySelector('.device-notice28')){const notice=document.createElement('p');notice.className='device-notice28';notice.textContent='이 게임은 학교 태블릿에 맞춰 제작되었습니다. 태블릿 또는 더 넓은 화면에서 이용해 주세요.';host.prepend?.(notice)}
  const wide=typeof view!=='undefined'&&['advanced','speedrun','baitrun','matching','revolutionmap'].includes(view);document.body.classList.toggle('wide-game28',!!wide);
  if(wide&&host&&!host.querySelector('.rotate-notice28')){const note=document.createElement('p');note.className='rotate-notice28';note.textContent='더 편한 게임 진행을 위해 기기를 가로로 돌려 주세요.';host.prepend?.(note)}
  for(const x of document.querySelectorAll('.slot.ok,.slot.bad'))if(!x.querySelector('.judge-label28')){const b=document.createElement('span');b.className='judge-label28';b.textContent=x.classList.contains('ok')?'✓ 정답':'↻ 다시 확인';x.append(b)}
  const d=dialog(),key=d?(d.getAttribute('aria-labelledby')||d.getAttribute('aria-label')||d.className):'';
  if(d){const fs=focusables(d),same=key===dialogKey,target=same&&focusedAction?fs.find(x=>x.getAttribute('onclick')===focusedAction):null;if(!d.contains(document.activeElement))(target||fs[0])?.focus({preventScroll:true});}
  else if(dialogKey&&lastOutside){const target=lastOutside.id?document.getElementById(lastOutside.id):Array.from(document.querySelectorAll('button')).find(x=>x.getAttribute('onclick')===lastOutside.action);target?.focus({preventScroll:true});focusedAction='';}
  dialogKey=key;
 }
 g.HistoryUI28={enhance};
})(window);
