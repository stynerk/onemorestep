import { useId, useState } from "react";
import { getDirectionQuestion, getRecordedDirectionWording, type DirectionChoice, type DirectionKind } from "../../lib/forwarding/direction-questions";
import { locales } from "../../lib/forwarding/institution-policy";
import type { Assessment, LeadInput } from "../../lib/forwarding/types";

type DirectionRow = { lead: LeadInput; assessment: Assessment };
type ResponseInput = { kind: DirectionKind; choice: DirectionChoice; country?: string; note: string };

export function DirectionPanel({ rows, expanded, onToggle, isPending, answeringDisabled, onAnswer }: {
  rows: DirectionRow[];
  expanded: boolean;
  onToggle: () => void;
  isPending: (leadId: string) => boolean;
  answeringDisabled: boolean;
  onAnswer: (lead: LeadInput, answer: ResponseInput) => void | Promise<void>;
}) {
  const panelId = useId();
  return <div className="direction-panel" id="direction-questions">
    <button type="button" className="button direction-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}>
      <span aria-live="polite">방향이 필요한 리드 {rows.length}건</span>
      <span aria-hidden="true">{expanded ? "접기" : "열기"}</span>
    </button>
    <section aria-labelledby={panelId + "-title"} id={panelId} hidden={!expanded}>
      <h2 id={panelId + "-title"}>방향을 알려 주세요</h2>
      {rows.length > 0 ? <ul className="direction-list">
        {rows.map(({ lead, assessment }) => {
          const question = getDirectionQuestion(lead, assessment);
          return <DirectionForm key={lead.id + "-" + question.kind} lead={lead} assessment={assessment} question={question}
            pending={isPending(lead.id)} disabled={answeringDisabled} onAnswer={onAnswer} />;
        })}
      </ul> : <p className="muted" role="status">추가로 답할 문의가 없습니다.</p>}
    </section>
  </div>;
}

function DirectionForm({ lead, assessment, question, pending, disabled, onAnswer }: DirectionRow & {
  question: ReturnType<typeof getDirectionQuestion>;
  pending: boolean;
  disabled: boolean;
  onAnswer: (lead: LeadInput, answer: ResponseInput) => void | Promise<void>;
}) {
  const [choice, setChoice] = useState<DirectionChoice | null>(null);
  const [country, setCountry] = useState("");
  const [note, setNote] = useState("");
  const titleId = "direction-" + lead.id + "-title";
  const needsCountry = choice === "other-country";
  const wording = assessment.directionQuestion ?? (assessment.directionConfirmation ? getRecordedDirectionWording(lead, assessment) : null);

  return <li className="direction-lead" aria-labelledby={titleId}>
    <h3 id={titleId}>{lead.id} {lead.institution || "소속 미기재"}</h3>
    <dl className="direction-evidence">
      <dt>확인한 근거</dt>
      <dd>
        <p>{wording?.summary ?? question.summary}</p>
        {assessment.sources.length > 0 && <ul className="direction-sources">
          {assessment.sources.map((url) => <li key={url}>
            <a href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname}</a>
          </li>)}
        </ul>}
      </dd>
      <dt>확인하지 못한 점</dt>
      <dd>{question.missing}</dd>
    </dl>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (!choice || (needsCountry && !country) || disabled || pending) return;
      void onAnswer(lead, { kind: question.kind, choice, ...(needsCountry ? { country } : {}), note: note.trim() });
    }}>
      <fieldset disabled={disabled || pending}>
        <legend>{wording?.question ?? question.question}</legend>
        <div className="direction-choices">
          {question.choices.map(({ value, label }) => <label key={value} className="direction-choice">
            <input type="radio" name={titleId + "-choice"} checked={choice === value} required onChange={() => setChoice(value)} />
            {label}
          </label>)}
        </div>
        {needsCountry && <label className="direction-country">확인한 소재지
          <select required value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value="">국가 선택</option>
            {Object.keys(locales).filter((name) => name !== lead.country).map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>}
        <label className="direction-note">답변 메모
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={400} />
        </label>
        <button type="submit" className="button button-primary" disabled={!choice || (needsCountry && !country)}>
          {pending ? "다시 선별 중…" : "답변 반영"}
        </button>
      </fieldset>
    </form>
  </li>;
}
