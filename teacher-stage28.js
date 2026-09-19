/* Clear every teacher view on logout/expiry/session replacement. */
let teacherOwner28=API.session?.token||'';
function resetTeacher28(){collectionDraft25=missionDraft25=attendanceDraft25=draft26=null;collectionStamp25=missionStamp25=attendanceStamp25=stamp26='';levelEdit26=0;info=null;ranks=null;created=[];deletePreview=null;cardsView=null;reportData27=reportDetail27=reportSettings27=null;reportOwner27=reportAutoOwner27='';reportSequence27++;reportFilter27={period:'today'};reportPending27=false;tab='overview';}
const teacherRender28=render;render=function(){const owner=API.session?.token||'';if(owner!==teacherOwner28){teacherOwner28=owner;resetTeacher28()}teacherRender28();HistoryUI28.enhance()};
const teacherLogin28=login;login=function(){resetTeacher28();teacherLogin28();HistoryUI28.enhance()};
logout=async function(){resetTeacher28();try{await API.logout()}catch{msg('연결을 확인해 주세요. 이 기기의 로그인 정보는 지웠습니다.')}finally{API.clear();login()}};
addEventListener('history-session-changed',e=>{teacherOwner28=API.session?.token||'';resetTeacher28();if(!e.detail?.authenticated)login()});
