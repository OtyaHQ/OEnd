import aiWorker from './index.mjs'
import { coreRequest } from './core-client.mjs'
import { handleSupportEmailAdmin } from './support-email.mjs'
import { gmailStatus, handleGmailConnector, listGmailMessages } from './gmail-connector.mjs'
import { handleOwnerActions } from './owner-actions.mjs'
import { handleOwnerConsole } from './owner-console.mjs'

const FAST_MODEL='@cf/meta/llama-3.1-8b-instruct-fast'
const PROVIDER_TIMEOUT_MS=8000
const MAX_CHURN_SIGNALS=50
const output=r=>typeof r?.response==='string'?r.response.trim():''
const clean=(v,max=2000)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max)
const crashEmailDetail=(v,max=420)=>clean(v,max)
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted-email]')
  .replace(/\b(?:sk-|re_|ghp_|github_pat_)[A-Za-z0-9._-]{12,}\b/g,'[redacted-token]')
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[redacted-jwt]')
  .replace(/([?&](?:token|key|secret|code)=)[^&\s]+/gi,'$1[redacted]')
  .replace(/\/storage\/emulated\/\d+\/[^\s]+/g,'[redacted-device-path]')

/**
 * Every Workers AI request from the O Worker is routed through the
 * single production AI Gateway. Call sites keep using env.AI.run(), while this
 * wrapper injects the private gateway ID and disables response caching so
 * conversational/support content is never served from an inference cache.
 * Prompt/response logging remains a gateway-side privacy setting and stays off
 * unless the owner explicitly changes that policy in Cloudflare.
 */
function withAiGateway(env){
  const ai=env.AI
  const gatewayId=String(env.AI_GATEWAY_ID||'').trim()
  if(!ai?.run||!gatewayId)return env
  return{
    ...env,
    AI:{
      run(model,input,options={}){
        const priorGateway=options?.gateway&&typeof options.gateway==='object'
          ? options.gateway
          : {}
        return ai.run(model,input,{
          ...options,
          gateway:{...priorGateway,id:gatewayId,skipCache:true},
        })
      },
    },
  }
}

async function email(env,subject,text,idempotencyKey){
  if(!env.AUTH?.fetch)throw new Error('OID email service is unavailable')
  const serviceToken=String(env.OTYA_O_MAIL_SERVICE_TOKEN||'')
  if(serviceToken.length<32)throw new Error('OTYA_O_MAIL_SERVICE_TOKEN is not configured on O')
  if(typeof idempotencyKey!=='string'||!idempotencyKey.trim()||idempotencyKey.length>256)throw new Error('A stable email idempotency key is required')
  const response=await env.AUTH.fetch(new Request('https://oid/internal/notifications/o/ops-report',{
    method:'POST',
    headers:{'content-type':'application/json','x-otya-service':'o','x-otya-service-token':serviceToken,'idempotency-key':idempotencyKey},
    body:JSON.stringify({subject:clean(subject,200),text:clean(text,12000)}),
    signal:AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  }))
  if(!response.ok)throw new Error('OID email service HTTP '+response.status)
  const result=await response.json().catch(()=>null)
  if(result?.accepted!==true||typeof result.emailId!=='string'||!result.emailId)throw new Error('OID email service did not confirm acceptance')
  return result.emailId
}
async function supportInbox(env,limit=8){
  if(!(await gmailStatus(env)).connected)return[]
  try{
    const messages=await listGmailMessages(env,'to:{support@otya.site support@petersmartlink.com} in:inbox',Math.max(1,Math.min(limit,20)))
    return messages.map(x=>({from:clean(x.from,180),subject:clean(x.subject,220),created_at:x.date,provider:'gmail'}))
  }catch{return[]}
}

async function operationsSnapshot(env,window='-24 hours'){
  const core=await coreRequest(env,'operations-snapshot',{query:{window}})
  let supportActions=0
  try{const row=await env.DB.prepare("SELECT COUNT(*) AS count FROM ai_support_audit WHERE created_at>=datetime('now', ?1)").bind(window).first();supportActions=Number(row?.count||0)}catch{}
  const metrics=core.metrics||{}
  return{
    generated_at:core.generatedAt||new Date().toISOString(),
    services:{private_database:Boolean(env.DB),private_kv:Boolean(env.KV),ai:Boolean(env.AI?.run),email:Boolean(env.AUTH?.fetch&&String(env.OTYA_O_MAIL_SERVICE_TOKEN||'').length>=32),core_data_api:Array.isArray(core.queueDelivery)},
    users:Number(metrics.users||0),devices:Number(metrics.devices||0),active_devices:Number(metrics.activeDevices24h||0),
    downloads:Number(metrics.downloads||0),crashes:Number(metrics.crashes||0),feedback:Number(metrics.feedback||0),
    support_actions:supportActions,queue_delivery_failures:Number(metrics.failedQueueEvents||0),
    queue_delivery:Array.isArray(core.queueDelivery)?core.queueDelivery:[],latest_release:core.latestRelease||null,
    crash_groups:Array.isArray(core.crashGroups)?core.crashGroups:[],feedback_items:Array.isArray(core.feedbackItems)?core.feedbackItems:[],
    recent_support:await supportInbox(env,8),
  }
}
async function summarize(env,snapshot,kind){
  if(!env.AI?.run)return''
  const system=kind==='weekly'
    ? 'You are the private operations analyst for Otya. Produce a concise executive weekly review for the owner. Use only supplied data. Structure: Executive summary, Product health, Delivery health, Support/customer signals, Risks, Recommended actions. Treat queue delivery failures as operational risks and distinguish transient failures from permanent failures. Prioritize facts and action; do not use hype.'
    : 'You are the private operations analyst for Otya. Produce a concise morning operations brief for the owner. Use only supplied data. Structure: Needs attention, Health, Delivery health, Customer/support signals, Release, Today. Treat queue delivery failures as operational risks and distinguish transient failures from permanent failures. If nothing is urgent, say so clearly. Do not invent facts.'
  try{return output(await env.AI.run(kind==='weekly'?(env.OTYA_AI_MODEL||FAST_MODEL):(env.OTYA_REPORT_MODEL||FAST_MODEL),{messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(snapshot).slice(0,24000)}]}))}catch{return''}
}

function rawFallback(snapshot){
  return [
    `Users: ${snapshot.users}`,
    `Devices: ${snapshot.devices}`,
    `Active devices: ${snapshot.active_devices}`,
    `Downloads: ${snapshot.downloads}`,
    `Crashes: ${snapshot.crashes}`,
    `Push delivery failures: ${snapshot.queue_delivery_failures}`,
    `Feedback: ${snapshot.feedback}`,
    `Support actions: ${snapshot.support_actions}`,
    `Latest release: ${snapshot.latest_release?.version||snapshot.latest_release?.tag||'unknown'}`,
  ].join('\n')
}

function kampalaDateKey(timestamp){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Africa/Kampala',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(new Date(timestamp))
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function daily(env,scheduledTime=Date.now()){
  const dateKey=kampalaDateKey(scheduledTime)
  const snapshot=await operationsSnapshot(env,'-24 hours')
  snapshot.generated_at=new Date(scheduledTime).toISOString()
  const summary=await summarize(env,snapshot,'daily')
  const date=new Intl.DateTimeFormat('en-UG',{timeZone:'Africa/Kampala',dateStyle:'medium'}).format(new Date(scheduledTime))
  await email(
    env,
    `Otya · Morning operations · ${date}`,
    [summary||rawFallback(snapshot),'',`Generated ${snapshot.generated_at}`].join('\n'),
    `o/daily-operations/${dateKey}`,
  )
}

async function weekly(env,scheduledTime=Date.now()){
  const dateKey=kampalaDateKey(scheduledTime)
  const snapshot=await operationsSnapshot(env,'-7 days')
  snapshot.generated_at=new Date(scheduledTime).toISOString()
  const summary=await summarize(env,snapshot,'weekly')
  const date=new Intl.DateTimeFormat('en-UG',{timeZone:'Africa/Kampala',dateStyle:'medium'}).format(new Date(scheduledTime))
  await email(
    env,
    `Otya · Weekly review · ${date}`,
    [summary||rawFallback(snapshot),'',`Generated ${snapshot.generated_at}`].join('\n'),
    `o/weekly-operations/${dateKey}`,
  )
}

async function urgent(env,scheduledTime=Date.now()){
  const core=await coreRequest(env,'crashes',{query:{window:'-1 hour',limit:'6'}})
  const crashes=Math.max(0,Number(core.count||0))
  const threshold=Math.max(3,Number(env.ADMIN_CRASH_ALERT_THRESHOLD||5))
  if(crashes<threshold)return
  const hour=new Date(scheduledTime).toISOString().slice(0,13)
  const key='ops:crash-alert:'+hour
  if(env.KV&&await env.KV.get(key))return
  const groups=Array.isArray(core.groups)?core.groups:[]
  const groupLines=groups.flatMap(x=>{
    const type=clean(x.error_type||'Unknown',120), group=clean(x.group_id||'',80)
    const shortGroup=group?' ['+group.slice(0,24)+']':''
    const deviceCount=Math.max(0,Number(x.devices||0))
    const lines=['• '+type+shortGroup+' — '+x.count+' reports — '+deviceCount+' device'+(deviceCount===1?'':'s')+' — latest '+(x.latest||'')]
    const app=clean(x.app_version||'',64)
    if(app)lines.push('  App: '+app+(x.version_code!=null?' ('+x.version_code+')':''))
    const description=crashEmailDetail(x.sample_description,320)
    if(description)lines.push('  Sample: '+description)
    const stack=crashEmailDetail(x.sample_stack,420)
    if(stack)lines.push('  Stack: '+stack)
    return lines
  })
  await email(env,'O alert · '+crashes+' crashes in the last hour', [
    'Otya End recorded '+crashes+' crash reports in the last hour.','',...groupLines,'',
    'Review O before taking any destructive or customer-facing action.','Generated '+new Date(scheduledTime).toISOString(),
  ].join('\n'),'o/crash-alert/'+hour)
  if(env.KV)await env.KV.put(key,'1',{expirationTtl:7200})
}
function churnRisk(days){
  if(days>=12)return{risk:'high',reason:`No registered Otya activity for ${days} days.`}
  if(days>=10)return{risk:'medium',reason:`No registered Otya activity for ${days} days.`}
  return{risk:'low',reason:`No registered Otya activity for ${days} days.`}
}

async function churnSignals(env){
  if(!env.KV?.put)return
  const result=await coreRequest(env,'users/churn-candidates',{query:{limit:String(MAX_CHURN_SIGNALS)}})
  for(const row of (Array.isArray(result.users)?result.users:[])){
    const id=String(row.user_id||'')
    if(!id)continue
    const lastSeen=new Date(row.last_seen_at||0).getTime()
    if(!Number.isFinite(lastSeen)||lastSeen<=0)continue
    const days=Math.max(0,Math.floor((Date.now()-lastSeen)/86400000))
    const risk=churnRisk(days)
    await env.KV.put('ai:churn:'+id,JSON.stringify({risk:risk.risk,reason:risk.reason,updated_at:new Date().toISOString()}),{expirationTtl:604800})
  }
}
export default {
  ...aiWorker,
  async fetch(request,env,ctx){
    const runtimeEnv=withAiGateway(env)
    const url=new URL(request.url)
    if(url.pathname.startsWith('/api/admin/ai/actions/')) return handleOwnerActions(request,runtimeEnv)
    if(url.pathname.startsWith('/api/admin/ai/support/')) return handleSupportEmailAdmin(request,runtimeEnv)
    if(url.pathname.startsWith('/api/admin/ai/console/')) return handleOwnerConsole(request,runtimeEnv)
    if(url.pathname==='/api/admin/ai/connectors/status'||url.pathname.startsWith('/api/admin/ai/connectors/gmail/')||url.pathname==='/api/ai/oauth/google/callback') return handleGmailConnector(request,runtimeEnv)
    if(url.pathname==='/api/ai/chat')return json({error:'owner_only',message:'O is a private owner workspace.'},410)
    if(url.pathname.startsWith('/api/telegram/')) return new Response(JSON.stringify({error:'Telegram transport is owned by OEnd'}),{status:404,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
    return aiWorker.fetch(request,runtimeEnv,ctx)
  },
  async queue(batch,env,ctx){
    return aiWorker.queue(batch,withAiGateway(env),ctx)
  },
  async scheduled(event,env,ctx){
    const runtimeEnv=withAiGateway(env)
    let task=Promise.resolve()
    if(event.cron==='0 6 * * 1')task=weekly(runtimeEnv,event.scheduledTime)
    else if(event.cron==='0 5 * * *')task=Promise.all([daily(runtimeEnv,event.scheduledTime),churnSignals(runtimeEnv)])
    else if(event.cron==='0 * * * *')task=urgent(runtimeEnv,event.scheduledTime)
    ctx.waitUntil(task)
  }
}
