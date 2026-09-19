/* Independent history-card renderer. No rewards, account data or server calls. */
(function (global) {
  'use strict';
  const TIERS = [
    {id:'normal', name:'노말', material:'청동 · 황동 · 양피지'},
    {id:'rare', name:'레어', material:'푸른 은빛 금속 · 사파이어'},
    {id:'unique', name:'유니크', material:'보라색 금속 · 자수정'},
    {id:'legend', name:'전설', material:'황금 세공 · 태양 문장'},
    {id:'myth', name:'신화', material:'오팔 · 수정 · 프리즘'}
  ];
  const LIMITS = Object.freeze({title:22, year:12, shortDescription:44, flow:16});
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL = value => {
    const s = String(value || '').trim();
    if (/^(?:javascript|vbscript):/i.test(s) || /[\u0000-\u001f]/.test(s)) throw new Error('허용되지 않는 이미지 주소');
    return esc(s);
  };
  const clamp = v => Math.max(0, Math.min(100, Number.isFinite(+v) ? +v : 50));
  const assetURL = (key, fallback) => (global.HISTORY_CARD_ASSETS || {})[key] || fallback;
  const frameURL = rarity => assetURL('frame-' + rarity, 'assets/frames/' + rarity + '.png');
  function validate(data) {
    for (const key of ['title','year','shortDescription']) {
      if (!String(data[key] ?? '').trim()) throw new Error(key + ' 값이 필요합니다.');
      if (Array.from(String(data[key])).length > LIMITS[key]) throw new Error(key + ': 최대 ' + LIMITS[key] + '자입니다. 내용을 요약해 주세요.');
    }
    for (const key of ['previousEvent','nextEvent']) {
      if (Array.from(String(data[key] || '')).length > LIMITS.flow) throw new Error(key + ': 최대 ' + LIMITS.flow + '자입니다.');
    }
    if (!data.image) throw new Error('사건 그림이 필요합니다.');
    return data;
  }
  function renderHistoryCard(input, options = {}) {
    const data = validate(input);
    const tier = TIERS.find(t => t.id === (options.rarity || data.rarity || 'normal'));
    if (!tier) throw new Error('지원하는 등급: normal, rare, unique, legend, myth');
    const mode = ['list','detail','reveal'].includes(options.mode) ? options.mode : 'list';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(data.firstAcquiredAt || '') ? data.firstAcquiredAt : '';
    const count = Math.max(0, Math.trunc(Number(data.ownedCount) || 0));
    const chapters = Array.isArray(data.detailedDescription) ? data.detailedDescription : [{heading:'사건 해설', text:data.detailedDescription || ''}];
    const effects = ['legend','myth'].includes(tier.id) ? '<div class="history-card__fx" aria-hidden="true">' + '<i></i>'.repeat(8) + (tier.id === 'myth' ? '<span class="history-card__prism"></span>' : '') + '</div>' : '';
    const foil = tier.id === 'myth' ? '<div class="history-card__foil" aria-hidden="true"></div>' : '';
    const frame = '<img class="history-card__frame" src="' + safeURL(frameURL(tier.id)) + '" alt="" draggable="false" decoding="async">';
    const title = '<h3 class="history-card__title' + (Array.from(data.title).length > 11 ? ' history-card__title--two-lines' : '') + '">' + esc(data.title) + '</h3>';
    return `<article class="history-card history-card--${mode}" data-rarity="${tier.id}" data-event-id="${esc(data.eventId)}" tabindex="0" aria-label="${esc(data.title)} · ${tier.name} · 앞면. Enter 키로 뒤집기">
      ${effects}<div class="history-card__rotator">
        <section class="history-card__face history-card__front" aria-hidden="false">
          <img class="history-card__picture" src="${safeURL(data.image)}" alt="${esc(data.imageAlt || data.title + ' 학습용 재구성 그림')}" style="object-position:${clamp(data.focalX)}% ${clamp(data.focalY)}%" draggable="false" decoding="async">
          ${frame}${foil}${title}
          <div class="history-card__year">${esc(data.year)}</div>
          <p class="history-card__summary">${esc(data.shortDescription)}</p>
          <div class="history-card__meta"><span>${tier.name}</span><time ${date ? 'datetime="' + date + '"' : ''}>${date ? '최초 획득 ' + date.replaceAll('-','.') : '최초 획득일 미기록'}</time><span>보유 ${count}장</span></div>
        </section>
        <section class="history-card__face history-card__back" aria-hidden="true" inert>
          <div class="history-card__back-paper"></div>${frame}${foil}${title}
          <div class="history-card__detail" tabindex="0" role="region" aria-label="사건 상세 설명, 길면 스크롤">
            ${chapters.map(c => '<h4>' + esc(c.heading) + '</h4><p>' + esc(c.text) + '</p>').join('')}
          </div>
          <div class="history-card__year">${esc(data.year)}</div>
          <div class="history-card__flow"><div><small>이전 사건</small>${esc(data.previousEvent || '이전 사건 없음')}</div><span aria-hidden="true">→</span><div><small>다음 사건</small>${esc(data.nextEvent || '다음 사건 없음')}</div></div>
          <p class="history-card__back-hint">상세 설명은 위아래로 스크롤할 수 있습니다.</p>
        </section>
      </div>
    </article>`;
  }
  function flipHistoryCard(card, showBack) {
    const back = showBack === undefined ? !card.classList.contains('is-back') : !!showBack;
    if (card.contains(document.activeElement) && document.activeElement !== card) card.focus({preventScroll:true});
    card.classList.toggle('is-back', back);
    for (const [selector, inactive] of [['.history-card__front',back],['.history-card__back',!back]]) {
      const face = card.querySelector(selector);
      face.inert = inactive;
      face.setAttribute('aria-hidden', String(inactive));
    }
    card.setAttribute('aria-label', card.querySelector('h3').textContent + ' · ' + (back ? '뒷면' : '앞면') + '. Enter 키로 뒤집기');
    card.dispatchEvent(new CustomEvent('historycardflip', {bubbles:true, detail:{back}}));
    return back;
  }
  const initialized = new WeakSet();
  function mountHistoryCards(root = document) {
    const cards = root.matches?.('.history-card') ? [root] : root.querySelectorAll('.history-card');
    for (const card of cards) {
      if (initialized.has(card)) continue;
      initialized.add(card);
      let down = null;
      card.addEventListener('pointerdown', e => {down = {x:e.clientX,y:e.clientY};});
      card.addEventListener('click', e => {
        if (e.target.closest('.history-card__detail')) return;
        if (down && Math.hypot(e.clientX-down.x,e.clientY-down.y)>10) return;
        flipHistoryCard(card);
      });
      card.addEventListener('keydown', e => {
        if (e.target === card && ['Enter',' '].includes(e.key)) {e.preventDefault(); flipHistoryCard(card);}
      });
    }
  }
  function auditHistoryCards(root = document) {
    const issues = [];
    for (const el of root.querySelectorAll('.history-card__title,.history-card__summary,.history-card__year,.history-card__meta')) {
      if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) issues.push({eventId:el.closest('.history-card').dataset.eventId,field:el.className});
    }
    return issues;
  }
  global.HistoryCards = {TIERS,LIMITS,assetURL,frameURL,renderHistoryCard,flipHistoryCard,mountHistoryCards,auditHistoryCards};
  global.renderHistoryCard = renderHistoryCard;
})(window);
