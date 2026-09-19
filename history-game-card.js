/* Game cards have their own compact layout. Collection PNG files are never changed. */
(function(global){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function renderHistoryGameCard(ref,options={}){
  const C=HistoryContent,e=C.event(ref.unitId,ref.eventId),f=C.focal(e,'game');
  const variant=options.variant||'full';
  const named=C.event(options.titleUnitId||ref.unitId,options.titleEventId||e.eventId);
  const title=options.displayTitle??named.title;
  const showTitle=variant!=='picture',showImage=variant!=='title';
  // The same neutral bronze frame for all topics and all correct/decoy cards.
  // Header and bottom ornament retain their original shape; image viewport is independent.
  const frame=HistoryCards.frameURL('normal');
  const label=options.ariaLabel||(showTitle?title:'역사 사건 그림');
  const clamp=v=>Math.min(100,Math.max(0,+v||0));
  return `<button type="button" class="history-game-card history-game-card--${esc(variant)}" data-event-id="${esc(e.eventId)}" data-unit-id="${esc(ref.unitId)}" aria-label="${esc(label)}" aria-pressed="false">
   <span class="game-ornament game-ornament--top" aria-hidden="true"><img src="${esc(frame)}" alt="" draggable="false"></span>
   <span class="game-ornament game-ornament--sides" aria-hidden="true"><img src="${esc(frame)}" alt="" draggable="false"></span>
   <span class="game-ornament game-ornament--bottom" aria-hidden="true"><img src="${esc(frame)}" alt="" draggable="false"></span>
   <span class="history-game-card__title">${showTitle?esc(title):'어떤 사건일까요?'}</span>
   ${showImage?`<img class="history-game-card__picture" src="${esc(C.image(e))}" alt="${showTitle?esc(title+' 카드의 그림'):'사건을 보고 답하는 문제 그림'}" style="object-position:${clamp(f.x)}% ${clamp(f.y)}%" draggable="false" decoding="async">`:`<span class="history-game-card__name">${esc(title)}</span>`}
  </button>`;
 }
 global.renderHistoryGameCard=renderHistoryGameCard;
})(window);
