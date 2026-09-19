// Isolated student trial. One database round-trip per action, no browser service key.
const VERSION = 'student-trial-1';
const origins = new Set(['https://historyt04.github.io','http://localhost:8000','http://127.0.0.1:8000']);
const messages: Record<string,string> = {
  AUTH_REQUIRED:'로그인이 만료되었습니다. 다시 로그인해 주세요.',
  INVALID_INPUT:'입력 내용을 확인해 주세요.',
  REQUEST_CONFLICT:'다른 작업에 사용된 요청 번호입니다. 화면을 새로고침해 주세요.',
  UNKNOWN_ACTION:'시험판에서 지원하지 않는 요청입니다.',
  UNKNOWN_GAME:'이번 시험판은 초급 게임부터 지원합니다.',
  RATE_LIMITED:'요청이 많습니다. 잠시 뒤 다시 시도해 주세요.',
  ATTEMPT_NOT_FOUND:'본인의 게임 기록을 찾지 못했습니다.',
  ATTEMPT_NOT_ACTIVE:'이미 중단한 게임입니다. 새로 시작해 주세요.',
  ATTEMPT_EXPIRED:'시작한 지 하루가 지나 새 게임을 시작해야 합니다.',
  TOO_FAST:'아직 완료를 확인할 수 없습니다. 잠시 뒤 같은 완료 저장을 다시 눌러 주세요.',
  INVALID_SUBMISSIONS:'답안 순서나 형식이 맞지 않습니다. 완료 기록은 저장하지 않았습니다.',
  INCOMPLETE_QUIZ:'아직 정답을 맞히지 않은 문제가 있습니다.',
  PACK_EMPTY:'열 수 있는 시험용 카드팩이 없습니다.',
  CONTENT_NOT_READY:'시험 문제 준비가 완료되지 않았습니다.',
};

Deno.serve(async (req: Request) => {
  const origin=req.headers.get('Origin');
  const headers={'Access-Control-Allow-Origin':origin&&origins.has(origin)?origin:'https://historyt04.github.io',
    'Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info',
    'Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store',
    'Content-Type':'application/json; charset=utf-8'};
  const reply=(body: unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.has(origin))return reply({ok:false,code:'ORIGIN_DENIED',message:'허용되지 않은 주소입니다.'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  try {
    // Read at most 256 KiB even when Content-Length is absent or forged.
    const reader=req.body?.getReader();
    if(!reader)return reply({ok:false,code:'INVALID_INPUT'},400);
    let size=0; const chunks: Uint8Array[]=[];
    for (;;) {const {done,value}=await reader.read();if(done)break;size+=value.length;
      if(size>262144){await reader.cancel();return reply({ok:false,code:'BODY_TOO_LARGE',message:'요청이 너무 큽니다.'},413);}chunks.push(value);}
    const raw=new Uint8Array(size);let offset=0;for(const c of chunks){raw.set(c,offset);offset+=c.length;}
    let body;
    try {body=JSON.parse(new TextDecoder().decode(raw));}catch{return reply({ok:false,code:'INVALID_INPUT'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.action!=='string'||
      (body.payload!==undefined&&(!body.payload||Array.isArray(body.payload)||typeof body.payload!=='object'))||
      (body.token!==undefined&&(typeof body.token!=='string'||body.token.length>200)))return reply({ok:false,code:'INVALID_INPUT'},400);
    const url=Deno.env.get('SUPABASE_URL');
    const key=Deno.env.get('HISTORY_SERVICE_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!key)return reply({ok:false,code:'CONFIG_REQUIRED',message:'서버 설정이 필요합니다.'},503);
    const result=await fetch(`${url}/rest/v1/rpc/trial_api`,{method:'POST',
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_action:body.action,p_payload:body.payload??{},p_token:body.token??''}),
      signal:AbortSignal.timeout(15000)});
    const data=await result.json();
    if(!result.ok){
      const code=typeof data.message==='string'&&Object.hasOwn(messages,data.message)?data.message:'SERVER_ERROR';
      // No request payloads, answers, codes or session tokens in logs.
      console.error(VERSION,body.action,data.code,code);
      return reply({ok:false,code,message:messages[code]??'서버 처리에 실패했습니다. 같은 작업을 다시 시도해 주세요.'},
        code==='AUTH_REQUIRED'?401:code==='RATE_LIMITED'?429:code==='SERVER_ERROR'?500:400);
    }
    return reply(data,data.ok?200:data.code==='RATE_LIMITED'?429:401);
  }catch(e){
    console.error(VERSION,e instanceof Error?e.name:'unknown');
    return reply({ok:false,code:'CONNECTION_ERROR',message:'응답을 확인하지 못했습니다. 같은 요청으로 다시 시도해 주세요.'},503);
  }
});
