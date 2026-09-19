// Text adapted from the existing HistoryLearningContent26 bank. Isolated local practice:
// no API requests, wallet writes, official rankings or claims of server completion.
export const events=[
  ['FR-01','삼부회 소집','1789. 5. 5.',0,'국왕이 재정 위기를 해결하려 세 신분의 대표를 소집했다.','신분별 표결에 반발한 제3신분이 별도 의회를 구성했다.'],
  ['FR-02','국민의회 결성','1789. 6. 17.',0,'삼부회의 제3신분 대표들이 신분별 표결에 반발했다.','국민을 대표한다고 선언하고 헌법 제정을 추진했다.'],
  ['FR-03','테니스 코트의 서약','1789. 6. 20.',0,'국민의회 의원들이 기존 회의장에 들어가지 못했다.','헌법을 제정할 때까지 해산하지 않겠다고 결의했다.'],
  ['FR-04','바스티유 감옥 습격','1789. 7. 14.',0,'국왕의 무력 탄압을 우려한 파리 시민들이 무기를 구했다.','시민의 봉기가 혁명을 확산시키는 계기가 되었다.'],
  ['FR-05','인간과 시민의 권리 선언','1789. 8. 26.',1,'신분제와 특권에 맞서 자유와 평등의 원칙을 세우려 했다.','자유·법 앞의 평등·국민 주권을 혁명의 원칙으로 제시했다.'],
  ['FR-06','루이 16세의 탈출 실패','1791. 6.',1,'혁명에 반대한 국왕이 왕비와 함께 국외 도피를 시도했다.','도피 중 붙잡히면서 국왕에 대한 불신이 더욱 커졌다.'],
  ['FR-07','국민공회와 공화정 수립','1792. 9.',2,'왕정이 무너진 뒤 새로운 대표 의회가 들어섰다.','국민공회가 왕정을 폐지하고 공화정을 선포했다.'],
  ['FR-08','루이 16세 처형','1793. 1. 21.',2,'국민공회가 국왕을 재판하고 사형을 결정했다.','국왕이 처형되면서 왕정과의 단절이 뚜렷해졌다.'],
  ['FR-09','로베스피에르의 공포 정치','1793~1794',2,'대외 전쟁과 국내 반혁명의 위기로 급진파가 통제를 강화했다.','반대 세력 처벌이 확대되고 통치에 대한 반발도 커졌다.'],
  ['FR-10','로베스피에르 체포와 처형','1794. 7.',2,'공포 정치와 로베스피에르에 대한 반발이 커졌다.','공포 정치가 끝나고 이후 총재정부로 이어졌다.'],
  ['FR-11','총재정부 수립','1795',3,'로베스피에르 몰락 이후 새 헌법으로 권력을 분산했다.','정치·경제 혼란 속에서 군대의 영향력이 커졌다.'],
  ['FR-12','나폴레옹의 쿠데타와 집권','1799. 11.',3,'총재정부의 혼란 속에서 나폴레옹이 군대를 기반으로 쿠데타를 일으켰다.','총재정부가 무너지고 통령정부가 들어섰다.'],
].map(([id,title,date,zone,cause,effect])=>({id,title,date,zone,cause,effect}));
export const zones=[
  {title:'혁명의 시작',period:'1789년 5~7월',note:'삼부회에서 시민 봉기까지'},
  {title:'입헌군주제로 가는 길',period:'1789년 8월~1792년 8월',note:'인권 선언과 왕권 제한 · 헌법 시행 1791년'},
  {title:'공화정과 공포 정치',period:'1792년 9월~1794년',note:'국민공회와 급진 정치'},
  {title:'총재정부와 나폴레옹',period:'1795~1799년',note:'총재정부에서 쿠데타까지'},
];
export function shuffle(items,random=Math.random){
  const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;
}
export function createConnections(){
  return {kind:'connections',sequence:shuffle(events),offset:0,choices:{},solved:[],feedback:'',options:null};
}
export function connectionRound(s){
  const current=s.sequence.slice(s.offset,s.offset+3);
  if(!s.options)s.options=shuffle(current);
  return current;
}
export function checkConnections(s){
  const rows=connectionRound(s),missing=rows.some(e=>!s.choices[e.id]);
  if(missing){s.feedback='양옆 설명을 읽고 가운데 사건을 모두 선택하세요.';return false;}
  for(const e of rows)if(s.choices[e.id]===e.id&&!s.solved.includes(e.id))s.solved.push(e.id);
  s.feedback=rows.every(e=>s.solved.includes(e.id))?'세 사건의 연결을 모두 찾았습니다!':'맞은 연결은 유지됩니다. 아직 맞지 않은 사건을 다시 살펴보세요.';
  return rows.every(e=>s.solved.includes(e.id));
}
export function nextConnections(s){
  if(!connectionRound(s).every(e=>s.solved.includes(e.id)))return false;
  s.offset+=3;s.options=null;s.feedback='';return true;
}
export function createMemory(){return {kind:'memory',phase:'ready',order:shuffle(events),selected:null,placed:{},feedback:'',hints:0,visibleUntil:0,checked:false};}
export function beginMemory(s,now=Date.now()){s.phase='memorize';s.visibleUntil=now+5000;}
export function tickMemory(s,now=Date.now()){
  if(s.phase==='memorize'&&now>=s.visibleUntil){s.phase='play';return true;}return false;
}
export function memoryHint(s,now=Date.now()){
  if(s.phase!=='play'||now<s.visibleUntil)return false;
  s.hints++;s.visibleUntil=now+3000;return true;
}
export function placeMemory(s,zone){
  if(s.phase!=='play'||!s.selected||!Number.isInteger(zone)||zone<0||zone>3)return false;
  s.placed[s.selected]=zone;s.selected=null;s.checked=false;s.feedback='';return true;
}
export function checkMemory(s){
  if(s.phase!=='play')return false;
  s.checked=true;const correct=events.filter(e=>s.placed[e.id]===e.zone).length;
  if(correct===events.length){s.phase='done';s.feedback='12개 사건을 모두 올바른 시기에 배치했습니다!';return true;}
  s.feedback=`${correct}/12개가 맞았습니다. 테두리가 붉은 카드를 선택해 다른 시기로 옮겨 보세요.`;return false;
}
