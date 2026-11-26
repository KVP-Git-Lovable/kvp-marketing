import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Download, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { metaConnectorRequest } from '@/lib/metaConnectorClient';
import { mapAudienceSheet, usableRows, type ConnectorAudienceRow } from '@/lib/metaConnectorAudience';
import { toast } from 'sonner';

export type ConnectorAudience = { id: string; name: string; row_count: number; invalid_count: number; duplicate_count: number; created_at: string };
const MAX_ROWS = 10000;

export function useConnectorAudiences(enabled = true) {
  return useQuery({ queryKey: ['meta-connector-audiences'], queryFn: () => metaConnectorRequest<{ rows: ConnectorAudience[] }>({ action: 'audiences' }), enabled, retry: false });
}

export default function MetaConnectorAudienceDialog({ open, onOpenChange, canCreate }: { open: boolean; onOpenChange: (v: boolean) => void; canCreate: boolean }) {
  const qc = useQueryClient();
  const audiences = useConnectorAudiences(open);
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ConnectorAudienceRow[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const usable = usableRows(rows).length;

  const choose = async (file?: File) => {
    if (!file) return;
    setError(''); setRows([]); setFileName(file.name);
    try {
      // raw: keep phone numbers as typed instead of letting the parser turn them into numbers
      const book = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true });
      const parsed = mapAudienceSheet(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, blankrows: false, raw: false }) as unknown[][]);
      if (parsed.length > MAX_ROWS) throw new Error(`Upload at most ${MAX_ROWS.toLocaleString()} rows per list.`);
      setRows(parsed);
      if (!name) setName(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read the file.'); }
  };

  const template = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['first_name,last_name,email,phone\nAsha,Rao,asha@example.com,9876543210\n'], { type: 'text/csv' }));
    a.download = 'customer_list_template.csv';
    a.click();
  };

  const upload = async () => {
    setBusy(true); setError('');
    try {
      const r = await metaConnectorRequest<{ audience: ConnectorAudience }>({ action: 'create_audience', name: name.trim(), rows, consent_confirmed: true });
      toast.success(`Customer list "${r.audience.name}" uploaded: ${r.audience.row_count} people sent to Meta.`);
      setName(''); setRows([]); setFileName(''); setConsent(false);
      await qc.invalidateQueries({ queryKey: ['meta-connector-audiences'] });
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customer lists</DialogTitle>
          <DialogDescription>Upload names, emails and phone numbers as a Meta Custom Audience, then target only those people in a campaign. Details are hashed before they are sent to Meta and are not stored here.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>List name</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="e.g. Existing customers" /></div>
          <div className="border border-dashed rounded-md p-4 flex flex-wrap items-center gap-3">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="flex-1 min-w-0 text-sm truncate">{fileName || 'CSV or Excel with email and/or phone columns (names optional)'}</p>
            <Button variant="ghost" size="sm" onClick={template}><Download className="h-4 w-4 mr-1" />Template</Button>
            <Button variant="outline" size="sm" onClick={() => input.current?.click()}>Choose file</Button>
            <input ref={input} type="file" accept=".csv,.xlsx,.xls" className="hidden" aria-label="Customer list file" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          {rows.length > 0 && <p className="text-sm">{rows.length.toLocaleString()} rows read · <b>{usable.toLocaleString()}</b> with a usable email or phone</p>}
          {rows.length > 0 && usable < 100 && <p className="text-xs text-amber-700">Meta usually needs about 100 matched people before an audience can deliver ads.</p>}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={consent} onCheckedChange={(c) => setConsent(c === true)} />
            <span>These people have agreed that we may use their details for advertising, and we accept Meta's Custom Audience terms.</span>
          </label>
          {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
          <div className="border-t pt-3">
            <h3 className="text-sm font-medium mb-2">Uploaded lists</h3>
            {audiences.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : audiences.error ? <p className="text-sm text-destructive">{(audiences.error as Error).message}</p>
              : !audiences.data?.rows.length ? <p className="text-sm text-muted-foreground">No lists yet.</p>
              : <ul className="divide-y text-sm">{audiences.data.rows.map((a) => <li key={a.id} className="py-2 flex justify-between gap-3"><span className="truncate">{a.name}</span><span className="text-muted-foreground shrink-0">{a.row_count} people · {new Date(a.created_at).toLocaleDateString()}</span></li>)}</ul>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={busy || !canCreate || !consent || !name.trim() || usable === 0} onClick={upload}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Upload to Meta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
