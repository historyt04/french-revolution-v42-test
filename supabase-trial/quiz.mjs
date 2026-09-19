// Pure local state machine. Server replays the same ordered transcript at completion.
export const normalizeAnswer=value=>String(value).normalize('NFKC').replace(/[\s·ㆍ.,!?()（）-]/gu,'').toLowerCase();
export const hintFor=label=>{const chars=[...label.replace(/\s/g,'')];return chars[0]+'○'.repeat(Math.max(0,chars.length-1));};
export function createQuiz(questions){
  return {questions,original:questions.map(q=>q.id),sequence:questions.map(q=>q.id),position:0,
    tries:0,round:0,passed:[],submissions:[],feedback:null,advance:false,done:false};
}
export function currentQuestion(s){return s.questions.find(q=>q.id===s.sequence[s.position]);}
export function submitAnswer(s,value){
  if(s.done||s.advance)return false;
  const answer=String(value).trim(),q=currentQuestion(s);
  if(!q||!normalizeAnswer(answer)||answer.length>150)return false;
  const ok=q.answers.some(a=>normalizeAnswer(a)===normalizeAnswer(answer));
  s.submissions.push({questionId:q.id,answer});s.tries++;
  if(ok)s.passed.push(q.id);
  s.feedback={ok,text:ok?'정답입니다.':s.tries===2?`정답: ${q.label} — 마지막에 다시 풀어요.`:'다시 생각해 보세요.'};
  s.advance=ok||s.tries===2;
  return true;
}
export function nextQuestion(s){
  if(!s.advance)return false;
  s.position++;s.tries=0;s.feedback=null;s.advance=false;
  if(s.position>=s.sequence.length){
    s.sequence=s.original.filter(id=>!s.passed.includes(id));s.position=0;s.round++;
    s.done=s.sequence.length===0;
  }
  return true;
}
