export const PROJECT_URL='https://mrrvuknoxkpowlqcwahk.supabase.co';
const PREFIX='history-supabase-student-trial-1';
export class TrialClient {
  constructor(){
    this.session=null;
    try {this.session=JSON.parse(sessionStorage.getItem(PREFIX)||localStorage.getItem(PREFIX)||'null');}catch{}
    if(this.session&&Date.parse(this.session.expiresAt)<=Date.now())this.clear();
  }
  remember(data){
    this.session={token:data.token,expiresAt:data.expiresAt,rememberDevice:data.rememberDevice};
    try {sessionStorage.setItem(PREFIX,JSON.stringify(this.session));
      if(data.rememberDevice)localStorage.setItem(PREFIX,JSON.stringify(this.session));else localStorage.removeItem(PREFIX);}catch{}
  }
  clear(){this.session=null;try{sessionStorage.removeItem(PREFIX);localStorage.removeItem(PREFIX);}catch{}}
  invalidateTab(){this.session=null;try{sessionStorage.removeItem(PREFIX);}catch{}}
  async call(action,payload={},token=this.session?.token){
    const start=performance.now();
    let response,body;
    try {
      response=await fetch(`${PROJECT_URL}/functions/v1/history-trial-api`,{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload,token}),
        signal:AbortSignal.timeout(20000)});
      body=await response.json();
    }catch{throw Object.assign(new Error('응답을 확인하지 못했습니다. 같은 작업을 다시 시도해 주세요.'),{code:'CONNECTION_ERROR'});}
    if(!response.ok||!body?.ok){
      if(body?.code==='AUTH_REQUIRED'&&token===this.session?.token)this.clear();
      throw Object.assign(new Error(body?.message||'새 시험용 서버가 아직 준비되지 않았습니다.'),{code:body?.code||'SERVER_ERROR'});
    }
    return {data:body.data,elapsed:Math.round(performance.now()-start)};
  }
}
