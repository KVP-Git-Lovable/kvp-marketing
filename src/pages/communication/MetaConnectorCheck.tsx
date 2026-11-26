import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { metaConnectorRequest } from '@/lib/metaConnectorClient';

/** Read-only check of what the Meta connection allows for lead forms, leads and customer lists. */
export default function MetaConnectorCheck({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const check = useQuery({
    queryKey: ['meta-connector-check'], enabled: open, retry: false, staleTime: 0,
    queryFn: () => metaConnectorRequest<{ checks: Array<{ label: string; ok: boolean; detail: string }> }>({ action: 'check' }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connector check</DialogTitle>
          <DialogDescription>What the connected Meta account allows. Nothing is created or changed.</DialogDescription>
        </DialogHeader>
        {check.isFetching ? <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Checking…</p>
          : check.error ? <p role="alert" className="text-sm text-destructive break-words">{(check.error as Error).message}</p>
          : <ul className="space-y-2">{check.data?.checks.map((c) => <li key={c.label} className="flex gap-2 text-sm">{c.ok ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}<div className="min-w-0"><p className="font-medium">{c.label}</p><p className="text-xs text-muted-foreground break-words">{c.detail}</p></div></li>)}</ul>}
        <Button variant="outline" size="sm" onClick={() => check.refetch()} disabled={check.isFetching}>Check again</Button>
      </DialogContent>
    </Dialog>
  );
}
