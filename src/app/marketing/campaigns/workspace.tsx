"use client";

import { useSyncExternalStore } from "react";
import { rankWorkflowRequests } from "../../../lib/marketing/workflow";
import { CampaignTracking, useCampaignTracking } from "../campaign-tracking";
import { readMarketingSnapshot, readMarketingState, subscribeToMarketingState } from "../storage";

const emptySnapshot = () => null;

export function CampaignsWorkspace({ publicDemo }: { publicDemo: boolean }) {
  const { campaigns } = useCampaignTracking();
  const snapshot = useSyncExternalStore(subscribeToMarketingState, readMarketingSnapshot, emptySnapshot);
  const state = readMarketingState(snapshot);
  const issuedCodes = rankWorkflowRequests(state.submitted).flatMap(({ id, title }) => {
    const code = state.workflows[id]?.at(-1)?.code;
    return code ? [{ code, title }] : [];
  });

  return <main className="workspace marketing-workspace">
    <div className="workspace-inner">
      <header className="page-heading">
        <div>
          <h1>캠페인 효과 보기</h1>
          <p>문의함 선별 기록으로 집계합니다. 유입 리드의 선별이 끝나면 유효 비율과 효과가 표시됩니다.</p>
        </div>
        {publicDemo && <span className="marketing-pill">공개 시연 · 기록 재생</span>}
      </header>
      <CampaignTracking campaigns={campaigns} issuedCodes={issuedCodes} />
    </div>
  </main>;
}
