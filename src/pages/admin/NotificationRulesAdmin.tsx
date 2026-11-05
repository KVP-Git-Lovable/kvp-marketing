import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Pencil, Trash2, Bell, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { NotificationRuleForm } from '@/components/admin/NotificationRuleForm';
import { NotificationHistoryTab } from '@/components/admin/NotificationHistoryTab';
import { ReportSubscriptionsTab } from '@/components/admin/reports/ReportSubscriptionsTab';
import { NotificationHub } from '@/components/admin/notifications/NotificationHub';
import { NewNotificationDialog } from '@/components/admin/notifications/NewNotificationDialog';
import { BroadcastComposer } from '@/components/admin/notifications/BroadcastComposer';
import { BannersTab } from '@/components/admin/notifications/BannersTab';
import type { HubKind } from '@/components/admin/notifications/NotificationHub';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';

interface NotificationRule {
  id: string;
  name: string;
  event_code: string;
  source_table: string;
  receiver_type: string;
  receiver_role: string | null;
  receiver_user_id: string | null;
  notification_channel: string;
  title_template: string;
  message_template: string;
  is_active: boolean;
  created_at: string;
}

const TABS = [
  { value: 'hub', label: 'Overview' },
  { value: 'rules', label: 'Alerts' },
  { value: 'reports', label: 'Reports' },
  { value: 'banners', label: 'Banners' },
  { value: 'history', label: 'History' },
];

const NotificationRulesAdmin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [rulesOpen, setRulesOpen] = useState(true);

  /** The hub is one list over four kinds, so picking a row has to land the user
   *  in that kind's own editor — which means the tab strip is driven from here
   *  rather than by the user's last click. */
  const [tab, setTab] = useState('hub');
  const [chooserOpen, setChooserOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [reportAutoOpen, setReportAutoOpen] =
    useState<{ kind: 'new' } | { kind: 'edit'; id: string } | null>(null);
  const [newBannerSignal, setNewBannerSignal] = useState(0);

  const openRuleEditor = (rule: NotificationRule | null) => {
    setTab('rules');
    setEditingRule(rule);
    setShowForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const primaryAction: { label: string; run: () => void } | null =
    tab === 'hub'     ? { label: 'New notification', run: () => setChooserOpen(true) }
  : tab === 'rules'   ? { label: 'New alert',        run: () => openRuleEditor(null) }
  : tab === 'banners' ? { label: 'New banner',       run: () => setNewBannerSignal(n => n + 1) }
  // Reports keeps its own New Subscription button beside its stat cards, so a
  // second one up here would be two ways to start the same wizard.
  : null;

  const handlePickKind = (kind: HubKind) => {
    setChooserOpen(false);
    if (kind === 'rule') openRuleEditor(null);
    else if (kind === 'report') { setTab('reports'); setReportAutoOpen({ kind: 'new' }); }
    else if (kind === 'broadcast') setBroadcastOpen(true);
    else { setTab('banners'); setNewBannerSignal(n => n + 1); }
  };

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['notification-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_rules')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as NotificationRule[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('notification_rules')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] });
      toast.success('Alert updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notification_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] });
      toast.success('Alert deleted');
    },
  });

  const handleEdit = (rule: NotificationRule) => openRuleEditor(rule);

  const handleClose = () => {
    setShowForm(false);
    setEditingRule(null);
  };

  const renderTemplate = (tpl: string, ctx: Record<string, string>) =>
    tpl
      .replace(/\{user_name\}/g, ctx.user_name || 'User')
      .replace(/\{module_name\}/g, ctx.module_name || '')
      .replace(/\{record_name\}/g, ctx.record_name || '')
      .replace(/\{date\}/g, new Date().toLocaleDateString())
      .replace(/\{points\}/g, ctx.points || '');

  const fireMutation = useMutation({
    mutationFn: async (rule: NotificationRule) => {
      const { data: recipients, error: recipientError } = await supabase.rpc(
        'notif_preview_recipients' as any,
        {
          p_receiver_type: rule.receiver_type,
          p_receiver_role: rule.receiver_role || null,
          p_receiver_user_id: rule.receiver_user_id || null,
          p_sample_actor: ['employee', 'manager', 'hierarchy'].includes(rule.receiver_type)
            ? user?.id || null
            : null,
        },
      );
      if (recipientError) throw recipientError;

      const receiverIds = Array.from(
        new Set(((recipients || []) as Array<{ id: string }>).map((recipient) => recipient.id).filter(Boolean)),
      );
      if (receiverIds.length === 0) throw new Error('No receivers resolved for this rule');

      const ctx = {
        user_name: (user as any)?.user_metadata?.full_name || user?.email || 'Admin',
        module_name: rule.source_table.replace(/_/g, ' '),
        record_name: '[Manual Fire]',
        points: '',
      };
      const title = `[TEST] ${renderTemplate(rule.title_template, ctx)}`;
      const message = renderTemplate(rule.message_template, ctx);

      const rows = receiverIds.map(uid => ({
        user_id: uid,
        title,
        message,
        type: 'info',
        metadata: {
          route: '/notifications',
          manual_fire: true,
          requested_channel: rule.notification_channel,
        },
      }));
      const { error } = await supabase.from('notifications').insert(rows);
      if (error) throw error;
      return receiverIds.length;
    },
    onSuccess: (count) => toast.success(`Fired in-app + push test to ${count} user(s)`),
    onError: (err: any) => toast.error(err.message || 'Failed to fire rule'),
  });

  const receiverLabel = (rule: NotificationRule) => {
    if (rule.receiver_type === 'role') return `Role: ${rule.receiver_role}`;
    if (rule.receiver_type === 'specific_user') return 'Specific User';
    return rule.receiver_type.charAt(0).toUpperCase() + rule.receiver_type.slice(1);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-subtle p-4 sm:p-5">
        <div className="mx-auto w-full min-w-0 max-w-[1500px] overflow-x-hidden">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            {/* The title, the one primary action and the tabs are a single
                header band. As four stacked rows they had no hierarchy — each
                read as loud as the next and the page looked packed before a
                single notification was on it. */}
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
                <div className="min-w-0">
                  <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Notifications</h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Every notification this app can send, in one place
                  </p>
                </div>
                {primaryAction && (
                  <Button onClick={primaryAction.run} className="w-full gap-2 rounded-xl sm:w-auto">
                    <Plus size={16} /> {primaryAction.label}
                  </Button>
                )}
              </div>

              {/* Underlined tabs on the band's own bottom edge, so they belong
                  to the header instead of floating under it as a grey pill bar. */}
              <TabsList className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-t bg-transparent p-0 px-2">
                {TABS.map(t => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="shrink-0 rounded-none border-b-2 border-transparent px-3 py-2.5 text-[13px] text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="hub" className="mt-5">
              <NotificationHub
                onNewNotification={() => setChooserOpen(true)}
                onEditRule={(rule) => openRuleEditor(rule as NotificationRule)}
                onEditReport={(id) => { setTab('reports'); setReportAutoOpen({ kind: 'edit', id }); }}
                onOpenBanners={() => setTab('banners')}
              />
            </TabsContent>

            <TabsContent value="rules" className="mt-5 space-y-6">
              {showForm && (
                <NotificationRuleForm
                  key={editingRule?.id || 'new'}
                  rule={editingRule}
                  userId={user?.id || ''}
                  onClose={handleClose}
                  onSaved={() => {
                    queryClient.invalidateQueries({ queryKey: ['notification-rules'] });
                    handleClose();
                  }}
                />
              )}

              <Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors">
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span className="flex items-center gap-2">
                          {rulesOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          <Bell size={18} /> Alerts ({rules.filter(r => r.is_active).length} / {rules.length})
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {rulesOpen ? 'Click to collapse' : 'Click to expand'}
                        </span>
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      {isLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                      ) : rules.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Bell className="mx-auto h-12 w-12 mb-3 opacity-30" />
                          <p>No alerts set up yet</p>
                          <p className="text-xs mt-1">Create your first alert to start notifying people when something happens</p>
                        </div>
                      ) : (
                        <div className="-mx-6 overflow-x-auto px-6">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Event</TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead>Receiver</TableHead>
                              <TableHead>Channel</TableHead>
                              <TableHead>Active</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rules.map((rule) => (
                              <TableRow key={rule.id}>
                                <TableCell className="font-medium">{rule.name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">{rule.event_code}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{rule.source_table}</TableCell>
                                <TableCell className="text-sm">{receiverLabel(rule)}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-xs">{rule.notification_channel}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Switch
                                    checked={rule.is_active}
                                    onCheckedChange={(checked) => toggleMutation.mutate({ id: rule.id, is_active: checked })}
                                  />
                                </TableCell>
                                <TableCell className="text-right space-x-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Fire now (send test notification to receivers)"
                                    disabled={fireMutation.isPending}
                                    onClick={() => {
                                      if (window.confirm(`Fire "${rule.name}" now? A [TEST] notification will be sent to its configured receivers.`)) {
                                        fireMutation.mutate(rule);
                                      }
                                    }}
                                  >
                                    <Zap size={14} className="text-amber-500" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                                    <Pencil size={14} />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(rule.id)}>
                                    <Trash2 size={14} className="text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </TabsContent>

            <TabsContent value="banners" className="mt-5">
              <BannersTab actorUserId={user?.id || ''} newSignal={newBannerSignal} />
            </TabsContent>

            <TabsContent value="reports" className="mt-5">
              <ReportSubscriptionsTab
                autoOpen={reportAutoOpen}
                onAutoOpenHandled={() => setReportAutoOpen(null)}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-5">
              <NotificationHistoryTab />
            </TabsContent>
          </Tabs>

          <NewNotificationDialog
            open={chooserOpen}
            onOpenChange={setChooserOpen}
            onPick={handlePickKind}
          />
          <BroadcastComposer
            open={broadcastOpen}
            onOpenChange={setBroadcastOpen}
            actorUserId={user?.id || ''}
          />
        </div>
      </div>
    </Layout>
  );
};

export default NotificationRulesAdmin;
