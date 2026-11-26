import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Facebook, Instagram, Megaphone, Upload, Plus, RefreshCw, Pause, Play, ExternalLink, Loader2, ImageIcon, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProfilePermissions } from '@/hooks/useProfilePermissions';
import { supabase } from '@/integrations/supabase/client';
import { captureVideoThumbnail } from '@/lib/adMedia';
import { metaConnectorRequest, readConnectorDraft, saveConnectorDraft } from '@/lib/metaConnectorClient';
import { CONNECTOR_DEFAULTS, websiteDestination } from '@/lib/metaConnectorRules';
import { toast } from 'sonner';

type Asset = { id: string; name: string; currency?: string; account_status?: number; website?: string; instagram_business_account?: { id: string; username: string } };
type Setup = { accounts: Asset[]; pages: Asset[]; identities: Record<string, Array<{ id: string; username: string }> | { error: string }> };
type Campaign = { id: string; name: string; account_id: string; status: string; last_error?: string; draft: any; remote: { campaign_id?: string; ad_id?: string; verified?: boolean }; created_at: string };
const empty = { name: '', account_id: '', page_id: '', website: '', text: '', headline: '', description: '', cta: CONNECTOR_DEFAULTS.cta as string, budget: '500', country: 'IN', platforms: ['facebook'] as string[], declaration: '', start: '', end: '', media_path: '', media_kind: 'image', thumbnail_path: '' };
const countries = [['IN','India'],['US','United States'],['GB','United Kingdom'],['AU','Australia'],['CA','Canada'],['AE','United Arab Emirates']];
const categories = [['NONE','None of these'],['CREDIT','Financial products / credit'],['EMPLOYMENT','Employment'],['HOUSING','Housing'],['ISSUES_ELECTIONS_POLITICS','Social issues, elections or politics']];
const ctas = [['LEARN_MORE','Learn More'],['SHOP_NOW','Shop Now'],['SIGN_UP','Sign Up'],['CONTACT_US','Contact Us'],['ORDER_NOW','Order Now']];
export default function MetaAdsConnectorTab() {
 const { user } = useAuth(); const permissions = useProfilePermissions(); const qc = useQueryClient();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[form,setForm]=useState(empty),[file,setFile]=useState<File|null>(null),[id,setId]=useState(()=>crypto.randomUUID()),[preview,setPreview]=useState(''),[platformPreview,setPlatformPreview]=useState('facebook'),[confirm,setConfirm]=useState<{row:Campaign;status:'ACTIVE'|'PAUSED'}|null>(null),[live,setLive]=useState<Record<string,string>>({});
 const [restored,setRestored]=useState(false); const input=useRef<HTMLInputElement>(null);
 const setup = useQuery({queryKey:['meta-connector-setup',user?.id],queryFn:()=>metaConnectorRequest<Setup>({action:'setup'}),staleTime:10*60*1000,retry:false});
 const list = useQuery({queryKey:['meta-connector-campaigns',user?.id],queryFn:()=>metaConnectorRequest<{rows:Campaign[]}>({action:'list'}),retry:false});
 const canCreate=permissions.hasPermission('comm_meta_connector_campaigns','can_create');
 const canEdit=permissions.hasPermission('comm_meta_connector_campaigns','can_edit');
 const account=setup.data?.accounts.find(a=>a.id===form.account_id),page=setup.data?.pages.find(a=>a.id===form.page_id);
 const available=setup.data?.identities[form.account_id];
 const instagram=Array.isArray(available)?available.find(i=>i.id===page?.instagram_business_account?.id):undefined;
 useEffect(()=>{if(!user)return;let alive=true;readConnectorDraft(user.id).then(v=>{if(alive&&v){setForm(v.form);setId(v.id);setFile(v.file||null);}if(alive)setRestored(true);}).catch(()=>setRestored(true));return()=>{alive=false;};},[user?.id]);
 useEffect(()=>{if(!user||!restored)return;const timer=setTimeout(()=>{saveConnectorDraft(user.id,{form,id,file}).catch(()=>setError('Could not save the local draft. Keep this page open until it is saved.'));},300);return()=>clearTimeout(timer);},[user?.id,form,id,file,restored]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>{if(!setup.data||!restored)return;setForm(f=>({...f,account_id:f.account_id||setup.data.accounts[0]?.id||'',page_id:f.page_id||setup.data.pages[0]?.id||''}));},[setup.data,restored]);
 const update=(key: keyof typeof empty,value:any)=>setForm(f=>({...f,[key]:value}));
 const refresh=()=>qc.invalidateQueries({queryKey:['meta-connector-campaigns']});
 const chooseFile=(next:File|undefined)=>{if(!next)return;const video=next.type==='video/mp4';if(!['image/jpeg','image/png','video/mp4'].includes(next.type)){setError('Choose a JPG or PNG image, or an MP4 video.');return;}if(next.size>(video?20:8)*1024*1024){setError(video?'Video must be under 20 MB.':'Image must be under 8 MB.');return;}setFile(next);setForm(f=>({...f,media_path:'',thumbnail_path:'',media_kind:video?'video':'image'}));setError('');};
 const upload=async()=>{
  if(!user||!file)throw new Error('Choose an image or video.');
  const mediaId=crypto.randomUUID();
  const path=`connector/${user.id}/${mediaId}.${file.type==='video/mp4'?'mp4':file.type==='image/png'?'png':'jpg'}`;
  const r=await supabase.storage.from('meta-media').upload(path,file,{upsert:false,contentType:file.type});if(r.error&&!/already exists|duplicate/i.test(r.error.message))throw r.error;
  let thumbnail_path='';if(file.type==='video/mp4'){const blob=await captureVideoThumbnail(file);thumbnail_path=`connector/${user.id}/${mediaId}-thumb.jpg`;const thumb=await supabase.storage.from('meta-media').upload(thumbnail_path,blob,{contentType:'image/jpeg',upsert:false});if(thumb.error)throw thumb.error;}
  return {media_path:path,thumbnail_path,media_kind:file.type==='video/mp4'?'video':'image'};
 };
 const create=async()=>{
  setError('');setBusy(true);
  try{
   if(!form.name.trim()||!form.text.trim()||!form.headline.trim())throw new Error('Enter a campaign name, primary text, and headline.');
   if(!form.declaration)throw new Error('Confirm the special ad category.');
   if(!form.platforms.length)throw new Error('Choose Facebook or Instagram.');
   if(form.platforms.includes('instagram')&&!instagram)throw new Error('Instagram is not verified for this Page and account.');
   const website=websiteDestination(form.website);if(!Number.isFinite(Number(form.budget))||Number(form.budget)<=0)throw new Error('Enter a daily budget greater than zero.');
   const media=form.media_path?{media_path:form.media_path,thumbnail_path:form.thumbnail_path,media_kind:form.media_kind}:await upload();
   const next={...form,...media};setForm(next);if(user)await saveConnectorDraft(user.id,{form:next,id,file});
   const r=await metaConnectorRequest({action:'create',id,draft:{name:form.name,account_id:form.account_id,page_id:form.page_id,instagram_id:form.platforms.includes('instagram')?instagram?.id:undefined,website,text:form.text,headline:form.headline,description:form.description,cta:form.cta,budget:Number(form.budget),countries:[form.country],platforms:form.platforms,categories:form.declaration==='NONE'?[]:[form.declaration],declaration_confirmed:true,...media,...(form.start?{start:new Date(form.start).toISOString()}:{}),...(form.end?{end:new Date(form.end).toISOString()}:{})}});
   await refresh();setOpen(false);toast.success(r.pending?'Video is processing on Meta. Resume preparation when ready.':'Campaign created paused.');
   setForm({...empty,account_id:form.account_id,page_id:form.page_id,website:form.website});setId(crypto.randomUUID());setFile(null);
  }catch(e){setError(e instanceof Error?e.message:String(e));await refresh();}finally{setBusy(false);}
 };
 const act=async(row:Campaign,action:string,status?:'ACTIVE'|'PAUSED')=>{setBusy(true);setError('');try{const r=await metaConnectorRequest({action,id:row.id,...(status?{status,confirmed:true}:{})});if(r.ad)setLive(v=>({...v,[row.id]:r.ad.effective_status}));toast.success(r.pending?'Video still processing on Meta.':'Campaign updated.');await refresh();setConfirm(null);}catch(e){setError(e instanceof Error?e.message:String(e));await refresh();}finally{setBusy(false);}};
 const setupError=setup.error instanceof Error?setup.error.message:'';
 const listError=list.error instanceof Error?list.error.message:'';
 return <section className="space-y-6 max-w-6xl mx-auto">
  <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-5"><div><div className="flex items-center gap-2"><Megaphone className="h-6 w-6 text-primary"/><h2 className="text-2xl font-semibold">Meta Ads Connector</h2></div><div className="flex flex-wrap gap-2 mt-3">{setup.data?.accounts.map(a=><Badge variant="outline" key={a.id}>{a.name} · {a.currency}</Badge>)}{setup.data?.pages.map(p=><Badge variant="secondary" key={p.id}>{p.name}</Badge>)}</div></div><div className="flex gap-2"><Button variant="outline" size="icon" title="Refresh account and campaigns" aria-label="Refresh account and campaigns" disabled={busy} onClick={()=>{setup.refetch();list.refetch();}}><RefreshCw className="h-4 w-4"/></Button><Button disabled={!canCreate||!setup.data||busy} onClick={()=>{setError('');setOpen(true);}}><Plus className="h-4 w-4 mr-2"/>New Campaign</Button></div></div>
  {(error||setupError||listError)&&<div role="alert" className="flex gap-2 border border-destructive/40 bg-destructive/10 text-destructive p-3 rounded-md text-sm break-words"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5"/><span>{error||setupError||listError}</span></div>}
  {setup.isLoading||list.isLoading?<div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin"/>Loading connected account…</div>:<>
   <div className="flex justify-between items-center"><h3 className="font-semibold">Connector campaigns</h3><Badge variant="outline">{list.data?.rows.length??0}</Badge></div>
   {!list.data?.rows.length?<div className="border-y py-12 text-center text-muted-foreground"><Megaphone className="h-8 w-8 mx-auto mb-3"/><p>No connector campaigns yet.</p></div>:<div className="divide-y border-y">{list.data.rows.map(row=><article key={row.id} className="py-4 flex flex-wrap justify-between gap-3"><div className="min-w-0 flex-1"><h4 className="font-medium break-words">{row.name}</h4><div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground"><Badge variant="outline">{live[row.id]||row.status.replaceAll('_',' ')}</Badge><span>{row.draft.budget} {setup.data?.accounts.find(a=>a.id===row.account_id)?.currency} / day</span><span>{new Date(row.created_at).toLocaleDateString()}</span></div>{row.last_error&&<p className="text-sm text-destructive mt-2 break-words">{row.last_error}</p>}</div><div className="flex items-center flex-wrap gap-2">{row.remote.ad_id&&row.remote.verified?<><Button variant="outline" size="icon" title="Check delivery status" aria-label={`Check status for ${row.name}`} disabled={busy} onClick={()=>act(row,'refresh')}><RefreshCw className="h-4 w-4"/></Button><Button variant="outline" disabled={busy||!canEdit} onClick={()=>setConfirm({row,status:row.status==='ACTIVE'?'PAUSED':'ACTIVE'})}>{row.status==='ACTIVE'?<Pause className="h-4 w-4 mr-2"/>:<Play className="h-4 w-4 mr-2"/>}{row.status==='ACTIVE'?'Pause':'Activate'}</Button></>:<Button variant="outline" disabled={busy||!canCreate||row.status==='PREPARING'} onClick={()=>act(row,'resume')}>Resume preparation</Button>}{row.remote.campaign_id&&<Button variant="ghost" size="icon" title="Open in Meta Ads Manager" aria-label={`Open ${row.name} in Ads Manager`} asChild><a target="_blank" rel="noopener noreferrer" href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${row.account_id.replace('act_','')}&selected_campaign_ids=${row.remote.campaign_id}`}><ExternalLink className="h-4 w-4"/></a></Button>}</div></article>)}</div>}
  </>}
  <Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent className="max-w-5xl w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>New Campaign</DialogTitle><DialogDescription>Website traffic · Link clicks · Created paused</DialogDescription></DialogHeader>
   <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
    <div className="space-y-4 min-w-0">
     <Field label="Campaign name"><Input value={form.name} onChange={e=>update('name',e.target.value)} maxLength={150} required/></Field>
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Ad account"><Picker value={form.account_id} onChange={v=>{update('account_id',v);update('platforms',['facebook']);}} options={(setup.data?.accounts||[]).map(a=>[a.id,a.name])}/></Field><Field label="Facebook Page"><Picker value={form.page_id} onChange={v=>{update('page_id',v);update('platforms',['facebook']);const p=setup.data?.pages.find(p=>p.id===v);if(!form.website&&p?.website?.startsWith('https://'))update('website',p.website);}} options={(setup.data?.pages||[]).map(p=>[p.id,p.name])}/></Field></div>
     <Field label="Image or video"><input ref={input} type="file" accept="image/jpeg,image/png,video/mp4" className="hidden" aria-label="Campaign media" onChange={e=>chooseFile(e.target.files?.[0])}/><div className="border border-dashed rounded-md p-4 flex flex-wrap items-center gap-3" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();chooseFile(e.dataTransfer.files[0]);}}><Upload className="h-6 w-6 text-muted-foreground"/><div className="flex-1 min-w-0 text-sm"><p className="truncate">{file?.name||'JPG / PNG · 8 MB   |   MP4 · 20 MB'}</p></div><Button variant="outline" size="sm" onClick={()=>input.current?.click()}>Choose file</Button></div></Field>
     <Field label="Primary text"><Textarea value={form.text} onChange={e=>update('text',e.target.value)} rows={3} maxLength={2000}/></Field>
     <Field label="Headline"><Input value={form.headline} onChange={e=>update('headline',e.target.value)} maxLength={255}/></Field>
     <Field label="Description (optional)"><Input value={form.description} onChange={e=>update('description',e.target.value)} maxLength={255}/></Field>
     <Field label="Website URL"><Input type="url" placeholder="https://" value={form.website} onChange={e=>update('website',e.target.value)}/></Field>
     <Field label="Call to action"><Picker value={form.cta} onChange={v=>update('cta',v)} options={ctas}/></Field>
     <fieldset className="space-y-3"><legend className="text-sm font-medium mb-2">Feed placements</legend><div className="flex flex-wrap gap-5">{['facebook','instagram'].map(p=><label key={p} className="flex items-center gap-2 text-sm"><Checkbox checked={form.platforms.includes(p)} disabled={p==='instagram'&&!instagram} onCheckedChange={checked=>update('platforms',checked?[...form.platforms,p]:form.platforms.filter(v=>v!==p))}/>{p==='facebook'?<Facebook className="h-4 w-4"/>:<Instagram className="h-4 w-4"/>}{p==='facebook'?'Facebook':instagram?`Instagram · @${instagram.username}`:'Instagram (not verified)'}</label>)}</div>{!instagram&&<p className="text-xs text-muted-foreground">No matching Instagram identity for this Page and ad account.</p>}</fieldset>
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label={`Daily budget (${account?.currency||'account currency'})`}><Input type="number" min="0.01" step="0.01" value={form.budget} onChange={e=>update('budget',e.target.value)}/></Field><Field label="Audience country"><Picker value={form.country} onChange={v=>update('country',v)} options={countries}/></Field></div>
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Start (optional, local time)"><Input type="datetime-local" value={form.start} onChange={e=>update('start',e.target.value)}/></Field><Field label="End (optional, local time)"><Input type="datetime-local" value={form.end} onChange={e=>update('end',e.target.value)}/></Field></div>
     <Field label="Special ad category"><Picker value={form.declaration} onChange={v=>update('declaration',v)} options={categories} placeholder="Confirm category"/></Field>
    </div>
    <div className="min-w-0"><div className="flex justify-between items-center mb-3"><h3 className="text-sm font-medium">Feed preview</h3><div className="flex gap-1">{['facebook','instagram'].map(p=><Button key={p} variant={platformPreview===p?'secondary':'ghost'} size="icon" title={`${p} preview`} aria-label={`${p} preview`} onClick={()=>setPlatformPreview(p)}>{p==='facebook'?<Facebook className="h-4 w-4"/>:<Instagram className="h-4 w-4"/>}</Button>)}</div></div><div className="border rounded-md overflow-hidden bg-card"><div className="p-3 flex items-center gap-2"><div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">{platformPreview==='facebook'?<Facebook className="h-5 w-5 text-primary"/>:<Instagram className="h-5 w-5 text-primary"/>}</div><div className="min-w-0"><p className="text-sm font-semibold break-words">{platformPreview==='instagram'&&instagram?instagram.username:page?.name||'Page'}</p><p className="text-xs text-muted-foreground">Sponsored</p></div></div>{form.text&&<p className="px-3 pb-3 text-sm whitespace-pre-wrap break-words">{form.text}</p>}<div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">{preview?form.media_kind==='video'?<video className="w-full h-full object-contain" src={preview} controls playsInline/>:<img className="w-full h-full object-contain" src={preview} alt="Campaign media preview"/>:<ImageIcon className="h-12 w-12 text-muted-foreground"/>}</div><div className="bg-muted/50 p-3 flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-xs text-muted-foreground truncate">{form.website}</p><p className="text-sm font-semibold break-words">{form.headline}</p><p className="text-xs text-muted-foreground break-words">{form.description}</p></div><span className="text-xs font-medium shrink-0">{ctas.find(c=>c[0]===form.cta)?.[1]}</span></div></div></div>
   </div>
   {error&&<p role="alert" className="text-sm text-destructive break-words">{error}</p>}
   <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Close</Button><Button disabled={busy||!canCreate} onClick={create}>{busy?<Loader2 className="h-4 w-4 animate-spin mr-2"/>:<Pause className="h-4 w-4 mr-2"/>}Create paused campaign</Button></DialogFooter>
  </DialogContent></Dialog>
  <Dialog open={!!confirm} onOpenChange={v=>{if(!busy&&!v)setConfirm(null);}}><DialogContent><DialogHeader><DialogTitle>{confirm?.status==='ACTIVE'?'Activate campaign?':'Pause campaign?'}</DialogTitle><DialogDescription>{confirm?.row.name}{confirm?.status==='ACTIVE'?` · ${confirm.row.draft.budget} ${setup.data?.accounts.find(a=>a.id===confirm.row.account_id)?.currency||''} daily budget. Meta may begin charging after approval.`:' · Delivery will be paused.'}</DialogDescription></DialogHeader>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setConfirm(null)}>Cancel</Button><Button disabled={busy} onClick={()=>confirm&&act(confirm.row,'status',confirm.status)}>{busy&&<Loader2 className="h-4 w-4 animate-spin mr-2"/>}{confirm?.status==='ACTIVE'?'Confirm activation':'Confirm pause'}</Button></DialogFooter></DialogContent></Dialog>
 </section>;
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-1.5"><Label className="text-sm">{label}</Label>{children}</div>;}
function Picker({value,onChange,options,placeholder='Select'}:{value:string;onChange:(v:string)=>void;options:string[][];placeholder?:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder={placeholder}/></SelectTrigger><SelectContent>{options.map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>;}
