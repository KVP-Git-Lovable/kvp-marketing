import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { adsetGoal, budgetChangeProblem, budgetFields, buildTargeting, campaignPayload, creativeLink, LEAD_CTAS, TRAFFIC_CTAS } from './rules.ts';
import { AGENT_BUDGET_COOLDOWN_HOURS, AGENT_MAX_BUDGET_STEP, AGENT_MAX_DAILY_BUDGET, AGENT_MAX_TOTAL_BUDGET } from '../_shared/meta-agent-limits.ts';
import { AUDIENCE_MAX_ROWS, AUDIENCE_SCHEMA, prepareAudience } from './audience.ts';
import { leadRows, type MetaLead } from './leads.ts';
import { buildLeadFormPayload, validateLeadForm, type LeadFormInput } from '../_shared/meta-leadforms.ts';
const GATEWAY = 'https://connector-gateway.lovable.dev/meta_ads/v26.0';
const numeric = z.string().regex(/^\d+$/);
const draftSchema = z.object({
  name: z.string().trim().min(1).max(150), account_id: z.string().regex(/^act_\d+$/), page_id: numeric,
  instagram_id: numeric.optional(), website: z.string().url().refine(v => { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; }).optional(),
  objective: z.enum(['traffic','leads']).default('traffic'), lead_form_id: numeric.optional(), audience_id: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(2000), headline: z.string().trim().min(1).max(255), description: z.string().max(255).default(''),
  cta: z.enum([...TRAFFIC_CTAS, 'GET_QUOTE', 'APPLY_NOW', 'SUBSCRIBE', 'DOWNLOAD']),
  budget_type: z.enum(['daily','lifetime']).default('daily'),
  age_min: z.number().int().min(18).max(65).optional(), age_max: z.number().int().min(18).max(65).optional(),
  genders: z.array(z.union([z.literal(1), z.literal(2)])).max(2).optional(),
  regions: z.array(z.object({ key: numeric, name: z.string().min(1).max(120) })).max(10).optional(),
  budget: z.number().positive().max(1000000), countries: z.array(z.enum(['IN','US','GB','AU','CA','AE'])).min(1).max(6),
  platforms: z.array(z.enum(['facebook','instagram'])).min(1).max(2),
  categories: z.array(z.enum(['CREDIT','EMPLOYMENT','HOUSING','ISSUES_ELECTIONS_POLITICS'])), declaration_confirmed: z.literal(true),
  start: z.string().datetime().optional(), end: z.string().datetime().optional(),
  media_path: z.string().min(1).max(500), media_kind: z.enum(['image','video']), thumbnail_path: z.string().max(500).optional(),
}).superRefine((d, c) => {
  if (d.objective === 'traffic' && !d.website) c.addIssue({code:'custom',message:'Enter the website URL.'});
  if (d.objective === 'leads' && !d.lead_form_id) c.addIssue({code:'custom',message:'Choose or create a lead form.'});
  if (!(d.objective === 'leads' ? LEAD_CTAS : TRAFFIC_CTAS).some(v => v === d.cta)) c.addIssue({code:'custom',message:'This button is not available for the chosen campaign type.'});
  if (d.platforms.includes('instagram') && !d.instagram_id) c.addIssue({code:'custom',message:'Select a verified Instagram identity.'});
  if (d.budget_type === 'lifetime' && !d.end) c.addIssue({code:'custom',message:'A total (lifetime) budget needs an end date.'});
  if ((d.age_min ?? 18) > (d.age_max ?? 65)) c.addIssue({code:'custom',message:'The minimum age is above the maximum age.'});
  if (d.categories.length && ((d.age_min ?? 18) > 18 || (d.age_max ?? 65) < 65 || d.genders?.length === 1)) c.addIssue({code:'custom',message:'Meta does not allow age or gender targeting for this special ad category.'});
  if (d.media_kind === 'video' && !d.thumbnail_path) c.addIssue({code:'custom',message:'Video thumbnail is required.'});
  if (d.end && Date.parse(d.end) <= Math.max(Date.now(), d.start ? Date.parse(d.start) : 0)) c.addIssue({code:'custom',message:'End time must be after the start time and in the future.'});
});
const schema = z.discriminatedUnion('action',[
 z.object({action:z.literal('setup')}), z.object({action:z.literal('list')}),
 z.object({action:z.literal('create'), id:z.string().uuid(), draft:draftSchema}),
 z.object({action:z.literal('resume'),id:z.string().uuid()}),
 z.object({action:z.literal('status'),id:z.string().uuid(),status:z.enum(['ACTIVE','PAUSED']),confirmed:z.literal(true)}),
 z.object({action:z.literal('refresh'),id:z.string().uuid()}),
 z.object({action:z.literal('details'),id:z.string().uuid()}),
 z.object({action:z.literal('check')}), z.object({action:z.literal('lead_forms')}),
 z.object({action:z.literal('create_lead_form'),form:z.record(z.unknown())}),
 z.object({action:z.literal('sync_leads'),id:z.string().uuid()}),
 z.object({action:z.literal('audiences')}),
 z.object({action:z.literal('search_region'),query:z.string().trim().min(2).max(80),country:z.string().length(2).default('IN')}),
 z.object({action:z.literal('insights'),id:z.string().uuid()}),
 z.object({action:z.literal('set_budget'),id:z.string().uuid(),amount:z.number().positive().max(1000000),confirmed:z.literal(true)}),
 z.object({action:z.literal('create_audience'),name:z.string().trim().min(1).max(100),consent_confirmed:z.literal(true),
  rows:z.array(z.object({first_name:z.string().max(100).optional(),last_name:z.string().max(100).optional(),email:z.string().max(254).optional(),phone:z.string().max(40).optional()})).min(1).max(AUDIENCE_MAX_ROWS)}),
]);
class ProviderError extends Error { constructor(public status:number, public details:unknown) { super(JSON.stringify(details)); } }
// pageToken: lead forms and leads belong to the Page, so Meta wants the Page's own access token for them.
async function graph(path:string, body?:Record<string,unknown>, params:Record<string,string>={}, pageToken?:string) {
 const key=Deno.env.get('LOVABLE_API_KEY'), connection=Deno.env.get('META_ADS_API_KEY');
 if (!key || !connection) throw new Error('The Meta Ads connector credentials are unavailable.');
 const url=new URL(`${GATEWAY}/${path}`); Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
 if(pageToken)url.searchParams.set('access_token',pageToken);
 const r=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${key}`,'X-Connection-Api-Key':connection,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if (!r.ok) { const details=await r.text(); console.error('Meta connector request failed',r.status,details); throw new ProviderError(r.status,details); }
 const data=await r.json(); if(data.error) throw new ProviderError(400,data.error); return data;
}
async function pages(path:string, fields:string) {
 const out:any[]=[]; let after:string|undefined;
 for(let i=0;i<10;i++) { const r=await graph(path,undefined,{fields,limit:'100',...(after?{after}:{})});out.push(...(r.data||[]));after=r.paging?.cursors?.after;if(!r.paging?.next || !after) return out; }
 throw new Error('Asset list is too large. Narrow the connected assets in Meta before continuing.');
}
async function pageAccessToken(pageId:string): Promise<string|undefined> {
 try { const r=await graph(pageId,undefined,{fields:'access_token'}); return r.access_token || undefined; } catch { return undefined; }
}
const providerMessage=(e:unknown)=>{
 if(e instanceof ProviderError){let d:any=e.details;if(typeof d==='string'){try{d=JSON.parse(d);}catch{return d.slice(0,400);}}return String(d?.error?.error_user_msg||d?.error?.message||d?.message||JSON.stringify(d)).slice(0,400);}
 return e instanceof Error?e.message:String(e);
};
function reportDate(timezone:string, daysAgo=0) {
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const part=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
 return new Date(Date.UTC(part('year'),part('month')-1,part('day')-daysAgo)).toISOString().slice(0,10);
}
Deno.serve(async(req)=>{
 const build={'X-Connector-Build':'agent-2026-11-26','Access-Control-Expose-Headers':'x-connector-build'};
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,...build,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response('ok',{headers:{...corsHeaders,...build}});
 if(req.method!=='POST')return json({error:'POST required'},405);
 let rowId:string|undefined; let db:any;
 try {
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)throw new Error('Backend configuration unavailable');
 db=createClient(url,key);const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token)return json({error:'Sign in to continue'},401);
 const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return json({error:'Sign in again to continue'},401);
 const parsed=schema.safeParse(await req.json());if(!parsed.success)return json({error:parsed.error.issues.map(i=>i.message).join(' ')},400);
 const b=parsed.data;const permission=['create','resume','create_lead_form','create_audience'].includes(b.action)?'can_create':['status','set_budget'].includes(b.action)?'can_edit':'can_read';
 const access=await db.rpc('user_has_permission',{_user_id:user.id,_object:'comm_meta_connector_campaigns',_perm:permission});
 if(access.error||access.data!==true)return json({error:'You do not have permission for Meta Ads Connector.'},403);
 const settingsResult=await db.from('meta_connector_settings').select('*').eq('singleton',true).maybeSingle();
 if(settingsResult.error)throw settingsResult.error;const settings=settingsResult.data;
 if(!settings)throw new Error('The saved Meta connector account and Page are missing.');
 if(b.action==='setup') {
 const [account,page]=await Promise.all([graph(settings.account_id,undefined,{fields:'id,name,currency,account_status,timezone_name,funding_source_details'}),graph(settings.page_id,undefined,{fields:'id,name,website,picture,instagram_business_account{id,username}'})]);
 const accounts=[account],pageList=[page];
 const identities:Record<string,unknown>={};for(const a of accounts){try{let list=await pages(`${a.id}/instagram_accounts`,'id,username');if(!list.length)list=await pages(`${a.id}/connected_instagram_accounts`,'id,username');identities[a.id]=list;}catch(e){identities[a.id]={error:e instanceof Error?e.message:String(e)};}}
 return json({accounts,pages:pageList,identities});
 }
 if(b.action==='list'){const r=await db.from('meta_connector_campaigns').select('*').order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;return json({rows:r.data});}
 // Read-only: what this connection is actually allowed to do. Creates nothing.
 if(b.action==='check') {
 const probe=async(label:string,run:()=>Promise<string>)=>{try{return {label,ok:true,detail:await run()};}catch(e){return {label,ok:false,detail:providerMessage(e)};}};
 const token=await pageAccessToken(settings.page_id);
 const checks=[
  await probe('Permissions granted',async()=>{const r=await graph('me/permissions');const g=(r.data||[]).filter((p:any)=>p.status==='granted').map((p:any)=>p.permission);const missing=['ads_management','pages_manage_ads','leads_retrieval'].filter(n=>!g.includes(n));if(missing.length)throw new Error(`Missing: ${missing.join(', ')}. Granted: ${g.join(', ')||'none reported'}`);return g.join(', ');}),
  {label:'Page access token',ok:!!token,detail:token?'Available':'The connector did not return a Page token, which lead forms and leads normally need.'},
  await probe('Lead Ads Terms accepted',async()=>{const r=await graph(settings.page_id,undefined,{fields:'leadgen_tos_accepted'},token);if(r.leadgen_tos_accepted===false)throw new Error('A Page admin must accept them at facebook.com/ads/leadgen/tos');return r.leadgen_tos_accepted===true?'Accepted':'Not reported';}),
  await probe('Read lead forms',async()=>{const r=await graph(`${settings.page_id}/leadgen_forms`,undefined,{fields:'id',limit:'1'},token);return `OK (${(r.data||[]).length?'forms found':'no forms yet'})`;}),
  await probe('Custom audiences',async()=>{await graph(`${settings.account_id}/customaudiences`,undefined,{fields:'id',limit:'1'});return 'Readable';}),
 ];
 return json({checks});
 }
 if(b.action==='search_region') {
 const r=await graph('search',undefined,{type:'adgeolocation',q:b.query,location_types:JSON.stringify(['region']),country_code:b.country,limit:'10'});
 return json({regions:(r.data||[]).map((x:any)=>({key:String(x.key),name:String(x.name),country:String(x.country_name||x.country_code||'')}))});
 }
 if(b.action==='lead_forms') {
 const token=await pageAccessToken(settings.page_id);
 const r=await graph(`${settings.page_id}/leadgen_forms`,undefined,{fields:'id,name,status,leads_count,created_time',limit:'100'},token);
 return json({forms:(r.data||[]).filter((f:any)=>f.status!=='ARCHIVED'&&f.status!=='DELETED').map((f:any)=>({id:String(f.id),external_id:String(f.id),name:String(f.name||'Untitled form'),status:String(f.status||'ACTIVE'),leads_count:Number(f.leads_count||0)}))});
 }
 if(b.action==='create_lead_form') {
 const input=b.form as unknown as LeadFormInput;const problems=validateLeadForm(input);if(problems.length)return json({error:problems.join('. ')},400);
 const token=await pageAccessToken(settings.page_id);
 const created=await graph(`${settings.page_id}/leadgen_forms`,buildLeadFormPayload(input),{},token);
 return json({form:{id:String(created.id),external_id:String(created.id),name:String(input.name).trim(),status:'ACTIVE',leads_count:0}});
 }
 if(b.action==='audiences') {
 const r=await db.from('meta_connector_audiences').select('id,name,row_count,invalid_count,duplicate_count,created_at').eq('account_id',settings.account_id).order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;return json({rows:r.data});
 }
 if(b.action==='create_audience') {
 const prepared=await prepareAudience(b.rows);
 if(!prepared.data.length)return json({error:'No row has a valid email address or phone number.'},400);
 let created:any;
 try { created=await graph(`${settings.account_id}/customaudiences`,{name:b.name,description:'Customer list uploaded from the app',subtype:'CUSTOM',customer_file_source:'USER_PROVIDED_ONLY'}); }
 catch(e){const m=providerMessage(e);if(/custom audience terms|1870090/i.test(m))return json({error:`Accept Meta's Custom Audience terms for this ad account first: https://business.facebook.com/ads/manage/customaudiences/tos/?act=${settings.account_id.replace('act_','')}`},400);throw e;}
 const audienceId=String(created.id);
 try {
  const session_id=Date.now()*1000+Math.floor(Math.random()*1000),size=5000,batches=Math.ceil(prepared.data.length/size);
  for(let i=0;i<batches;i++)await graph(`${audienceId}/users`,{session:{session_id,batch_seq:i+1,last_batch_flag:i===batches-1,estimated_num_total:prepared.data.length},payload:{schema:AUDIENCE_SCHEMA,data:prepared.data.slice(i*size,(i+1)*size)}});
 } catch(e) {
  // Do not leave a half-filled audience behind on Meta.
  try{await fetch(`${GATEWAY}/${audienceId}`,{method:'DELETE',headers:{Authorization:`Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,'X-Connection-Api-Key':Deno.env.get('META_ADS_API_KEY')!}});}catch{/* reported below */}
  throw e;
 }
 const saved=await db.from('meta_connector_audiences').insert({created_by:user.id,account_id:settings.account_id,external_id:audienceId,name:b.name,row_count:prepared.data.length,invalid_count:prepared.invalid,duplicate_count:prepared.duplicates}).select('id,name,row_count,invalid_count,duplicate_count,created_at').single();
 if(saved.error)throw new Error(`The audience exists on Meta (id ${audienceId}) but saving it here failed: ${saved.error.message}`);
 return json({audience:saved.data});
 }
 if(b.action==='create') {
 if(b.draft.account_id!==settings.account_id||b.draft.page_id!==settings.page_id)return json({error:'Use the saved connector account and Page.'},400);
 if(b.draft.audience_id){const a=await db.from('meta_connector_audiences').select('id').eq('id',b.draft.audience_id).eq('account_id',settings.account_id).maybeSingle();if(a.error)throw a.error;if(!a.data)return json({error:'The selected customer list was not found.'},400);}
 const existing=await db.from('meta_connector_campaigns').select('*').eq('id',b.id).maybeSingle();if(existing.error)throw existing.error;
 if(!existing.data) {const ins=await db.from('meta_connector_campaigns').insert({id:b.id,created_by:user.id,account_id:b.draft.account_id,page_id:b.draft.page_id,name:b.draft.name,draft:b.draft});if(ins.error&&ins.error.code!=='23505')throw ins.error;}
 }
 const id='id'in b?b.id:'';const result=await db.from('meta_connector_campaigns').select('*').eq('id',id).maybeSingle();if(result.error)throw result.error;const row=result.data;if(!row)return json({error:'Campaign draft not found'},404);
 if(row.account_id!==settings.account_id||row.page_id!==settings.page_id)throw new Error('This campaign belongs to a different connector setup.');
 if(b.action==='details') {
 const account=await graph(settings.account_id,undefined,{fields:'id,name,currency,timezone_name'});
 if(!row.remote.campaign_id)return json({account,campaign:null,adsets:[],ads:[],insights:null,adsetInsights:[],time_range:null});
 const time_range={since:reportDate(account.timezone_name,29),until:reportDate(account.timezone_name)};
 const insightFields='spend,impressions,reach,clicks,inline_link_clicks,actions,cost_per_action_type,date_start,date_stop';
 const [campaign,adsets,ads,insights,adsetInsights]=await Promise.all([
  graph(row.remote.campaign_id,undefined,{fields:'id,name,objective,status,effective_status,buying_type,special_ad_categories,created_time,updated_time,issues_info,advantage_state_info'}),
  pages(`${row.remote.campaign_id}/adsets`,'id,campaign_id,name,status,effective_status,issues_info,start_time,end_time,daily_budget,lifetime_budget,bid_strategy,billing_event,optimization_goal,promoted_object,targeting,attribution_spec,learning_stage_info'),
  pages(`${row.remote.campaign_id}/ads`,'id,name,adset_id,status,effective_status,issues_info,ad_review_feedback,creative{id,name,thumbnail_url,image_url,object_story_spec,instagram_user_id}'),
  graph(`${row.remote.campaign_id}/insights`,undefined,{fields:insightFields,time_range:JSON.stringify(time_range)}),
  graph(`${row.remote.campaign_id}/insights`,undefined,{fields:`adset_id,adset_name,${insightFields}`,level:'adset',limit:'100',time_range:JSON.stringify(time_range)}),
 ]);
 return json({account,campaign,adsets,ads,insights:insights.data?.[0]||null,adsetInsights:adsetInsights.data||[],time_range});
 }
 if(b.action==='sync_leads') {
 const formId=row.draft.lead_form_id,adId=row.remote.ad_id;
 if(row.draft.objective!=='leads'||!formId)return json({error:'This is not a lead generation campaign.'},400);
 if(!adId)return json({error:'Finish preparing the campaign before syncing leads.'},400);
 const token=await pageAccessToken(settings.page_id);
 const found:MetaLead[]=[];let after:string|undefined,truncated=false;
 for(let i=0;;i++){const r=await graph(`${formId}/leads`,undefined,{fields:'id,created_time,ad_id,field_data',limit:'100',...(after?{after}:{})},token);found.push(...(r.data||[]));after=r.paging?.cursors?.after;if(!r.paging?.next||!after)break;if(i>=49){truncated=true;break;}}
 const rows=leadRows(found,id,formId,adId);
 if(rows.length){const up=await db.from('meta_connector_leads').upsert(rows,{onConflict:'campaign_id,lead_id'});if(up.error)throw up.error;}
 return json({synced:rows.length,truncated});
 }
 if(b.action==='insights') {
 if(!row.remote.campaign_id)return json({days:[]});
 const account=await graph(settings.account_id,undefined,{fields:'timezone_name,currency'});
 const r=await graph(`${row.remote.campaign_id}/insights`,undefined,{fields:'spend,impressions,clicks,inline_link_clicks,frequency,actions,date_start',time_increment:'1',time_range:JSON.stringify({since:reportDate(account.timezone_name,6),until:reportDate(account.timezone_name)}),limit:'50'});
 return json({days:r.data||[],currency:account.currency});
 }
 if(b.action==='set_budget') {
 if(!row.remote.adset_id)throw new Error('This campaign has no ad set yet.');
 const type=row.draft.budget_type==='lifetime'?'lifetime':'daily';
 const problem=budgetChangeProblem(Number(row.draft.budget),b.amount,type,{step:AGENT_MAX_BUDGET_STEP,maxDaily:AGENT_MAX_DAILY_BUDGET,maxTotal:AGENT_MAX_TOTAL_BUDGET,cooldownHours:AGENT_BUDGET_COOLDOWN_HOURS},row.remote.budget_changed_at);
 if(problem)return json({error:problem},400);
 await graph(row.remote.adset_id,budgetFields(type,b.amount));
 const updated=await db.from('meta_connector_campaigns').update({draft:{...row.draft,budget:b.amount},remote:{...row.remote,budget_changed_at:new Date().toISOString()},updated_at:new Date().toISOString()}).eq('id',id).select().single();
 if(updated.error)throw new Error(`Meta accepted the new budget but saving it here failed: ${updated.error.message}`);
 return json({row:updated.data});
 }
 if(b.action==='refresh') { if(!row.remote.ad_id)return json({row}); const ad=await graph(row.remote.ad_id,undefined,{fields:'id,status,effective_status,issues_info,ad_review_feedback'});return json({row,ad}); }
 if(b.action==='status') {
 if(!row.remote.ad_id||!row.remote.adset_id||!row.remote.campaign_id)throw new Error('Complete the paused campaign before activation.');
 if(b.status==='ACTIVE'&&!row.remote.verified)throw new Error('Resume preparation and verify the paused ad before activating it.');
 const chain=b.status==='ACTIVE'?[row.remote.ad_id,row.remote.adset_id,row.remote.campaign_id]:[row.remote.campaign_id,row.remote.ad_id,row.remote.adset_id];
 for(const node of chain)await graph(node,{status:b.status});
 const ad=await graph(row.remote.ad_id,undefined,{fields:'id,status,effective_status'});const updated=await db.from('meta_connector_campaigns').update({status:b.status,last_error:null,updated_at:new Date().toISOString()}).eq('id',id).select().single();if(updated.error)throw updated.error;return json({row:updated.data,ad});
 }
 if(row.remote.ad_id&&row.status==='PAUSED')return json({row});
 // Atomic lease prevents concurrent requests creating the same chain. Stale leases are resumable.
 const lock=await db.from('meta_connector_campaigns').update({status:'PREPARING',updated_at:new Date().toISOString()}).eq('id',id).or(`status.neq.PREPARING,updated_at.lt.${new Date(Date.now()-180000).toISOString()}`).select().maybeSingle();if(lock.error)throw lock.error;if(!lock.data)return json({error:'Campaign preparation is already in progress. Refresh shortly.'});rowId=id;
 const d=draftSchema.parse(row.draft), remote={...row.remote};
 const save=async(status='PREPARING')=>{const r=await db.from('meta_connector_campaigns').update({remote,status,last_error:null,updated_at:new Date().toISOString()}).eq('id',id);if(r.error)throw r.error;};
 const [account,page]=await Promise.all([graph(d.account_id,undefined,{fields:'id,currency,account_status,funding_source_details'}),graph(d.page_id,undefined,{fields:'id,name,instagram_business_account{id,username}'})]);
 if(account.account_status!==1)throw new Error('This Meta ad account is not active. Check billing and account restrictions in Meta.');
 if(!account.funding_source_details)throw new Error('Confirm billing in Meta Ads Manager before creating a campaign.');
 if(d.platforms.includes('instagram')) {let identities=await pages(`${d.account_id}/instagram_accounts`,'id,username');if(!identities.length)identities=await pages(`${d.account_id}/connected_instagram_accounts`,'id,username');if(page.instagram_business_account?.id!==d.instagram_id||!identities.some(i=>i.id===d.instagram_id))throw new Error('Instagram identity must be connected to the selected Page and ad account.');}
 const signed=async(path:string)=>{if(!path.startsWith(`connector/${row.created_by}/`)||path.includes('..'))throw new Error('Media does not belong to the campaign creator.');const r=await db.storage.from('meta-media').createSignedUrl(path,3600);if(r.error)throw r.error;return r.data.signedUrl;};
 const uploadImage=async(path:string)=>{const response=await fetch(await signed(path));if(!response.ok)throw new Error('Unable to read uploaded image');const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>8*1024*1024)throw new Error('Image exceeds 8 MB');let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const r=await graph(`${d.account_id}/adimages`,{bytes:btoa(binary)});const image=Object.values(r.images||{})[0] as any;if(!image?.hash)throw new Error('Meta did not return an image hash');return image.hash;};
 if(d.media_kind==='image'&&!remote.image_hash){remote.image_hash=await uploadImage(d.media_path);await save();}
 if(d.media_kind==='video'){
 if(!remote.video_id){const r=await graph(`${d.account_id}/advideos`,{file_url:await signed(d.media_path),title:d.name});remote.video_id=r.id;await save();}
 if(!remote.thumbnail_hash&&d.thumbnail_path){remote.thumbnail_hash=await uploadImage(d.thumbnail_path);await save();}
 if(remote.video_checked_at&&Date.now()-Date.parse(remote.video_checked_at)<60000){await save('VIDEO_PROCESSING');return json({pending:true,row:{...row,remote,status:'VIDEO_PROCESSING'}});}
 if((remote.video_checks||0)>=10)throw new Error('Video processing has not completed after ten checks. Check the retained video in Meta Ads Manager.');
 const videos=await graph(`${d.account_id}/advideos`,undefined,{fields:'id,status',limit:'1',filtering:JSON.stringify([{field:'id',operator:'IN',value:[remote.video_id]}])});remote.video_checked_at=new Date().toISOString();remote.video_checks=(remote.video_checks||0)+1;await save();const status=videos.data?.find((v:any)=>v.id===remote.video_id)?.status?.video_status;
 if(status==='error')throw new Error('Meta could not process the video. Choose a different video.');
 if(status!=='ready'){await save('VIDEO_PROCESSING');return json({pending:true,row:{...row,remote,status:'VIDEO_PROCESSING'}});}
 }
 // Unique names reconcile a provider write if its response was lost before persisting its ID.
 const unique=`${d.name} [Connector ${id}]`;
 const ensure=async(field:string,edge:string,payload:Record<string,unknown>)=>{
 if(remote[field])return;
 const matches=edge==='adcreatives'?(await pages(`${d.account_id}/${edge}`,'id,name')).filter(v=>v.name===unique):(await graph(`${d.account_id}/${edge}`,undefined,{fields:'id,name',filtering:JSON.stringify([{field:'name',operator:'EQUAL',value:unique}]),limit:'10'})).data||[];
 if(matches.length>1)throw new Error('Multiple matching Meta objects found; inspect in Ads Manager before retrying.');
 remote[field]=matches[0]?.id || (await graph(`${d.account_id}/${edge}`,{...payload,name:unique})).id;await save();};
 await ensure('campaign_id','campaigns',campaignPayload(unique,d.categories,d.objective));
 let audienceExternalId:string|undefined;
 if(d.audience_id){const a=await db.from('meta_connector_audiences').select('external_id').eq('id',d.audience_id).eq('account_id',settings.account_id).maybeSingle();if(a.error)throw a.error;if(!a.data)throw new Error('The selected customer list was not found.');audienceExternalId=a.data.external_id;}
 const goal=adsetGoal(d.objective,d.page_id);
 const targeting=buildTargeting(d,audienceExternalId);
 // All offered currencies use two minor-unit digits; unsupported currencies must be handled explicitly.
 if(!['INR','USD','GBP','AUD','CAD','AED'].includes(account.currency))throw new Error('This account currency is not supported by the budget form.');
 await ensure('adset_id','adsets',{campaign_id:remote.campaign_id,...budgetFields(d.budget_type,d.budget),bid_strategy:'LOWEST_COST_WITHOUT_CAP',billing_event:'IMPRESSIONS',...goal,targeting,status:'PAUSED',...(d.start?{start_time:d.start}:{}),...(d.end?{end_time:d.end}:{})});
 const {link,call_to_action}=creativeLink(d.objective,d.cta,d.website,d.lead_form_id);
 const story=d.media_kind==='image'?{page_id:d.page_id,link_data:{link,message:d.text,name:d.headline,description:d.description,image_hash:remote.image_hash,call_to_action}}:{page_id:d.page_id,video_data:{video_id:remote.video_id,image_hash:remote.thumbnail_hash,message:d.text,title:d.headline,link_description:d.description,call_to_action}};
 await ensure('creative_id','adcreatives',{object_story_spec:story,...(d.platforms.includes('instagram')?{instagram_user_id:d.instagram_id}:{})});
 await ensure('ad_id','ads',{adset_id:remote.adset_id,creative:{creative_id:remote.creative_id},status:'PAUSED'});
 const [ad,adset]=await Promise.all([graph(remote.ad_id,undefined,{fields:'id,status,effective_status,creative{instagram_user_id,object_story_spec}'}),graph(remote.adset_id,undefined,{fields:'id,status,targeting,optimization_goal,start_time,end_time'})]);
 if(d.platforms.includes('instagram')&&ad.creative?.instagram_user_id!==d.instagram_id)throw new Error('Instagram identity read-back did not match; campaign remains paused.');
 const accepted=adset.targeting?.publisher_platforms||[];
 if(accepted.length!==d.platforms.length||!d.platforms.every(p=>accepted.includes(p)))throw new Error('Meta placement read-back did not match; campaign remains paused.');
 if(adset.optimization_goal!==goal.optimization_goal)throw new Error('Meta optimization read-back did not match; campaign remains paused.');
 if(audienceExternalId&&!(adset.targeting?.custom_audiences||[]).some((a:any)=>String(a.id)===audienceExternalId))throw new Error('Meta did not apply the customer list to the ad set; campaign remains paused.');
 remote.verified=true;
 await save('PAUSED');return json({row:{...row,remote,status:'PAUSED'},ad,adset});
 }catch(e){const message=e instanceof Error?e.message:String(e);if(rowId&&db)await db.from('meta_connector_campaigns').update({status:'RETRY_REQUIRED',last_error:message,updated_at:new Date().toISOString()}).eq('id',rowId);if(e instanceof ProviderError)return json({error:'Meta request failed',status:e.status,details:e.details},e.status);return json({error:message},400);}
});
