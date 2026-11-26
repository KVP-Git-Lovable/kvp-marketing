import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { metaConnectorRequest } from '@/lib/metaConnectorClient';
import { csvCell } from '@/lib/metaConnectorAudience';

type Lead = { id: string; lead_id: string; created_time: string | null; fields: Record<string, string> };
const label = (key: string) => key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Leads received by one Instant Form campaign: sync from Meta, view and download. */
export default function MetaConnectorLeads({ row, onClose }: { row: { id: string; name: string } | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const leads = useQuery({
    queryKey: ['meta-connector-leads', row?.id],
    enabled: !!row,
    queryFn: async () => {
      const { data, error } = await (supabase.from('meta_connector_leads' as never) as any)
        .select('id, lead_id, created_time, fields').eq('campaign_id', row!.id).order('created_time', { ascending: false }).limit(1000);
      if (error) throw error;
      return (data || []) as Lead[];
    },
  });
  const rows = leads.data || [];
  const keys = Array.from(new Set(rows.flatMap((l) => Object.keys(l.fields || {}))));

  const sync = async () => {
    if (!row) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await metaConnectorRequest<{ synced: number; truncated: boolean }>({ action: 'sync_leads', id: row.id });
      setMessage(`${r.synced} lead(s) received from Meta for this campaign.${r.truncated ? ' The form has more entries than one sync reads.' : ''}`);
      await leads.refetch();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not get leads from Meta'); } finally { setBusy(false); }
  };

  const download = () => {
    const csv = [['Received', ...keys.map(label)], ...rows.map((l) => [l.created_time || '', ...keys.map((k) => l.fields[k] || '')])]
      .map((line) => line.map(csvCell).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `leads-${row?.name.replace(/[^\w-]+/g, '-')}.csv`;
    a.click();
  };

  return (
    <Dialog open={!!row} onOpenChange={(v) => { if (!v) { setMessage(''); setError(''); onClose(); } }}>
      <DialogContent className="max-w-5xl w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leads · {row?.name}</DialogTitle>
          <DialogDescription>People who filled in this campaign's Instant Form. Meta keeps leads for 90 days, so sync regularly.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={sync} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}Get leads from Meta</Button>
          <Button size="sm" variant="outline" onClick={download} disabled={!rows.length}><Download className="h-4 w-4 mr-2" />Download CSV</Button>
          <span className="text-sm text-muted-foreground">{rows.length} stored</span>
        </div>
        {message && <p className="text-sm">{message}</p>}
        {(error || leads.error) && <p role="alert" className="text-sm text-destructive break-words">{error || (leads.error as Error).message}</p>}
        <div className="overflow-x-auto border rounded-md">
          <Table>
            <TableHeader><TableRow><TableHead>Received</TableHead>{keys.map((k) => <TableHead key={k}>{label(k)}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {!rows.length ? <TableRow><TableCell colSpan={keys.length + 1} className="text-center py-8 text-muted-foreground">{leads.isLoading ? 'Loading…' : 'No leads yet.'}</TableCell></TableRow>
                : rows.map((l) => <TableRow key={l.id}><TableCell className="whitespace-nowrap text-xs">{l.created_time ? new Date(l.created_time).toLocaleString() : '—'}</TableCell>{keys.map((k) => <TableCell key={k} className="text-sm">{l.fields[k] || '—'}</TableCell>)}</TableRow>)}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
