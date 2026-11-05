import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { categoryMeta } from "@/modules/gamification/constants";
import { useActivities, useGamSettings, usePrograms } from "@/modules/gamification/hooks";

export default function GamePolicy() {
  const navigate = useNavigate();
  const [conversionRate, setConversionRate] = useState(1);

  useEffect(() => {
    fetchConversionRate();
  }, []);

  const fetchConversionRate = async () => {
    const { data } = await supabase
      .from("gamification_games")
      .select("points_to_rupee_conversion")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setConversionRate(data.points_to_rupee_conversion || 1);
    }
  };

  const { data: settings } = useGamSettings();
  const { data: programs = [], isLoading: loadingPrograms } = usePrograms();
  const { data: actions = [], isLoading: loadingActions } = useActivities();

  const tieredIds = useMemo(
    () => actions.filter((a) => a.is_tiered).map((a) => a.id),
    [actions]
  );

  const { data: tiers = [] } = useQuery({
    queryKey: ["policy-tiers", tieredIds.join(",")],
    enabled: tieredIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_tiers")
        .select("action_id, threshold_pct, points")
        .in("action_id", tieredIds)
        .order("threshold_pct", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  /**
   * The real, configured programme — replacing a hardcoded "9 Activities" list
   * that named activities nobody had set up and quoted point values that were
   * not the ones being awarded (it claimed "First Orders from New Retailer —
   * 5 points" while the configured activity pays 55). Reps read this page to
   * learn the rules, so it has to come from the same tables the engine reads.
   */
  const livePrograms = useMemo(() => {
    const tiersByAction = new Map<string, { threshold_pct: number; points: number }[]>();
    (tiers as any[]).forEach((t) => {
      const list = tiersByAction.get(t.action_id) ?? [];
      list.push({ threshold_pct: Number(t.threshold_pct), points: Number(t.points) });
      tiersByAction.set(t.action_id, list);
    });

    return programs
      .filter((p) => p.is_active)
      .map((p) => ({
        ...p,
        rate: Number(p.points_to_rupee_conversion ?? settings?.point_conversion ?? 1),
        items: actions
          .filter((a) => a.game_id === p.id && a.is_enabled)
          .map((a) => ({ ...a, tiers: tiersByAction.get(a.id) ?? [] })),
      }))
      .filter((p) => p.items.length > 0);
  }, [programs, actions, tiers, settings]);

  const activityCount = livePrograms.reduce((n: number, p: { items: unknown[] }) => n + p.items.length, 0);
  const loadingConfig = loadingPrograms || loadingActions;

  /** Only facts that are actually set — an unset cap should say nothing, not "none". */
  const configFacts = (a: any, rate: number) => {
    const out: [string, string][] = [];
    out.push(["Trigger", String(a.trigger_type ?? a.action_type ?? "—").replace(/_/g, " ")]);
    if (a.is_tiered && a.base_daily_target) {
      out.push(["Daily target", `${a.base_daily_target} productive visits = 100%`]);
    }
    if (a.cap_scope && a.cap_scope !== "none" && a.cap_value) {
      out.push(["Cap", `${a.cap_value} per ${String(a.cap_scope).replace(/_/g, " / ")}`]);
    }
    out.push([
      "Expiry",
      a.expiry_type === "days" ? `${a.expiry_days} days`
        : a.expiry_type === "never" ? "Never"
        : "End of financial year",
    ]);
    out.push(["Awarded", a.award_mode === "approval" ? "After manager approval" : "Automatically"]);
    if (a.validity_from || a.validity_to) {
      out.push(["Runs", `${a.validity_from ?? "—"} to ${a.validity_to ?? "—"}`]);
    }
    if (!a.is_tiered && Number(a.points) > 0) {
      out.push(["Worth", `₹${(Number(a.points) * rate).toFixed(2)} per award`]);
    }
    return out;
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/leaderboard")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Leaderboard
        </Button>

        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2">Game Policy</h1>
          <p className="text-lg text-muted-foreground">
            Understanding how to earn points, track progress, and redeem rewards
          </p>
        </div>

        <Tabs defaultValue="activities" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="activities">
              {loadingConfig ? "Activities" : `${activityCount} ${activityCount === 1 ? "Activity" : "Activities"}`}
            </TabsTrigger>
            <TabsTrigger value="structure">Game Structure</TabsTrigger>
            <TabsTrigger value="process">Earning Process</TabsTrigger>
            <TabsTrigger value="redemption">Redemption</TabsTrigger>
          </TabsList>

          <TabsContent value="activities" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>How you earn points</CardTitle>
                <CardDescription>
                  Every game and activity currently switched on, exactly as configured. Change it in
                  Admin &rarr; Gamification and this page follows.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingConfig ? (
                  <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : !livePrograms.length ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No games are active with any activity switched on, so there is nothing to earn right now.
                  </p>
                ) : (
                  livePrograms.map((p: any) => {
                    const cat = categoryMeta(p.category);
                    return (
                      <div key={p.id} className="space-y-3 pb-6 border-b last:border-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: cat.fill, color: cat.ac }}
                          >
                            <Trophy className="h-4 w-4" />
                          </div>
                          <h3 className="text-lg font-semibold">{p.name}</h3>
                          <Badge variant="secondary">{cat.label}</Badge>
                          <span className="text-xs text-muted-foreground">1 pt = ₹{p.rate}</span>
                          {(p.start_date || p.end_date) && (
                            <span className="text-xs text-muted-foreground">
                              · {p.start_date ?? "—"} to {p.end_date ?? "—"}
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-sm text-muted-foreground">{p.description}</p>
                        )}

                        <div className="space-y-3">
                          {p.items.map((a: any) => (
                            <div key={a.id} className="rounded-lg border p-3.5">
                              <div className="flex items-start gap-3 flex-wrap">
                                <h4 className="font-semibold flex-1 min-w-0">{a.action_name}</h4>
                                <Badge variant="secondary" className="shrink-0">
                                  {a.is_tiered
                                    ? a.tiers.length
                                      ? `${Math.min(...a.tiers.map((t: any) => t.points))}–${Math.max(
                                          ...a.tiers.map((t: any) => t.points)
                                        )} points`
                                      : "Tiered"
                                    : `${a.points ?? 0} points`}
                                </Badge>
                              </div>
                              {a.description && (
                                <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                              )}

                              {a.is_tiered && a.tiers.length > 0 && (
                                <div className="mt-3 bg-muted/50 p-3 rounded-md">
                                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Tiers</p>
                                  <ul className="space-y-1">
                                    {a.tiers.map((t: any) => (
                                      <li key={t.threshold_pct} className="text-sm flex justify-between gap-3">
                                        <span>
                                          Reach {t.threshold_pct}%
                                          {a.base_daily_target
                                            ? ` (${Math.ceil((t.threshold_pct / 100) * Number(a.base_daily_target))} of ${a.base_daily_target})`
                                            : ""}
                                        </span>
                                        <span className="font-semibold tabular-nums">{t.points} pts</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                                {configFacts(a, p.rate).map(([k, v]) => (
                                  <div key={k} className="flex justify-between gap-3 text-sm">
                                    <span className="text-muted-foreground">{k}</span>
                                    <span className="text-right">{v}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structure" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Game Structure & Configuration</CardTitle>
                <CardDescription>How games are organized and managed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">1. Game Creation</h3>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <p className="text-sm">• Admin selects one or more of the 9 activities</p>
                      <p className="text-sm">• Defines reward points per activity</p>
                      <p className="text-sm">• Sets start and end dates (optional)</p>
                      <p className="text-sm">• Chooses territories (or applies to all)</p>
                      <p className="text-sm">• Activates the game</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">2. Activity Configuration</h3>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-1">Daily Target Activity:</p>
                        <p className="text-xs text-muted-foreground ml-4">→ Choose: Total Orders OR Sales Value (₹)</p>
                        <p className="text-xs text-muted-foreground ml-4">→ Set base daily target</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Focused Products:</p>
                        <p className="text-xs text-muted-foreground ml-4">→ Auto-detected from Product Master</p>
                        <p className="text-xs text-muted-foreground ml-4">→ Points awarded when order contains focused product</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Order Frequency:</p>
                        <p className="text-xs text-muted-foreground ml-4">→ Define consecutive orders needed (e.g., 2, 3, 4)</p>
                        <p className="text-xs text-muted-foreground ml-4">→ Sequence resets if gap occurs</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">3. Territory Application</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <p className="font-medium mb-2">All Territories</p>
                        <p className="text-sm text-muted-foreground">Game applies to everyone across all regions</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="font-medium mb-2">Selected Territories</p>
                        <p className="text-sm text-muted-foreground">Game applies only to specific territories</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">4. Points Calculation Flow</h3>
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-lg">
                      <div className="flex flex-col space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">1</div>
                          <p className="text-sm">User performs activity (e.g., creates order)</p>
                        </div>
                        <div className="ml-4 border-l-2 border-blue-300 h-4"></div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">2</div>
                          <p className="text-sm">System checks active games with matching activities</p>
                        </div>
                        <div className="ml-4 border-l-2 border-green-300 h-4"></div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold">3</div>
                          <p className="text-sm">Validates configuration rules (limits, thresholds, etc.)</p>
                        </div>
                        <div className="ml-4 border-l-2 border-purple-300 h-4"></div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">4</div>
                          <p className="text-sm">Awards points to user's account</p>
                        </div>
                        <div className="ml-4 border-l-2 border-orange-300 h-4"></div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center text-sm font-bold">5</div>
                          <p className="text-sm">Points appear in leaderboard & user profile</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="process" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Earning Points: Detailed Process</CardTitle>
                <CardDescription>Step-by-step guide on how points are earned</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Real-Time Point Calculation</h3>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                      <p className="text-sm">Points are calculated and awarded in real-time as activities occur:</p>
                      <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
                        <li>Order placed → Check for First Order, Daily Target, Focused Product, Productive Visit</li>
                        <li>Visit completed → Check for Productive Visit points</li>
                        <li>Competition data submitted → Award Competition Intelligence points</li>
                        <li>Feedback captured → Award Retailer Feedback points</li>
                        <li>Branding request created → Award Branding Request points</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Example Scenarios</h3>
                    
                    <div className="space-y-4">
                      <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
                        <p className="font-medium text-green-700 dark:text-green-300 mb-2">Scenario 1: New Retailer Onboarding</p>
                        <div className="text-sm space-y-1 text-green-600 dark:text-green-400">
                          <p>1. Add new retailer "XYZ Mart" → 0 points (no game for this)</p>
                          <p>2. Visit XYZ Mart and place first order → 5 points (First Order from New Retailer)</p>
                          <p>3. Order contains Focused Product → Additional 5 points</p>
                          <p>4. This is your 5th order today, meeting daily target → Additional 15 points</p>
                          <p className="font-bold pt-2">Total Earned: 25 points from one visit!</p>
                        </div>
                      </div>

                      <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20">
                        <p className="font-medium text-blue-700 dark:text-blue-300 mb-2">Scenario 2: Daily Routine</p>
                        <div className="text-sm space-y-1 text-blue-600 dark:text-blue-400">
                          <p>1. Visit Retailer A (existing) → Place order → 5 points (Productive Visit)</p>
                          <p>2. Visit Retailer B (existing) → Place order → 5 points (Productive Visit) + 2 points (2nd consecutive order)</p>
                          <p>3. Visit Retailer C → Capture competition data → 2 points</p>
                          <p>4. Visit Retailer D → Place order with focused product → 5 points + 5 points</p>
                          <p>5. Complete 5 orders, hit daily target → 15 points</p>
                          <p className="font-bold pt-2">Total Earned: 39 points for the day!</p>
                        </div>
                      </div>

                      <div className="border rounded-lg p-4 bg-purple-50 dark:bg-purple-950/20">
                        <p className="font-medium text-purple-700 dark:text-purple-300 mb-2">Scenario 3: Month-End Achievement</p>
                        <div className="text-sm space-y-1 text-purple-600 dark:text-purple-400">
                          <p>1. Last month beat sales: ₹2,00,000</p>
                          <p>2. This month beat sales: ₹2,20,000 (10% growth)</p>
                          <p>3. Growth exceeds 7% minimum → 5 points (Beat Growth)</p>
                          <p className="font-bold pt-2">Bonus earned at month end!</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Tracking Your Progress</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <p className="font-medium mb-2">Leaderboard Tab</p>
                        <p className="text-sm text-muted-foreground">View your rank and points by time period</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="font-medium mb-2">My Games Tab</p>
                        <p className="text-sm text-muted-foreground">See active games and points earned per game</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="font-medium mb-2">Badges Tab</p>
                        <p className="text-sm text-muted-foreground">View earned badges and achievements</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="font-medium mb-2">My Points Card</p>
                        <p className="text-sm text-muted-foreground">Filter by today, week, month, quarter, YTD</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="redemption" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Points Redemption Policy</CardTitle>
                <CardDescription>How to redeem your earned points for rewards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Redemption Process</h3>
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 p-6 rounded-lg">
                      <div className="flex flex-col space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center text-sm font-bold">1</div>
                          <p className="text-sm">Navigate to Leaderboard → Click "Redeem Points"</p>
                        </div>
                        <div className="ml-4 border-l-2 border-yellow-300 h-4"></div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">2</div>
                          <p className="text-sm">Enter points amount you want to redeem</p>
                        </div>
                        <div className="ml-4 border-l-2 border-orange-300 h-4"></div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold">3</div>
                          <p className="text-sm">System calculates the voucher amount (₹{conversionRate} per point)</p>
                        </div>
                        <div className="ml-4 border-l-2 border-red-300 h-4"></div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center text-sm font-bold">4</div>
                          <p className="text-sm">Submit redemption request</p>
                        </div>
                        <div className="ml-4 border-l-2 border-pink-300 h-4"></div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold">5</div>
                          <p className="text-sm">Admin reviews and approves request</p>
                        </div>
                        <div className="ml-4 border-l-2 border-purple-300 h-4"></div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">6</div>
                          <p className="text-sm">Receive voucher code or gift</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Redemption Rules</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <p className="font-medium mb-2">Conversion Rate</p>
                        <p className="text-2xl font-bold text-primary">1 Point = ₹{conversionRate}</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="font-medium mb-2">Minimum Redemption</p>
                        <p className="text-2xl font-bold text-primary">100 Points</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="font-medium mb-2">Processing Time</p>
                        <p className="text-sm text-muted-foreground">2-5 business days</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="font-medium mb-2">Redemption Status</p>
                        <p className="text-sm text-muted-foreground">Track in "My Redemptions" tab</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Request Statuses</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                        <Badge variant="secondary">Pending</Badge>
                        <p className="text-sm">Request submitted, awaiting admin review</p>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                        <Badge className="bg-green-600">Approved</Badge>
                        <p className="text-sm">Request approved! Voucher code will be shared</p>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                        <Badge variant="destructive">Rejected</Badge>
                        <p className="text-sm">Request rejected with reason provided</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Important Notes</h3>
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border-l-4 border-blue-500 space-y-2">
                      <p className="text-sm">• Points cannot be transferred between users</p>
                      <p className="text-sm">• Redeemed points are deducted from your total</p>
                      <p className="text-sm">• Rejected requests return points to your account</p>
                      <p className="text-sm">• Keep track of your redemption history in the dashboard</p>
                      <p className="text-sm">• Contact admin if you have questions about redemption</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Redemption Example</h3>
                    <div className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                      <p className="font-medium mb-3">Scenario: First Redemption</p>
                      <div className="space-y-2 text-sm">
                        <p>• Current Points: 500 points</p>
                        <p>• Redeem Request: 200 points</p>
                        <p>• Voucher Value: ₹200</p>
                        <p>• After Redemption: 300 points remaining</p>
                        <p className="pt-2 font-medium">Process: Request submitted → Admin approves → Receive ₹200 voucher code → Use for purchases!</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-center">
          <Button onClick={() => navigate("/leaderboard")} size="lg">
            Go to Leaderboard
          </Button>
        </div>
      </div>
    </Layout>
  );
}
