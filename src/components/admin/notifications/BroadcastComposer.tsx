import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, Search, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * "Right now, once" — the one kind of notification that is not configuration.
 *
 * It is also the only kind that cannot be undone, so the dialog resolves how
 * many people would receive it and makes the operator confirm that number
 * before anything is sent.
 */

type Portal = 'field_sales_app' | 'customer_portal' | 'distributor_portal';
type FieldAudience = 'all' | 'role' | 'user';

const PORTALS: Array<{ id: Portal; label: string; hint: string }> = [
  { id: 'field_sales_app', label: 'Field sales app', hint: 'The reps and managers who use this app' },
  { id: 'customer_portal', label: 'Customer portal', hint: 'Every retailer with the portal switched on' },
  { id: 'distributor_portal', label: 'Distributor portal', hint: 'Every active distributor user' },
];

export function BroadcastComposer({
  open, onOpenChange, actorUserId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  actorUserId: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [portals, setPortals] = useState<Portal[]>(['field_sales_app']);
  const [audience, setAudience] = useState<FieldAudience>('all');
  const [roleId, setRoleId] = useState<string>('');
  const [userIds, setUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: roles = [] } = useQuery({
    queryKey: ['broadcast-roles'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from('security_profiles').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: people = [] } = useQuery({
    queryKey: ['broadcast-people'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, user_status, is_active')
        .order('full_name');
      if (error) throw error;
      return (data || []).filter((p: any) => p.user_status === 'active' && p.is_active !== false);
    },
  });

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people as any[];
    return (people as any[]).filter(p => `${p.full_name || ''} ${p.username || ''}`.toLowerCase().includes(q));
  }, [people, search]);

  const reset = () => {
    setTitle(''); setMessage(''); setPortals(['field_sales_app']);
    setAudience('all'); setRoleId(''); setUserIds([]); setSearch('');
    setConfirming(false);
  };

  const close = () => { reset(); onOpenChange(false); };

  const togglePortal = (p: Portal) =>
    setPortals(prev => (prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]));

  /** What the operator is about to do, in people rather than in parameters. */
  const reach = useMemo(() => {
    const parts: string[] = [];
    if (portals.includes('field_sales_app')) {
      if (audience === 'all') parts.push('everyone who uses the app');
      else if (audience === 'role') parts.push(roleId ? `everyone with the ${roles.find((r: any) => r.id === roleId)?.name} profile` : 'a role (not picked yet)');
      else parts.push(`${userIds.length} selected ${userIds.length === 1 ? 'person' : 'people'}`);
    }
    if (portals.includes('customer_portal')) parts.push('every portal-enabled retailer');
    if (portals.includes('distributor_portal')) parts.push('every active distributor user');
    return parts.join(' + ');
  }, [portals, audience, roleId, roles, userIds]);

  const problem =
    !title.trim() ? 'Give it a title.'
      : !message.trim() ? 'Write the message.'
        : portals.length === 0 ? 'Pick at least one place to send it.'
          : portals.includes('field_sales_app') && audience === 'role' && !roleId ? 'Pick the role.'
            : portals.includes('field_sales_app') && audience === 'user' && userIds.length === 0 ? 'Pick at least one person.'
              : null;

  const send = async () => {
    if (problem) { toast.error(problem); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.rpc('send_broadcast_notification' as any, {
        p_title: title.trim(),
        p_message: message.trim(),
        p_actor_user_id: actorUserId,
        p_portals: portals,
        p_field_sales_target_type: audience,
        p_field_sales_target_ids: audience === 'role' ? [roleId] : audience === 'user' ? userIds : null,
        p_target_type: 'all',
        p_target_ids: null,
        p_distributor_target_type: 'all',
        p_distributor_target_ids: null,
      });
      if (error) throw error;
      const sent = Number(data ?? 0);
      if (sent === 0) toast.error('Nothing was sent — that audience resolved to nobody.');
      else toast.success(`Sent to ${sent} recipient${sent === 1 ? '' : 's'}`);
      qc.invalidateQueries({ queryKey: ['hub-broadcasts'] });
      close();
    } catch (e: any) {
      toast.error(e.message || 'Could not send the announcement');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone size={17} className="text-amber-600" /> New announcement
          </DialogTitle>
          <DialogDescription>
            This goes out immediately and cannot be recalled. Nothing is saved as a rule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bc-title">Title</Label>
            <Input
              id="bc-title"
              value={title}
              onChange={e => { setTitle(e.target.value); setConfirming(false); }}
              placeholder="Van service tomorrow"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bc-msg">Message</Label>
            <Textarea
              id="bc-msg"
              rows={3}
              value={message}
              onChange={e => { setMessage(e.target.value); setConfirming(false); }}
              placeholder="Plan your beat around a 2pm start."
            />
            <p className="text-[11px] text-muted-foreground">
              <code>{'{user_name}'}</code> and <code>{'{retailer_name}'}</code> are filled in per recipient.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Where it goes</Label>
            <div className="grid gap-1.5">
              {PORTALS.map(p => (
                <label
                  key={p.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors',
                    portals.includes(p.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <Checkbox
                    checked={portals.includes(p.id)}
                    onCheckedChange={() => { togglePortal(p.id); setConfirming(false); }}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-[13px] font-medium">{p.label}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{p.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {portals.includes('field_sales_app') && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label className="text-[12px]">Who in the field sales app</Label>
              <Select value={audience} onValueChange={v => { setAudience(v as FieldAudience); setConfirming(false); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="role">A role</SelectItem>
                  <SelectItem value="user">Specific people</SelectItem>
                </SelectContent>
              </Select>

              {audience === 'role' && (
                <Select value={roleId} onValueChange={v => { setRoleId(v); setConfirming(false); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Pick a role" /></SelectTrigger>
                  <SelectContent>
                    {(roles as any[]).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              {audience === 'user' && (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-8 pl-8 text-[12px]"
                      placeholder="Search people"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-40 rounded-md border">
                    <div className="p-1.5">
                      {filteredPeople.map((p: any) => (
                        <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12.5px] hover:bg-muted/60">
                          <Checkbox
                            checked={userIds.includes(p.id)}
                            onCheckedChange={() => {
                              setConfirming(false);
                              setUserIds(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]);
                            }}
                          />
                          {p.full_name || p.username || 'User'}
                        </label>
                      ))}
                      {filteredPeople.length === 0 && (
                        <p className="px-1.5 py-2 text-[12px] text-muted-foreground">Nobody matches that.</p>
                      )}
                    </div>
                  </ScrollArea>
                  <p className="text-[11px] text-muted-foreground">{userIds.length} selected</p>
                </div>
              )}
            </div>
          )}

          <div className={cn(
            'rounded-lg border p-3 text-[12.5px]',
            confirming ? 'border-amber-400 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : 'bg-muted/30',
          )}>
            {confirming ? (
              <p className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                <span>Send “{title.trim()}” to {reach || 'nobody'}? This cannot be recalled.</span>
              </p>
            ) : (
              <p>This will reach <strong>{reach || 'nobody yet'}</strong>.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>Cancel</Button>
          {confirming ? (
            <Button onClick={send} disabled={sending} className="bg-amber-600 hover:bg-amber-700">
              {sending ? 'Sending…' : 'Yes, send it now'}
            </Button>
          ) : (
            <Button onClick={() => (problem ? toast.error(problem) : setConfirming(true))}>Review and send</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
