import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sparkles, AlertTriangle, CheckCircle, TrendingDown, TrendingUp, ShieldAlert, Target, Users, MapPin, Package, Zap, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { useBeatHealthInsight, BeatHealthInsight } from '@/hooks/useBeatHealthInsight';
import { supabase } from '@/integrations/supabase/client';
import type { BeatPlanRow } from '@/hooks/useBeatPlannerInsights';

interface BeatInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  beatId: string;
  beatName: string;
  /** This beat's row from the AI Beat Planner analysis (display only). */
  planInsight?: BeatPlanRow | null;
}

/** Natural-language nudge built from the Beat Planner numbers, e.g.
 * "Only 3 of this beat's 7 shops were visited in the last month; they owe
 * ₹389 in total; on average you haven't been there in over 2 months — give
 * this beat 1 day in the next plan." */
function beatPlanSentence(p: BeatPlanRow): string {
  const shops = p.retailers === 1 ? 'shop' : 'shops';
  const coverage =
    p.visited30d <= 0
      ? `None of this beat's ${p.retailers} ${shops} were visited in the last month`
      : p.visited30d >= p.retailers
        ? `All ${p.retailers} ${shops} in this beat were visited in the last month`
        : `${p.coveragePct < 60 ? 'Only ' : ''}${p.visited30d} of this beat's ${p.retailers} ${shops} were visited in the last month`;

  const clauses = [coverage];
  if (p.pending > 0) {
    clauses.push(`they owe ₹${Number(p.pending).toLocaleString('en-IN', { maximumFractionDigits: 0 })} in total`);
  }
  const d = p.avgDaysSinceVisit;
  if (d != null && d > 0) {
    clauses.push(
      d >= 60
        ? `on average you haven't been there in over ${Math.floor(d / 30)} months`
        : d >= 30
          ? `on average you haven't been there in over a month`
          : `your last visits average just ${d} day${d === 1 ? '' : 's'} ago`,
    );
  }
  const n = p.newRetailers ?? 0;
  if (n > 0) {
    clauses.push(
      n === 1
        ? `1 new shop just joined this beat — a fresh chance to introduce your range`
        : `${n} new shops just joined this beat — fresh chances to introduce your range`,
    );
  }
  const days = p.suggestedDays === 1 ? '1 day' : `${p.suggestedDays} days`;
  return `${clauses.join('; ')} — give this beat ${days} in the next plan.`;
}

const RISK_LABELS: Record<string, { label: string; color: string }> = {
  revenue_drop: { label: 'Revenue Drop', color: 'bg-red-100 text-red-800 border-red-200' },
  low_conversion: { label: 'Low Conversion', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  high_value_inactive: { label: 'High-Value Inactive', color: 'bg-red-100 text-red-800 border-red-200' },
  low_coverage: { label: 'Low Coverage', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  concentration_risk: { label: 'Concentration Risk', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  low_sku_penetration: { label: 'Low SKU Penetration', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  no_retailers: { label: 'No Retailers', color: 'bg-red-100 text-red-800 border-red-200' },
};

function HealthScoreRing({ score, status }: { score: number; status: string }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const statusColors: Record<string, string> = {
    excellent: 'text-emerald-500',
    stable: 'text-blue-500',
    needs_attention: 'text-amber-500',
    critical: 'text-red-500',
  };

  const strokeColors: Record<string, string> = {
    excellent: '#10b981',
    stable: '#3b82f6',
    needs_attention: '#f59e0b',
    critical: '#ef4444',
  };

  const statusLabels: Record<string, string> = {
    excellent: 'Excellent',
    stable: 'Stable',
    needs_attention: 'Needs Attention',
    critical: 'Critical',
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={strokeColors[status] || '#6b7280'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${statusColors[status]}`}>{score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <Badge
        className={`${
          status === 'excellent' ? 'bg-emerald-100 text-emerald-800' :
          status === 'stable' ? 'bg-blue-100 text-blue-800' :
          status === 'needs_attention' ? 'bg-amber-100 text-amber-800' :
          'bg-red-100 text-red-800'
        }`}
      >
        {statusLabels[status] || status}
      </Badge>
    </div>
  );
}

function KPIRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-muted/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

export function BeatInsightModal({ isOpen, onClose, beatId, beatName, planInsight }: BeatInsightModalProps) {
  const { insight, loading, error, fetchInsight, reset } = useBeatHealthInsight();

  useEffect(() => {
    if (isOpen && beatId) {
      fetchInsight(beatId);
    }
    return () => { if (!isOpen) reset(); };
  }, [isOpen, beatId]);

  const handleFeedback = async (type: 'like' | 'dislike') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('ai_feature_feedback').insert({
        feature: 'beat_health_insight',
        feedback_type: type,
        user_id: user.id,
      });
    } catch {}
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Health Insight — {beatName}
          </DialogTitle>
        </DialogHeader>

        {/* AI Beat Planner nudge (from the shared beat_planner analysis) */}
        {planInsight && (
          <div
            className={`flex items-start gap-1.5 rounded-md border px-3 py-2 text-xs leading-snug ${
              planInsight.coveragePct < 30
                ? 'border-rose-200 bg-rose-50/80 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200'
                : planInsight.coveragePct < 60
                  ? 'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'
                  : 'border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
            }`}
            title="From AI Beat Planner — computed from your visits and orders"
          >
            <Sparkles size={12} className="mt-0.5 shrink-0" />
            <span>{beatPlanSentence(planInsight)}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing beat performance…</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchInsight(beatId)}>
              Retry
            </Button>
          </div>
        ) : insight ? (
          <div className="space-y-5">
            {/* Health Score Ring */}
            <div className="flex justify-center">
              <HealthScoreRing score={insight.health_score} status={insight.status} />
            </div>

            {/* Summary */}
            <div className={`p-4 rounded-lg border ${
              insight.severity_level === 'success' ? 'bg-emerald-50 border-emerald-200' :
              insight.severity_level === 'info' ? 'bg-blue-50 border-blue-200' :
              insight.severity_level === 'warning' ? 'bg-amber-50 border-amber-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-2">
                {insight.severity_level === 'success' ? <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" /> :
                 insight.severity_level === 'warning' ? <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" /> :
                 insight.severity_level === 'critical' ? <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" /> :
                 <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />}
                <p className="text-sm leading-relaxed">{insight.summary}</p>
              </div>
            </div>

            {/* Risk Signals */}
            {insight.risk_signals.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {insight.risk_signals.map((signal) => {
                  const risk = RISK_LABELS[signal] || { label: signal, color: 'bg-muted text-muted-foreground' };
                  return (
                    <Badge key={signal} variant="outline" className={`text-xs ${risk.color}`}>
                      {risk.label}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Recommended Actions */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" />
                Recommended Actions
              </h4>
              <ol className="space-y-2">
                {insight.recommended_actions.map((action, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    <span>{action}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Expandable Data Points */}
            <div>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="trigger" className="border rounded-lg">
                  <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
                    ▶ View Data Points Considered
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <Accordion type="multiple" className="w-full space-y-1">
                      {/* Revenue */}
                      <AccordionItem value="revenue" className="border-0 border-b">
                        <AccordionTrigger className="py-2 text-sm hover:no-underline">
                          <span className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-green-600" /> Revenue
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-6">
                            <KPIRow label="MTD Revenue" value={formatCurrency(insight.data_points.revenue.mtd)} />
                            <KPIRow label="Last Month" value={formatCurrency(insight.data_points.revenue.last_month)} />
                            <KPIRow label="3-Month Avg" value={formatCurrency(insight.data_points.revenue.three_month_avg)} />
                            <KPIRow label="Growth %" value={`${insight.data_points.revenue.growth_pct}%`} />
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Retailer Activity */}
                      <AccordionItem value="retailer" className="border-0 border-b">
                        <AccordionTrigger className="py-2 text-sm hover:no-underline">
                          <span className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-600" /> Retailer Activity
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-6">
                            <KPIRow label="Total Retailers" value={insight.data_points.retailer_activity.total} />
                            <KPIRow label="Active (This Month)" value={insight.data_points.retailer_activity.active} />
                            <KPIRow label="Inactive (30+ days)" value={insight.data_points.retailer_activity.inactive_30d} />
                            <KPIRow label="New This Month" value={insight.data_points.retailer_activity.new_this_month} />
                            <KPIRow label="Lost (60+ days)" value={insight.data_points.retailer_activity.lost_60d} />
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Coverage */}
                      <AccordionItem value="coverage" className="border-0 border-b">
                        <AccordionTrigger className="py-2 text-sm hover:no-underline">
                          <span className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-blue-600" /> Visit Coverage
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-6">
                            <KPIRow label="Planned Visits" value={insight.data_points.coverage.planned} />
                            <KPIRow label="Completed" value={insight.data_points.coverage.completed} />
                            <KPIRow label="Missed" value={insight.data_points.coverage.missed} />
                            <KPIRow label="Coverage %" value={`${insight.data_points.coverage.coverage_pct}%`} />
                            <KPIRow label="Avg/Retailer" value={insight.data_points.coverage.avg_per_retailer} />
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Conversion */}
                      <AccordionItem value="conversion" className="border-0 border-b">
                        <AccordionTrigger className="py-2 text-sm hover:no-underline">
                          <span className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-cyan-600" /> Conversion
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-6">
                            <KPIRow label="Total Visits" value={insight.data_points.conversion.total_visits} />
                            <KPIRow label="Orders Generated" value={insight.data_points.conversion.orders} />
                            <KPIRow label="Conversion Rate" value={`${insight.data_points.conversion.rate_pct}%`} />
                            <KPIRow label="Avg Billing/Visit" value={formatCurrency(insight.data_points.conversion.avg_billing)} />
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Productivity */}
                      <AccordionItem value="productivity" className="border-0 border-b">
                        <AccordionTrigger className="py-2 text-sm hover:no-underline">
                          <span className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-amber-600" /> Productivity
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-6">
                            <KPIRow label="Working Days" value={insight.data_points.productivity.working_days} />
                            <KPIRow label="Orders/Day" value={insight.data_points.productivity.orders_per_day} />
                            <KPIRow label="Revenue/Day" value={formatCurrency(insight.data_points.productivity.revenue_per_day)} />
                            <KPIRow label="Avg Order Value" value={formatCurrency(insight.data_points.productivity.avg_order_value)} />
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* SKU Penetration */}
                      <AccordionItem value="sku" className="border-0">
                        <AccordionTrigger className="py-2 text-sm hover:no-underline">
                          <span className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-orange-600" /> SKU Penetration
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="pl-6">
                            <KPIRow label="Catalog Total" value={insight.data_points.sku_penetration.catalog} />
                            <KPIRow label="SKUs Sold" value={insight.data_points.sku_penetration.sold} />
                            <KPIRow label="Penetration %" value={`${insight.data_points.sku_penetration.pct}%`} />
                            <KPIRow label="Concentration Risk" value={`${insight.data_points.sku_penetration.concentration_risk}%`} />
                            {insight.data_points.sku_penetration.top_5.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Top 5 SKUs</p>
                                {insight.data_points.sku_penetration.top_5.map((sku, i) => (
                                  <div key={i} className="flex justify-between text-xs py-0.5">
                                    <span>{sku.name}</span>
                                    <span className="font-medium">{formatCurrency(sku.revenue)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleFeedback('like')}>
                  <ThumbsUp className="h-4 w-4 mr-1" /> Helpful
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleFeedback('dislike')}>
                  <ThumbsDown className="h-4 w-4 mr-1" /> Not Helpful
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(insight.timestamp).toLocaleString()}
              </span>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
