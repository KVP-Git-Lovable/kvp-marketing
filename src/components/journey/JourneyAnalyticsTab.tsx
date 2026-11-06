import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { JourneyAnalyticsPanel } from "@/components/journey/JourneyAnalyticsPanel";
import { JourneyFailedMessages } from "@/components/journey/JourneyFailedMessages";

type PanelProps = React.ComponentProps<typeof JourneyAnalyticsPanel>;

// Hosts the Analytics dashboard and its sub-views (Failed Messages) without changing routes.
export function JourneyAnalyticsTab(props: Omit<PanelProps, "actions">) {
  const [view, setView] = useState<"dashboard" | "failed">("dashboard");

  if (view === "failed") {
    return <JourneyFailedMessages journeyId={props.journeyId} canvasData={props.canvasData} onBack={() => setView("dashboard")} />;
  }
  return (
    <JourneyAnalyticsPanel
      {...props}
      actions={
        <Button variant="outline" size="sm" onClick={() => setView("failed")}>
          <AlertTriangle className="h-4 w-4 mr-1" /> Failed Messages
        </Button>
      }
    />
  );
}
