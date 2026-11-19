import { isPublicDemo, linerRuntimeSettings } from "../lib/demo-mode";
import Inbox from "./forwarding/inbox";
import "./forwarding/forwarding.css";

// The platform runtime can force public mode even for an externally built artifact.
export const dynamic = "force-dynamic";

export default function Home() {
  const liner = linerRuntimeSettings();
  const liveAssessment = liner.mode?.trim() === "live" && Boolean(liner.apiKey?.trim());
  return <Inbox publicDemo={isPublicDemo()} liveAssessment={liveAssessment} />;
}
