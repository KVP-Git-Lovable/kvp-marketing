import { AlertCircle, ExternalLink, Facebook, ImageIcon, Instagram, Loader2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { metaConnectorRequest } from '@/lib/metaConnectorClient';

type CampaignRow = {
  id: string;
  name: string;
  account_id: string;
  status: string;
  draft: Record<string, any>;
  remote: { campaign_id?: string };
};

type Issue = { error_message?: string; message?: string; summary?: string; level?: string };
type Insight = {
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  adset_id?: string;
};
type Adset = {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  billing_event?: string;
  optimization_goal?: string;
  promoted_object?: Record<string, any>;
  targeting?: Record<string, any>;
  attribution_spec?: Array<Record<string, any>>;
  learning_stage_info?: { status?: string };
  start_time?: string;
  end_time?: string;
  issues_info?: Issue[];
};
type Ad = {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  effective_status?: string;
  issues_info?: Issue[];
  ad_review_feedback?: Record<string, any>;
  creative?: {
    id: string;
    name?: string;
    thumbnail_url?: string;
    image_url?: string;
    instagram_user_id?: string;
    object_story_spec?: Record<string, any>;
  };
};
type Details = {
  account: { id: string; name: string; currency: string; timezone_name?: string } | null;
  campaign: {
    id: string;
    name: string;
    objective?: string;
    status: string;
    effective_status?: string;
    buying_type?: string;
    special_ad_categories?: string[];
    created_time?: string;
    updated_time?: string;
    issues_info?: Issue[];
    advantage_state_info?: { advantage_state?: string };
  } | null;
  adsets: Adset[];
  ads: Ad[];
  insights: Insight | null;
  adsetInsights: Insight[];
  time_range: { since: string; until: string } | null;
};

export default function MetaConnectorCampaignDetails({ row, onClose }: { row: CampaignRow | null; onClose: () => void }) {
  const details = useQuery({
    queryKey: ['meta-connector-campaign-details', row?.id],
    queryFn: () => metaConnectorRequest<Details>({ action: 'details', id: row!.id }),
    enabled: !!row?.remote.campaign_id,
    staleTime: 15 * 60 * 1000,
    retry: false,
  });
  const data = details.data;
  const currency = data?.account?.currency || 'INR';
  const timezone = data?.account?.timezone_name;
  const adsManagerUrl = row?.remote.campaign_id
    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${row.account_id.replace('act_', '')}&selected_campaign_ids=${row.remote.campaign_id}`
    : '';

  return (
    <Dialog open={!!row} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-6xl w-[calc(100%-2rem)] max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle className="break-words">{row?.name}</DialogTitle>
            {data?.campaign && <StatusBadge status={data.campaign.effective_status || data.campaign.status} />}
          </div>
          <DialogDescription>Campaign details from your connected Meta account</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 border-b pb-4">
          <Button variant="outline" size="sm" disabled={details.isFetching || !row?.remote.campaign_id} onClick={() => details.refetch()}>
            <RefreshCw className={`h-4 w-4 mr-2 ${details.isFetching ? 'animate-spin' : ''}`} />Refresh details
          </Button>
          {adsManagerUrl && <Button variant="outline" size="sm" asChild>
            <a href={adsManagerUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Open in Meta Ads Manager</a>
          </Button>}
        </div>

        {details.error && <div role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{details.error instanceof Error ? details.error.message : String(details.error)}</span>
        </div>}
        {details.isLoading && <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading campaign details…</div>}

        {data && !data.campaign && <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">Meta has not finished preparing this campaign yet. The saved draft is shown below.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Detail label="Draft status" value={row?.status.replaceAll('_', ' ')} />
            <Detail label="Daily budget" value={`${row?.draft.budget} ${currency}`} />
            <Detail label="Website" value={row?.draft.website} />
            <Detail label="Audience" value={row?.draft.countries?.join(', ')} />
          </div>
        </div>}

        {data?.campaign && <div className="space-y-8">
          <IssueList issues={data.campaign.issues_info} />

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h3 className="font-semibold">Performance</h3>
              <p className="text-xs text-muted-foreground">{data.time_range ? `${data.time_range.since} to ${data.time_range.until}` : 'Last 30 days'}{timezone ? ` · ${timezone}` : ''}</p>
            </div>
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-3 lg:grid-cols-5">
              <Metric label="Spend" value={formatMajor(data.insights?.spend, currency)} />
              <Metric label="Impressions" value={formatNumber(data.insights?.impressions)} />
              <Metric label="Reach" value={formatNumber(data.insights?.reach)} />
              <Metric label="Link clicks" value={formatNumber(data.insights?.inline_link_clicks)} />
              <Metric label="Cost / link click" value={costPerClick(data.insights, currency)} />
            </div>
            {!data.insights && <p className="text-sm text-muted-foreground">No delivery was recorded in this period.</p>}
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Campaign overview</h3>
            <div className="grid gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Objective" value={humanize(data.campaign.objective)} />
              <Detail label="Configured status" value={humanize(data.campaign.status)} />
              <Detail label="Buying type" value={humanize(data.campaign.buying_type)} />
              <Detail label="Special ad category" value={data.campaign.special_ad_categories?.length ? data.campaign.special_ad_categories.map(humanize).join(', ') : 'None'} />
              <Detail label="Advantage+ state" value={humanize(data.campaign.advantage_state_info?.advantage_state)} />
              <Detail label="Campaign ID" value={data.campaign.id} mono />
              <Detail label="Created" value={formatDate(data.campaign.created_time, timezone)} />
              <Detail label="Last updated" value={formatDate(data.campaign.updated_time, timezone)} />
              <Detail label="Attribution" value={formatAttribution(data.adsets)} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2"><h3 className="font-semibold">Ad sets</h3><Badge variant="outline">{data.adsets.length}</Badge></div>
            {data.adsets.map(adset => {
              const performance = data.adsetInsights.find(item => item.adset_id === adset.id);
              return <article key={adset.id} className="space-y-4 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><h4 className="font-medium break-words">{adset.name}</h4><p className="mt-1 text-xs text-muted-foreground">Ad set ID: {adset.id}</p></div>
                  <StatusBadge status={adset.effective_status || adset.status} />
                </div>
                <IssueList issues={adset.issues_info} />
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Detail label="Budget" value={budget(adset, currency)} />
                  <Detail label="Optimization" value={humanize(adset.optimization_goal)} />
                  <Detail label="Bid strategy" value={humanize(adset.bid_strategy)} />
                  <Detail label="Billing" value={humanize(adset.billing_event)} />
                  <Detail label="Starts" value={formatDate(adset.start_time, timezone)} />
                  <Detail label="Ends" value={formatDate(adset.end_time, timezone)} />
                  <Detail label="Learning" value={humanize(adset.learning_stage_info?.status)} />
                  <Detail label="Promoted object" value={promotedObject(adset.promoted_object)} />
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="mb-2 text-sm font-medium">Audience and placements</p>
                  <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="Countries" value={adset.targeting?.geo_locations?.countries?.join(', ')} />
                    <Detail label="Age range" value={adset.targeting?.age_min ? `${adset.targeting.age_min}–${adset.targeting.age_max || '65+'}` : undefined} />
                    <Detail label="Placements" value={placements(adset.targeting)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <span>Spend: <strong className="font-medium text-foreground">{formatMajor(performance?.spend, currency)}</strong></span>
                  <span>Impressions: <strong className="font-medium text-foreground">{formatNumber(performance?.impressions)}</strong></span>
                  <span>Link clicks: <strong className="font-medium text-foreground">{formatNumber(performance?.inline_link_clicks)}</strong></span>
                </div>
              </article>;
            })}
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2"><h3 className="font-semibold">Ads</h3><Badge variant="outline">{data.ads.length}</Badge></div>
            {data.ads.map(ad => <AdDetails key={ad.id} ad={ad} />)}
          </section>
        </div>}
      </DialogContent>
    </Dialog>
  );
}

function AdDetails({ ad }: { ad: Ad }) {
  const story = ad.creative?.object_story_spec || {};
  const creative = story.link_data || story.video_data || {};
  const image = ad.creative?.thumbnail_url || ad.creative?.image_url;
  const destination = creative.link || creative.call_to_action?.value?.link;
  return <article className="overflow-hidden rounded-lg border">
    <div className="flex flex-wrap items-start justify-between gap-2 border-b p-4">
      <div><h4 className="font-medium break-words">{ad.name}</h4><p className="mt-1 text-xs text-muted-foreground">Ad ID: {ad.id} · Ad set: {ad.adset_id}</p></div>
      <StatusBadge status={ad.effective_status || ad.status} />
    </div>
    <IssueList issues={ad.issues_info} />
    <ReviewFeedback value={ad.ad_review_feedback} />
    <div className="grid gap-4 p-4 md:grid-cols-[180px_minmax(0,1fr)]">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-muted">
        {image ? <img src={image} alt={`${ad.name} creative`} className="h-full w-full object-cover" /> : <ImageIcon className="h-10 w-10 text-muted-foreground" />}
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex gap-2 text-muted-foreground"><Facebook className="h-4 w-4" />{ad.creative?.instagram_user_id && <Instagram className="h-4 w-4" />}<span className="text-xs">Creative ID: {ad.creative?.id || 'Unavailable'}</span></div>
        {creative.message && <p className="whitespace-pre-wrap break-words text-sm">{creative.message}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Headline" value={creative.name || creative.title} />
          <Detail label="Description" value={creative.description || creative.link_description} />
          <Detail label="Destination" value={destination} />
          <Detail label="Call to action" value={humanize(creative.call_to_action?.type)} />
        </div>
      </div>
    </div>
  </article>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-r p-4 last:border-r-0 sm:border-b-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold break-words">{value}</p></div>;
}
function Detail({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 break-words text-sm ${mono ? 'font-mono' : 'font-medium'}`}>{value || 'Not set'}</p></div>;
}
function StatusBadge({ status }: { status: string }) {
  return <Badge variant={status === 'ACTIVE' ? 'default' : status === 'PAUSED' ? 'secondary' : 'outline'}>{humanize(status)}</Badge>;
}
function IssueList({ issues }: { issues?: Issue[] }) {
  if (!issues?.length) return null;
  return <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{issues.map((issue, index) => <p key={index}>{issue.error_message || issue.message || issue.summary || 'Meta reported a delivery issue.'}</p>)}</div>;
}
function ReviewFeedback({ value }: { value?: Record<string, any> }) {
  if (!value || !Object.keys(value).length) return null;
  return <div className="mx-4 mt-4 rounded-md bg-muted/50 p-3 text-sm"><p className="mb-1 font-medium">Ad review feedback</p>{Object.entries(value).map(([key, entry]) => <p key={key} className="break-words text-muted-foreground">{humanize(key)}: {typeof entry === 'string' ? entry : JSON.stringify(entry)}</p>)}</div>;
}
function humanize(value?: string) {
  return value ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : 'Not set';
}
function formatNumber(value?: string) {
  return value === undefined ? '0' : new Intl.NumberFormat('en-IN').format(Number(value));
}
function formatMajor(value: string | undefined, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}
function formatMinor(value: string | undefined, currency: string) {
  return formatMajor(String(Number(value || 0) / 100), currency);
}
function costPerClick(insight: Insight | null, currency: string) {
  const clicks = Number(insight?.inline_link_clicks || 0);
  return clicks ? formatMajor(String(Number(insight?.spend || 0) / clicks), currency) : '—';
}
function budget(adset: Adset, currency: string) {
  if (adset.daily_budget) return `${formatMinor(adset.daily_budget, currency)} / day`;
  if (adset.lifetime_budget) return `${formatMinor(adset.lifetime_budget, currency)} lifetime`;
  return 'Campaign budget';
}
function formatDate(value?: string, timezone?: string) {
  if (!value) return 'Not set';
  try { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(value)); }
  catch { return new Date(value).toLocaleString(); }
}
function placements(targeting?: Record<string, any>) {
  if (!targeting) return 'Not set';
  const platforms = targeting.publisher_platforms || [];
  const positions = [...(targeting.facebook_positions || []), ...(targeting.instagram_positions || [])];
  return [...platforms.map(humanize), ...positions.map(humanize)].join(' · ') || 'Automatic placements';
}
function promotedObject(value?: Record<string, any>) {
  if (!value) return 'Not set';
  if (value.pixel_id) return `Pixel ${value.pixel_id}${value.custom_event_type ? ` · ${humanize(value.custom_event_type)}` : ''}`;
  if (value.application_id) return `App ${value.application_id}`;
  if (value.page_id) return `Page ${value.page_id}`;
  return Object.keys(value).map(humanize).join(', ');
}
function formatAttribution(adsets: Adset[]) {
  const specs = adsets.flatMap(adset => adset.attribution_spec || []);
  if (!specs.length) return 'Not available';
  return specs.map(spec => Object.entries(spec).map(([key, value]) => `${humanize(key)}: ${String(value)}`).join(', ')).join(' · ');
}
