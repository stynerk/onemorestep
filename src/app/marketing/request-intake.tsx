import { useState, type FormEvent } from "react";
import {
  demoDate, isMarketingIntake, marketingDealSizes, marketingRegions, products, requestTypes, salesRequesters,
  type MarketingIntake,
} from "../../lib/marketing/workflow";

type LeadOption = { id: string; institution: string; region: MarketingIntake["region"] | null; stage: MarketingIntake["stage"] };
const emptyFields = { requester: "", type: "", product: "", region: "", deadline: "", dealSize: "", memo: "", leadId: "" };

function Choice({ label, value, options, change, disabled }: {
  label: string; value: string; options: readonly string[]; change: (value: string) => void; disabled?: boolean;
}) {
  return <label>{label}
    <select aria-label={label} value={value} required disabled={disabled} onChange={event => change(event.currentTarget.value)}>
      <option value="">선택</option>
      {options.map(option => <option key={option}>{option}</option>)}
    </select>
  </label>;
}

export function RequestIntake({ leads, submit, cancel }: {
  leads: readonly LeadOption[]; submit: (intake: MarketingIntake) => void; cancel: () => void;
}) {
  const [fields, setFields] = useState(emptyFields);
  const lead = leads.find(option => option.id === fields.leadId);
  const intake = { ...fields, leadId: lead?.id ?? "", region: lead?.region ?? fields.region,
    stage: lead?.stage ?? "없음", regionFromLead: Boolean(lead?.region) };
  const change = (field: keyof typeof emptyFields) => (value: string) => setFields(previous => ({ ...previous, [field]: value }));

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isMarketingIntake(intake)) submit(intake);
  }

  return <section className="marketing-card marketing-intake" aria-labelledby="marketing-request-intake">
    <div className="marketing-section-head"><h2 id="marketing-request-intake">마케팅 요청 접수</h2><span>시연 기준일 {demoDate}</span></div>
    <form className="marketing-intake-form" onSubmit={save}>
      <Choice label="요청자" value={fields.requester} options={salesRequesters} change={change("requester")} />
      <Choice label="요청 유형" value={fields.type} options={requestTypes} change={change("type")} />
      <Choice label="상품" value={fields.product} options={products} change={change("product")} />
      <label>연결 리드
        <select aria-label="연결 리드" value={intake.leadId} onChange={event => change("leadId")(event.currentTarget.value)}>
          <option value="">연결하지 않음</option>
          {leads.map(option => <option key={option.id} value={option.id}>{option.id} · {option.institution || "기관 미기재"}</option>)}
        </select>
      </label>
      <div>
        <Choice label="지역" value={intake.region} options={marketingRegions} change={change("region")} disabled={Boolean(lead?.region)} />
        {lead?.region && <span className="marketing-field-source">문의함 기록</span>}
      </div>
      <div className="marketing-intake-stage">
        <span>딜 단계</span><output aria-label="딜 단계">{intake.stage}</output>
        {lead && <span className="marketing-field-source">문의함 기록</span>}
      </div>
      <label>마감일 <input type="date" value={fields.deadline} required onChange={event => change("deadline")(event.currentTarget.value)} /></label>
      <Choice label="딜 규모" value={fields.dealSize} options={marketingDealSizes} change={change("dealSize")} />
      <label className="marketing-intake-memo">메모
        <textarea value={fields.memo} required maxLength={400} rows={2} onChange={event => change("memo")(event.currentTarget.value)} />
      </label>
      <div className="marketing-actions marketing-intake-actions">
        <button type="button" className="button button-light" onClick={cancel}>닫기</button>
        <button type="submit" className="button button-primary" disabled={!isMarketingIntake(intake)}>접수하기</button>
      </div>
    </form>
  </section>;
}
