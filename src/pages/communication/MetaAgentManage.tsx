import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { metaAgentRequest } from '@/lib/metaAgentClient';
import { toast } from 'sonner';

type Evidence = Record<string, number>;
type Row = {
  id: string; campaign_name: string; kind: 'pause' | 'increase_budget' | 'new_creative'; reason: string; explanation: string | null;
  evidence: Evidence; proposal: { budget?: number } | null; status: string; result_message: string | null; created_at: string;
};
type Finding = { campaign_id: string; name: string; error?: string; recommendations: Array<{ kind: string; reason: string; evidence: Evidence }> };

const TITLES: Record<string, string> = { pause: 'Pause campaign', increase_budget: 'Raise budget', new_creative: 'Refresh the creative' };
const numbers = (e: Evidence) => [
  e.days !== undefined && `${e.days} day(s)`, e.spend !== undefined && `₹${e.spend.toLocaleString('en-IN')} spent`,
  e.results !== undefined && `${e.results} result(s)`, e.cost_per_result ? `₹${e.cost_per_result} per result` : false,
  e.frequency_now !== undefined && `frequency ${e.frequency_before} → ${e.frequency_now}`,
].filter(Boolean).join(' · ');

export default function MetaAgentManage({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState('');
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [error, setError] = useState('');
  const history = useQuery({ queryKey: ['meta-agent-recommendations'], queryFn: () => metaAgentRequest<{ rows: Row[] }>({ action: 'recommendations' }), retry: false });
  const rows = (history.data?.rows || []).filter((r) => r.status !== 'superseded');

  const analyse = async () => {
    setBusy('analyse'); setError(''); setConfirming('');
    try {
      const value = Number(target);
      const r = await metaAgentRequest<{ results: Finding[] }>({ action: 'analyse', ...(value > 0 ? { target_cost_per_result: value } : {}) });
      setFindings(r.results);
      await history.refetch();
    } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed'); } finally { setBusy(''); }
  };

  const decide = async (row: Row, approve: boolean) => {
    setBusy(row.id); setError('');
    try {
      await metaAgentRequest({ action: 'decide', recommendation_id: row.id, approve });
      toast.success(!approve ? 'Suggestion rejected.' : row.kind === 'new_creative' ? 'Noted. Create a new ad in the Create tab.' : 'Change applied on Meta.');
      if (approve) await qc.invalidateQueries({ queryKey: ['meta-connector-campaigns'] });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not apply the change'); } finally { setBusy(''); setConfirming(''); await history.refetch(); }
  };

  const quiet = (findings || []).filter((f) => f.error || f.recommendations.every((r) => r.kind === 'no_action'));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Target cost per result (₹, optional)</Label>
          <Input type="number" min="1" step="any" className="w-56" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 100 per lead or click" />
        </div>
        <Button onClick={analyse} disabled={!!busy}>{busy === 'analyse' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}Analyse campaigns</Button>
      </div>
      <p className="text-xs text-muted-foreground">Reads the last 7 days of each connector campaign. Nothing changes on Meta until you approve a suggestion. Without a target cost, and for awareness campaigns, only creative advice is given.</p>
      {(error || history.error) && <p role="alert" className="text-sm text-destructive break-words">{error || (history.error as Error).message}</p>}
      {findings && !findings.length && <p className="text-sm text-muted-foreground">There are no prepared connector campaigns to analyse yet.</p>}
      {quiet.length > 0 && (
        <ul className="rounded-md border divide-y text-sm">
          {quiet.map((f) => <li key={f.campaign_id} className="p-3"><p className="font-medium break-words">{f.name}</p><p className={`text-xs break-words ${f.error ? 'text-destructive' : 'text-muted-foreground'}`}>{f.error || f.recommendations[0]?.reason}</p></li>)}
        </ul>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Suggestions</h3>
        {history.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : !rows.length ? <p className="text-sm text-muted-foreground">No suggestions yet.</p> : rows.map((r) => (
          <article key={r.id} className="rounded-md border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2"><Badge variant={r.status === 'pending' ? 'default' : 'outline'}>{r.status}</Badge><p className="font-medium text-sm break-words">{TITLES[r.kind]}{r.proposal?.budget ? ` to ₹${r.proposal.budget.toLocaleString('en-IN')}` : ''} · {r.campaign_name}</p></div>
            <p className="text-sm break-words">{r.explanation || r.reason}</p>
            <p className="text-xs text-muted-foreground">{numbers(r.evidence)} · {new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            {r.result_message && <p className="text-xs text-destructive break-words">{r.result_message}</p>}
            {r.status === 'pending' && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!canEdit || !!busy} onClick={() => (confirming === r.id ? decide(r, true) : setConfirming(r.id))}>
                  {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                  {r.kind === 'new_creative' ? 'Noted' : confirming === r.id ? 'Confirm: apply on Meta' : 'Approve'}
                </Button>
                <Button size="sm" variant="outline" disabled={!canEdit || !!busy} onClick={() => decide(r, false)}><X className="h-4 w-4 mr-1" />Reject</Button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
