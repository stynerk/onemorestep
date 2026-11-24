import { isPublicDemo } from "../../../lib/demo-mode";
import { CampaignsWorkspace } from "./workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "One More Step · 캠페인 효과 보기" };

export default function MarketingCampaignsPage() {
  return <CampaignsWorkspace publicDemo={isPublicDemo()} />;
}
