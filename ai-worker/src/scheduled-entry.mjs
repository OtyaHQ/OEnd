import aiWorker from './index.mjs'
import { handleSupportEmailAdmin } from './support-email.mjs'
import { gmailStatus, handleGmailConnector, listGmailMessages } from './gmail-connector.mjs'
import { handlePublicChat } from './client-chat.mjs'
import { handlePublicChatStream } from './client-chat-stream.mjs'
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
 * Every Workers AI request from the otya-ai Worker is routed through the
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
  if(!env.AUTH?.fetch)throw new Error('Shared Otya Auth email service is unavailable')
  const serviceToken=String(env.OTYA_NEXT_MAIL_SERVICE_TOKEN||'')
  if(serviceToken.length<32)throw new Error('OTYA_NEXT_MAIL_SERVICE_TOKEN is not configured on otya-next')
  if(typeof idempotencyKey!=='string'||!idempotencyKey.trim()||idempotencyKey.length>256){
    throw new Error('A stable email idempotency key is required')
  }
  const response=await env.AUTH.fetch(new Request('https://auth/internal/notifications/otya-next/ops-report',{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-otya-service':'otya-next',
      'x-otya-service-token':serviceToken,
    },
    body:JSON.stringify({subject,text,idempotencyKey}),
    signal:AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  }))
  if(!response.ok)throw new Error(`Shared Otya Auth email service HTTP ${response.status}`)
  const result=await response.json().catch(()=>null)
  if(result?.accepted!==true||typeof result.emailId!=='string'||!result.emailId){
    throw new Error('Shared Otya Auth email service did not confirm acceptance')
  }
  return result.emailId
}

async function scalar(env,sql,bindings=[]){
  if(!env.DB?.prepare)return 0
  try{const row=await env.DB.prepare(sql).bind(...bindings).first();return Number(row?.count||0)}catch{return 0}
}

async function rows(env,sql,bindings=[]){
  if(!env.DB?.prepare)return[]
  try{const result=await env.DB.prepare(sql).bind(...bindings).all();return result?.results||[]}catch{return[]}
}

async function supportInbox(env,limit=8){
  if(!(await gmailStatus(env)).connected)return[]
  try{
    const messages=await listGmailMessages(env,'to:support@petersmartlink.com in:inbox',Math.max(1,Math.min(limit,20)))
    return messages.map(x=>({from:clean(x.from,180),subject:clean(x.subject,220),created_at:x.date,provider:'gmail'}))
  }catch{return[]}
}

async function operationsSnapshot(env,window='-24 hours'){
  const [
    users,devices,active,downloads,crashes,feedback,supportActions,
    queueFailures,queueDeliveryRows,crashGroups,feedbackRows,support,
  ]=await Promise.all([
    scalar(env,'SELECT COUNT(*) count FROM users'),
    scalar(env,'SELECT COUNT(*) count FROM devices'),
    scalar(env,`SELECT COUNT(*) count FROM devices WHERE last_seen_at>=datetime('now',?)`,[window]),
    scalar(env,`SELECT COUNT(*) count FROM downloads WHERE created_at>=datetime('now',?)`,[window]),
    scalar(env,`SELECT COUNT(*) count FROM crash_reports WHERE created_at>=datetime('now',?)`,[window]),
    scalar(env,`SELECT COUNT(*) count FROM feedback WHERE created_at>=datetime('now',?)`,[window]),
    scalar(env,`SELECT COUNT(*) count FROM ai_support_audit WHERE created_at>=datetime('now',?)`,[window]),
    scalar(env,`SELECT COALESCE(SUM(failed_count),0) count FROM queue_delivery_events WHERE created_at>=datetime('now',?)`,[window]),
    rows(env,`SELECT queue_name,outcome,COUNT(*) events,COALESCE(SUM(sent_count),0) sent,COALESCE(SUM(failed_count),0) failed,COALESCE(SUM(transient_failed),0) transient_failed,COALESCE(SUM(removed_count),0) removed,COALESCE(SUM(total_count),0) total,MAX(created_at) latest FROM queue_delivery_events WHERE created_at>=datetime('now',?) GROUP BY queue_name,outcome ORDER BY failed DESC,events DESC LIMIT 12`,[window]),
    rows(env,`SELECT group_id,error_type,COUNT(*) count,MAX(created_at) latest FROM crash_reports WHERE created_at>=datetime('now',?) GROUP BY group_id,error_type ORDER BY count DESC LIMIT 8`,[window]),
    rows(env,`SELECT category,sentiment,description,created_at FROM feedback WHERE created_at>=datetime('now',?) ORDER BY created_at DESC LIMIT 12`,[window]),
    supportInbox(env,8),
  ])
  let latestRelease=null
  try{latestRelease=await env.DB.prepare('SELECT tag,version,released_at FROM releases ORDER BY released_at DESC LIMIT 1').first()}catch{}
  return{
    generated_at:new Date().toISOString(),
    services:{database:Boolean(env.DB),kv:Boolean(env.KV),ai:Boolean(env.AI?.run),email:Boolean(env.AUTH?.fetch&&String(env.OTYA_NEXT_MAIL_SERVICE_TOKEN||'').length>=32),delivery_evidence:Boolean(env.DB?.prepare)},
    users,devices,active_devices:active,downloads,crashes,feedback,support_actions:supportActions,
    queue_delivery_failures:queueFailures,
    queue_delivery:queueDeliveryRows,
    latest_release:latestRelease,
    crash_groups:crashGroups,
    feedback_items:feedbackRows.map(x=>({...x,description:clean(x.description,500)})),
    recent_support:support,
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
    `otya-next/daily-operations/${dateKey}`,
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
    `otya-next/weekly-operations/${dateKey}`,
  )
}

async function urgent(env,scheduledTime=Date.now()){
  const crashes=await scalar(env,"SELECT COUNT(*) count FROM crash_reports WHERE created_at>=datetime('now','-1 hour')")
  const threshold=Math.max(3,Number(env.ADMIN_CRASH_ALERT_THRESHOLD||5))
  if(crashes<threshold)return
  const hour=new Date(scheduledTime).toISOString().slice(0,13)
  const key=`ops:crash-alert:${hour}`
  if(env.KV&&await env.KV.get(key))return
  const groups=await rows(env,`
    WITH recent AS (
      SELECT group_id,error_type,device_id,app_version,version_code,description,stack_trace,created_at
      FROM crash_reports
      WHERE created_at>=datetime('now','-1 hour')
    ), grouped AS (
      SELECT group_id,error_type,COUNT(*) count,
        COUNT(DISTINCT NULLIF(device_id,'')) devices,
        MAX(created_at) latest
      FROM recent
      GROUP BY group_id,error_type
      ORDER BY count DESC
      LIMIT 6
    )
    SELECT grouped.*,
      (SELECT app_version FROM recent r
        WHERE COALESCE(r.group_id,'')=COALESCE(grouped.group_id,'')
          AND COALESCE(r.error_type,'')=COALESCE(grouped.error_type,'')
        ORDER BY r.created_at DESC LIMIT 1) app_version,
      (SELECT version_code FROM recent r
        WHERE COALESCE(r.group_id,'')=COALESCE(grouped.group_id,'')
          AND COALESCE(r.error_type,'')=COALESCE(grouped.error_type,'')
        ORDER BY r.created_at DESC LIMIT 1) version_code,
      (SELECT description FROM recent r
        WHERE COALESCE(r.group_id,'')=COALESCE(grouped.group_id,'')
          AND COALESCE(r.error_type,'')=COALESCE(grouped.error_type,'')
        ORDER BY r.created_at DESC LIMIT 1) sample_description,
      (SELECT stack_trace FROM recent r
        WHERE COALESCE(r.group_id,'')=COALESCE(grouped.group_id,'')
          AND COALESCE(r.error_type,'')=COALESCE(grouped.error_type,'')
        ORDER BY r.created_at DESC LIMIT 1) sample_stack
    FROM grouped
    ORDER BY count DESC
  `)
  const groupLines=groups.flatMap(x=>{
    const type=clean(x.error_type||'Unknown',120)
    const group=clean(x.group_id||'',80)
    const shortGroup=group?` [${group.slice(0,24)}]`:''
    const deviceCount=Math.max(0,Number(x.devices||0))
    const lines=[`• ${type}${shortGroup} — ${x.count} reports — ${deviceCount} device${deviceCount===1?'':'s'} — latest ${x.latest||''}`]
    const app=clean(x.app_version||'',64)
    if(app)lines.push(`  App: ${app}${x.version_code!=null?` (${x.version_code})`:''}`)
    const description=crashEmailDetail(x.sample_description,320)
    if(description)lines.push(`  Sample: ${description}`)
    const stack=crashEmailDetail(x.sample_stack,420)
    if(stack)lines.push(`  Stack: ${stack}`)
    return lines
  })
  await email(env,`Otya alert · ${crashes} crashes in the last hour`,[
    `Otya recorded ${crashes} crash reports in the last hour.`,
    '',
    ...groupLines,
    '',
    'Review the Otya Console before taking any destructive or customer-facing action.',
    `Generated ${new Date(scheduledTime).toISOString()}`,
  ].join('\n'),`otya-next/crash-alert/${hour}`)
  if(env.KV)await env.KV.put(key,'1',{expirationTtl:7200})
}

function churnRisk(days){
  if(days>=12)return{risk:'high',reason:`No registered Otya activity for ${days} days.`}
  if(days>=10)return{risk:'medium',reason:`No registered Otya activity for ${days} days.`}
  return{risk:'low',reason:`No registered Otya activity for ${days} days.`}
}

async function churnSignals(env){
  if(!env.DB?.prepare||!env.KV?.put)return
  const {results=[]}=await env.DB.prepare(`
    SELECT user_id, MAX(last_seen_at) AS last_seen_at
    FROM devices
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING MAX(last_seen_at)>=datetime('now','-14 days')
       AND MAX(last_seen_at)<datetime('now','-7 days')
    ORDER BY last_seen_at ASC
    LIMIT ?
  `).bind(MAX_CHURN_SIGNALS).all()

  for(const row of results){
    const id=row.user_id
    if(!id)continue
    const lastSeen=new Date(row.last_seen_at||0).getTime()
    if(!Number.isFinite(lastSeen)||lastSeen<=0)continue
    const days=Math.max(0,Math.floor((Date.now()-lastSeen)/86400000))
    const risk=churnRisk(days)
    await env.KV.put(`ai:churn:${id}`,JSON.stringify({
      risk:risk.risk,
      reason:risk.reason,
      updated_at:new Date().toISOString(),
    }),{expirationTtl:604800})
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
    if(url.pathname==='/api/ai/chat'){
      const streamed=await handlePublicChatStream(request,runtimeEnv)
      if(streamed)return streamed
      return handlePublicChat(request,runtimeEnv)
    }
    if(url.pathname.startsWith('/api/telegram/')) return new Response(JSON.stringify({error:'Telegram transport is owned by Otya Core'}),{status:404,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
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
