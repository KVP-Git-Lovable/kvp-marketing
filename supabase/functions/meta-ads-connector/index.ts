import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { campaignPayload } from './rules.ts';
const GATEWAY = 'https://connector-gateway.lovable.dev/meta_ads/v26.0';
const numeric = z.string().regex(/^\d+$/);
const draftSchema = z.object({
  name: z.string().trim().min(1).max(150), account_id: z.string().regex(/^act_\d+$/), page_id: numeric,
  instagram_id: numeric.optional(), website: z.string().url().refine(v => { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; }),
  text: z.string().trim().min(1).max(2000), headline: z.string().trim().min(1).max(255), description: z.string().max(255).default(''),
  cta: z.enum(['LEARN_MORE','SHOP_NOW','SIGN_UP','CONTACT_US','ORDER_NOW']),
  budget: z.number().positive().max(1000000), countries: z.array(z.enum(['IN','US','GB','AU','CA','AE'])).min(1).max(6),
  platforms: z.array(z.enum(['facebook','instagram'])).min(1).max(2),
  categories: z.array(z.enum(['CREDIT','EMPLOYMENT','HOUSING','ISSUES_ELECTIONS_POLITICS'])), declaration_confirmed: z.literal(true),
  start: z.string().datetime().optional(), end: z.string().datetime().optional(),
  media_path: z.string().min(1).max(500), media_kind: z.enum(['image','video']), thumbnail_path: z.string().max(500).optional(),
}).superRefine((d, c) => {
  if (d.platforms.includes('instagram') && !d.instagram_id) c.addIssue({code:'custom',message:'Select a verified Instagram identity.'});
  if (d.media_kind === 'video' && !d.thumbnail_path) c.addIssue({code:'custom',message:'Video thumbnail is required.'});
  if (d.end && Date.parse(d.end) <= Math.max(Date.now(), d.start ? Date.parse(d.start) : 0)) c.addIssue({code:'custom',message:'End time must be after the start time and in the future.'});
});
const schema = z.discriminatedUnion('action',[
 z.object({action:z.literal('setup')}), z.object({action:z.literal('list')}),
 z.object({action:z.literal('create'), id:z.string().uuid(), draft:draftSchema}),
 z.object({action:z.literal('resume'),id:z.string().uuid()}),
 z.object({action:z.literal('status'),id:z.string().uuid(),status:z.enum(['ACTIVE','PAUSED']),confirmed:z.literal(true)}),
 z.object({action:z.literal('refresh'),id:z.string().uuid()}),
]);
class ProviderError extends Error { constructor(public status:number, public details:unknown) { super(JSON.stringify(details)); } }
async function graph(path:string, body?:Record<string,unknown>, params:Record<string,string>={}) {
 const key=Deno.env.get('LOVABLE_API_KEY'), connection=Deno.env.get('META_ADS_API_KEY');
 if (!key || !connection) throw new Error('The Meta Ads connector credentials are unavailable.');
 const url=new URL(`${GATEWAY}/${path}`); Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
 const r=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${key}`,'X-Connection-Api-Key':connection,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 if (!r.ok) { const details=await r.text(); console.error('Meta connector request failed',r.status,details); throw new ProviderError(r.status,details); }
 const data=await r.json(); if(data.error) throw new ProviderError(400,data.error); return data;
}
async function pages(path:string, fields:string) {
 const out:any[]=[]; let after:string|undefined;
 for(let i=0;i<10;i++) { const r=await graph(path,undefined,{fields,limit:'100',...(after?{after}:{})});out.push(...(r.data||[]));after=r.paging?.cursors?.after;if(!r.paging?.next || !after) return out; }
 throw new Error('Asset list is too large. Narrow the connected assets in Meta before continuing.');
}
Deno.serve(async(req)=>{
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'POST required'},405);
 let rowId:string|undefined; let db:any;
 try {
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)throw new Error('Backend configuration unavailable');
 db=createClient(url,key);const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token)return json({error:'Sign in to continue'},401);
 const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return json({error:'Sign in again to continue'},401);
 const parsed=schema.safeParse(await req.json());if(!parsed.success)return json({error:parsed.error.issues.map(i=>i.message).join(' ')},400);
 const b=parsed.data;const permission=['create','resume'].includes(b.action)?'can_create':b.action==='status'?'can_edit':'can_read';
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
 if(b.action==='create') {
 if(b.draft.account_id!==settings.account_id||b.draft.page_id!==settings.page_id)return json({error:'Use the saved connector account and Page.'},400);
 const existing=await db.from('meta_connector_campaigns').select('*').eq('id',b.id).maybeSingle();if(existing.error)throw existing.error;
 if(!existing.data) {const ins=await db.from('meta_connector_campaigns').insert({id:b.id,created_by:user.id,account_id:b.draft.account_id,page_id:b.draft.page_id,name:b.draft.name,draft:b.draft});if(ins.error&&ins.error.code!=='23505')throw ins.error;}
 }
 const id='id'in b?b.id:'';const result=await db.from('meta_connector_campaigns').select('*').eq('id',id).maybeSingle();if(result.error)throw result.error;const row=result.data;if(!row)return json({error:'Campaign draft not found'},404);
 if(row.account_id!==settings.account_id||row.page_id!==settings.page_id)throw new Error('This campaign belongs to a different connector setup.');
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
 await ensure('campaign_id','campaigns',campaignPayload(unique,d.categories));
 const targeting={geo_locations:{countries:d.countries},publisher_platforms:d.platforms,facebook_positions:d.platforms.includes('facebook')?['feed']:undefined,instagram_positions:d.platforms.includes('instagram')?['stream']:undefined,age_min:18,age_max:65,targeting_automation:{advantage_audience:0}};
 // All offered currencies use two minor-unit digits; unsupported currencies must be handled explicitly.
 if(!['INR','USD','GBP','AUD','CAD','AED'].includes(account.currency))throw new Error('This account currency is not supported by the budget form.');
 await ensure('adset_id','adsets',{campaign_id:remote.campaign_id,daily_budget:Math.round(d.budget*100),bid_strategy:'LOWEST_COST_WITHOUT_CAP',billing_event:'IMPRESSIONS',optimization_goal:'LINK_CLICKS',destination_type:'WEBSITE',targeting,status:'PAUSED',...(d.start?{start_time:d.start}:{}),...(d.end?{end_time:d.end}:{})});
 const cta={type:d.cta,value:{link:d.website}};
 const story=d.media_kind==='image'?{page_id:d.page_id,link_data:{link:d.website,message:d.text,name:d.headline,description:d.description,image_hash:remote.image_hash,call_to_action:cta}}:{page_id:d.page_id,video_data:{video_id:remote.video_id,image_hash:remote.thumbnail_hash,message:d.text,title:d.headline,link_description:d.description,call_to_action:cta}};
 await ensure('creative_id','adcreatives',{object_story_spec:story,...(d.platforms.includes('instagram')?{instagram_user_id:d.instagram_id}:{})});
 await ensure('ad_id','ads',{adset_id:remote.adset_id,creative:{creative_id:remote.creative_id},status:'PAUSED'});
 const [ad,adset]=await Promise.all([graph(remote.ad_id,undefined,{fields:'id,status,effective_status,creative{instagram_user_id,object_story_spec}'}),graph(remote.adset_id,undefined,{fields:'id,status,targeting,optimization_goal,start_time,end_time'})]);
 if(d.platforms.includes('instagram')&&ad.creative?.instagram_user_id!==d.instagram_id)throw new Error('Instagram identity read-back did not match; campaign remains paused.');
 const accepted=adset.targeting?.publisher_platforms||[];
 if(accepted.length!==d.platforms.length||!d.platforms.every(p=>accepted.includes(p)))throw new Error('Meta placement read-back did not match; campaign remains paused.');
 if(adset.optimization_goal!=='LINK_CLICKS')throw new Error('Meta optimization read-back did not match; campaign remains paused.');
 remote.verified=true;
 await save('PAUSED');return json({row:{...row,remote,status:'PAUSED'},ad,adset});
 }catch(e){const message=e instanceof Error?e.message:String(e);if(rowId&&db)await db.from('meta_connector_campaigns').update({status:'RETRY_REQUIRED',last_error:message,updated_at:new Date().toISOString()}).eq('id',rowId);if(e instanceof ProviderError)return json({error:'Meta request failed',status:e.status,details:e.details},e.status);return json({error:message},400);}
});
