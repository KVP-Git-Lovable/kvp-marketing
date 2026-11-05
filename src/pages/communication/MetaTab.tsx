import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Newspaper, Megaphone, Activity, ArrowLeft } from "lucide-react";
import MetaOrganicPostsPanel from "./meta/MetaOrganicPostsPanel";
import MetaAdvertisementsPanel from "./meta/MetaAdvertisementsPanel";
import MetaDiagnosticsPanel from "./meta/MetaDiagnosticsPanel";

type View = "hub" | "organic" | "advertisements" | "diagnostics";

const CARDS = [
  { id: "organic" as const, icon: Newspaper, title: "Meta Organic Posts", description: "Compose, schedule and publish posts to your Facebook Page and Instagram account." },
  { id: "advertisements" as const, icon: Megaphone, title: "Meta Advertisements", description: "Create and manage paid campaigns, ad sets and ads, and keep the ads account topped up." },
  { id: "diagnostics" as const, icon: Activity, title: "Meta Diagnostics", description: "Check the health of the Meta connection, tokens, permissions and recent API calls." },
];

export default function MetaTab() {
  const [view, setView] = useState<View>("hub");

  if (view === "hub") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Meta</h2>
          <p className="text-xs text-muted-foreground">
            Run your Facebook and Instagram presence from one place: publish organic posts, manage paid advertising, and check the health of your Meta connection. Use Meta Connection to link or change the account these pages work with.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {CARDS.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setView(c.id)}>
              <CardContent className="p-4 space-y-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <c.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <p className="font-medium text-sm">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => setView("hub")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Meta
      </Button>
      {view === "organic" && <MetaOrganicPostsPanel />}
      {view === "advertisements" && <MetaAdvertisementsPanel />}
      {view === "diagnostics" && <MetaDiagnosticsPanel />}
    </div>
  );
}
