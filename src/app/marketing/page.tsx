import { isPublicDemo } from "../../lib/demo-mode";
import { MarketingWorkspace } from "./workspace";
import "../forwarding/forwarding.css";
import "./marketing.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "미리내 · 마케팅 협조 요청" };

export default function MarketingPage() {
  return <MarketingWorkspace publicDemo={isPublicDemo()} />;
}
