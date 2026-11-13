'use strict';
// One-time, local imports. No OAuth, upload, background sync, or AI extraction.
const knowledge = document.createElement('section');
knowledge.id = 'knowledge-view';
knowledge.hidden = true;
knowledge.innerHTML = `
  <div class="reason"><strong>미리내가 우리 회사에 대해 알고 있는 것</strong><p>회사 설정과 직접 확인한 자료를 함께 보관해요. 자료는 이 브라우저에만 저장되며, 연결한 테마의 상세 화면과 새 초안에 원문 발췌로 표시됩니다.</p><button class="text-button" data-profile>회사 설정 수정 ↗</button></div>
  <div class="model-grid" id="knowledge-profile"></div>
  <section class="below"><div class="section-top"><h2>회사 자료 가져오기</h2><span class="small">선택 → 미리보기 → 확인 후 반영</span></div>
  <div class="import-channels" role="group" aria-label="자료 가져오기 방식">
    <button class="button quiet" data-channel="paste">메모 붙여넣기</button>
    <button class="button secondary" data-channel="file">PC 파일</button>
    <button class="button secondary" data-channel="folder">PC 폴더</button>
    <button class="button secondary" data-channel="drive">Google Drive</button>
    <button class="button secondary" data-channel="notion">Notion</button>
    <button class="button secondary" data-channel="link">웹 링크</button>
  </div><p class="hint">가상 자료나 공개 자료로 체험해 주세요. 파일·폴더는 TXT/MD를 한 번 읽습니다. 드라이브·노션은 링크와 복사한 본문을 받으며 계정 연결·자동 수집은 아직 지원하지 않습니다.</p>
  <input id="knowledge-files" type="file" accept=".txt,.md" multiple hidden aria-label="회사 텍스트 파일 선택">
  <input id="knowledge-folder" type="file" webkitdirectory multiple hidden aria-label="회사 자료 폴더 선택">
  <p id="import-status" class="progress-status" role="status"></p></section>
  <section class="below"><div class="section-top"><h2>확인한 자료와 업무 이력</h2><span class="small" id="knowledge-count"></span></div><div id="knowledge-list"></div></section>`;
$('#tasks-view').after(knowledge);
const importDialog = document.createElement('dialog');
importDialog.id='import-dialog';
importDialog.setAttribute('aria-labelledby','import-title');
importDialog.innerHTML=`<div class="dialog-head"><div><span class="tag">회사 맥락 · 반영 전 확인</span><h2 id="import-title">자료를 확인해 주세요</h2></div><button class="close" data-close aria-label="자료 가져오기 닫기">×</button></div>
<form id="import-form" class="dialog-body"><p class="small" id="import-guide"></p>
<div class="field"><label for="reference-title">자료 제목</label><input id="reference-title" maxlength="120" required></div>
<div class="field"><label for="reference-url">출처 링크 (선택)</label><input id="reference-url" type="url" maxlength="2000" placeholder="https://"></div>
<div class="field"><label for="reference-content">반영할 본문 · 직접 검토하고 수정해 주세요</label><textarea id="reference-content" maxlength="8000" required style="min-height:180px"></textarea></div>
<div class="model-grid"><div class="field"><label for="reference-type">자료 종류</label><select id="reference-type"><option value="company">사업·제품 정보</option><option value="history">업무 이력·지난 활동</option><option value="research">시장·고객 조사</option></select></div>
<div class="field"><label for="reference-kind">내용의 확인 수준</label><select id="reference-kind"><option value="hypothesis">아직 추측 · 검증 전</option><option value="fact">내가 확인한 사실</option></select></div></div>
<div class="field"><label for="reference-theme">함께 볼 테마</label><select id="reference-theme"><option value="all">모든 테마</option><option value="support">스타트업 지원</option><option value="market">시장·경쟁사</option><option value="company">우리 회사에 필요한 것</option></select></div>
<p class="hint">자동 요약이나 사실 판정을 하지 않습니다. 검토한 원문만 반영하며, 새 초안에는 최대 3개 자료의 앞 500자를 덧붙입니다. 기존에 저장한 초안은 덮어쓰지 않습니다.</p>
<div class="dialog-actions"><button type="button" class="button secondary" id="skip-import">이번 자료 건너뛰기</button><button class="button" type="submit">확인하고 반영</button></div></form>`;
document.body.append(importDialog);
const style=document.createElement('style');
style.textContent='.model-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.model-cell{padding:16px;border:1px solid var(--line);background:#fff;border-radius:12px;font-size:13px;line-height:1.8}.model-cell strong{display:block;font-size:11px;color:var(--muted);margin-bottom:6px}.import-channels{display:flex;flex-wrap:wrap;gap:9px}.reference-body{white-space:pre-wrap;margin:10px 0;font-size:13px;line-height:1.8;max-height:200px;overflow:auto}.reference-meta{display:flex;gap:7px;flex-wrap:wrap}.reference-actions{display:flex;gap:14px;align-items:center}.reference-card{padding:20px;border:1px solid var(--line);border-radius:14px;background:#fff;margin-top:12px}.reference-card h3{font-size:16px}.source-link{overflow-wrap:anywhere}.mobile-nav{grid-template-columns:repeat(4,1fr)}@media(max-width:680px){.model-grid{grid-template-columns:1fr}.import-channels .button{flex:1 1 43%;white-space:normal}.section-top{align-items:flex-start}.reference-card{padding:16px}}';
document.head.append(style);
for(const nav of document.querySelectorAll('.navigation,.mobile-nav')){
  const button=document.createElement('button');button.dataset.view='knowledge';
  button.className=nav.classList.contains('navigation')?'nav-button':'';
  button.innerHTML='<span class="nav-symbol" aria-hidden="true">◇</span>회사 자료';nav.append(button);
}
const channelNames={paste:'메모',file:'PC 파일',folder:'PC 폴더',drive:'Google Drive',notion:'Notion',link:'웹 링크'};
const typeNames={company:'사업·제품 정보',history:'업무 이력',research:'시장·고객 조사'};
let pendingImports=[],editingReference=null,importChannel='paste';
function safeReferenceUrl(value){if(!value)return '';try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}}
function cleanReference(item){
  if(!item||typeof item!=='object'||typeof item.id!=='string'||typeof item.content!=='string'||typeof item.title!=='string')return null;
  return {id:item.id.slice(0,100),title:item.title.slice(0,120),content:item.content.slice(0,8000),url:safeReferenceUrl(item.url),channel:channelNames[item.channel]?item.channel:'paste',type:typeNames[item.type]?item.type:'company',theme:['all','support','market','company'].includes(item.theme)?item.theme:'all',kind:item.kind==='fact'?'fact':'hypothesis',date:typeof item.date==='string'?item.date.slice(0,30):''};
}
// Migrate the existing prototype state without dropping its profile or drafts.
const defaultReferences=()=>JSON.parse(JSON.stringify(SCENARIO.references||[])).map(cleanReference).filter(Boolean);
try{const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');state.references=Array.isArray(stored?.references)?stored.references.slice(0,30).map(cleanReference).filter(Boolean):defaultReferences();}catch{state.references=defaultReferences();}
function companyReferences(card){return (state.references||[]).filter(item=>item.theme==='all'||item.theme===card.id);}
const baseDraft=makeDraft;
makeDraft=function(card){const refs=companyReferences(card).slice(0,3);return baseDraft(card)+(refs.length?'\n\n会社資料'.replace('会社資料','회사 자료')+' · 검토할 원문 발췌 (자동 분석 아님)\n'+refs.map(item=>`\n[${item.title} · ${item.kind==='fact'?'내가 확인한 사실':'검증 전'}]\n${item.content.slice(0,500)}\n출처: ${item.url||channelNames[item.channel]}`).join('\n'):'');};
const baseDetail=openDetail;
openDetail=function(id){baseDetail(id);const card=cards.find(item=>item.id===id);if(!card)return;
  const refs=companyReferences(card);const section=document.createElement('section');section.className='detail-section';section.innerHTML='<h3>함께 확인할 회사 자료</h3>'+(refs.length?refs.map(item=>`<details class="detail-source"><summary>${esc(item.title)} · ${item.kind==='fact'?'내가 확인한 사실':'검증 전'}</summary><p class="reference-body">${esc(item.content)}</p>${item.url?`<a class="source-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">원문 링크 ↗</a>`:''}<span>${channelNames[item.channel]} · ${typeNames[item.type]} · ${esc(item.date)}</span></details>`).join(''):'<p class="small">이 테마에 연결한 자료가 없어요. 회사 자료에서 추가해 보세요.</p>');
  $('#detail-body .reason').after(section);
};
window.renderKnowledge=function(){
  knowledge.hidden=view!=='knowledge';
  if(view==='knowledge'){$('#page-title').textContent='우리 회사를 이해하는 자료실';$('#page-subtitle').textContent='회사 정보, 지난 활동과 참고 자료를 한곳에서 확인해요.';$('#breadcrumb-page').textContent='회사 자료';}
  $('#knowledge-profile').innerHTML=fields.map(([key,label])=>`<div class="model-cell"><strong>${esc(label.slice(3))} <span class="tag gray">${state.assumptions[key]?'아직 추측':'확인한 사실로 입력'}</span></strong>${esc(state.profile[key])}</div>`).join('');
  const refs=state.references||[];$('#knowledge-count').textContent=refs.length+'/30개';
  $('#knowledge-list').innerHTML=refs.length?refs.map(item=>`<article class="reference-card"><div class="reference-meta"><span class="tag">${typeNames[item.type]}</span><span class="tag gray">${item.kind==='fact'?'내가 확인한 사실':'검증 전'}</span><span class="small">${channelNames[item.channel]} · ${esc(item.date)} · ${item.theme==='all'?'모든 테마':cards.find(c=>c.id===item.theme).theme}</span></div><h3>${esc(item.title)}</h3><p class="reference-body">${esc(item.content)}</p><div class="reference-actions">${item.url?`<a class="small source-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">원문 열기 ↗</a>`:''}<button class="text-button" data-edit-reference="${esc(item.id)}">수정</button><button class="text-button" data-remove-reference="${esc(item.id)}">삭제</button></div></article>`).join(''):'<div class="empty">아직 반영한 자료가 없어요.<br>회사 소개, 지난 활동 메모나 공개 자료를 가져와 보세요.</div>';
};
function previewReference(item={}){
  editingReference=item.id||null;importChannel=item.channel||importChannel;
  $('#reference-title').value=item.title||'';$('#reference-url').value=item.url||'';$('#reference-content').value=item.content||'';
  $('#reference-type').value=item.type||'company';$('#reference-kind').value=item.kind||'hypothesis';$('#reference-theme').value=item.theme||'all';
  $('#import-title').textContent=editingReference?'자료 수정':'자료 확인 · '+channelNames[importChannel];
  $('#import-guide').textContent=['drive','notion','link'].includes(importChannel)?'원문 링크와 사용할 본문을 붙여넣어 주세요. 링크만으로 본문을 자동으로 읽거나 계정을 연결하지 않습니다.':'검토할 본문만 남겨 주세요. 파일은 외부로 업로드하지 않으며 자동으로 사실을 판정하지 않습니다.';
  $('#skip-import').textContent=pendingImports.length?'건너뛰고 다음 자료':'취소';openDialog(importDialog);
}
function nextImport(){importDialog.close();if(pendingImports.length)previewReference(pendingImports.shift());}
async function readKnowledgeFiles(files,channel){
  const selected=Array.from(files);const available=30-(state.references||[]).length;const accepted=selected.filter(file=>/\.(txt|md)$/i.test(file.name)&&file.size<=32000).slice(0,available);
  $('#import-status').textContent=`${accepted.length}개 미리보기 · ${selected.length-accepted.length}개 제외 (TXT/MD, 파일당 32KB, 전체 30개까지)`;
  if(!accepted.length)return;pendingImports=[];
  for(const file of accepted){try{const content=await file.text();if(content.length>8000||content.includes('\u0000')||content.includes('\uFFFD'))continue;pendingImports.push({title:file.name,content,channel});}catch{/* A failed file is never claimed as imported. */}}
  $('#import-status').textContent=`${pendingImports.length}개를 읽었어요. 반영 전 내용을 하나씩 확인해 주세요. ${accepted.length-pendingImports.length}개는 본문 길이·인코딩·읽기 오류로 제외했어요.`;
  if(pendingImports.length)previewReference(pendingImports.shift());
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.channel){importChannel=button.dataset.channel;pendingImports=[];if(importChannel==='file'){$('#knowledge-files').click();return;}if(importChannel==='folder'){$('#knowledge-folder').click();return;}previewReference();}
  if(button.id==='skip-import')nextImport();
  if(button.dataset.editReference){pendingImports=[];const item=state.references.find(item=>item.id===button.dataset.editReference);if(item)previewReference(item);}
  if(button.dataset.removeReference){state.references=state.references.filter(item=>item.id!==button.dataset.removeReference);save();render();showToast('자료를 삭제했어요. 기존 초안의 발췌는 직접 수정해 주세요.');}
  if(button.id==='confirm-reset'){state.references=defaultReferences();pendingImports=[];save();render();}
});
$('#knowledge-files').addEventListener('change',event=>{readKnowledgeFiles(event.target.files,'file');event.target.value='';});
$('#knowledge-folder').addEventListener('change',event=>{readKnowledgeFiles(event.target.files,'folder');event.target.value='';});
$('#import-form').addEventListener('submit',event=>{
  event.preventDefault();const url=$('#reference-url').value.trim();if(url&&!safeReferenceUrl(url)){showToast('인증 정보가 없는 HTTP/HTTPS 링크를 입력해 주세요.');return;}
  const title=$('#reference-title').value.trim(),content=$('#reference-content').value.trim();if(!title||!content){showToast('제목과 검토한 본문을 입력해 주세요.');return;}
  if(!editingReference&&(state.references||[]).length>=30){showToast('자료는 최대 30개까지 반영할 수 있어요.');return;}
  const item=cleanReference({id:editingReference||crypto.randomUUID(),title,content,url,channel:importChannel,type:$('#reference-type').value,kind:$('#reference-kind').value,theme:$('#reference-theme').value,date:new Date().toLocaleDateString('ko-KR')});
  state.references=state.references||[];if(editingReference)state.references=state.references.map(ref=>ref.id===editingReference?item:ref);else state.references.push(item);
  save();view='knowledge';render();nextImport();showToast('확인한 자료를 반영했어요. 연결한 테마의 상세에서도 볼 수 있어요.');
});
render();
