'use client'

import Link from 'next/link'
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'
import { clearAdminSessionCache, getAdminSession } from '@/lib/admin_session_client'

type SpecialistMeta = { title: string; role: string; confidence?: string }
type Msg = { id?: number; role: 'user' | 'assistant'; content: string; specialist?: SpecialistMeta }
type Conv = { id: string; title: string; updated_at?: string }
type Session = { loading: boolean; authenticated: boolean }

const stages = ['Understanding your request…', 'Checking Otya systems…', 'Using the right tools…', 'Preparing the answer…']
const toolLabels: Record<string,string> = {
  system_status: 'Checked system status',
  config_status: 'Checked configuration',
  plugins: 'Checked connected services',
  feedback_summary: 'Reviewed feedback',
  crash_summary: 'Reviewed crashes',
  release_summary: 'Reviewed releases',
  support_inbox: 'Reviewed support inbox',
  support_audit: 'Reviewed support activity',
  full_report: 'Reviewed the full Otya system',
}

export default function ConsoleClient() {
  const [session,setSession] = useState<Session>({ loading:true, authenticated:false })
  const [notice,setNotice] = useState('')
  const [convs,setConvs] = useState<Conv[]>([])
  const [current,setCurrent] = useState('')
  const [messages,setMessages] = useState<Msg[]>([])
  const [input,setInput] = useState('')
  const [busy,setBusy] = useState(false)
  const [stage,setStage] = useState(0)
  const [activity,setActivity] = useState('')
  const [sidebar,setSidebar] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const refreshSession = useCallback(async()=>{
    try {
      const state = await getAdminSession()
      setSession({loading:false,authenticated:state.authenticated})
      if (!state.authenticated) window.location.replace('/admin')
    } catch {
      setSession({loading:false,authenticated:false})
      window.location.replace('/admin')
    }
  },[])

  useEffect(()=>{void refreshSession()},[refreshSession])
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'})},[messages,busy,stage])
  useEffect(()=>{if(!busy){setStage(0);return}const t=window.setInterval(()=>setStage(i=>Math.min(i+1,stages.length-1)),1400);return()=>window.clearInterval(t)},[busy])

  const api = useCallback(async(url:string,init?:RequestInit)=>{
    const r = await fetch(url,{...init,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(init?.headers||{})}})
    const d = await r.json().catch(()=>({}))
    if(r.status===401 || r.status===403){
      clearAdminSessionCache()
      setSession({loading:false,authenticated:false})
      window.location.replace('/admin')
      throw new Error('Owner verification is required.')
    }
    if(!r.ok) throw new Error(d.detail||d.error||`HTTP ${r.status}`)
    return d
  },[])

  const loadConvs = useCallback(async()=>{
    if(!session.authenticated)return
    try{const d=await api('/api/admin/ai-console/conversations');setConvs(d.conversations||[])}catch(e){setNotice((e as Error).message)}
  },[api,session.authenticated])
  useEffect(()=>{void loadConvs()},[loadConvs])

  async function logout(){
    await fetch('/api/admin/session',{method:'DELETE',credentials:'same-origin'}).catch(()=>null)
    clearAdminSessionCache()
    setSession({loading:false,authenticated:false})
    setMessages([]);setConvs([]);setCurrent('')
    window.location.replace('/account')
  }

  async function newChat(){
    if(busy)return;setNotice('');setActivity('')
    try{const d=await api('/api/admin/ai-console/conversation/new',{method:'POST',body:'{}'});setCurrent(d.conversation.id);setMessages([]);setSidebar(false);await loadConvs()}catch(e){setNotice((e as Error).message)}
  }

  async function openConv(id:string){
    if(busy)return;setBusy(true);setNotice('');setActivity('')
    try{const d=await api(`/api/admin/ai-console/conversation?id=${encodeURIComponent(id)}`);setCurrent(id);setMessages((d.conversation?.messages||[]).map((m:Msg)=>({id:m.id,role:m.role,content:m.content})));setSidebar(false)}catch(e){setNotice((e as Error).message)}finally{setBusy(false)}
  }

  async function send(){
    const text=input.trim();if(!text||busy)return
    setInput('');setMessages(m=>[...m,{role:'user',content:text}]);setBusy(true);setStage(0);setNotice('');setActivity('')
    try{
      const d=await api('/api/admin/ai-console/chat',{method:'POST',body:JSON.stringify({message:text,conversation_id:current||undefined})})
      setCurrent(d.conversation_id||current)
      const specialist: SpecialistMeta | undefined = d.specialist && typeof d.specialist.title === 'string'
        ? { title: d.specialist.title.slice(0, 80), role: typeof d.specialist.role === 'string' ? d.specialist.role.slice(0, 60) : 'team_lead', confidence: typeof d.specialist.confidence === 'string' ? d.specialist.confidence : undefined }
        : undefined
      setMessages(m=>[...m,{role:'assistant',content:d.answer||'I could not produce a response.',specialist}])
      if(d.tool) setActivity(toolLabels[d.tool]||`Used ${String(d.tool).replaceAll('_',' ')}`)
      await loadConvs()
    }catch(e){
      if (session.authenticated) setMessages(m=>[...m,{role:'assistant',content:`I could not complete that request: ${(e as Error).message}`}])
    }finally{setBusy(false)}
  }

  function composerKey(e:KeyboardEvent<HTMLTextAreaElement>){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}

  if(session.loading || !session.authenticated)return <main className="min-h-screen grid place-items-center" style={{background:'var(--cosmos-scaffold)',color:'var(--cosmos-text-primary)'}}><div className="text-center"><OtyaBrandMark ai size={58} thinking label="Checking Next owner access"/><p className="mt-3 text-sm otya-muted">Opening your secure Next workspace…</p></div></main>

  return <main className="h-[100dvh] overflow-hidden flex" style={{background:'var(--cosmos-scaffold)',color:'var(--cosmos-text-primary)'}}>
    {sidebar&&<button className="fixed inset-0 z-30 bg-black/35 md:hidden" aria-label="Close navigation" onClick={()=>setSidebar(false)}/>} 
    <aside className={`${sidebar?'translate-x-0':'-translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 left-0 z-40 w-[270px] shrink-0 border-r flex flex-col transition-transform`} style={{background:'var(--cosmos-surface)',borderColor:'var(--cosmos-divider)'}}>
      <div className="h-16 px-4 flex items-center gap-2 border-b" style={{borderColor:'var(--cosmos-divider)'}}><OtyaBrandMark ai size={40}/><span className="font-black tracking-[-.03em]">Next</span><button className="ml-auto md:hidden" aria-label="Close navigation" onClick={()=>setSidebar(false)}>×</button></div>
      <div className="p-3"><button onClick={()=>void newChat()} className="w-full min-h-11 rounded-2xl border px-3 text-left text-sm font-semibold" style={{borderColor:'var(--cosmos-divider)'}}>＋ New chat</button></div>
      <div className="px-4 pb-2 text-[10px] uppercase tracking-[.13em] otya-muted">History</div>
      <div className="flex-1 overflow-auto px-2">{convs.map(c=><button key={c.id} onClick={()=>void openConv(c.id)} className="w-full rounded-xl px-3 py-2.5 text-left text-sm truncate" style={{background:current===c.id?'color-mix(in srgb,var(--cosmos-primary) 10%,transparent)':'transparent',fontWeight:current===c.id?700:500}}>{c.title||'Conversation'}</button>)}</div>
      <div className="border-t p-3 space-y-1" style={{borderColor:'var(--cosmos-divider)'}}><Link href="/account" className="block rounded-xl px-3 py-2 text-sm">Otya Space</Link><Link href="/admin/ai/settings" className="block rounded-xl px-3 py-2 text-sm">Next settings</Link><button onClick={logout} className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-500">Leave owner mode</button></div>
    </aside>

    <section className="flex-1 min-w-0 flex flex-col">
      <header className="h-16 shrink-0 border-b flex items-center px-3 sm:px-5" style={{background:'var(--cosmos-app-bar)',borderColor:'var(--cosmos-divider)'}}><button className="md:hidden min-w-11 min-h-11 rounded-xl mr-1" onClick={()=>setSidebar(true)} aria-label="Open navigation">☰</button><OtyaBrandMark ai size={38} thinking={busy}/><div className="ml-2"><div className="font-black leading-none">Next</div><div className="text-[11px] otya-muted mt-1">{busy?stages[stage]:'Your owner assistant'}</div></div></header>
      {notice&&<div className="mx-4 mt-3 rounded-xl border px-3 py-2 text-sm" style={{borderColor:'var(--cosmos-divider)',background:'var(--cosmos-card)'}}>{notice}</div>}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 sm:px-8 py-6">
        <div className="mx-auto max-w-3xl">
          {messages.length===0?<div className="pt-[12vh] max-w-xl"><OtyaBrandMark ai size={68}/><h1 className="mt-5 text-3xl sm:text-5xl font-black tracking-[-.055em]">What should Next handle?</h1><p className="mt-3 otya-muted leading-7">Ask naturally. Next can inspect your Otya system, explain what it finds, prepare safe changes and ask before meaningful external or destructive actions are executed.</p></div>:<div className="space-y-7">{messages.map((m,i)=>m.role==='user'?<div key={i} className="ml-auto max-w-[86%] rounded-[22px] rounded-br-md px-4 py-3 bg-black/[.055] dark:bg-white/[.08] text-sm leading-6">{m.content}</div>:<div key={i} className="max-w-[98%]"><div className="mb-2"><OtyaBrandMark ai size={34}/></div>{m.specialist&&<div className="mb-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] otya-muted" style={{borderColor:"var(--cosmos-divider)"}}><span>{m.specialist.title}</span><span>· Advisory</span></div>}<div className="whitespace-pre-wrap text-sm sm:text-[15px] leading-7">{m.content}</div></div>)}{busy&&<div className="flex items-start gap-3 py-2" role="status" aria-live="polite"><OtyaBrandMark ai size={44} thinking label="Next is working"/><div><div className="text-sm font-semibold">{stages[stage]}</div><div className="text-xs otya-muted mt-1">Next is working securely in the background.</div></div></div>}{activity&&!busy&&<div className="text-xs otya-muted border-l-2 pl-3" style={{borderColor:'var(--cosmos-divider)'}}>{activity}</div>}</div>}
        </div>
      </div>
      <div className="shrink-0 p-3 sm:p-5"><div className="mx-auto max-w-3xl"><div className="flex items-end gap-2 rounded-[22px] border p-1.5" style={{background:'var(--cosmos-card)',borderColor:'var(--cosmos-divider)'}}><textarea rows={1} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={composerKey} placeholder="Ask Next anything about your system" className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 outline-none text-sm"/><button onClick={()=>void send()} disabled={busy||!input.trim()} className="cosmos-button min-h-12 min-w-12 rounded-[17px] font-black disabled:opacity-50" aria-label="Send">↑</button></div><div className="mt-2 text-center text-[10px] otya-muted">Owner access is enforced by the server. Next chooses only the tools your verified session is allowed to use.</div></div></div>
    </section>
  </main>
}
