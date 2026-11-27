import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Paperclip, Pause, RotateCcw, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { metaAgentRequest } from '@/lib/metaAgentClient';
import { uploadConnectorMedia, type ConnectorMedia } from '@/lib/metaConnectorMedia';
import type { AgentPlan } from '../../../supabase/functions/meta-agent/plan';
import { toast } from 'sonner';

type Message = { role: 'user' | 'assistant'; content: string };
type Assets = {
  account: { name: string }; page: { name: string }; instagram: { username: string } | null;
  lead_forms: Array<{ id: string; name: string }>; customer_lists: Array<{ id: string; name: string; people: number }>;
};
type ChatReply = { reply: string; options?: string[]; plan?: AgentPlan; assets?: Assets };

const CATEGORIES = [['NONE', 'None of these'], ['CREDIT', 'Financial products / credit'], ['EMPLOYMENT', 'Employment'], ['HOUSING', 'Housing'], ['ISSUES_ELECTIONS_POLITICS', 'Social issues, elections or politics']];
const EXAMPLE = 'Use the attached image and run a campaign from 1 December to 10 December with Rs 5,000 total budget, for women aged 25 to 65 in Karnataka, sending them to https://example.com';
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default function MetaAgentChat({ canCreate }: { canCreate: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [runId, setRunId] = useState(() => crypto.randomUUID());
  // One id per proposed plan, so pressing the button again resumes the same Meta campaign instead of making another.
  const [campaignId, setCampaignId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [media, setMedia] = useState<(ConnectorMedia & { preview: string; name: string }) | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState<'' | 'chat' | 'upload' | 'create'>('');
  const [error, setError] = useState('');

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [messages, plan, busy]);

  const attach = async (file?: File) => {
    if (!file || !user) return;
    setBusy('upload'); setError('');
    try {
      const uploaded = await uploadConnectorMedia(user.id, file);
      setMedia({ ...uploaded, preview: URL.createObjectURL(file), name: file.name });
      setPlan(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed'); } finally { setBusy(''); }
  };
  const mediaBody = media ? { media_path: media.media_path, media_kind: media.media_kind, ...(media.thumbnail_path ? { thumbnail_path: media.thumbnail_path } : {}) } : undefined;

  const send = async (value = text) => {
    const content = value.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next); setText(''); setOptions([]); setPlan(null); setError(''); setBusy('chat');
    try {
      const r = await metaAgentRequest<ChatReply>({ action: 'chat', run_id: runId, messages: next.slice(-40), ...(mediaBody ? { media: mediaBody } : {}) });
      setMessages([...next, { role: 'assistant', content: r.reply.slice(0, 4000) }]);
      setOptions(r.options || []);
      if (r.plan) { setPlan(r.plan); setAssets(r.assets || null); setCategory(''); setCampaignId(crypto.randomUUID()); }
    } catch (e) { setError(e instanceof Error ? e.message : 'The agent could not answer'); setMessages(messages); setText(content); } finally { setBusy(''); }
  };

  const reset = () => { setRunId(crypto.randomUUID()); setCampaignId(crypto.randomUUID()); setMessages([]); setText(''); setMedia(null); setOptions([]); setPlan(null); setCategory(''); setError(''); };

  const create = async () => {
    if (!plan || !mediaBody) return;
    setBusy('create'); setError('');
    try {
      const r = await metaAgentRequest<{ pending?: boolean }>({ action: 'create', run_id: runId, campaign_id: campaignId, plan, media: mediaBody, messages: messages.slice(-40), category });
      toast.success(r.pending ? 'Video is processing on Meta. Use "Resume preparation" on the campaign when ready.' : 'Campaign created paused. Review it, then Activate it from the campaign list.');
      await qc.invalidateQueries({ queryKey: ['meta-connector-campaigns'] });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the campaign');
      await qc.invalidateQueries({ queryKey: ['meta-connector-campaigns'] });
    } finally { setBusy(''); }
  };

  const rows: Array<[string, string]> = plan ? [
    ['Objective', plan.objective === 'leads' ? 'Lead generation (Instant Form)' : 'Website traffic'],
    ['Budget', `₹${plan.budget.toLocaleString('en-IN')} ${plan.budget_type === 'lifetime' ? 'total' : 'per day'}`],
    ['Dates', `${when(plan.start) || 'Starts when activated'} → ${when(plan.end) || 'no end date'}`],
    ['Audience', `${plan.genders.length === 1 ? (plan.genders[0] === 2 ? 'Women' : 'Men') : 'Everyone'}, ${plan.age_min}–${plan.age_max}, ${plan.regions?.length ? plan.regions.map((r) => r.name).join(', ') : 'all of India'}`],
    ...(plan.audience_id ? [['Customer list', assets?.customer_lists.find((a) => a.id === plan.audience_id)?.name || plan.audience_id] as [string, string]] : []),
    ['Placements', plan.platforms.map((p) => (p === 'facebook' ? 'Facebook feed' : 'Instagram feed')).join(', ')],
    [plan.objective === 'leads' ? 'Lead form' : 'Website', plan.objective === 'leads' ? assets?.lead_forms.find((f) => f.id === plan.lead_form_id)?.name || plan.lead_form_id || '' : plan.website || ''],
    ['Account · Page', `${assets?.account.name || ''} · ${assets?.page.name || ''}`],
  ] : [];

  return (
    <div className="space-y-3">
      <div className="h-[46dvh] min-h-[260px] overflow-y-auto rounded-md border bg-muted/20 p-3 space-y-3">
        {!messages.length && (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Describe the campaign you want. Attach the image or video it should use. I will ask for anything that is missing and show you the plan before anything is created.</p>
            <button type="button" className="text-left underline underline-offset-2" onClick={() => setText(EXAMPLE)}>Try an example</button>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <p className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border'}`}>{m.content}</p>
          </div>
        ))}
        {options.length > 0 && <div className="flex flex-wrap gap-2">{options.map((o) => <Button key={o} size="sm" variant="outline" disabled={!!busy} onClick={() => send(o)}>{o}</Button>)}</div>}
        {plan && (
          <div className="rounded-lg border bg-card p-3 space-y-3">
            <p className="font-semibold">{plan.name}</p>
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              {media && (media.media_kind === 'video'
                ? <video src={media.preview} className="w-full rounded-md" controls playsInline />
                : <img src={media.preview} alt="Ad media" className="w-full rounded-md object-cover" />)}
              <div className="min-w-0 text-sm space-y-1">
                <p className="whitespace-pre-wrap break-words">{plan.text}</p>
                <p className="font-semibold break-words">{plan.headline}</p>
                {plan.description && <p className="text-muted-foreground break-words">{plan.description}</p>}
                <p className="text-xs text-muted-foreground">Button: {plan.cta.replace(/_/g, ' ').toLowerCase()}</p>
              </div>
            </div>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-sm">{rows.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="break-words">{v}</dd></div>)}</dl>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <p className="text-xs text-muted-foreground mb-1">Special ad category (your declaration)</p>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Confirm category" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button disabled={!canCreate || !!busy || !category || !media} onClick={create}>{busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pause className="h-4 w-4 mr-2" />}Create paused</Button>
            </div>
            {!media && <p className="text-xs text-destructive">Attach an image or video to create this campaign.</p>}
            <p className="text-xs text-muted-foreground">To change anything, just say so below. Nothing spends money until you activate the campaign.</p>
          </div>
        )}
        {busy === 'chat' && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Thinking…</p>}
        <div ref={bottom} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
      {media && <div className="flex items-center gap-2 text-sm"><Paperclip className="h-4 w-4" /><span className="truncate">{media.name}</span><Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Remove attachment" onClick={() => { setMedia(null); setPlan(null); }}><X className="h-3 w-3" /></Button></div>}
      <div className="flex items-end gap-2">
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,video/mp4" className="hidden" aria-label="Attach ad media" onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ''; }} />
        <Button variant="outline" size="icon" title="Attach image or video" aria-label="Attach image or video" disabled={!!busy || !canCreate} onClick={() => fileInput.current?.click()}>{busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}</Button>
        <Textarea rows={2} className="flex-1" value={text} maxLength={4000} placeholder="Describe your campaign…" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <Button size="icon" aria-label="Send" disabled={!!busy || !text.trim() || !canCreate} onClick={() => send()}><Send className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" title="Start over" aria-label="Start over" disabled={!!busy || !messages.length} onClick={reset}><RotateCcw className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
