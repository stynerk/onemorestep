import type { AssessmentHandoff, Dealer } from "../../lib/forwarding/types";

export function handoffLabel(handoff: AssessmentHandoff, dealers: readonly Dealer[]) {
  switch (handoff.kind) {
    case "dealer":
      return dealers.find((dealer) => dealer.id === handoff.dealerId)?.name ?? "딜러";
    case "regional-sales":
      return handoff.region ? handoff.region + " 권역 세일즈팀" : "권역 세일즈팀 · 권역 미지정";
    case "hr":
      return "인사팀";
    case "none":
      return "없음";
  }
}
