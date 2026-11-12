"use client";

import { useState, type FormEvent } from "react";
import type { ResearchResult } from "../lib/research";

export default function Home() {
  const [query, setQuery] = useState("Liner API로 출처 있는 조사 기능을 준비하려면?");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        setError(response.status === 400
          ? "조사할 내용을 2~300자로 입력해 주세요."
          : "조사를 완료하지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      setResult(await response.json());
    } catch {
      setError("연결을 확인한 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <p className="eyebrow">ONEMORESTEP · 개발 세팅 확인</p>
      <h1>미리내</h1>
      <p>조사할 내용을 입력하고 출처를 확인해 보세요.</p>
      <form onSubmit={submit}>
        <label htmlFor="query">조사할 내용</label>
        <textarea id="query" value={query} onChange={(e) => setQuery(e.target.value)} minLength={2} maxLength={300} required />
        <button disabled={busy || query.trim().length < 2} type="submit">{busy ? "조사 중…" : "조사 결과 확인"}</button>
      </form>
      <div aria-live="polite" aria-busy={busy}>
        {error && <p role="alert">{error}</p>}
        {result && <section aria-label="조사 결과">
          <h2>{result.mode === "sample" ? "준비된 예시" : "실시간 조사"}</h2>
          <p className="notice">{result.notice}</p>
          {result.sampleQuery && <p>예시 질의: {result.sampleQuery}</p>}
          {result.sources.length === 0 && <p>검색 결과가 없습니다. 다른 내용으로 조사해 보세요.</p>}
          <ul>{result.sources.map((source, index) => <li key={`${source.url}-${index}`}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
            <p>{source.description}</p>
          </li>)}</ul>
        </section>}
      </div>
    </main>
  );
}
