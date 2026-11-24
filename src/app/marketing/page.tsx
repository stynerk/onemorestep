import { isPublicDemo } from "../../lib/demo-mode";
import { MarketingWorkspace } from "./workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "One More Step · 마케팅 협조 요청" };

export default function MarketingPage() {
  return <MarketingWorkspace publicDemo={isPublicDemo()} />;
}
