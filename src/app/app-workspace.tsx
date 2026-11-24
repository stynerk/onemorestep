"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Fragment, Suspense, useContext, useState, type ReactNode } from "react";
import { isAvailableIndustry, medicom, type DemoIndustry, type DemoIndustryOption } from "../lib/forwarding/industry-demo";
import { createBrowserForwardingStore } from "../lib/forwarding/store";
import { DemoLogoutButton } from "./demo-session";
import { useInbox, type InboxController } from "./forwarding/inbox-controller";
import { resetMarketingDemo } from "./marketing/storage";
import "./app-workspace.css";

type WorkspaceSettings = {
  publicDemo: boolean;
  liveAssessment: boolean;
  industries: readonly DemoIndustryOption[];
};

type Workspace = WorkspaceSettings & {
  inbox: InboxController;
  industry: DemoIndustry;
  busy: boolean;
  href: (path: string) => string;
  chooseIndustry: (industry: DemoIndustry) => void;
};

const WorkspaceContext = createContext<Workspace | null>(null);

export function useAppWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("업무 화면의 공통 레이아웃이 필요합니다.");
  return workspace;
}

function industryHref(path: string, industry: DemoIndustry) {
  const href = new URL(path, "https://workspace.invalid");
  if (industry.id !== "medicom") href.searchParams.set("industry", industry.id);
  return href.pathname + href.search + href.hash;
}

export function AppWorkspace({ children, ...settings }: WorkspaceSettings & { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return children;
  return <Suspense fallback={null}>
    <WorkspaceRoute {...settings}>{children}</WorkspaceRoute>
  </Suspense>;
}

function WorkspaceRoute({ children, ...settings }: WorkspaceSettings & { children: ReactNode }) {
  const industryId = useSearchParams().get("industry");
  const requested = settings.industries.find((industry) => industry.id === industryId);
  const industry = settings.publicDemo && requested && isAvailableIndustry(requested) ? requested : medicom;
  return <WorkspaceFrame key={industry.id} {...settings} industry={industry}>{children}</WorkspaceFrame>;
}

function WorkspaceFrame({ children, industry, ...settings }: WorkspaceSettings & { children: ReactNode; industry: DemoIndustry }) {
  const pathname = usePathname();
  const router = useRouter();
  const inbox = useInbox(settings.publicDemo, settings.liveAssessment && industry.id === "medicom", industry);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetError, setResetError] = useState(false);
  const [resetRevision, setResetRevision] = useState(0);
  const busy = inbox.running || inbox.pending.length > 0 || Object.values(inbox.mail).some((item) => item.pending);
  const href = (path: string) => industryHref(path, industry);
  const feedbackCount = inbox.directionLeads.length;

  function chooseIndustry(next: DemoIndustry) {
    if (next.id !== industry.id) router.replace(industryHref(pathname, next), { scroll: false });
  }

  function resetDemo() {
    if (!inbox.reset()) {
      setResetError(true);
      return;
    }
    const otherIndustries = [medicom, ...settings.industries.filter((option) => option.id !== "medicom")];
    const forwardingResults = otherIndustries.filter(isAvailableIndustry).filter((option) => option.id !== industry.id)
      .map((option) => createBrowserForwardingStore(option).reset().ok);
    const marketingCleared = resetMarketingDemo();
    setResetError(forwardingResults.includes(false) || !marketingCleared);
    setConfirmReset(false);
    setResetRevision((revision) => revision + 1);
    router.replace(href(pathname), { scroll: false });
  }

  return <WorkspaceContext.Provider value={{ ...settings, inbox, industry, busy, href, chooseIndustry }}>
    <div className="app-workspace">
      <aside className="app-sidebar" aria-label="One More Step">
        <p className="app-sidebar-brand"><span aria-hidden="true">✦</span> One More Step</p>
        <nav aria-label="업무 메뉴" className="app-sidebar-nav">
          <div className="app-sidebar-group" data-active={pathname.startsWith("/inbox")}>
            <Link className="app-sidebar-parent" href={href("/inbox")}>문의 선별</Link>
            <Link href={href("/inbox")} aria-current={pathname === "/inbox" ? "page" : undefined}>전체 문의</Link>
            <Link href={href("/inbox/status")} aria-current={pathname === "/inbox/status" ? "page" : undefined}>선별 현황</Link>
            <Link href={href("/inbox/feedback")} aria-current={pathname === "/inbox/feedback" ? "page" : undefined}
              aria-label="피드백 요청" aria-describedby="sidebar-feedback-count">피드백 요청 <span id="sidebar-feedback-count">{feedbackCount}건</span></Link>
          </div>
          <div className="app-sidebar-group" data-active={pathname.startsWith("/marketing")}>
            <Link className="app-sidebar-parent" href={href("/marketing")}>마케팅 요청</Link>
            <Link href={href("/marketing")} aria-current={pathname === "/marketing" ? "page" : undefined}>전체 요청 확인</Link>
            <Link href={href("/marketing/campaigns")} aria-current={pathname === "/marketing/campaigns" ? "page" : undefined}>캠페인 효과 보기</Link>
          </div>
        </nav>
        <div className="app-sidebar-actions">
          <button type="button" className="app-sidebar-action" disabled={busy} onClick={() => { setResetError(false); setConfirmReset(true); }}>시연 초기화</button>
          <DemoLogoutButton className="app-sidebar-action" />
        </div>
      </aside>
      <div className="app-workspace-content">
        {confirmReset && <div className="app-reset-confirm">
          <p role="status">이 브라우저의 선별, 결정, 회신과 마케팅 기록을 지울까요?</p>
          <button type="button" className="app-sidebar-action" onClick={() => setConfirmReset(false)}>취소</button>
          <button type="button" className="app-sidebar-action app-reset-primary" disabled={busy} onClick={resetDemo}>초기화 확인</button>
        </div>}
        {resetError && <p className="app-reset-confirm" role="alert">시연 기록을 모두 초기화하지 못했습니다. 브라우저 저장소를 확인해 주세요.</p>}
        <Fragment key={resetRevision}>{children}</Fragment>
      </div>
    </div>
  </WorkspaceContext.Provider>;
}
