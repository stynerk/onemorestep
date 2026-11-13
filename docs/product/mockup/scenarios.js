'use strict';
// Synthetic fixtures only: no real company, program, announcement, or operating advice.
window.MIRINAE_SCENARIOS={
  default:{id:'default',name:'소상공인 AI 서비스 · 기존 예시'},
  autonomy:{
    id:'autonomy',name:'루프오토 · 자율주행 차량 운영 관리 (가상)',
    profile:{
      intro:'루프오토(가상)는 자율주행 차량을 운영하는 사업자에게 배차·관제·정비·운영 이력 관리 소프트웨어를 제공하는 스타트업',
      stage:'법인 설립 · 관제 시제품 보유 · 실증 파트너 탐색 중 · 상용 운영 전',
      goal:'실증 파트너와 운영 검증 범위를 합의하고 첫 파일럿 제안서를 준비하기',
      decision:'완성차·운수 사업자 중 어느 고객군과 먼저 운영 관리 파일럿을 시작할지',
      resources:'관제·데이터 개발 역량은 있으나 실증 차량과 현장 운영 파트너, 안전 검토 체계는 협의 전',
      competitor:'가상 플릿브릿지: 차량 관제·정비 이력 관리 서비스'
    },
    assumptions:{intro:false,stage:false,goal:true,decision:true,resources:false,competitor:true},
    statuses:{company:'preparing'},checks:{company:[true,false,false]},
    workMap:{
      dates:[{id:'auto-date-partner',title:'가상 일정 · 실증 파트너 탐색 미팅',date:'2026-11-18'},{id:'auto-date-proposal',title:'가상 내부 목표 · 파일럿 제안서 검토',date:'2026-11-23'}],
      routines:['매주 공개 실증·협력 기회 확인','매주 잠재 고객 인터뷰 질문과 관제 요구사항 검토','격주 운영 예외 상황과 사람의 승인 절차 점검'],
      topics:['자율주행 실증·운영 협력','차량 관제·배차','정비·운영 이력','운영 예외 대응','경쟁사 제품 변화']
    },
    references:[
      {id:'auto-ref-product',title:'가상 회사 소개 · 루프오토 제품 범위',content:'[가상 테스트 문서]\n고객 후보는 자율주행 차량 운영사와 운수 사업자다. 제품 범위는 차량 상태 확인, 배차 이력, 정비 요청, 운영 보고의 통합 관리다. 자율주행 주행 판단·차량 제어 기술은 협력사 영역으로 가정한다. 실제 고객·계약·운영 실적은 없다.',channel:'paste',type:'company',theme:'all',kind:'fact',url:'',date:'2026. 11. 13.'},
      {id:'auto-ref-history',title:'가상 업무 이력 · 관제 시제품 검토',content:'[가상 테스트 문서]\n관제 시제품에서 차량 상태 목록과 운영 이력 화면을 검토했다. 사람의 개입이 필요한 상황과 정비 요청의 담당·승인 흐름은 미정이다. 이번 검토에서는 ‘시제품 화면 검토’만 마쳤으며 실제 차량 실증이나 안전 검증은 수행하지 않은 것으로 가정한다.',channel:'paste',type:'history',theme:'company',kind:'fact',url:'',date:'2026. 11. 13.'},
      {id:'auto-ref-hypothesis',title:'가상 고객 가설 · 분산된 운영 기록',content:'[가상 검증 전 가설]\n운영 담당자가 관제·정비·배차 기록을 여러 도구에서 확인하느라 인수인계에 어려움을 겪을 수 있다. 통합 이력과 예외 처리 담당자 지정이 도움이 될 수 있다는 가설이며 실제 인터뷰 근거는 없다. 기존 운영 방식과 도입 결정권자부터 확인해야 한다.',channel:'paste',type:'research',theme:'market',kind:'hypothesis',url:'',date:'2026. 11. 13.'}
    ],
    cards:[
      {id:'support',theme:'스타트업 지원',title:'가상 모빌리티 실증 협력 프로그램 검토',description:'서울 지역 실증 파트너와 운영 검증 계획을 제안받는다는 가상 공고다. 실제 모집·지원금·자격을 뜻하지 않는다.',action:'협력 대상과 실증 역할을 대조하고 파일럿 제안서 항목 정리',source:'가상 모빌리티 실증 협력 안내',checks:['가상 프로그램의 협력 대상·지역 조건 대조','운영사·기술사·우리 회사의 역할 구분','파일럿 제안서에 확인 필요 항목 표시'],draftTitle:'실증 협력 제안서 목차'},
      {id:'market',theme:'시장·경쟁사',title:'가상 경쟁사의 정비 이력 통합, 우리 차별점은?',description:'가상 플릿브릿지가 관제 화면에 정비 이력을 통합했다는 테스트 상황이다. 실제 기업 발표가 아니다.',action:'경쟁 기능과 고객의 운영 문제를 나눠 인터뷰 질문 준비',source:'가상 플릿브릿지 제품 업데이트',checks:['가상 발표 기능과 우리 시제품 범위 비교','통합 이력의 필요성은 검증 전 가설로 분리','운영 담당자와 구매 결정권자에게 물을 질문 정리'],draftTitle:'운영사 고객 인터뷰 질문'},
      {id:'company',theme:'우리 회사에 필요한 것',title:'첫 파일럿 전, 운영 예외 대응의 책임부터 정하기',description:'시제품 화면 검토를 마쳤다는 가상 이력을 바탕으로, 미정인 역할·승인·검증 범위를 준비하는 예시다.',action:'운영 예외 상황의 담당자·승인·기록 기준을 협의할 질문 작성',source:'가상 파일럿 준비 검토 메모',checks:['시제품 화면 검토 완료 기록 확인','고객·기술 협력사·우리 팀의 책임과 승인 질문 정리','실제 운영 전 별도 검토할 항목과 파일럿 성공 기준 합의'],draftTitle:'파일럿 사전 협의 질문'}
    ]
  }
};
const scenarioPanel=document.createElement('section');
scenarioPanel.className='company';scenarioPanel.setAttribute('aria-label','테스트 회사 선택');
scenarioPanel.innerHTML='<div class="company-info"><label for="scenario-select" class="company-name">테스트 회사</label><p class="company-description">모든 기업·공고·발표·일정은 가상 데이터입니다. 회사별 저장값을 분리하며, 직접 편집에 따른 제안 재판단은 아직 구현하지 않았습니다.</p></div><select id="scenario-select" aria-label="테스트 회사" style="max-width:100%;min-width:0;padding:10px;border:1px solid var(--line);border-radius:8px;background:white;font-size:12px"><option value="default">소상공인 AI 서비스</option><option value="autonomy">루프오토 · 자율주행 운영 관리</option></select>';
document.querySelector('.company').before(scenarioPanel);
const scenarioSelect=document.querySelector('#scenario-select');
scenarioSelect.value=new URLSearchParams(location.search).get('scenario')==='autonomy'?'autonomy':'default';
scenarioSelect.addEventListener('change',()=>{const url=new URL(location.href);if(scenarioSelect.value==='default')url.searchParams.delete('scenario');else url.searchParams.set('scenario',scenarioSelect.value);location.assign(url.href);});
const scenarioStyle=document.createElement('style');scenarioStyle.textContent='@media(max-width:680px){section[aria-label="테스트 회사 선택"]{display:block}#scenario-select{width:100%;margin-top:10px}}';document.head.append(scenarioStyle);
