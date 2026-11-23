"use client";

import { useMemo, useSyncExternalStore } from "react";
import { createBrowserForwardingStore, FORWARDING_STORAGE_KEY } from "../../lib/forwarding/store";
import { createIndustryState } from "../../lib/forwarding/industry-demo";
import type { ChannelId } from "../../lib/marketing/policy";
import { marketingCampaignMetrics, marketingLeadOptions, type CampaignMetrics } from "../../lib/marketing/tracking";
import styles from "./campaign-tracking.module.css";

function readSavedInbox() {
  try { return window.localStorage.getItem(FORWARDING_STORAGE_KEY); } catch { return null; }
}

function subscribeToInbox(listener: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === FORWARDING_STORAGE_KEY || event.key === null) listener();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", listener);
  };
}

const emptySnapshot = () => null;

export function useCampaignTracking() {
  const snapshot = useSyncExternalStore(subscribeToInbox, readSavedInbox, emptySnapshot);
  return useMemo(() => {
    const state = snapshot === null ? createIndustryState() : createBrowserForwardingStore().hydrate().state;
    const campaigns = marketingCampaignMetrics(state);
    const channelEffects: Partial<Record<ChannelId, CampaignMetrics>> = {};
    for (const campaign of campaigns) channelEffects[campaign.channel] = campaign;
    return { leadOptions: marketingLeadOptions(state), campaigns, channelEffects };
  }, [snapshot]);
}

const percent = new Intl.NumberFormat("ko-KR", { style: "percent", maximumFractionDigits: 0 });

export function CampaignTracking({ campaigns, issuedCodes = [] }: {
  campaigns: readonly CampaignMetrics[];
  issuedCodes?: readonly { code: string; title: string }[];
}) {
  const largestCampaign = Math.max(1, ...campaigns.map(({ total }) => total));
  return <section className="marketing-card" aria-labelledby="campaign-tracking-title">
    <h2 id="campaign-tracking-title" className={styles.title}>캠페인 효과</h2>
    <p className={styles.summary}>문의함 판정 기록으로 집계합니다. 유입 리드의 판정이 끝나면 유효 비율과 효과가 표시됩니다.</p>
    <div className={styles.scroller} tabIndex={0} role="region" aria-label="캠페인 효과 표 스크롤">
      <table className={styles.table} aria-label="캠페인 효과">
        <thead>
          <tr>
            <th scope="col">코드</th><th scope="col">캠페인</th><th scope="col">채널</th><th scope="col">유입</th>
            <th scope="col">유효 (비율)</th><th scope="col">애매</th><th scope="col">국가 확인</th>
            <th scope="col">제휴 확인</th><th scope="col">무효</th><th scope="col">미판정</th>
            <th scope="col">딜러 배정</th><th scope="col">효과</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => <tr key={campaign.code}>
            <th scope="row">{campaign.code}</th>
            <td>{campaign.title}</td><td>{campaign.channelLabel}</td>
            <td>
              <span className={styles.volumeCell}>
                <span>{campaign.total}</span>
                <span className={styles.volumeTrack} aria-hidden="true">
                  <span className={styles.volume} style={{ inlineSize: (100 * campaign.total / largestCampaign) + "%" }}>
                    <span className={styles.validVolume} style={{ inlineSize: (campaign.total ? 100 * campaign.valid / campaign.total : 0) + "%" }} />
                  </span>
                </span>
              </span>
            </td>
            <td>{campaign.validRatio === null ? campaign.valid : campaign.valid + "/" + campaign.total + " (" + percent.format(campaign.validRatio) + ")"}</td>
            <td>{campaign.verdicts.ambiguous}</td><td>{campaign.verdicts["country-check"]}</td>
            <td>{campaign.verdicts["partnership-check"]}</td><td>{campaign.verdicts.invalid}</td><td>{campaign.pending}</td>
            <td>{campaign.dealerCount}</td>
            <td><strong className={campaign.effect === "효과 낮음" ? styles.low : campaign.effect === "효과 높음" ? styles.high : undefined}>{campaign.effect}</strong></td>
          </tr>)}
          {issuedCodes.map(({ code, title }) => <tr key={code}>
            <th scope="row">{code}</th><td>{title}</td><td>—</td>
            <td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>판단 보류</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}
