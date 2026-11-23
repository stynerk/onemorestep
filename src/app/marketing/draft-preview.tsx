import { useState, type FormEvent } from "react";
import { marketingReviewWarnings } from "../../lib/marketing/draft";
import { marketingChannels, type ChannelId } from "../../lib/marketing/policy";
import type { DraftRecord } from "./storage";

const modeLabels = { live: "Liner 실시간", recorded: "Liner 기록 재생", template: "기본 틀" };

function safeSourceUrl(raw: string) {
  try {
    const url = new URL(raw);
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) return url.href;
  } catch { /* Ignore unsupported links. */ }
  return null;
}

export function DraftPreview({ channel, record, editing, setEditing, saveDraft, readOnly }: {
  channel: ChannelId;
  record: DraftRecord;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  saveDraft: (update: Partial<DraftRecord>) => void;
  readOnly?: boolean;
}) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const { draft, status, editedText, editedTitle } = record;
  const descriptor = marketingChannels.find(item => item.id === channel);
  const lines = editedText === undefined ? draft.lines : editedText.split("\n").filter(line => line.trim()).map(line => ({
    text: line, sourceUrl: undefined, needsVerification: true,
  }));
  const shownTitle = editedTitle ?? draft.title;
  const titleNeedsVerification = editedTitle !== undefined || draft.titleNeedsVerification;
  const warnings = editedText === undefined && editedTitle === undefined ? draft.warnings
    : [...new Set([...draft.warnings, ...marketingReviewWarnings(shownTitle, lines)])];
  const needsReview = warnings.length > 0 || titleNeedsVerification || lines.some(line => line.needsVerification);
  const links = draft.sources.flatMap(source => {
    const url = safeSourceUrl(source.url);
    return url ? [{ ...source, url }] : [];
  });

  function startEditing() {
    setText(editedText ?? draft.lines.map(line => line.text).join("\n"));
    setTitle(shownTitle);
    setEditing(true);
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    setConfirmed(false);
    saveDraft({ editedTitle: title.trim() === draft.title ? undefined : title.trim(), editedText: text.trim(), status: "수정됨" });
  }

  function setStatus(next: "승인됨" | "반려됨") {
    setConfirmed(false);
    saveDraft({ status: next });
  }

  return <section className="marketing-preview" aria-labelledby="marketing-preview-heading">
    <header className="marketing-section-head">
      <h4 id="marketing-preview-heading">{descriptor?.label} 초안</h4>
      <div className="marketing-pills">
        <span className="marketing-pill">{modeLabels[draft.mode]}</span>
        <span className="marketing-pill marketing-human" role="status">{status}</span>
      </div>
    </header>
    <p className="muted">{descriptor?.format}</p>
    {draft.mode === "template" && <p className="muted">준비된 Liner 초안이 없어 채널 기본 틀을 표시합니다. 검토할 내용을 수정해 주세요.</p>}
    {!editing && shownTitle && <p className="marketing-draft-title">{shownTitle} {" "}
      {titleNeedsVerification && <strong className="marketing-verify">확인 필요</strong>}
    </p>}
    {editing ? <form className="marketing-edit" onSubmit={submitEdit}>
      <label>수정한 제목<input value={title} onChange={event => setTitle(event.target.value)} maxLength={260} /></label>
      <label>수정한 초안<textarea value={text} onChange={event => setText(event.target.value)} rows={6} required maxLength={4000} /></label>
      <div className="marketing-actions">
        <button type="button" className="button button-light" onClick={() => setEditing(false)}>수정 취소</button>
        <button type="submit" className="button button-primary" disabled={!text.trim()}>수정 저장</button>
      </div>
    </form> : <ul className="marketing-draft-lines" aria-label="초안 내용">
      {lines.map((line, index) => {
        const url = line.sourceUrl && safeSourceUrl(line.sourceUrl);
        return <li key={index}>
          <span>{line.text}</span>{" "}
          {line.needsVerification && <strong className="marketing-verify">확인 필요</strong>}{" "}
          {url && <a href={url} target="_blank" rel="noreferrer">문장 근거</a>}
        </li>;
      })}
    </ul>}
    {links.length > 0 && editedText !== undefined && <p className="muted">아래 링크는 원본 초안의 근거입니다.</p>}
    {links.length > 0 && <ul className="marketing-sources" aria-label={editedText !== undefined ? "원본 Liner Search 근거" : "Liner Search 근거"}>
      {links.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}
    </ul>}
    {links[0]?.excerpt && <blockquote className="marketing-excerpt">
      <strong>공개 참고 발췌</strong><p>{links[0].excerpt}</p>
    </blockquote>}
    {warnings.length > 0 && <ul className="marketing-warnings" aria-label="의료기기 표현 경고">
      {warnings.map(warning => <li key={warning}><strong>의료기기 표현 경고</strong> · {warning}</li>)}
    </ul>}
    {!editing && !readOnly && <>
      {needsReview && status !== "승인됨" && <label className="marketing-confirm-evidence">
        <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> 표현과 근거를 확인했습니다
      </label>}
      <div className="marketing-actions">
        <button type="button" className="button button-light" onClick={startEditing}>초안 수정</button>
        <button type="button" className="button button-light" disabled={status === "반려됨"} onClick={() => setStatus("반려됨")}>초안 반려</button>
        <button type="button" className="button button-primary" disabled={status === "승인됨" || (draft.mode === "template" && editedText === undefined) || (needsReview && !confirmed)}
          onClick={() => setStatus("승인됨")}>초안 승인</button>
      </div>
    </>}
  </section>;
}
