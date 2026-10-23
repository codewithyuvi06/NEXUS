import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  Activity, AlarmClock, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check,
  CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Command, FileText, Flag,
  FolderKanban, Goal as GoalIcon, LayoutDashboard, ListTodo, LogOut, Menu, Moon, MoreHorizontal,
  PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Sparkles, Sun, Target, Timer, X,
  BookOpen, ChartNoAxesCombined, CircleCheck, Flame, SlidersHorizontal, UserRound, Zap
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, parseISO } from 'date-fns'
import type { Goal, Habit, Note, Project, Task, TaskStatus, Priority, FocusSession } from './types'
import { api } from './services/api'
import { initialGoals, initialHabits, initialNotes, initialProjects, initialTasks } from './data'

const navItems = [
  {to:'/',label:'Overview',icon:LayoutDashboard},
  {to:'/tasks',label:'Tasks',icon:ListTodo},
  {to:'/projects',label:'Projects',icon:FolderKanban},
  {to:'/goals',label:'Goals',icon:Target},
  {to:'/habits',label:'Habits',icon:Flame},
  {to:'/calendar',label:'Calendar',icon:CalendarDays},
  {to:'/notes',label:'Notes',icon:BookOpen},
  {to:'/focus',label:'Focus',icon:Timer},
  {to:'/analytics',label:'Analytics',icon:ChartNoAxesCombined}
]
const statusList: TaskStatus[] = ['Backlog','To Do','In Progress','Review','Completed']
const priorityList: Priority[] = ['Low','Medium','High']
const today = format(new Date(),'yyyy-MM-dd')
function usePersistedState<T>(key: string, initial: T) {
  const [value,setValue] = useState<T>(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) as T : initial } catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)) }, [key,value])
  return [value,setValue] as const
}

type CloudItem = { id: string; createdAt?: string; updatedAt?: string }
type ResourceKind = 'task' | 'project' | 'goal' | 'habit' | 'note' | 'focus-session'
function comparable(item: CloudItem) {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = item
  return JSON.stringify(data)
}
function useCloudState<T extends CloudItem>(key: string, kind: ResourceKind, initial: T[], userId?: string) {
  const [value, setValue] = usePersistedState<T[]>(key, initial)
  const readyRef = useRef(false)
  const serverRef = useRef<T[]>([])
  const latestRef = useRef(value)
  const syncingRef = useRef(false)
  const requestedRef = useRef(false)
  latestRef.current = value

  useEffect(() => {
    readyRef.current = false
    serverRef.current = []
    if (!userId) return
    let cancelled = false
    const load = async () => {
      try {
        const result = await api.request<{ items: T[] }>(`/resources/${kind}`)
        if (cancelled) return
        let items = result.items
        // Seed the demo workspace once per account/resource kind. A server-side marker
        // prevents deleted collections from being repopulated on a later sign-in.
        if (items.length === 0) {
          const markerName = `nexus-seeded-v1-${kind}`
          const markers = await api.request<{ items: Array<{ id: string; systemMarker?: string }> }>('/resources/event')
          const alreadySeeded = markers.items.some(marker => marker.systemMarker === markerName)
          if (!alreadySeeded) {
            const created: T[] = []
            for (const item of initial) {
              const response = await api.request<{ item: T }>(`/resources/${kind}`, {
                method: 'POST', body: JSON.stringify(item)
              })
              created.push(response.item)
            }
            await api.request<{ item: { id: string } }>('/resources/event', {
              method: 'POST', body: JSON.stringify({ systemMarker: markerName })
            })
            items = created
          }
        }
        if (cancelled) return
        serverRef.current = items
        setValue(items)
        latestRef.current = items
        readyRef.current = true
      } catch (error) {
        console.error(`NEXUS could not load ${kind} data from the server:`, error)
      }
    }
    void load()
    return () => { cancelled = true; readyRef.current = false }
  }, [kind, userId])

  useEffect(() => {
    if (!userId || !readyRef.current) return
    const timer = window.setTimeout(() => {
      requestedRef.current = true
      if (syncingRef.current) return
      syncingRef.current = true
      void (async () => {
        try {
          while (requestedRef.current) {
            requestedRef.current = false
            const desired = latestRef.current
            const snapshot = serverRef.current
            const desiredIds = new Set(desired.map(item => item.id))
            let nextSnapshot = [...snapshot]
            for (const oldItem of snapshot) {
              if (!desiredIds.has(oldItem.id)) {
                await api.request<void>(`/resources/${kind}/${oldItem.id}`, { method: 'DELETE' })
                nextSnapshot = nextSnapshot.filter(item => item.id !== oldItem.id)
              }
            }
            const replacements = new Map<string, string>()
            for (const item of desired) {
              const existing = nextSnapshot.find(old => old.id === item.id)
              if (existing) {
                if (comparable(existing) !== comparable(item)) {
                  const response = await api.request<{ item: T }>(`/resources/${kind}/${item.id}`, {
                    method: 'PATCH', body: JSON.stringify(item)
                  })
                  nextSnapshot = nextSnapshot.map(old => old.id === item.id ? response.item : old)
                }
              } else {
                const response = await api.request<{ item: T }>(`/resources/${kind}`, {
                  method: 'POST', body: JSON.stringify(item)
                })
                replacements.set(item.id, response.item.id)
                nextSnapshot.push(response.item)
              }
            }
            serverRef.current = nextSnapshot
            if (replacements.size) {
              setValue(current => current.map(item => replacements.has(item.id) ? { ...item, id: replacements.get(item.id)! } : item))
            }
          }
        } catch (error) {
          console.error(`NEXUS could not save ${kind} data to the server:`, error)
        } finally {
          syncingRef.current = false
        }
      })()
    }, 350)
    return () => window.clearTimeout(timer)
  }, [value, userId, kind])

  return [value, setValue] as const
}
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2,7)}` }
function prettyDate(date: string) { try { return format(parseISO(date),'MMM d') } catch { return date } }

function Button({children,onClick,variant='primary',className='',type='button'}: {children:React.ReactNode;onClick?:()=>void;variant?:'primary'|'secondary'|'ghost'|'danger';className?:string;type?:'button'|'submit'}) {
  return <button type={type} onClick={onClick} className={`btn btn-${variant} ${className}`}>{children}</button>
}
function Badge({children,tone='neutral'}:{children:React.ReactNode;tone?:string}) { return <span className={`badge badge-${tone.toLowerCase().replaceAll(' ','-')}`}>{children}</span> }
function Progress({value}:{value:number}) { return <div className="progress"><span style={{width:`${Math.min(100,Math.max(0,value))}%`}} /></div> }
function SectionTitle({title,sub,action}:{title:string;sub?:string;action?:React.ReactNode}) {
 return <div className="section-title"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{action}</div>
}
function Empty({title,description,action}:{title:string;description:string;action?:React.ReactNode}) {
 return <div className="empty-state"><span className="empty-icon"><Sparkles size={20}/></span><h3>{title}</h3><p>{description}</p>{action}</div>
}
function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}) {
 useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[onClose])
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><motion.div initial={{opacity:0,y:12,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8}} className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={18}/></button></div>{children}</motion.div></div>
}

type AppDialogState = {
  kind: 'text' | 'confirm'
  title: string
  message?: string
  label?: string
  initialValue?: string
  placeholder?: string
  confirmLabel?: string
  danger?: boolean
} | null

function useAppDialog() {
  const [dialog, setDialog] = useState<AppDialogState>(null)
  const resolver = useRef<((value: string | boolean | null) => void) | null>(null)
  const text = (options: { title: string; message?: string; label?: string; initialValue?: string; placeholder?: string }) => new Promise<string | null>(resolve => {
    resolver.current = value => resolve(typeof value === 'string' ? value : null)
    setDialog({ ...options, kind: 'text' })
  })
  const confirm = (title: string, message: string, danger = false) => new Promise<boolean>(resolve => {
    resolver.current = value => resolve(value === true)
    setDialog({ kind: 'confirm', title, message, danger, confirmLabel: danger ? 'Delete' : 'Confirm' })
  })
  const finish = (value: string | boolean | null) => {
    const resolve = resolver.current
    resolver.current = null
    setDialog(null)
    resolve?.(value)
  }
  return { dialog, text, confirm, finish, cancel: () => finish(null) }
}
function AppDialog({ dialog, onFinish, onCancel }: {
  dialog: AppDialogState
  onFinish: (value: string | boolean | null) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  useEffect(() => { setValue(dialog?.initialValue ?? '') }, [dialog])
  if (!dialog) return null
  return <Modal title={dialog.title} onClose={onCancel}>
    {dialog.kind === 'text' ? <form className="form-stack" onSubmit={e => { e.preventDefault(); onFinish(value.trim()) }}>
      {dialog.message && <p className="dialog-message">{dialog.message}</p>}
      <label>{dialog.label ?? 'Name'}<input autoFocus required value={value} onChange={e => setValue(e.target.value)} placeholder={dialog.placeholder ?? 'Enter a name'} /></label>
      <div className="modal-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">Save</Button></div>
    </form> : <div className="form-stack">
      <p className="dialog-message">{dialog.message}</p>
      <div className="modal-actions"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button variant={dialog.danger ? 'danger' : 'primary'} onClick={() => onFinish(true)}>{dialog.confirmLabel ?? 'Confirm'}</Button></div>
    </div>}
  </Modal>
}

function TaskForm({initial,onSave,onClose}:{initial?:Task;onSave:(task:Task)=>void;onClose:()=>void}) {
 const [title,setTitle]=useState(initial?.title??'')
 const [description,setDescription]=useState(initial?.description??'')
 const [priority,setPriority]=useState<Priority>(initial?.priority??'Medium')
 const [status,setStatus]=useState<TaskStatus>(initial?.status??'To Do')
 const [dueDate,setDueDate]=useState(initial?.dueDate??today)
 const [project,setProject]=useState(initial?.project??'NEXUS')
 const [tags,setTags]=useState(initial?.tags.join(', ')??'')
 const submit=(e:React.FormEvent)=>{e.preventDefault();if(!title.trim())return;onSave({id:initial?.id??uid(),title:title.trim(),description,priority,status,dueDate,project,tags:tags.split(',').map(t=>t.trim()).filter(Boolean),subtasks:initial?.subtasks??0,doneSubtasks:initial?.doneSubtasks??0,completedAt:status==='Completed'?(initial?.completedAt??new Date().toISOString()):undefined})}
 return <form className="form-stack" onSubmit={submit}>
  <label>Task title<input autoFocus required value={title} onChange={e=>setTitle(e.target.value)} placeholder="What needs to get done?"/></label>
  <label>Description<textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Add a little context..."/></label>
  <div className="form-grid"><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value as Priority)}>{priorityList.map(x=><option key={x}>{x}</option>)}</select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value as TaskStatus)}>{statusList.map(x=><option key={x}>{x}</option>)}</select></label></div>
  <div className="form-grid"><label>Due date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} /></label><label>Project<select value={project} onChange={e=>setProject(e.target.value)}>{['NEXUS','College','Personal','Learning','CREWVERSE'].map(x=><option key={x}>{x}</option>)}</select></label></div>
  <label>Tags <span className="field-hint">comma separated</span><input value={tags} onChange={e=>setTags(e.target.value)} placeholder="Design, Study"/></label>
  <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">{initial?'Save changes':'Create task'}</Button></div>
 </form>
}
function TaskRow({task,onToggle,onEdit}:{task:Task;onToggle:()=>void;onEdit:()=>void}) {
 return <div className={`task-row ${task.status==='Completed'?'is-complete':''}`}>
  <button className={`check-circle ${task.status==='Completed'?'checked':''}`} onClick={onToggle} aria-label={`Mark ${task.title} complete`}>{task.status==='Completed'&&<Check size={13}/>}</button>
  <button className="task-main" onClick={onEdit}><strong>{task.title}</strong>{task.description&&<span>{task.description}</span>}<small>{task.project} <i>·</i> {prettyDate(task.dueDate)}</small></button>
  <Badge tone={task.priority}>{task.priority}</Badge><button className="icon-btn row-edit" onClick={onEdit} aria-label="Edit task"><MoreHorizontal size={18}/></button>
 </div>
}
type AuthUser = { id: string; name: string; email: string }
type AuthResponse = { token: string; user: AuthUser }
type MeResponse = { user: AuthUser }

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
 const [mode,setMode]=useState<'login'|'register'>('login')
 const [name,setName]=useState('')
 const [email,setEmail]=useState('')
 const [password,setPassword]=useState('')
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setError('');setBusy(true)
  try {
   const result=await api.request<AuthResponse>(`/auth/${mode}`,{method:'POST',body:JSON.stringify({...(mode==='register'?{name:name.trim()}:{}),email:email.trim(),password})})
   localStorage.setItem('nexus_token',result.token)
   onAuthenticated(result.user)
  } catch(err) { setError(err instanceof Error?err.message:'Could not connect to NEXUS. Check that the backend is running.') }
  finally { setBusy(false) }
 }
 return <div className="auth-screen"><div className="auth-card"><div className="auth-brand"><div className="brand-mark"><span/></div><div><strong>NEXUS</strong><small>PERSONAL OS</small></div></div><div className="auth-intro"><div className="eyebrow">YOUR SPACE TO FOCUS</div><h1>{mode==='login'?'Welcome back.':'Make space for what matters.'}</h1><p>{mode==='login'?'Sign in to continue to your personal workspace.':'Create your account to get started with NEXUS.'}</p></div>
  <form className="auth-form" onSubmit={submit}>
   {mode==='register'&&<label>Full name<input autoComplete="name" required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}
   <label>Email address<input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
   <label>Password<input autoComplete={mode==='login'?'current-password':'new-password'} type="password" minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/><small>{mode==='register'?'Use at least 8 characters.':'Your password is never shown.'}</small></label>
   {error&&<p className="auth-error" role="alert">{error}</p>}
   <button className="btn btn-primary full-width auth-submit" type="submit" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'} <ArrowRight size={15}/></button>
  </form><p className="auth-switch">{mode==='login'?"New to NEXUS?":"Already have an account?"} <button type="button" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?'Create an account':'Sign in'}</button></p><p className="auth-footnote">Your workspace is personal. Keep your login details private.</p></div></div>
}

function App() {
 const [authUser,setAuthUser]=useState<AuthUser|null>(null)
 const [authChecked,setAuthChecked]=useState(false)
 const [authError,setAuthError]=useState('')
 useEffect(()=>{
  const token=localStorage.getItem('nexus_token')
  if(!token){setAuthChecked(true);return}
  api.request<MeResponse>('/auth/me').then(result=>setAuthUser(result.user)).catch(()=>{localStorage.removeItem('nexus_token');setAuthError('Your session expired. Please sign in again.')}).finally(()=>setAuthChecked(true))
 },[])
 const handleAuthenticated=(user:AuthUser)=>{setAuthUser(user);setAuthError('')}
 const signOut=()=>{localStorage.removeItem('nexus_token');setAuthUser(null);setAuthChecked(true)}
 const [tasks,setTasks]=useCloudState<Task>('nexus_tasks','task',initialTasks,authUser?.id)
 const [projects,setProjects]=useCloudState<Project>('nexus_projects','project',initialProjects,authUser?.id)
 const [goals,setGoals]=useCloudState<Goal>('nexus_goals','goal',initialGoals,authUser?.id)
 const [habits,setHabits]=useCloudState<Habit>('nexus_habits','habit',initialHabits,authUser?.id)
 const [focusSessions,setFocusSessions]=useCloudState<FocusSession>('nexus_focus_sessions','focus-session',[],authUser?.id)
 const [notes,setNotes]=useCloudState<Note>('nexus_notes','note',initialNotes,authUser?.id)
 const [collapsed,setCollapsed]=useState(false)
 const [mobileMenu,setMobileMenu]=useState(false)
 const [dark,setDark]=usePersistedState('nexus_dark',false)
 const [modal,setModal]=useState<'task'|'project'|'goal'|'note'|null>(null)
 const [editingTask,setEditingTask]=useState<Task|undefined>()
 const [toast,setToast]=useState('')
 const [search,setSearch]=useState('')
 const [commandOpen,setCommandOpen]=useState(false)
 const [profileName,setProfileName]=usePersistedState('nexus_name','Alex Morgan')
 useEffect(()=>{if(authUser){setProfileName(authUser.name)}},[authUser?.id])
 const location=useLocation(), navigate=useNavigate()
 const notify=useCallback((msg:string)=>{setToast(msg);window.setTimeout(()=>setToast(''),2600)},[])
 const openTask=(task?:Task)=>{setEditingTask(task);setModal('task')}
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setCommandOpen(v=>!v)}if(e.key==='Escape')setCommandOpen(false)};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[])
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light'},[dark])
 const done=tasks.filter(t=>t.status==='Completed').length
 const completion=Math.round(done/Math.max(tasks.length,1)*100)
 const toggleTask=(id:string)=>setTasks(old=>old.map(t=>t.id===id?(t.status==='Completed'?{...t,status:'To Do' as TaskStatus,completedAt:undefined}:{...t,status:'Completed' as TaskStatus,completedAt:new Date().toISOString()}):t))
 const saveTask=(task:Task)=>{setTasks(old=>old.some(t=>t.id===task.id)?old.map(t=>t.id===task.id?task:t):[task,...old]);setModal(null);setEditingTask(undefined);notify(editingTask?'Task updated':'Task created')}
 const saveProject=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const d=new FormData(e.currentTarget);setProjects(old=>[{id:uid(),name:String(d.get('name')),description:String(d.get('description')),status:'Planning',progress:0,deadline:String(d.get('deadline')||'2026-11-30'),priority:'Medium',color:'sage'},...old]);setModal(null);notify('Project created')}
 const saveGoal=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const d=new FormData(e.currentTarget);setGoals(old=>[{id:uid(),title:String(d.get('title')),category:String(d.get('category')),progress:0,deadline:String(d.get('deadline')||'2026-12-31'),milestones:3},...old]);setModal(null);notify('Goal created')}
 const saveNote=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();const d=new FormData(e.currentTarget);setNotes(old=>[{id:uid(),title:String(d.get('title')),body:String(d.get('body')),category:String(d.get('category')||'Personal'),tags:['New'],favorite:false,updatedAt:'Just now'},...old]);setModal(null);notify('Note saved')}
 const pageTitle=navItems.find(n=>n.to===location.pathname)?.label??({notifications:'Notifications',settings:'Settings',profile:'Profile'} as Record<string,string>)[location.pathname.slice(1)]??'Overview'
 const headerDate=format(new Date(),'EEEE, MMMM d')
 const commandAction=(path:string,action?:()=>void)=>{setCommandOpen(false);if(action)action();else navigate(path)}
 if(!authChecked) return <div className="auth-loading"><div className="brand-mark"><span/></div><p>Opening your NEXUS workspace…</p></div>
 if(!authUser) return <><AuthScreen onAuthenticated={handleAuthenticated}/>{authError&&<div className="auth-session-note">{authError}</div>}</>
 return <div className={`app-shell ${dark?'dark':''}`}>
  <aside className={`sidebar ${collapsed?'collapsed':''} ${mobileMenu?'mobile-open':''}`}>
   <div className="brand"><div className="brand-mark"><span/></div>{!collapsed&&<div><strong>NEXUS</strong><small>PERSONAL OS</small></div>}<button className="collapse-btn" onClick={()=>setCollapsed(v=>!v)} aria-label="Toggle sidebar">{collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button></div>
   {!collapsed&&<div className="workspace-label">WORKSPACE <ChevronDown size={13}/></div>}
   <nav className="side-nav" aria-label="Main navigation">
    {navItems.map(({to,label,icon:Icon})=><NavLink key={to} to={to} end={to==='/'} onClick={()=>setMobileMenu(false)} className={({isActive})=>`nav-link ${isActive?'active':''}`} title={collapsed?label:undefined}><Icon size={18}/>{!collapsed&&<span>{label}</span>}{label==='Tasks'&&!collapsed&&<em>{tasks.filter(t=>t.status!=='Completed').length}</em>}</NavLink>)}
   </nav>
   {!collapsed&&<div className="sidebar-bottom"><div className="sidebar-quote"><span className="quote-spark">✳</span><p>Make space for<br/><strong>what matters.</strong></p><small>A little progress, every day.</small></div><NavLink to="/settings" className={({isActive})=>`nav-link ${isActive?'active':''}`}><Settings size={18}/><span>Settings</span></NavLink><NavLink to="/profile" className={({isActive})=>`nav-link ${isActive?'active':''}`}><UserRound size={18}/><span>My profile</span></NavLink></div>}
  </aside>
  {mobileMenu&&<button className="mobile-scrim" onClick={()=>setMobileMenu(false)} aria-label="Close menu"/>}
  <div className="main-shell">
   <header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu-btn" onClick={()=>setMobileMenu(v=>!v)} aria-label="Open menu"><Menu size={20}/></button><span className="breadcrumbs">Workspace <ChevronRight size={14}/><strong>{pageTitle}</strong></span></div><div className="topbar-actions"><button className="search-trigger" onClick={()=>setCommandOpen(true)}><Search size={16}/><span>Search anything...</span><kbd>⌘ K</kbd></button><button className="icon-btn theme-toggle" onClick={()=>setDark(v=>!v)} aria-label="Toggle theme">{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="icon-btn notification-btn" onClick={()=>navigate('/notifications')} aria-label="Notifications"><Bell size={18}/><i/></button><button className="profile-chip" onClick={()=>navigate('/profile')}><span className="avatar">{profileName.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase()}</span><span className="profile-chip-name">{profileName}</span><ChevronDown size={14}/></button><button className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={17}/></button></div></header>
   <main className="page-content"><AnimatePresence mode="wait"><motion.div key={location.pathname} initial={{opacity:0,y:7}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:.18}}>
    <Routes>
     <Route path="/" element={<Dashboard name={profileName} date={headerDate} tasks={tasks} projects={projects} goals={goals} habits={habits} sessions={focusSessions} done={done} completion={completion} toggleTask={toggleTask} editTask={openTask} quickAction={setModal} navigate={navigate}/>} />
     <Route path="/tasks" element={<TasksPage tasks={tasks} setTasks={setTasks} toggleTask={toggleTask} editTask={openTask} createTask={()=>openTask()}/>} />
     <Route path="/projects" element={<ProjectsPage projects={projects} setProjects={setProjects} create={()=>setModal('project')} tasks={tasks}/>} />
     <Route path="/goals" element={<GoalsPage goals={goals} setGoals={setGoals} create={()=>setModal('goal')}/>} />
     <Route path="/habits" element={<HabitsPage habits={habits} setHabits={setHabits}/>} />
     <Route path="/calendar" element={<CalendarPage tasks={tasks} createTask={()=>openTask()}/>} />
     <Route path="/notes" element={<NotesPage notes={notes} setNotes={setNotes} create={()=>setModal('note')}/>} />
     <Route path="/focus" element={<FocusPage tasks={tasks} sessions={focusSessions} setSessions={setFocusSessions} notify={notify}/>} />
     <Route path="/analytics" element={<AnalyticsPage tasks={tasks} completion={completion} habits={habits} projects={projects} goals={goals} sessions={focusSessions}/>} />
     <Route path="/notifications" element={<NotificationsPage notify={notify}/>} />
     <Route path="/profile" element={<ProfilePage name={profileName} setName={setProfileName} tasks={tasks} completion={completion} goals={goals}/>} />
     <Route path="/settings" element={<SettingsPage dark={dark} setDark={setDark} notify={notify}/>} />
     <Route path="*" element={<Empty title="Page not found" description="That destination isn't part of this workspace." action={<Button onClick={()=>navigate('/')}>Return to overview</Button>}/>} />
    </Routes>
   </motion.div></AnimatePresence></main>
   <footer className="app-footer"><span>© 2026 NEXUS</span><span><span className="status-dot"/> Workspace signed in · data syncs to your account</span><button onClick={()=>notify('Help centre coming in a future release')}><CircleHelp size={14}/> Help & feedback</button></footer>
  </div>
  <AnimatePresence>{modal&&<Modal title={modal==='task'?(editingTask?'Edit task':'Create a task'):modal==='project'?'Create a project':modal==='goal'?'Create a goal':'Create a note'} onClose={()=>{setModal(null);setEditingTask(undefined)}}>{modal==='task'?<TaskForm initial={editingTask} onSave={saveTask} onClose={()=>{setModal(null);setEditingTask(undefined)}}/>:modal==='project'?<form className="form-stack" onSubmit={saveProject}><label>Project name<input required name="name" placeholder="e.g. Portfolio refresh"/></label><label>Description<textarea name="description" rows={3} placeholder="What are you working towards?"/></label><label>Target date<input name="deadline" type="date" defaultValue="2026-11-30"/></label><div className="modal-actions"><Button variant="secondary" onClick={()=>setModal(null)}>Cancel</Button><Button type="submit">Create project</Button></div></form>:modal==='goal'?<form className="form-stack" onSubmit={saveGoal}><label>Goal title<input required name="title" placeholder="What do you want to achieve?"/></label><label>Category<select name="category"><option>Career</option><option>Education</option><option>Personal</option><option>Health</option><option>Finance</option><option>Other</option></select></label><label>Target date<input name="deadline" type="date" defaultValue="2026-12-31"/></label><div className="modal-actions"><Button variant="secondary" onClick={()=>setModal(null)}>Cancel</Button><Button type="submit">Create goal</Button></div></form>:<form className="form-stack" onSubmit={saveNote}><label>Note title<input required name="title" placeholder="Give this note a title"/></label><label>Category<select name="category"><option>Personal</option><option>Learning</option><option>Product</option><option>Journal</option><option>Work</option></select></label><label>Content<textarea name="body" rows={6} placeholder="Start writing..."/></label><div className="modal-actions"><Button variant="secondary" onClick={()=>setModal(null)}>Cancel</Button><Button type="submit">Save note</Button></div></form>}</Modal>}</AnimatePresence>
  <AnimatePresence>{commandOpen&&<Modal title="Quick command" onClose={()=>setCommandOpen(false)}><div className="command-search"><Search size={18}/><input autoFocus placeholder="Search pages or create something..." value={search} onChange={e=>setSearch(e.target.value)}/><kbd>ESC</kbd></div><div className="command-label">NAVIGATION</div>{navItems.filter(n=>n.label.toLowerCase().includes(search.toLowerCase())).map(n=><button className="command-item" key={n.to} onClick={()=>commandAction(n.to)}>{<n.icon size={17}/>}<span>{n.label}</span><ArrowRight size={15}/></button>)}<div className="command-label">QUICK CREATE</div>{[{label:'New task',icon:ListTodo,action:()=>commandAction('',()=>openTask())},{label:'New project',icon:FolderKanban,action:()=>commandAction('',()=>setModal('project'))},{label:'New goal',icon:Target,action:()=>commandAction('',()=>setModal('goal'))},{label:'New note',icon:FileText,action:()=>commandAction('',()=>setModal('note'))},{label:'Start focus session',icon:Timer,action:()=>commandAction('/focus')}].filter(x=>x.label.toLowerCase().includes(search.toLowerCase())).map(x=><button className="command-item" key={x.label} onClick={x.action}><x.icon size={17}/><span>{x.label}</span><Plus size={15}/></button>)}</Modal>}</AnimatePresence>
  <AnimatePresence>{toast&&<motion.div className="toast" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}}><CheckCheck size={17}/>{toast}</motion.div>}</AnimatePresence>
 </div>
}

function Dashboard({name,date,tasks,projects,goals,habits,sessions,done,completion,toggleTask,editTask,quickAction,navigate}:{name:string;date:string;tasks:Task[];projects:Project[];goals:Goal[];habits:Habit[];sessions:FocusSession[];done:number;completion:number;toggleTask:(id:string)=>void;editTask:(t?:Task)=>void;quickAction:(m:'task'|'project'|'goal'|'note'|null)=>void;navigate:(path:string)=>void}) {
 const open=tasks.filter(t=>t.status!=='Completed')
 const activeGoals=goals.filter(g=>!g.completed&&g.progress<100)
 const activeProjects=projects.filter(p=>p.status!=='Completed')
 const strongestHabit=[...habits].sort((a,b)=>b.streak-a.streak)[0]
 const todaySessions=sessions.filter(s=>new Date(s.endedAt).toDateString()===new Date().toDateString())
 const todayFocusMinutes=todaySessions.reduce((sum,s)=>sum+s.durationMinutes,0)
 const weekTrend=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(6-i));return {day:format(d,'EEE'),tasks:tasks.filter(t=>t.status==='Completed'&&t.completedAt&&new Date(t.completedAt).toDateString()===d.toDateString()).length}})
 const priorities=tasks.filter(t=>t.status!=='Completed'&&t.priority==='High').slice(0,3)
 const [showAll,setShowAll]=useState(false)
 return <div className="page-stack">
  <div className="welcome-row"><div><div className="eyebrow">{date.toUpperCase()} <span className="eyebrow-dot">·</span> YOUR SPACE TO FOCUS</div><h1>Good afternoon, {name.split(' ')[0]} <span className="wave">✳</span></h1><p className="page-subtitle">A clear mind starts with a little clarity. Here's your day at a glance.</p></div><Button onClick={()=>quickAction('task')}><Plus size={16}/> New task</Button></div>
  <div className="stat-grid">
   <StatCard icon={CircleCheck} label="Tasks completed" value={`${done}/${tasks.length}`} detail={`${completion}% completion rate`} trend="up"/>
   <StatCard icon={Timer} label="Focus this week" value={`${Math.floor(sessions.filter(s=>new Date(s.endedAt).getTime()>=Date.now()-7*86400000).reduce((sum,s)=>sum+s.durationMinutes,0)/60)}h ${sessions.filter(s=>new Date(s.endedAt).getTime()>=Date.now()-7*86400000).reduce((sum,s)=>sum+s.durationMinutes,0)%60}m`} detail="From completed focus sessions" trend="neutral"/>
   <StatCard icon={Flame} label="Best habit streak" value={`${strongestHabit?.streak??0} days`} detail={strongestHabit?.title??'Create your first habit'} trend="up"/>
   <StatCard icon={Target} label="Active goals" value={String(activeGoals.length)} detail={`${goals.filter(g=>g.completed||g.progress>=100).length} achieved`} trend="neutral"/>
  </div>
  <div className="dashboard-grid">
   <section className="panel priorities-panel"><SectionTitle title="Today's priorities" sub={`${priorities.length} high-impact tasks to move forward`} action={<button className="text-action" onClick={()=>navigate('/tasks')}>View all <ArrowRight size={14}/></button>}/><div className="task-list">{(showAll?open:priorities).map(t=><TaskRow key={t.id} task={t} onToggle={()=>toggleTask(t.id)} onEdit={()=>editTask(t)}/>)}</div>{priorities.length===0&&<Empty title="Clear runway" description="No high-priority tasks right now."/>}<button className="add-inline" onClick={()=>editTask()}><Plus size={15}/> Add a task</button>{open.length>3&&<button className="show-more" onClick={()=>setShowAll(v=>!v)}>{showAll?'Show priorities':'Show all open tasks'} <ChevronDown size={14}/></button>}</section>
   <section className="panel daily-panel"><SectionTitle title="Your daily rhythm" sub="Small steps add up."/><div className="completion-ring-wrap"><div className="completion-ring" style={{'--progress':`${completion*3.6}deg`} as React.CSSProperties}><div><strong>{completion}%</strong><span>complete</span></div></div><div className="ring-copy"><strong>{done} tasks done</strong><span>of {tasks.length} total tasks</span><div className="tiny-bar"><span style={{width:`${completion}%`}}/></div><small>{completion>=70?'You’re making lovely progress.':'You’re building momentum. Keep going.'}</small></div></div><div className="mini-divider"/><div className="focus-summary"><span className="focus-icon"><Timer size={18}/></span><div><strong>Focus time</strong><small>Daily goal · 3 hours</small></div><div className="focus-amount"><strong>{Math.floor(todayFocusMinutes/60)}h {todayFocusMinutes%60}m</strong><Progress value={Math.min(100,todayFocusMinutes/180*100)}/></div></div><Button variant="secondary" className="full-width" onClick={()=>navigate('/focus')}><Zap size={15}/> Start a focus session</Button></section>
  </div>
  <div className="dashboard-grid lower-grid">
   <section className="panel"><SectionTitle title="Active projects" sub="Your work, moving forward" action={<button className="text-action" onClick={()=>navigate('/projects')}>All projects <ArrowRight size={14}/></button>}/><div className="project-list">{activeProjects.slice(0,3).map(p=><div className="project-line" key={p.id}><div className={`project-symbol ${p.color}`}><FolderKanban size={17}/></div><div className="project-line-info"><div className="project-name-line"><strong>{p.name}</strong><span>{p.progress}%</span></div><Progress value={p.progress}/><small>{p.status} <i>·</i> Due {prettyDate(p.deadline)}</small></div></div>)}</div></section>
   <section className="panel"><SectionTitle title="Goals in motion" sub="Keep the bigger picture close" action={<button className="text-action" onClick={()=>navigate('/goals')}>View goals <ArrowRight size={14}/></button>}/><div className="goal-list">{activeGoals.slice(0,3).map(g=><div className="goal-line" key={g.id}><div className="goal-bullet"><Flag size={15}/></div><div className="goal-info"><strong>{g.title}</strong><div className="goal-meta"><Progress value={g.progress}/><span>{g.progress}%</span></div><small>{g.category} <i>·</i> Due {prettyDate(g.deadline)}</small></div></div>)}</div></section>
  </div>
  <div className="dashboard-grid lower-grid">
   <section className="panel"><SectionTitle title="Habit check-in" sub="Consistency over intensity" action={<button className="text-action" onClick={()=>navigate('/habits')}>Track habits <ArrowRight size={14}/></button>}/><div className="habit-compact-list">{habits.slice(0,4).map(h=><div className="habit-compact" key={h.id}><span className="habit-dot"/><span>{h.title}</span><strong><Flame size={13}/>{h.streak}</strong><div className="week-dots">{h.week.slice(0,7).map((v,i)=><i key={i} className={v?'filled':''}/>)}</div></div>)}</div></section>
   <section className="panel"><SectionTitle title="This week" sub="A gentle view of your momentum"/><div className="chart-wrap small-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={weekTrend} barSize={17}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:11}}/><Tooltip cursor={{fill:'var(--sage-pale)'}} contentStyle={{borderRadius:12,border:'1px solid var(--border)',background:'var(--surface)',fontSize:12}}/><Bar dataKey="tasks" name="Tasks done" fill="#8FA28A" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div><div className="chart-foot"><span><i className="legend-dot sage-dot"/> Tasks completed</span><button className="text-action" onClick={()=>navigate('/analytics')}>See insights <ArrowRight size={14}/></button></div></section>
  </div>
 </div>
}
function StatCard({icon:Icon,label,value,detail,trend}:{icon:LucideIcon;label:string;value:string;detail:string;trend:'up'|'neutral'}) {
 return <div className="stat-card"><div className="stat-top"><span className="stat-icon"><Icon size={18}/></span><span className={`trend ${trend}`}>{trend==='up'?<ArrowUpRight size={14}/>:<Activity size={14}/>}</span></div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></div>
}
function PageHeader({eyebrow,title,description,action}:{eyebrow?:string;title:string;description:string;action?:React.ReactNode}) {
 return <div className="page-header"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div>{action}</div>
}
function TasksPage({tasks,setTasks,toggleTask,editTask,createTask}:{tasks:Task[];setTasks:React.Dispatch<React.SetStateAction<Task[]>>;toggleTask:(id:string)=>void;editTask:(t?:Task)=>void;createTask:()=>void}) {
 const dialog = useAppDialog()
 const [query,setQuery]=useState(''),[view,setView]=useState<'List'|'Board'>('List'),[status,setStatus]=useState('Active tasks'),[priority,setPriority]=useState('All priorities')
 const filtered=tasks.filter(t=>(t.title+' '+t.project+' '+t.tags.join(' ')).toLowerCase().includes(query.toLowerCase())&&(status==='Active tasks'?t.status!=='Completed':status==='All tasks'||t.status===status)&&(priority==='All priorities'||t.priority===priority))
 const removeTask=async (id:string)=>{const item=tasks.find(t=>t.id===id);if(item&&await dialog.confirm('Delete task?',`Permanently delete “${item.title}”?`,true))setTasks(old=>old.filter(t=>t.id!==id))}
 const move=(id:string,s:TaskStatus)=>setTasks(old=>old.map(t=>t.id===id?{...t,status:s}:t))
 return <><div className="page-stack"><PageHeader eyebrow="MAKE IT HAPPEN" title="Tasks" description="Turn intentions into progress, one clear next step at a time." action={<Button onClick={createTask}><Plus size={16}/> New task</Button>}/>
  <div className="task-summary-strip"><div><span>All tasks</span><strong>{tasks.length}</strong></div><div><span>In progress</span><strong>{tasks.filter(t=>t.status==='In Progress').length}</strong></div><div><span>Completed</span><strong>{tasks.filter(t=>t.status==='Completed').length}</strong></div><div><span>High priority</span><strong>{tasks.filter(t=>t.priority==='High'&&t.status!=='Completed').length}</strong></div></div>
  <div className="panel"><div className="toolbar"><div className="inline-search"><Search size={16}/><input placeholder="Search tasks, projects, tags..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="toolbar-right"><select value={status} onChange={e=>setStatus(e.target.value)}><option>Active tasks</option><option>All tasks</option>{statusList.map(s=><option key={s}>{s}</option>)}</select><select value={priority} onChange={e=>setPriority(e.target.value)}><option>All priorities</option>{priorityList.map(s=><option key={s}>{s}</option>)}</select><div className="view-toggle"><button className={view==='List'?'selected':''} onClick={()=>setView('List')}><ListTodo size={15}/></button><button className={view==='Board'?'selected':''} onClick={()=>setView('Board')}><PanelLeftOpen size={15}/></button></div></div></div>
   {view==='List'?<><div className="task-table-head"><span>Task</span><span>Priority</span><span>Status</span><span>Due date</span><span/></div><div className="task-list full-task-list">{filtered.map(t=><div className="task-table-row" key={t.id}><div className="table-task"><button className={`check-circle ${t.status==='Completed'?'checked':''}`} onClick={()=>toggleTask(t.id)} aria-label="Toggle complete">{t.status==='Completed'&&<Check size={13}/>}</button><button className="task-main" onClick={()=>editTask(t)}><strong>{t.title}</strong><small>{t.project} <i>·</i> {t.tags.join(', ')||'No tags'}</small></button></div><div><Badge tone={t.priority}>{t.priority}</Badge></div><div><Badge tone={t.status}>{t.status}</Badge></div><div className="due-cell">{prettyDate(t.dueDate)}</div><div className="row-actions"><button className="icon-btn" onClick={()=>editTask(t)} aria-label="Edit task" title="Edit task"><MoreHorizontal size={17}/></button><button className="icon-btn danger-icon" onClick={()=>removeTask(t.id)} aria-label="Delete task" title="Delete task"><X size={15}/></button></div></div>)}</div>{filtered.length===0&&<Empty title="No tasks match" description="Try another search or adjust your filters."/>}</>:<div className="kanban">{statusList.map(s=><div className="kanban-column" key={s} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=e.dataTransfer.getData('taskId');if(id)move(id,s)}}><div className="kanban-head"><span className={`status-dot status-${s.toLowerCase().replaceAll(' ','-')}`}/><strong>{s}</strong><em>{filtered.filter(t=>t.status===s).length}</em></div>{filtered.filter(t=>t.status===s).map(t=><div className="kanban-card" key={t.id} draggable onDragStart={e=>e.dataTransfer.setData('taskId',t.id)}><button className="task-card-title" onClick={()=>editTask(t)}>{t.title}</button><p>{t.project}</p><div className="kanban-card-foot"><Badge tone={t.priority}>{t.priority}</Badge><small>{prettyDate(t.dueDate)}</small></div><div className="kanban-card-actions"><select aria-label="Move task to status" value={t.status} onChange={e=>move(t.id,e.target.value as TaskStatus)}>{statusList.map(x=><option key={x}>{x}</option>)}</select><button className="icon-btn" onClick={()=>toggleTask(t.id)} aria-label="Toggle task complete" title="Complete / reopen"><Check size={15}/></button><button className="icon-btn danger-icon" onClick={()=>removeTask(t.id)} aria-label="Delete task" title="Delete task"><X size={15}/></button></div></div>)}<button className="add-inline" onClick={createTask}><Plus size={14}/> Add task</button></div>)}</div>}
  </div></div><AppDialog dialog={dialog.dialog} onFinish={dialog.finish} onCancel={dialog.cancel}/></>
}
function ProjectsPage({projects,setProjects,create,tasks}:{projects:Project[];setProjects:React.Dispatch<React.SetStateAction<Project[]>>;create:()=>void;tasks:Task[]}) {
 const dialog = useAppDialog()
 const [showCompleted,setShowCompleted]=useState(false)
 const visibleProjects=projects.filter(p=>showCompleted?p.status==='Completed':p.status!=='Completed')
 const removeProject=async (p:Project)=>{if(await dialog.confirm('Delete project?',`Permanently delete “${p.name}”? Tasks assigned to it will remain.`,true))setProjects(old=>old.filter(x=>x.id!==p.id))}
 const renameProject=async (p:Project)=>{const name=await dialog.text({title:'Rename project',label:'Project name',initialValue:p.name});if(name?.trim())setProjects(old=>old.map(x=>x.id===p.id?{...x,name:name.trim()}:x))}
 const completeProject=(p:Project)=>setProjects(old=>old.map(x=>x.id===p.id?{...x,status:x.status==='Completed'?'In progress':'Completed',progress:x.status==='Completed'?Math.min(x.progress,99):100}:x))
 return <><div className="page-stack"><PageHeader eyebrow="LONGER-TERM WORK" title="Projects" description="Bring related tasks together and keep the bigger picture in view." action={<div className="header-actions"><Button variant="secondary" onClick={()=>setShowCompleted(v=>!v)}>{showCompleted?'Show active':'Show completed'}</Button><Button onClick={create}><Plus size={16}/> New project</Button></div>}/><div className="project-card-grid">{visibleProjects.map(p=><div className="panel project-card" key={p.id}><div className="project-card-top"><div className={`project-symbol large ${p.color}`}><FolderKanban size={20}/></div><div className="row-actions"><button className="icon-btn" onClick={()=>renameProject(p)} aria-label="Rename project" title="Rename project"><MoreHorizontal size={16}/></button><button className="icon-btn" onClick={()=>completeProject(p)} aria-label={p.status==='Completed'?'Reopen project':'Complete project'} title={p.status==='Completed'?'Reopen project':'Mark complete'}><Check size={16}/></button><button className="icon-btn danger-icon" onClick={()=>removeProject(p)} aria-label="Delete project" title="Delete project"><X size={15}/></button></div></div><div className="project-card-title"><h3>{p.name}</h3><Badge tone={p.status}>{p.status}</Badge></div><p>{p.description}</p><div className="project-progress-label"><span>Overall progress</span><strong>{p.progress}%</strong></div><Progress value={p.progress}/><div className="project-card-meta"><span><ListTodo size={14}/>{tasks.filter(t=>t.project===p.name).length} tasks</span><span><CalendarDays size={14}/>Due {prettyDate(p.deadline)}</span></div><div className="project-card-bottom"><div className="avatar-stack"><span>AM</span><span>JD</span><span>+1</span></div><Badge tone={p.priority}>{p.priority} priority</Badge></div></div>)}</div></div><AppDialog dialog={dialog.dialog} onFinish={dialog.finish} onCancel={dialog.cancel}/></>
}
function GoalsPage({goals,setGoals,create}:{goals:Goal[];setGoals:React.Dispatch<React.SetStateAction<Goal[]>>;create:()=>void}) {
 const dialog = useAppDialog()
 const [showCompleted,setShowCompleted]=useState(false)
 const visibleGoals=goals.filter(g=>showCompleted?Boolean(g.completed||g.progress>=100):!g.completed&&g.progress<100)
 const removeGoal=async (g:Goal)=>{if(await dialog.confirm('Delete goal?',`Permanently delete “${g.title}”?`,true))setGoals(old=>old.filter(x=>x.id!==g.id))}
 const renameGoal=async (g:Goal)=>{const title=await dialog.text({title:'Rename goal',label:'Goal name',initialValue:g.title});if(title?.trim())setGoals(old=>old.map(x=>x.id===g.id?{...x,title:title.trim()}:x))}
 const changeProgress=(g:Goal,delta:number)=>setGoals(old=>old.map(x=>x.id===g.id?{...x,progress:Math.max(0,Math.min(100,x.progress+delta)),completed:Math.max(0,Math.min(100,x.progress+delta))>=100}:x))
 return <><div className="page-stack"><PageHeader eyebrow="THE BIGGER PICTURE" title="Goals" description="Make meaningful progress toward the things you care about." action={<div className="header-actions"><Button variant="secondary" onClick={()=>setShowCompleted(v=>!v)}>{showCompleted?'Show active':'Show achieved'}</Button><Button onClick={create}><Plus size={16}/> New goal</Button></div>}/><div className="goal-overview panel"><div className="goal-overview-icon"><Target size={22}/></div><div><span className="stat-label">Your progress this season</span><h2>{Math.round(goals.filter(g=>!g.completed&&g.progress<100).reduce((a,g)=>a+g.progress,0)/Math.max(goals.filter(g=>!g.completed&&g.progress<100).length,1))}% <small>average active goal completion</small></h2></div><div className="goal-overview-count"><strong>{goals.filter(g=>!g.completed&&g.progress<100).length}</strong><span>active goals</span></div></div><div className="goal-card-grid">{visibleGoals.map(g=><div className="panel goal-card" key={g.id}><div className="goal-card-top"><Badge tone="neutral">{g.category}</Badge><div className="row-actions"><button className="icon-btn" onClick={()=>renameGoal(g)} title="Rename goal" aria-label="Rename goal"><MoreHorizontal size={15}/></button><button className="icon-btn" onClick={()=>changeProgress(g,10)} title="Add 10% progress" aria-label="Add 10 percent progress"><Plus size={15}/></button><button className="icon-btn" onClick={()=>changeProgress(g,-10)} title="Reduce progress by 10%" aria-label="Reduce progress"><ArrowDownRight size={15}/></button><button className="icon-btn" onClick={()=>changeProgress(g,100-g.progress)} title="Mark goal achieved" aria-label="Mark goal achieved"><Check size={15}/></button><button className="icon-btn danger-icon" onClick={()=>removeGoal(g)} title="Delete goal" aria-label="Delete goal"><X size={15}/></button></div></div><h3>{g.title}</h3><div className="goal-progress-number"><strong>{g.progress}%</strong><span>complete</span></div><Progress value={g.progress}/><div className="goal-card-foot"><span><Flag size={14}/>{g.milestones} milestones</span><span><CalendarDays size={14}/>{prettyDate(g.deadline)}</span></div><div className="milestone-steps">{Array.from({length:g.milestones},(_,i)=><span key={i} className={i<Math.round(g.progress/100*g.milestones)?'done':''}/>)}</div></div>)}</div></div><AppDialog dialog={dialog.dialog} onFinish={dialog.finish} onCancel={dialog.cancel}/></>
}
function HabitsPage({habits,setHabits}:{habits:Habit[];setHabits:React.Dispatch<React.SetStateAction<Habit[]>>}) {
 const dialog = useAppDialog()
 const days=['M','T','W','T','F','S','S']
 const addHabit=async ()=>{const title=await dialog.text({title:'Create a habit',label:'Habit name',placeholder:'e.g. Practise Java'});if(!title?.trim())return;const category=await dialog.text({title:'Habit category',label:'Category',initialValue:'Personal',placeholder:'Learning, Health, Career'});if(category===null)return;setHabits(old=>[{id:uid(),title:title.trim(),category:category.trim()||'Personal',streak:0,week:[false,false,false,false,false,false,false]},...old])}
 const renameHabit=async (h:Habit)=>{const title=await dialog.text({title:'Rename habit',label:'Habit name',initialValue:h.title});if(title?.trim())setHabits(old=>old.map(x=>x.id===h.id?{...x,title:title.trim()}:x))}
 const deleteHabit=async (h:Habit)=>{if(await dialog.confirm('Delete habit?',`Delete “${h.title}” and its check-in history?`,true))setHabits(old=>old.filter(x=>x.id!==h.id))}
 const todayIndex=(new Date().getDay()+6)%7
 const toggle=(habitId:string,index:number)=>setHabits(old=>old.map(h=>h.id===habitId?{...h,week:h.week.map((v,i)=>i===index?!v:v),streak:index===todayIndex?Math.max(0,h.streak+(h.week[index]?-1:1)):h.streak}:h))
 const total=habits.reduce((n,h)=>n+h.week.filter(Boolean).length,0),possible=habits.length*7
 const strongestHabit=[...habits].sort((a,b)=>b.streak-a.streak)[0]
 return <><div className="page-stack"><PageHeader eyebrow="SMALL PROMISES, KEPT" title="Habits" description="Build the kind of consistency that makes the hard things easier." action={<Button onClick={addHabit}><Plus size={16}/> Add habit</Button>}/><div className="stat-grid three"><StatCard icon={Flame} label="Active streaks" value={`${habits.filter(h=>h.streak>0).length}`} detail="Habits with momentum" trend="up"/><StatCard icon={CircleCheck} label="Weekly completion" value={`${Math.round(total/Math.max(possible,1)*100)}%`} detail={`${total} check-ins this week`} trend="up"/><StatCard icon={Target} label="Habits tracked" value={`${habits.length}`} detail="Your personal rhythm" trend="neutral"/></div><div className="panel habit-panel"><div className="habit-panel-head"><div><h2>Your weekly rhythm</h2><p>Check off each day as you go. Progress, not perfection.</p></div><Badge>7-day tracker</Badge></div><div className="habit-table"><div className="habit-table-head"><span>Habit</span>{days.map((d,i)=><span key={i}>{d}</span>)}<span>Streak</span><span>Manage</span></div>{habits.map(h=><div className="habit-table-row" key={h.id}><div className="habit-title"><span className="habit-dot"/><div><strong>{h.title}</strong><small>{h.category}</small></div></div>{h.week.map((v,i)=><button key={i} className={`habit-check ${v?'done':''}`} onClick={()=>toggle(h.id,i)} aria-label={`Toggle ${h.title} day ${i+1}`}>{v&&<Check size={13}/>}</button>)}<div className="streak-cell"><Flame size={14}/>{h.streak}</div><div className="row-actions habit-actions"><button className="icon-btn" onClick={()=>renameHabit(h)} title="Rename habit" aria-label={`Rename ${h.title}`}><MoreHorizontal size={16}/></button><button className="icon-btn danger-icon" onClick={()=>deleteHabit(h)} title="Delete habit" aria-label={`Delete ${h.title}`}><X size={15}/></button></div></div>)}</div><div className="habit-note"><Sparkles size={16}/><span>Missing a day doesn't erase your progress. Come back when you're ready.</span></div></div><div className="panel habit-insight"><div><div className="eyebrow">A LITTLE INSIGHT</div><h2>{strongestHabit?`Your longest streak is ${strongestHabit.title}.`:'Your next habit starts with one check-in.'}</h2><p>{strongestHabit?`You have recorded a ${strongestHabit.streak}-day streak. Keep it sustainable and focus on showing up consistently.`:'Create a habit and check in when you complete it to start building a personal rhythm.'}</p></div><div className="insight-number"><Flame size={20}/><strong>{strongestHabit?.streak??0}</strong><span>day streak</span></div></div></div><AppDialog dialog={dialog.dialog} onFinish={dialog.finish} onCancel={dialog.cancel}/></>
}
function CalendarPage({tasks,createTask}:{tasks:Task[];createTask:()=>void}) {
 const [offset,setOffset]=useState(0),[view,setView]=useState('Month')
 const monthDate=new Date(new Date().getFullYear(),new Date().getMonth()+offset,1),monthLabel=format(monthDate,'MMMM yyyy')
 const first=new Date(monthDate.getFullYear(),monthDate.getMonth(),1).getDay()
 const daysInMonth=new Date(monthDate.getFullYear(),monthDate.getMonth()+1,0).getDate()
 const cells=Array.from({length:42},(_,i)=>{const n=i-first+1;return n>0&&n<=daysInMonth?n:null})
 const events=tasks.filter(t=>t.status!=='Completed')
 return <div className="page-stack"><PageHeader eyebrow="MAKE TIME FOR WHAT MATTERS" title="Calendar" description="See your commitments and create a little breathing room." action={<Button onClick={createTask}><Plus size={16}/> Add event</Button>}/><div className="panel calendar-panel"><div className="calendar-toolbar"><div className="calendar-month-nav"><button className="icon-btn" onClick={()=>setOffset(v=>v-1)} aria-label="Previous month"><ChevronLeft size={18}/></button><h2>{monthLabel}</h2><button className="icon-btn" onClick={()=>setOffset(v=>v+1)} aria-label="Next month"><ChevronRight size={18}/></button><button className="btn btn-secondary btn-small" onClick={()=>setOffset(0)}>Today</button></div><div className="view-toggle">{['Month','Week','Day','Agenda'].map(v=><button key={v} className={view===v?'selected':''} onClick={()=>setView(v)}>{v}</button>)}</div></div>{view==='Month'?<><div className="calendar-grid calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d}>{d}</div>)}</div><div className="calendar-grid">{cells.map((day,i)=>{const dateKey=day?`${monthDate.getFullYear()}-${String(monthDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`:'';const dayTasks=events.filter(t=>t.dueDate===dateKey);return <div className={`calendar-day ${day===new Date().getDate()&&offset===0?'today':''} ${!day?'muted-day':''}`} key={i}><span>{day??''}</span>{dayTasks.slice(0,2).map(t=><button className={`calendar-event ${t.priority.toLowerCase()}`} key={t.id} title={t.title} onClick={createTask}>{t.title}</button>)}{dayTasks.length>2&&<small>+{dayTasks.length-2} more</small>}</div>})}</div></>:<div className="agenda-list">{events.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,view==='Day'?4:10).map(t=><div className="agenda-item" key={t.id}><div className="agenda-date"><strong>{prettyDate(t.dueDate)}</strong><small>{t.dueDate===today?'Today':'Upcoming'}</small></div><div className="agenda-dot"/><div className="agenda-info"><strong>{t.title}</strong><small>{t.project} · {t.priority} priority</small></div><Badge tone={t.status}>{t.status}</Badge></div>)}</div>}</div></div>
}
function NotesPage({notes,setNotes,create}:{notes:Note[];setNotes:React.Dispatch<React.SetStateAction<Note[]>>;create:()=>void}) {
 const dialog = useAppDialog()
 const [query,setQuery]=useState(''),[selected,setSelected]=useState<string|null>(notes[0]?.id??null),[category,setCategory]=useState('All notes')
 const filtered=notes.filter(n=>(n.title+' '+n.body+' '+n.tags.join(' ')).toLowerCase().includes(query.toLowerCase())&&(category==='All notes'||(category==='Favorites'?n.favorite:n.category===category)))
 const active=filtered.find(n=>n.id===selected)??filtered[0]
 const update=(field:'title'|'body',value:string)=>active&&setNotes(old=>old.map(n=>n.id===active.id?{...n,[field]:value,updatedAt:'Just now'}:n))
 const remove=async ()=>{if(active&&await dialog.confirm('Delete note?','This note will be permanently deleted.',true)){setNotes(old=>old.filter(n=>n.id!==active.id));setSelected(null)}}
 return <><div className="page-stack"><PageHeader eyebrow="YOUR SECOND BRAIN" title="Notes" description="A home for the ideas, learnings and details you want to keep." action={<Button onClick={create}><Plus size={16}/> New note</Button>}/><div className="notes-workspace panel"><aside className="notes-sidebar"><div className="inline-search notes-search"><Search size={15}/><input placeholder="Find a note..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="notes-filters">{['All notes','Favorites','Product','Learning','Journal','Work','Personal'].map(c=><button key={c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{c==='Favorites'?'★':c==='All notes'?'◫':'·'} <span>{c}</span></button>)}</div><div className="notes-list">{filtered.map(n=><button key={n.id} className={`note-list-item ${active?.id===n.id?'active':''}`} onClick={()=>setSelected(n.id)}><div><strong>{n.title}</strong>{n.favorite&&<span className="favorite-star">★</span>}</div><p>{n.body.slice(0,72)}</p><small>{n.category} · {n.updatedAt}</small></button>)}</div>{filtered.length===0&&<p className="empty-mini">No notes found.</p>}</aside>{active?<article className="note-editor"><div className="note-editor-toolbar"><Badge>{active.category}</Badge><div><button className={`icon-btn ${active.favorite?'favorite-active':''}`} onClick={()=>setNotes(old=>old.map(n=>n.id===active.id?{...n,favorite:!n.favorite}:n))} aria-label="Toggle favorite">★</button><button className="icon-btn" onClick={remove} aria-label="Delete note"><X size={17}/></button></div></div><input className="note-title-input" value={active.title} onChange={e=>update('title',e.target.value)} aria-label="Note title"/><div className="note-editor-meta"><span>Last edited {active.updatedAt}</span><span>{active.body.length} characters</span></div><textarea className="note-body-input" value={active.body} onChange={e=>update('body',e.target.value)} placeholder="Let your thoughts find a place..."/><div className="note-tags">{active.tags.map(t=><Badge key={t}>{t}</Badge>)}<span className="autosave-label"><Check size={13}/> Auto-saved</span></div></article>:<Empty title="A fresh page" description="Create a note to capture your next idea." action={<Button onClick={create}>Create a note</Button>}/>}</div></div><AppDialog dialog={dialog.dialog} onFinish={dialog.finish} onCancel={dialog.cancel}/></>
}
function FocusPage({tasks,sessions,setSessions,notify}:{tasks:Task[];sessions:FocusSession[];setSessions:React.Dispatch<React.SetStateAction<FocusSession[]>>;notify:(m:string)=>void}) {
 const dialog = useAppDialog()
 const [mode,setMode]=useState<'Focus'|'Short break'|'Long break'|'Custom'>('Focus'),[minutes,setMinutes]=useState(25),[remaining,setRemaining]=useState(25*60),[running,setRunning]=useState(false),[selected,setSelected]=useState(tasks.find(t=>t.status!=='Completed')?.id??'')
 useEffect(()=>{setRemaining((mode==='Focus'?minutes:mode==='Short break'?5:mode==='Long break'?15:minutes)*60);setRunning(false)},[mode,minutes])
 useEffect(()=>{if(!running)return;const id=window.setInterval(()=>setRemaining(r=>Math.max(0,r-1)),1000);return()=>window.clearInterval(id)},[running])
 useEffect(()=>{if(!running||remaining!==0)return;setRunning(false);notify(`${mode} session complete — take a breath.`);if(mode==='Focus'||mode==='Custom'){const task=tasks.find(t=>t.id===selected);setSessions(old=>[{id:uid(),taskId:selected||undefined,taskTitle:task?.title||'Unassigned focus',mode,durationMinutes:mode==='Custom'?minutes:25,endedAt:new Date().toISOString()},...old])}},[running,remaining,mode,notify,tasks,selected,minutes,setSessions])
 const total=(mode==='Focus'||mode==='Custom'?minutes:mode==='Short break'?5:15)*60
 const todayFocusMinutes=sessions.filter(session=>new Date(session.endedAt).toDateString()===new Date().toDateString()).reduce((sum,session)=>sum+session.durationMinutes,0)
 const dailyGoalMinutes=180
 const time=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`
 const circumference=2*Math.PI*108,offset=circumference*(1-remaining/Math.max(total,1))
 return <><div className="page-stack focus-page"><PageHeader eyebrow="ONE THING AT A TIME" title="Focus" description="Give your attention to one thing. The rest can wait."/><div className="focus-layout"><section className="panel focus-main"><div className="focus-mode-tabs">{(['Focus','Short break','Long break','Custom'] as const).map(m=><button key={m} className={mode===m?'selected':''} onClick={()=>setMode(m)}>{m}</button>)}</div><div className="timer-wrap"><svg className="timer-svg" viewBox="0 0 240 240" aria-label={`${time} remaining`}><circle cx="120" cy="120" r="108" className="timer-track"/><circle cx="120" cy="120" r="108" className="timer-progress" strokeDasharray={circumference} strokeDashoffset={offset}/></svg><div className="timer-center"><span className="timer-label">{running?'IN SESSION':remaining===0?'SESSION COMPLETE':mode.toUpperCase()}</span><strong>{time}</strong><span className="timer-sub">{mode==='Focus'?'Protect your attention':'Rest is productive, too'}</span></div></div><div className="timer-controls"><Button onClick={()=>{if(remaining===0)setRemaining(total);setRunning(v=>!v)}}>{running?'Pause session':remaining===0?'Start again':'Start session'} {running?'Ⅱ':<ArrowRight size={16}/>}</Button><Button variant="secondary" onClick={()=>{setRunning(false);setRemaining(total)}}>Reset</Button></div>{mode==='Custom'&&<div className="custom-time"><label>Session length <strong>{minutes} min</strong></label><input type="range" min="5" max="90" step="5" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></div>}<div className="focus-task-select"><label>I'm focusing on</label><select value={selected} onChange={e=>setSelected(e.target.value)}>{tasks.filter(t=>t.status!=='Completed').map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></div></section><aside className="focus-side"><div className="panel focus-goal-card"><span className="focus-side-icon"><Target size={19}/></span><div className="eyebrow">DAILY FOCUS GOAL</div><h2>3 hours</h2><p>Today's focus time, based on completed sessions.</p><Progress value={Math.min(100,todayFocusMinutes/dailyGoalMinutes*100)}/><div className="focus-goal-meta"><span>{Math.floor(todayFocusMinutes/60)}h {todayFocusMinutes%60}m completed</span><strong>{Math.round(Math.min(100,todayFocusMinutes/dailyGoalMinutes*100))}%</strong></div></div><div className="panel session-history"><SectionTitle title="Recent sessions" sub="Completed focus sessions saved to your account"/>{sessions.slice(0,5).map(session=><div className="session-item" key={session.id}><span className="session-check"><Check size={14}/></span><div><strong>{session.taskTitle}</strong><small>{format(new Date(session.endedAt),'MMM d · h:mm a')} · {session.durationMinutes} minutes</small></div><Badge>{session.mode}</Badge><button className="icon-btn danger-icon" onClick={async ()=>{if(await dialog.confirm('Delete focus session?','This session will be removed from your history.',true))setSessions(old=>old.filter(x=>x.id!==session.id))}} aria-label="Delete focus session" title="Delete session"><X size={14}/></button></div>)}{sessions.length===0&&<p className="empty-mini">Complete a focus timer to start your history.</p>}</div><div className="focus-quote">“The secret of getting ahead is getting started.”<small>— Mark Twain</small></div></aside></div></div><AppDialog dialog={dialog.dialog} onFinish={dialog.finish} onCancel={dialog.cancel}/></>
}
function AnalyticsPage({tasks,completion,habits,projects,goals,sessions}:{tasks:Task[];completion:number;habits:Habit[];projects:Project[];goals:Goal[];sessions:FocusSession[]}) {
 const [period,setPeriod]=useState<'7'|'30'|'90'>('7')
 const days=Number(period)
 const now=new Date()
 const rangeStart=new Date(now);rangeStart.setHours(0,0,0,0);rangeStart.setDate(rangeStart.getDate()-(days-1))
 const inRange=(iso?:string)=>{if(!iso)return false;const d=new Date(iso);return !Number.isNaN(d.getTime())&&d>=rangeStart&&d<=now}
 const completedTasks=tasks.filter(t=>t.status==='Completed')
 const periodTasks=completedTasks.filter(t=>inRange(t.completedAt))
 const periodSessions=sessions.filter(s=>inRange(s.endedAt))
 const focusMinutes=periodSessions.reduce((n,s)=>n+Math.max(0,s.durationMinutes),0)
 const habitChecks=habits.reduce((n,h)=>n+h.week.filter(Boolean).length,0),habitPossible=habits.length*7
 const trend=Array.from({length:days},(_,i)=>{const date=new Date(rangeStart);date.setDate(rangeStart.getDate()+i);const key=date.toDateString();return {day:days===7?format(date,'EEE'):format(date,'MMM d'),tasks:periodTasks.filter(t=>t.completedAt&&new Date(t.completedAt).toDateString()===key).length,focus:periodSessions.filter(s=>new Date(s.endedAt).toDateString()===key).reduce((n,s)=>n+s.durationMinutes/60,0)}})
 const activeGoals=goals.filter(g=>!g.completed&&g.progress<100)
 const achievedGoals=goals.filter(g=>g.completed||g.progress>=100)
 const summary=days===7?'This week':days===30?'This month':'Last 90 days'
 const distribution=[{name:'Completed',value:completedTasks.length,color:'#8FA28A'},{name:'In progress',value:tasks.filter(t=>t.status==='In Progress').length,color:'#C8A96B'},{name:'To do',value:tasks.filter(t=>!['Completed','In Progress'].includes(t.status)).length,color:'#D9D6CD'}]
 return <div className="page-stack"><PageHeader eyebrow="NOTICE YOUR PROGRESS" title="Analytics" description="A data-backed view of your progress. Focus sessions and task completion trends update as you use NEXUS." action={<div className="view-toggle">{([{value:'7',label:'7 days'},{value:'30',label:'30 days'},{value:'90',label:'90 days'}] as const).map(o=><button key={o.value} className={period===o.value?'selected':''} onClick={()=>setPeriod(o.value)}>{o.label}</button>)}</div>}/>
 <div className="stat-grid"><StatCard icon={CircleCheck} label="Tasks completed" value={String(completedTasks.length)} detail={`${periodTasks.length} completed ${days===7?'in the last week':days===30?'in the last month':'in this 90-day window'}`} trend="up"/><StatCard icon={Activity} label="Completion rate" value={`${completion}%`} detail="Completed out of all tracked tasks" trend="neutral"/><StatCard icon={Timer} label="Focus time" value={`${Math.floor(focusMinutes/60)}h ${focusMinutes%60}m`} detail={`${periodSessions.length} recorded sessions · ${summary}`} trend="up"/><StatCard icon={Flame} label="Habit consistency" value={`${Math.round(habitChecks/Math.max(habitPossible,1)*100)}%`} detail="Based on the current 7-day habit grid" trend="neutral"/></div>
 <div className="analytics-grid"><section className="panel analytics-wide"><SectionTitle title="Productivity trend" sub={`Completed tasks per day · ${summary.toLowerCase()}`}/><div className="chart-wrap analytics-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={trend}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="day" axisLine={false} tickLine={false} interval={days===90?6:days===30?2:0} tick={{fill:'var(--muted)',fontSize:11}}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:12}}/><Tooltip contentStyle={{borderRadius:12,border:'1px solid var(--border)',background:'var(--surface)',fontSize:12}}/><Bar dataKey="tasks" name="Completed tasks" fill="#8FA28A" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div><p className="analytics-footnote">Completion trend is tracked from the date you complete tasks in NEXUS. Older completed tasks without a completion timestamp count in totals but not in daily trends.</p></section>
 <section className="panel"><SectionTitle title="Task distribution" sub="Your current workload"/><div className="chart-wrap pie-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={57} outerRadius={82} paddingAngle={4}>{distribution.map(d=><Cell key={d.name} fill={d.color}/>)}</Pie><Tooltip contentStyle={{borderRadius:12,border:'1px solid var(--border)',background:'var(--surface)',fontSize:12}}/></PieChart></ResponsiveContainer><div className="pie-center"><strong>{tasks.length}</strong><span>total tasks</span></div></div><div className="distribution-legend">{distribution.map(d=><div key={d.name}><span><i style={{background:d.color}}/>{d.name}</span><strong>{d.value}</strong></div>)}</div></section>
 <section className="panel analytics-wide"><SectionTitle title="Focus time" sub={`Recorded focus hours per day · ${summary.toLowerCase()}`}/><div className="chart-wrap analytics-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={trend}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3"/><XAxis dataKey="day" axisLine={false} tickLine={false} interval={days===90?6:days===30?2:0} tick={{fill:'var(--muted)',fontSize:11}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:12}}/><Tooltip formatter={(v)=>[`${Number(v).toFixed(2)} h`,'Focus time']} contentStyle={{borderRadius:12,border:'1px solid var(--border)',background:'var(--surface)',fontSize:12}}/><Bar dataKey="focus" name="Focus hours" fill="#C8A96B" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></section>
 <section className="panel"><SectionTitle title="Goal progress" sub="Active goals and milestones"/><div className="analytics-projects">{activeGoals.map(g=><div key={g.id}><div><strong>{g.title}</strong><span>{g.progress}%</span></div><Progress value={g.progress}/></div>)}{activeGoals.length===0&&<p className="empty-mini">No active goals yet.</p>}<div className="analytics-summary-line"><span>Goals achieved</span><strong>{achievedGoals.length}</strong></div></div></section>
 <section className="panel analytics-wide"><SectionTitle title="Habit consistency" sub="This week's check-ins by habit"/><div className="analytics-projects">{habits.map(h=><div key={h.id}><div><strong>{h.title}</strong><span>{Math.round(h.week.filter(Boolean).length/7*100)}%</span></div><Progress value={h.week.filter(Boolean).length/7*100}/></div>)}{habits.length===0&&<p className="empty-mini">Add a habit to start tracking consistency.</p>}</div></section>
 <section className="panel"><SectionTitle title="Project progress" sub="Progress across your work"/><div className="analytics-projects">{projects.filter(p=>p.status!=='Completed').map(p=><div key={p.id}><div><strong>{p.name}</strong><span>{p.progress}%</span></div><Progress value={p.progress}/></div>)}</div></section></div>
 <section className="panel analytics-summary"><SectionTitle title={`${summary} summary`} sub="A quick review of the period"/><div className="summary-metrics"><div><span>Tasks completed in period</span><strong>{periodTasks.length}</strong></div><div><span>Focus time recorded</span><strong>{(focusMinutes/60).toFixed(1)}h</strong></div><div><span>Active goals</span><strong>{activeGoals.length}</strong></div><div><span>Goals achieved</span><strong>{achievedGoals.length}</strong></div><div><span>Habit check-ins this week</span><strong>{habitChecks}/{habitPossible}</strong></div></div><p className="analytics-footnote">NEXUS reports recorded activity, not inferred productivity. Keep the focus timer running to build a more accurate picture over time.</p></section></div>
}
function NotificationsPage({notify}:{notify:(m:string)=>void}) {
 const [items,setItems]=useState([{id:1,title:'React component library is due soon',body:'Your NEXUS task is due tomorrow.',time:'20 min ago',type:'Deadline',read:false},{id:2,title:'You reached a 12-day reading streak',body:'Consistency is a quiet superpower. Keep it going.',time:'2 hours ago',type:'Habit',read:false},{id:3,title:'Weekly review is ready',body:'Take a moment to look back on your progress.',time:'Yesterday',type:'Reminder',read:true},{id:4,title:'NEXUS project moved forward',body:'Your project is now 62% complete.',time:'Yesterday',type:'Project',read:true}])
 return <div className="page-stack"><PageHeader eyebrow="STAY IN THE LOOP" title="Notifications" description="A few thoughtful nudges to help you stay on track." action={<Button variant="secondary" onClick={()=>setItems(old=>old.map(n=>({...n,read:true})))}><CheckCheck size={15}/> Mark all read</Button>}/><div className="panel notification-panel"><div className="notification-panel-head"><strong>Recent activity</strong><span>{items.filter(n=>!n.read).length} unread</span></div>{items.map(n=><div className={`notification-row ${n.read?'read':''}`} key={n.id}><div className={`notification-symbol ${n.type.toLowerCase()}`}>{n.type==='Deadline'?<CalendarDays size={17}/>:n.type==='Habit'?<Flame size={17}/>:n.type==='Project'?<FolderKanban size={17}/>:<Bell size={17}/>}</div><div className="notification-copy"><strong>{n.title}</strong><p>{n.body}</p><small>{n.time} · {n.type}</small></div>{!n.read&&<span className="unread-dot"/>}<button className="icon-btn" onClick={()=>setItems(old=>old.map(x=>x.id===n.id?{...x,read:true}:x))} aria-label="Mark notification read"><Check size={15}/></button></div>)}<div className="notification-footer"><span>You're all caught up with your important updates.</span><button className="text-action" onClick={()=>notify('Notification preferences opened in Settings')}>Manage preferences <ArrowRight size={14}/></button></div></div></div>
}
function ProfilePage({name,setName,tasks,completion,goals}:{name:string;setName:(v:string)=>void;tasks:Task[];completion:number;goals:Goal[]}) {
 const [bio,setBio]=usePersistedState('nexus_bio','Building good systems, learning every day, and making room for what matters.')
 return <div className="page-stack"><PageHeader eyebrow="YOUR SPACE, YOUR PACE" title="Profile" description="A small snapshot of the person behind the plans."/><div className="profile-layout"><section className="panel profile-main"><div className="profile-cover"/><div className="profile-detail"><div className="avatar profile-avatar">AM</div><div className="profile-edit-fields"><label>Display name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Bio<textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3}/></label><p className="autosave-label"><Check size={13}/> Changes save automatically</p></div></div></section><aside className="panel profile-stats"><SectionTitle title="Your progress" sub="Every small step counts"/><div className="profile-stat"><span>Tasks completed</span><strong>{tasks.filter(t=>t.status==='Completed').length}</strong></div><div className="profile-stat"><span>Completion rate</span><strong>{completion}%</strong></div><div className="profile-stat"><span>Active goals</span><strong>{goals.length}</strong></div><div className="profile-achievements"><h3><Sparkles size={16}/> Achievements</h3><div><span>✳</span><p><strong>Getting started</strong><small>Created your first workspace</small></p></div><div><span>↗</span><p><strong>Momentum builder</strong><small>Completed 5 tasks</small></p></div><div><span>♧</span><p><strong>Habit keeper</strong><small>Showed up consistently</small></p></div></div></aside></div></div>
}
function SettingsPage({dark,setDark,notify}:{dark:boolean;setDark:(v:boolean)=>void;notify:(m:string)=>void}) {
 const dialog = useAppDialog()
 const [emailAlerts,setEmailAlerts]=usePersistedState('nexus_email_alerts',true),[reminders,setReminders]=usePersistedState('nexus_reminders',true),[weekStart,setWeekStart]=usePersistedState('nexus_week_start','Monday')
 return <><div className="page-stack"><PageHeader eyebrow="MAKE IT YOURS" title="Settings" description="Shape NEXUS around the way you like to work."/><div className="settings-layout"><div className="settings-nav panel">{['Account','Appearance','Notifications','Productivity','Privacy','Preferences'].map((s,i)=><a href={`#${s.toLowerCase()}`} key={s} className={i===0?'current':''}>{[UserRound,Sun,Bell,Zap,Settings,SlidersHorizontal].map((Icon,j)=>i===j?<Icon size={16} key={s}/>:null)}{s}</a>)}</div><div className="settings-content"><section id="account" className="panel settings-section"><div><h2>Account</h2><p>Manage your personal details and workspace identity.</p></div><label>Workspace name<input defaultValue="My workspace"/></label><label>Email address<input type="email" defaultValue="alex@example.com"/></label><Button variant="secondary" onClick={()=>notify('Account preferences saved')}>Save account</Button></section><section id="appearance" className="panel settings-section"><div><h2>Appearance</h2><p>Make the workspace comfortable to look at.</p></div><div className="setting-row"><div><strong>Dark appearance</strong><small>Use a darker palette for low-light environments.</small></div><button className={`switch ${dark?'on':''}`} onClick={()=>setDark(!dark)} aria-label="Toggle dark appearance"><span/></button></div><div className="theme-preview"><div className="theme-preview-card light-preview"><span/><span/><span/></div><div className="theme-preview-card dark-preview"><span/><span/><span/></div></div></section><section id="notifications" className="panel settings-section"><div><h2>Notifications</h2><p>Choose which nudges are helpful to you.</p></div><SettingSwitch title="Email summaries" description="A short weekly review in your inbox." value={emailAlerts} onChange={setEmailAlerts}/><SettingSwitch title="Task reminders" description="A gentle nudge before due dates." value={reminders} onChange={setReminders}/></section><section id="productivity" className="panel settings-section"><div><h2>Productivity</h2><p>Set your defaults for planning and focus.</p></div><label>Week starts on<select value={weekStart} onChange={e=>setWeekStart(e.target.value)}><option>Monday</option><option>Sunday</option></select></label><label>Default focus duration<select defaultValue="25 minutes"><option>15 minutes</option><option>25 minutes</option><option>45 minutes</option><option>60 minutes</option></select></label></section><section id="privacy" className="panel settings-section"><div><h2>Privacy & data</h2><p>Your workspace data syncs to your NEXUS account.</p></div><div className="privacy-note"><CircleHelp size={17}/><span>Tasks, projects, goals, habits and notes sync to your account. Theme and display preferences remain local to this browser.</span></div><Button variant="secondary" onClick={async ()=>{if(await dialog.confirm('Reset local demo data?','This clears NEXUS data stored in this browser. Account data saved on the server is not deleted.',true)){Object.keys(localStorage).filter(k=>k.startsWith('nexus_')).forEach(k=>localStorage.removeItem(k));window.location.reload()}}}>Reset local demo data</Button></section><section id="preferences" className="panel settings-section"><div><h2>Preferences</h2><p>Keep your workspace aligned with your routine.</p></div><SettingSwitch title="Reduce motion" description="Use calmer transitions where possible." value={false} onChange={()=>notify('Motion preference can be wired to the design system')}/></section></div></div></div><AppDialog dialog={dialog.dialog} onFinish={dialog.finish} onCancel={dialog.cancel}/></>
}
function SettingSwitch({title,description,value,onChange}:{title:string;description:string;value:boolean;onChange:(v:boolean)=>void}) {
 return <div className="setting-row"><div><strong>{title}</strong><small>{description}</small></div><button className={`switch ${value?'on':''}`} onClick={()=>onChange(!value)} aria-label={`Toggle ${title}`}><span/></button></div>
}
export default App
