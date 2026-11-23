import { useState } from "react";
import { marketingAssignees, salesRequesters, type WorkflowEvent, type WorkflowStatus } from "../../lib/marketing/workflow";

const timestamp = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul",
});
type ActiveTransition = Exclude<WorkflowStatus, "접수">;
const nextStatus = { "접수": "진행", "진행": "검토", "검토": "완료" } as const;

export function WorkflowHistory({ history }: { history: readonly WorkflowEvent[] }) {
  return <ol className="marketing-workflow-history">
    {history.map((event, index) => <li key={index}>
      <strong>{event.status}</strong> · {event.actor} · <time dateTime={event.at}>{timestamp.format(new Date(event.at))}</time>
      {event.reason && <p>사유: {event.reason}</p>}
    </li>)}
  </ol>;
}

export function RequestWorkflow({ history, approved, change }: {
  history: readonly WorkflowEvent[]; approved: boolean; change: (status: ActiveTransition, assignee: string, reason?: string) => void;
}) {
  const [assignee, setAssignee] = useState("");
  const [reason, setReason] = useState("");
  const latest = history[history.length - 1];
  const current = latest?.status ?? "접수";
  const assigned = history.find(event => event.status === "진행")?.actor;
  const next = current === "완료" || current === "반려" ? null : nextStatus[current];
  const effectiveAssignee = assigned ?? assignee;

  return <section className="marketing-detail-section" aria-labelledby="marketing-workflow">
    <div className="marketing-section-head">
      <h3 id="marketing-workflow">처리 흐름</h3>
      <span>현재 상태 {current}{assigned && " · " + assigned}</span>
    </div>
    {latest?.code && <p>캠페인 코드 <strong>{latest.code}</strong></p>}
    {next && <>
      <div className="marketing-workflow-actions">
        {!assigned && <label>담당자
          <select value={assignee} onChange={event => setAssignee(event.currentTarget.value)}>
            <option value="">선택</option>
            {marketingAssignees.map(option => <option key={option}>{option}</option>)}
          </select>
        </label>}
        <button type="button" className="button button-primary" disabled={!effectiveAssignee || (next === "완료" && !approved)}
          onClick={() => change(next, effectiveAssignee)}>{next}</button>
      </div>
      {next === "완료" && !approved && <p className="muted">초안을 하나 이상 승인하면 완료할 수 있습니다.</p>}
      <form className="marketing-workflow-actions" onSubmit={event => {
        event.preventDefault();
        if (effectiveAssignee && reason.trim()) change("반려", effectiveAssignee, reason);
      }}>
        <label>반려 사유<input value={reason} required maxLength={180} onChange={event => setReason(event.currentTarget.value)} /></label>
        <button type="submit" className="button button-light" disabled={!effectiveAssignee || !reason.trim()}>반려</button>
      </form>
    </>}
    <WorkflowHistory history={history} />
  </section>;
}

type RequestSummary = { id: string; title: string; requester: string; history: readonly WorkflowEvent[] };

export function RequesterView({ requests }: { requests: readonly RequestSummary[] }) {
  const [requester, setRequester] = useState<string>(salesRequesters[0]);
  const options = [...new Set([...salesRequesters, ...requests.map(item => item.requester)])];
  const own = requests.filter(item => item.requester === requester);
  return <section className="marketing-card marketing-intake" aria-labelledby="marketing-requester-view">
    <h2 id="marketing-requester-view">요청자 보기</h2>
    <label className="marketing-requester-choice">내 요청 보기
      <select value={requester} onChange={event => setRequester(event.currentTarget.value)}>
        {options.map(option => <option key={option}>{option}</option>)}
      </select>
    </label>
    {own.length ? <ul className="marketing-requester-list">
      {own.map(item => <li key={item.id}>
        <strong>{item.id} · {item.title}</strong>
        <span className="marketing-pill">{item.history.at(-1)?.status}</span>
        <WorkflowHistory history={item.history} />
      </li>)}
    </ul> : <p>등록한 요청이 없습니다.</p>}
  </section>;
}
