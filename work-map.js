'use strict';
// The work map shares profile and preparation state with the existing prototype.
const mapDefaults=()=>({dates:[],routines:['매주 고객 가설과 인터뷰 질문 검토'],topics:['스타트업 지원','시장·경쟁사','고객 검증']});
function loadWorkMap(){
  const clean=mapDefaults();
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')?.workMap;
    if(!raw||typeof raw!=='object')return clean;
    for(const key of ['routines','topics'])if(Array.isArray(raw[key]))clean[key]=raw[key].filter(item=>typeof item==='string'&&item.trim()).slice(0,12).map(item=>item.slice(0,180));
    if(Array.isArray(raw.dates))clean.dates=raw.dates.filter(item=>item&&typeof item.id==='string'&&typeof item.title==='string'&&validMapDate(item.date)).slice(0,20).map(item=>({id:item.id.slice(0,100),title:item.title.slice(0,120),date:item.date}));
  }catch{/* Invalid or unavailable storage falls back to the fictional example. */}
  return clean;
}
function validMapDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const parsed=new Date(value+'T12:00:00');return !Number.isNaN(parsed.getTime())&&parsed.getFullYear()===Number(value.slice(0,4))&&parsed.getMonth()+1===Number(value.slice(5,7))&&parsed.getDate()===Number(value.slice(8,10));
}
state.workMap=loadWorkMap();
const mapView=document.createElement('section');mapView.id='work-map-view';mapView.hidden=true;
mapView.innerHTML=`<div class="map-intro"><span class="tag">회사 맥락 · 내가 확인하고 수정하는 지도</span><p class="small">목표와 단계, 일정과 반복 업무를 함께 살펴봐요. 처음 표시된 내용은 가상 예시입니다.</p></div>
<div class="map-layout"><div class="map-main">
  <div class="map-two"><section class="map-panel"><div class="section-top"><h2>지금의 목표</h2><span class="tag gray" id="map-goal-kind"></span></div><p id="map-goal"></p></section><section class="map-panel"><div class="section-top"><h2>현재 단계</h2><button class="text-button" data-profile>회사 설정 ↗</button></div><p id="map-stage"></p></section></div>
  <section class="map-panel"><div class="section-top"><h2>주요 일정과 마감</h2><span class="small">직접 등록한 일정</span></div><div id="map-dates"></div>
    <form id="map-date-form" class="map-date-form"><div class="field"><label for="map-date-title">할 일 · 일정 이름</label><input id="map-date-title" maxlength="120" placeholder="예: 공개 지원 공고 자격 확인" required></div><div class="field"><label for="map-date-value">날짜</label><input type="date" id="map-date-value" required></div><button type="submit" class="button quiet">일정 추가</button></form><p class="hint">자동 알림·캘린더 연동은 실행되지 않습니다.</p></section>
  <section class="map-panel"><div class="section-top"><h2>반복해서 챙길 일</h2><span class="tag gray">가상 예시 · 직접 편집</span></div><div id="map-routines"></div></section>
  <section class="map-panel"><div class="section-top"><h2>지켜볼 주제</h2><button class="text-button" data-view="home">브리핑 보기 ↗</button></div><div id="map-topics" class="map-chips"></div><p class="hint">관심 주제는 현재 지도에만 기록됩니다. 실제 검색 조건이나 추천은 자동 변경되지 않습니다.</p></section>
  <section class="map-panel"><div class="section-top"><h2>지도에서 이어가는 준비</h2><button class="text-button" data-view="tasks">모두 보기 ↗</button></div><div id="map-preparations"></div><div class="map-context"><p class="small" id="map-context-summary"></p><button class="text-button" data-view="knowledge">회사 자료와 업무 이력 보기 ↗</button></div></section>
</div><aside class="map-panel map-editor" aria-label="업무 지도 수정"><span class="tag">직접 수정</span><h2>지금 달라진 것이 있나요?</h2><p class="small">항목을 골라 고친 뒤 저장해 주세요. 목표·단계·고민·자원은 회사 설정과 함께 바뀝니다.</p>
  <form id="map-edit-form"><div class="field"><label for="map-edit-key">바꿀 항목</label><select id="map-edit-key"><option value="goal">지금의 목표</option><option value="stage">현재 단계</option><option value="decision">지금 고민하는 결정</option><option value="resources">자원과 제약</option><option value="routines">반복해서 챙길 일</option><option value="topics">지켜볼 주제</option></select></div><div class="field"><label for="map-edit-value">수정할 내용</label><textarea id="map-edit-value" maxlength="300" required></textarea></div><div class="field" id="map-kind-field"><label for="map-edit-kind">내용의 확인 수준</label><select id="map-edit-kind"><option value="fact">내가 확인한 사실</option><option value="hypothesis">아직 추측</option></select></div><p class="hint" id="map-edit-hint"></p><button type="submit" class="button">지도에 반영</button></form><p class="hint">대화형 AI 수정이 아닌 직접 편집입니다. 입력은 이 브라우저에만 저장됩니다.</p>
</aside></div>`;
$('#knowledge-view').after(mapView);
const mapStyle=document.createElement('style');
mapStyle.textContent='.map-intro{display:flex;align-items:center;gap:12px;margin-bottom:22px;flex-wrap:wrap}.map-layout{display:grid;grid-template-columns:minmax(0,1fr) 285px;gap:20px;align-items:start}.map-main{display:grid;gap:18px;min-width:0}.map-two{display:grid;grid-template-columns:1fr 1fr;gap:18px}.map-panel{padding:22px;border:1px solid var(--line);border-radius:var(--radius);background:#fff;min-width:0}.map-panel h2{font-size:16px}.map-panel p{font-size:13px;line-height:1.85}.map-panel .section-top{margin-bottom:12px}.map-editor{position:sticky;top:20px}.map-editor h2{margin:12px 0}.map-editor .button{margin-top:12px;width:100%}.map-editor textarea{min-height:130px}.map-date-form{display:grid;grid-template-columns:minmax(0,1fr) 145px auto;gap:10px;align-items:end;margin-top:18px}.map-date-form .field{margin:0}.map-date-form .field label{font-size:11px}.map-date-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);font-size:12px}.map-date-row>div{flex:1;min-width:0}.map-date-row strong{display:block;margin-bottom:4px}.map-list-item{padding:10px 0;border-bottom:1px solid var(--line);font-size:13px;line-height:1.8}.map-chips{display:flex;gap:8px;flex-wrap:wrap}.map-chips .tag{font-size:12px;padding:9px 12px}.map-context{border-top:1px solid var(--line);margin-top:16px;padding-top:15px}.map-context .text-button{padding-left:0}.mobile-nav{grid-template-columns:repeat(5,1fr)}@media(max-width:1100px){.map-layout{grid-template-columns:1fr}.map-editor{position:static}.map-date-form{grid-template-columns:minmax(0,1fr) 145px}.map-date-form .button{grid-column:1/-1}}@media(max-width:680px){.map-two{grid-template-columns:1fr;gap:14px}.map-panel{padding:18px}.map-layout{gap:16px}.map-date-form{grid-template-columns:1fr}.map-date-form .button{grid-column:auto}.map-date-row{gap:8px}.map-date-row .text-button{padding-left:0}.map-intro{margin-bottom:17px}}';
document.head.append(mapStyle);
for(const nav of document.querySelectorAll('.navigation,.mobile-nav')){
  const button=document.createElement('button');button.dataset.view='map';button.className=nav.classList.contains('navigation')?'nav-button':'';
  button.innerHTML='<span class="nav-symbol" aria-hidden="true">▦</span>'+(nav.classList.contains('navigation')?'내 업무 지도':'업무 지도');
  nav.insertBefore(button,nav.querySelector('[data-view="tasks"]'));
}
const previousKnowledgeRender=window.renderKnowledge;
window.renderKnowledge=function(){previousKnowledgeRender();renderWorkMap();};
function dateDistance(value){
  const now=new Date();const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());const [y,m,d]=value.split('-').map(Number);const diff=Math.round((Date.UTC(y,m-1,d)-today)/86400000);
  return diff===0?'오늘':diff>0?'D−'+diff:Math.abs(diff)+'일 지남';
}
function renderWorkMap(){
  mapView.hidden=view!=='map';const data=state.workMap||mapDefaults();
  if(view==='map'){$('#page-title').textContent='내 업무 지도';$('#page-subtitle').textContent='지금의 목표에서 다음 행동까지, 우리 일의 맥락을 한눈에 봐요.';$('#breadcrumb-page').textContent='내 업무 지도';}
  $('#map-goal').textContent=state.profile.goal;$('#map-stage').textContent=state.profile.stage;$('#map-goal-kind').textContent=state.assumptions.goal?'아직 추측':'확인한 사실로 입력';
  $('#map-dates').innerHTML=data.dates.length?[...data.dates].sort((a,b)=>a.date.localeCompare(b.date)).map(item=>`<div class="map-date-row"><div><strong>${esc(item.title)}</strong><time datetime="${esc(item.date)}">${esc(item.date)}</time></div><span class="tag gray">${dateDistance(item.date)}</span><button class="text-button" data-delete-map-date="${esc(item.id)}" aria-label="${esc(item.title)} 일정 삭제">삭제</button></div>`).join(''):'<p class="small">등록한 일정이 없어요. 날짜가 정해진 다음 행동을 추가해 보세요.</p>';
  $('#map-routines').innerHTML=data.routines.length?data.routines.map(item=>`<div class="map-list-item">↻ ${esc(item)}</div>`).join(''):'<p class="small">등록한 반복 업무가 없어요.</p>';
  $('#map-topics').innerHTML=data.topics.length?data.topics.map(item=>`<span class="tag">${esc(item)}</span>`).join(''):'<p class="small">지켜볼 주제를 추가해 보세요.</p>';
  const preparing=cards.filter(card=>state.statuses[card.id]==='preparing');
  $('#map-preparations').innerHTML=preparing.length?preparing.map(card=>`<div class="map-date-row"><div><strong>${esc(card.title)}</strong><span class="small">체크리스트 ${(state.checks[card.id]||[]).filter(Boolean).length}/3</span></div><button class="button secondary" data-open="${card.id}">이어서 보기</button></div>`).join(''):'<p class="small">아직 시작한 준비가 없어요. 브리핑에서 기회를 검토하고 준비를 시작해 보세요.</p>';
  $('#map-context-summary').textContent='함께 참고할 회사 자료 '+(state.references||[]).length+'개 · 지금 고민: '+state.profile.decision;
}
function fillMapEditor(){
  const key=$('#map-edit-key').value;const list=['routines','topics'].includes(key);const data=state.workMap||mapDefaults();
  $('#map-edit-value').value=list?data[key].join('\n'):state.profile[key];$('#map-edit-value').maxLength=list?2160:300;$('#map-kind-field').hidden=list;
  $('#map-edit-kind').value=state.assumptions[key]?'hypothesis':'fact';$('#map-edit-value').required=!list;
  $('#map-edit-hint').textContent=list?'한 줄에 한 항목씩, 최대 12개·항목당 180자입니다. 비워서 저장하면 목록을 지웁니다.':'회사 설정과 같은 항목입니다. 수정하면 브리핑의 연결 정보와 새 템플릿에도 반영됩니다.';
}
$('#map-edit-key').addEventListener('change',fillMapEditor);
$('#map-edit-form').addEventListener('submit',event=>{
  event.preventDefault();const key=$('#map-edit-key').value;const value=$('#map-edit-value').value.trim();
  if(['routines','topics'].includes(key)){
    const lines=value.split(/\r?\n/).map(item=>item.trim()).filter(Boolean);
    if(lines.length>12||lines.some(item=>item.length>180)){showToast('목록은 최대 12개, 항목당 180자까지 입력해 주세요.');return;}
    state.workMap=state.workMap||mapDefaults();state.workMap[key]=lines;
  }else{if(!['goal','stage','decision','resources'].includes(key)||!value)return;state.profile[key]=value.slice(0,300);state.assumptions[key]=$('#map-edit-kind').value==='hypothesis';}
  save();render();showToast('업무 지도에 반영했어요.');
});
$('#map-date-form').addEventListener('submit',event=>{
  event.preventDefault();const title=$('#map-date-title').value.trim();const date=$('#map-date-value').value;
  if(!title||!validMapDate(date)){showToast('일정 이름과 올바른 날짜를 입력해 주세요.');return;}
  state.workMap=state.workMap||mapDefaults();if(state.workMap.dates.length>=20){showToast('일정은 최대 20개까지 추가할 수 있어요.');return;}
  state.workMap.dates.push({id:crypto.randomUUID(),title:title.slice(0,120),date});save();event.currentTarget.reset();render();showToast('일정을 추가했어요.');
});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.view==='map')fillMapEditor();
  if(button.dataset.deleteMapDate){state.workMap.dates=state.workMap.dates.filter(item=>item.id!==button.dataset.deleteMapDate);save();render();showToast('일정을 삭제했어요.');}
  if(button.id==='confirm-reset'){state.workMap=mapDefaults();save();render();fillMapEditor();}
});
render();fillMapEditor();
