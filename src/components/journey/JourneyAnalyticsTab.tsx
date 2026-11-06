import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MessageCircle } from "lucide-react";
import { JourneyAnalyticsPanel } from "@/components/journey/JourneyAnalyticsPanel";
import { JourneyFailedMessages } from "@/components/journey/JourneyFailedMessages";
import { JourneyConversations } from "@/components/journey/JourneyConversations";

type PanelProps = React.ComponentProps<typeof JourneyAnalyticsPanel>;

// Hosts the Analytics dashboard and its sub-views (Failed Messages) without changing routes.
export function JourneyAnalyticsTab(props: Omit<PanelProps, "actions"> & { journeyName?: string }) {
  const [view, setView] = useState<"dashboard" | "failed" | "conversations">("dashboard");

  if (view === "failed") {
    return <JourneyFailedMessages journeyId={props.journeyId} canvasData={props.canvasData} onBack={() => setView("dashboard")} />;
  }
  if (view === "conversations") {
    return <JourneyConversations journeyId={props.journeyId} journeyName={props.journeyName} canvasData={props.canvasData} onBack={() => setView("dashboard")} />;
  }
  return (
    <JourneyAnalyticsPanel
      journeyId={props.journeyId} canvasData={props.canvasData} enrolledCount={props.enrolledCount} completedCount={props.completedCount}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setView("conversations")}>
            <MessageCircle className="h-4 w-4 mr-1 text-green-600" /> View WhatsApp Conversations
          </Button>
          <Button variant="outline" size="sm" onClick={() => setView("failed")}>
            <AlertTriangle className="h-4 w-4 mr-1" /> Failed Messages
          </Button>
        </>
      }
    />
  );
}
