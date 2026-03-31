import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Activity, Zap, Brain, TrendingUp, Moon, BookOpen, Coffee, FlaskConical,
  AlertTriangle, Clock, User, BarChart3, MessageSquare, RefreshCw, Flame, Menu, X
} from 'lucide-react'
import { RadialBarChart, RadialBar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, AreaChart, Area } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { predictFatigue, getCircadianPhase, rankTasksByCircadian, MEU_WEIGHTS, MEU_SCALAR, DAILY_MEU_CAPACITY } from '../hooks/usePrediction'
import MetricCard from './MetricCard'
import TaskList from './TaskList'
import StressHeatmap from './StressHeatmap'
import Chatbot from './Chatbot'
import LanguageSwitcher from './LanguageSwitcher'
import Onboarding from './Onboarding'
import BioCheckin from './BioCheckin'

const generateChartData = () => Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  productivity: Math.round(30 + 50 * Math.sin((i - 6) * Math.PI / 12) + Math.random() * 10),
  fatigue: Math.round(70 - 50 * Math.sin((i - 6) * Math.PI / 12) + Math.random() * 10),
  cortisol: Math.round(
    i >= 6 && i <= 11 ? 70 + (i - 6) * 6 + Math.random() * 8 :
      i >= 12 && i <= 15 ? 55 + Math.random() * 10 :
        30 + Math.random() * 15
  ),
}))

export default function Dashboard() {
  const { t } = useTranslation()

  // ── Auth state ──────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null)
  const [regForm, setRegForm] = useState({ username: '', password: '', name: '', age: '' })
  const [authMode, setAuthMode] = useState('register') // 'register' | 'login'
  const [authError, setAuthError] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError('')
    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login'
      const body = authMode === 'register' ? regForm : { username: regForm.username, password: regForm.password }
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const res = await fetch(`${baseURL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) setUser(data.user)
      else setAuthError(data.error)
    } catch {
      setAuthError('Server not reachable')
    }
  }

  // ── Dashboard state ─────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState([
    { id: 1, name: 'Math Assignment', priority: 'high', duration: 60, completed: false },
    { id: 2, name: 'Physics Lab Report', priority: 'high', duration: 90, completed: false },
    { id: 3, name: 'Read Biology Chapter', priority: 'medium', duration: 45, completed: false },
    { id: 4, name: 'Review English Notes', priority: 'low', duration: 30, completed: false },
  ])
  const [inputs, setInputs] = useState({ sleepHours: 7, studyLoad: 6, hoursSinceBreak: 2, energyLevel: 6 })
  const [prediction, setPrediction] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [powerNaps, setPowerNaps] = useState([])
  const [isTired, setIsTired] = useState(false)
  const [totalMEU, setTotalMEU] = useState(0)
  const [chartData] = useState(generateChartData())
  const [activeTab, setActiveTab] = useState('dashboard')
  const [circadian, setCircadian] = useState(getCircadianPhase(new Date().getHours()))
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [hasOnboarded, setHasOnboarded] = useState(false)
  const [hasCheckedIn, setHasCheckedIn] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Sync user status when logged in
  useEffect(() => {
    if (user && user.chronotype) {
      setHasOnboarded(true)
    }
  }, [user])

  const analyze = useCallback(() => {
    const result = predictFatigue({ ...inputs, chronotype: user?.chronotype || 'lark' })
    setPrediction(result)
  }, [inputs, user])

  useEffect(() => { analyze() }, [])

  useEffect(() => {
    const interval = setInterval(() => setCircadian(getCircadianPhase(new Date().getHours())), 60000)
    return () => clearInterval(interval)
  }, [])

  const handleReschedule = async (tired = isTired) => {
    setIsRescheduling(true)
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const res = await fetch(`${baseURL}/api/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: tasks.filter(t => !t.completed), sleepHours: inputs.sleepHours, isTired: tired, chronotype: user?.chronotype || 'lark', currentFatigue: prediction?.fatigueIndex || 0 })
      })
      const data = await res.json()
      setSchedule(data.scheduledTasks || [])
      setPowerNaps(data.powerNapBlocks || [])
      setTotalMEU(data.totalMEU || 0)
    } catch {
      // Fallback: local rank
      const ranked = rankTasksByCircadian(tasks, new Date().getHours(), inputs.sleepHours, tired)
      setSchedule(ranked)
    }
    setIsRescheduling(false)
  }

  const handleTired = () => {
    const newTired = !isTired
    setIsTired(newTired)
    if (schedule.length > 0) handleReschedule(newTired)
  }

  const handleBurnoutSOS = async () => {
    // Activate Recovery Mode: Sets user to tired, simulates low sleep for max rest blocks
    setIsTired(true)
    setInputs(prev => ({ ...prev, sleepHours: Math.min(prev.sleepHours, 5) })) // Trigger low sleep napping

    setIsRescheduling(true)
    try {
      // Deprioritize all high-load tasks instantly to lower intensity
      const modifiedTasks = tasks.map(t => ({
        ...t,
        priority: t.priority === 'high' ? 'medium' : t.priority
      }))
      setTasks(modifiedTasks)

      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const res = await fetch(`${baseURL}/api/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: modifiedTasks.filter(t => !t.completed), sleepHours: 5, isTired: true, chronotype: user?.chronotype || 'lark', currentFatigue: prediction?.fatigueIndex || 100 })
      })
      const data = await res.json()
      setSchedule(data.scheduledTasks || [])
      setPowerNaps([...(data.powerNapBlocks || []), { time: 'Now', label: 'Emergency NSDR (30 min)', type: 'rest' }])
      setTotalMEU(data.totalMEU || 0)
      setActiveTab('schedule')
    } catch (e) {
      console.error(e)
    }
    setIsRescheduling(false)
  }

  const fatigueData = prediction ? {
    fatigue_index: prediction.fatigueIndex,
    productivity: prediction.productivity,
    burnout_risk: prediction.burnoutRisk,
    sleep_hours: inputs.sleepHours,
    energy_level: inputs.energyLevel,
    study_load: inputs.studyLoad,
  } : {}

  const radialData = prediction ? [
    { name: 'Productivity', value: prediction.productivity, fill: '#00e5a0' },
    { name: 'Fatigue', value: prediction.fatigueIndex, fill: '#ff6b35' },
    { name: 'Burnout Risk', value: prediction.burnoutRisk, fill: '#6c63ff' },
  ] : []

  const meuUsed = tasks.filter(t => !t.completed).reduce((sum, t) => sum + (isTired ? ((MEU_WEIGHTS[t.priority] || 3) * MEU_SCALAR) * 2 : ((MEU_WEIGHTS[t.priority] || 3) * MEU_SCALAR)), 0)
  const meuPercent = Math.min(100, Math.round((meuUsed / DAILY_MEU_CAPACITY) * 100))

  const tabs = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: BarChart3 },
    { id: 'schedule', label: 'Schedule', icon: Clock },
    { id: 'coach', label: t('nav.coach'), icon: MessageSquare },
    { id: 'analytics', label: t('nav.analytics'), icon: TrendingUp },
    { id: 'profile', label: 'Profile', icon: User },
  ]

  // ── Auth Screen ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-obsidian text-text font-body flex items-center justify-center relative overflow-hidden">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, type: 'spring' }} className="absolute -top-40 -right-40 w-96 h-96 bg-accent/8 rounded-full blur-3xl pointer-events-none" />
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, type: 'spring', delay: 0.2 }} className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan/8 rounded-full blur-3xl pointer-events-none" />
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, type: 'spring' }}
          className="bg-panel border border-border rounded-2xl p-8 w-[420px] max-w-full shadow-2xl relative z-10"
        >
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/40">
              <Brain size={22} className="text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-1 font-display text-center">CogniFlow</h2>
          <p className="text-subtle text-center text-xs mb-6 font-display">{t('auth.systemDesc')}</p>

          <div className="flex rounded-xl border border-border p-1 mb-6 gap-1">
            {['register', 'login'].map(mode => (
              <button
                key={mode}
                onClick={() => { setAuthMode(mode); setAuthError('') }}
                className={`flex-1 py-2 rounded-lg text-xs font-display font-bold transition-all ${authMode === mode ? 'bg-accent text-white shadow shadow-accent/30' : 'text-subtle hover:text-text'}`}
              >
                {mode === 'register' ? t('auth.registerTab') : t('auth.loginTab')}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuth} className="space-y-3">
            <input
              className="w-full bg-void border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-accent transition-colors placeholder-muted"
              placeholder={t('auth.username')}
              required
              value={regForm.username}
              onChange={e => setRegForm({ ...regForm, username: e.target.value })}
            />
            <input
              className="w-full bg-void border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-accent transition-colors placeholder-muted"
              type="password"
              placeholder={t('auth.password')}
              required
              value={regForm.password}
              onChange={e => setRegForm({ ...regForm, password: e.target.value })}
            />
            {authMode === 'register' && (
              <>
                <input
                  className="w-full bg-void border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-accent transition-colors placeholder-muted"
                  placeholder={t('auth.fullName')}
                  required
                  value={regForm.name}
                  onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                />
                <input
                  className="w-full bg-void border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-accent transition-colors placeholder-muted"
                  type="number"
                  placeholder={t('auth.age')}
                  required
                  value={regForm.age}
                  onChange={e => setRegForm({ ...regForm, age: e.target.value })}
                />
              </>
            )}
            {authError && <p className="text-ember text-xs font-display">{authError}</p>}
            <button
              className="w-full py-3 bg-accent text-white rounded-xl font-bold font-display hover:bg-accent/80 transition-all shadow-lg shadow-accent/20 mt-2"
              type="submit"
            >
              {authMode === 'register' ? t('auth.registerBtn') : t('auth.loginBtn')}
            </button>
          </form>
        </motion.div>
      </div>
    )
  }

  // Handle Onboarding Completion
  const handleOnboardingComplete = async (bioProfile) => {
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      await fetch(`${baseURL}/api/user/profile/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bioProfile)
      })
      setUser({ ...user, ...bioProfile })
      setHasOnboarded(true)
    } catch (e) {
      console.error('Failed to save bio-profile', e)
      setHasOnboarded(true)
    }
  }

  // Handle Bio Checkin Completion
  const handleCheckinComplete = (data) => {
    setInputs(prev => ({ ...prev, energyLevel: data.feeling, sleepQuality: data.sleepQuality }))
    setHasCheckedIn(true)
    // If sleep < 6 or feeling low, trigger reschedule automatically
    if (inputs.sleepHours < 6 || data.feeling < 4) {
      handleTired()
    }
  }

  if (user && !hasOnboarded) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  // ── Main App ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-obsidian text-text font-body">
      {user && hasOnboarded && !hasCheckedIn && <BioCheckin onComplete={handleCheckinComplete} />}

      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/3 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border bg-void/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-lg shadow-accent/40">
                <Brain size={16} className="text-white" />
              </div>
              <div>
                <span className="font-display font-bold text-text text-lg tracking-tight">CogniFlow</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse-slow" />
                  <span className="text-[10px] text-subtle font-display">
                    {circadian.icon} {circadian.phase.toUpperCase()} {t('dashboard.phaseText')}
                  </span>
                </div>
              </div>
            </div>

            {/* MEU bar in header */}
            <div className="hidden md:flex items-center gap-3 bg-panel border border-border rounded-xl px-4 py-2">
              <span className="text-[11px] text-subtle font-display">MEU</span>
              <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${meuPercent > 80 ? 'bg-ember' : meuPercent > 60 ? 'bg-accent' : 'bg-mint'}`}
                  style={{ width: `${meuPercent}%` }}
                />
              </div>
              <span className={`text-[11px] font-display font-bold ${meuPercent > 80 ? 'text-ember' : 'text-mint'}`}>
                {meuUsed}/{DAILY_MEU_CAPACITY}
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-1 bg-panel border border-border rounded-xl p-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-display transition-all duration-200 flex items-center gap-1.5 ${activeTab === tab.id ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'text-subtle hover:text-text'
                    }`}
                >
                  <tab.icon size={12} />
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <div className="md:hidden">
                <button 
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 text-subtle hover:text-text hover:bg-white/5 rounded-xl transition-all"
                >
                  <Menu size={20} />
                </button>
              </div>

              {/* Desktop controls */}
              <div className="hidden md:flex items-center gap-3">
                <button
                  onClick={handleBurnoutSOS}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display border transition-all text-white bg-red-600 hover:bg-red-700 shadow border-red-500 shadow-red-500/30 font-bold"
                >
                  <AlertTriangle size={12} />
                  {t('dashboard.burnoutSos')}
                </button>
                <button
                  onClick={handleTired}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display border transition-all ${isTired ? 'bg-ember/20 border-ember/50 text-ember' : 'border-border text-subtle hover:border-accent/50 hover:text-text'}`}
                >
                  <Flame size={12} />
                  {isTired ? t('dashboard.tiredOn') : t('dashboard.tired')}
                </button>
              </div>
              
              <LanguageSwitcher />
              <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm font-display">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Menu Layer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
              exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              className="fixed inset-0 z-[100] bg-obsidian/80 flex justify-end"
            >
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-72 sm:w-80 h-full bg-panel border-l border-border shadow-2xl p-6 flex flex-col"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-lg shadow-accent/40">
                      <Brain size={16} className="text-white" />
                    </div>
                    <span className="font-display font-bold text-text text-lg">Menu</span>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-void rounded-xl text-subtle hover:text-white border border-border">
                    <X size={18}/>
                  </button>
                </div>

                <nav className="flex flex-col gap-2 mb-8">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false) }}
                      className={`px-4 py-3 rounded-xl text-sm font-display font-medium transition-all flex items-center gap-3 ${activeTab === tab.id ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'text-subtle hover:text-text bg-void border border-border'}`}
                    >
                      <tab.icon size={16} />
                      {tab.label}
                    </button>
                  ))}
                </nav>

                <div className="mt-auto space-y-3">
                  <div className="p-4 bg-void border border-border rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-subtle font-display">{t('dashboard.meuCapacity')}</span>
                      <span className={`text-xs font-bold ${meuPercent > 80 ? 'text-ember' : 'text-mint'}`}>{meuUsed}/{DAILY_MEU_CAPACITY}</span>
                    </div>
                    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${meuPercent > 80 ? 'bg-ember' : meuPercent > 60 ? 'bg-accent' : 'bg-mint'}`}
                        style={{ width: `${meuPercent}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => { handleBurnoutSOS(); setIsMobileMenuOpen(false) }}
                    className="w-full flex justify-center items-center gap-2 py-3 rounded-xl text-sm font-display text-white bg-red-600 hover:bg-red-700 shadow border border-red-500 shadow-red-500/30 font-bold transition-all"
                  >
                    <AlertTriangle size={14} /> {t('dashboard.burnoutSos')}
                  </button>
                  <button
                    onClick={() => { handleTired(); setIsMobileMenuOpen(false) }}
                    className={`w-full flex justify-center items-center gap-2 py-3 rounded-xl text-sm font-display border transition-all ${isTired ? 'bg-ember/20 border-ember/50 text-ember' : 'border-border text-subtle hover:border-accent/50 hover:text-text'}`}
                  >
                    <Flame size={14} /> {isTired ? t('dashboard.tiredOn') : t('dashboard.tired')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="max-w-7xl mx-auto px-6 py-6">

          {/* ── DASHBOARD TAB ─────────────────── */}
          {activeTab === 'dashboard' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="font-display text-2xl font-bold text-text">{t('dashboard.title')}</h1>
                  <p className="text-subtle text-sm mt-0.5">{t('dashboard.subtitle')}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xs text-muted">{new Date().toLocaleDateString()}</p>
                  <p className="font-display text-lg font-bold" style={{ color: circadian.color }}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* Burnout Alert */}
              {prediction?.burnoutRisk > 60 && (
                <div className="bg-ember/10 border border-ember/30 rounded-xl p-4 flex items-center gap-3 animate-pulse-slow">
                  <AlertTriangle size={18} className="text-ember flex-shrink-0" />
                  <div>
                    <p className="text-ember text-sm font-display font-bold">{t('dashboard.highBurnoutTitle')} ({prediction.burnoutRisk}%)</p>
                    <p className="text-ember/70 text-xs mt-0.5">{t('dashboard.highBurnoutDesc')}</p>
                  </div>
                </div>
              )}

              {/* Sleep Alert */}
              {inputs.sleepHours < 6 && (
                <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-center gap-3">
                  <Moon size={16} className="text-accent flex-shrink-0" />
                  <p className="text-accent/90 text-xs font-display">
                    {t('dashboard.lowSleepAlert')}
                  </p>
                </div>
              )}

              {/* Metric cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label={t('dashboard.fatigue')} value={prediction?.fatigueIndex ?? '--'} unit="%" color="ember" icon={Activity} trend={prediction?.fatigueIndex} />
                <MetricCard label={t('dashboard.productivity')} value={prediction?.productivity ?? '--'} unit="%" color="mint" icon={TrendingUp} trend={prediction?.productivity} />
                <MetricCard label={t('dashboard.energy')} value={inputs.energyLevel} unit="/10" color="cyan" icon={Zap} trend={inputs.energyLevel * 10} />
                <MetricCard label={t('dashboard.burnoutRisk')} value={prediction?.burnoutRisk ?? '--'} unit="%" color="accent" icon={Flame} trend={prediction?.burnoutRisk} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Daily Input */}
                  <div className="bg-panel border border-border rounded-2xl p-5">
                    <h3 className="font-display text-sm text-subtle uppercase tracking-widest mb-4">{t('dashboard.dailyInput')}</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {[
                        { key: 'sleepHours', label: t('dashboard.sleep'), icon: Moon, min: 0, max: 12, step: 0.5 },
                        { key: 'studyLoad', label: t('dashboard.studyLoad'), icon: BookOpen, min: 1, max: 10, step: 1 },
                        { key: 'hoursSinceBreak', label: t('dashboard.lastBreak'), icon: Coffee, min: 0, max: 8, step: 0.5 },
                        { key: 'energyLevel', label: t('dashboard.energy'), icon: Zap, min: 1, max: 10, step: 1 },
                      ].map(({ key, label, icon: Icon, min, max, step }) => (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Icon size={13} className="text-accent" />
                              <label className="text-xs text-subtle font-display">{label}</label>
                            </div>
                            <span className="font-display text-sm font-bold text-accent">{inputs[key]}</span>
                          </div>
                          <input
                            type="range" min={min} max={max} step={step} value={inputs[key]}
                            onChange={e => setInputs(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                            className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={analyze}
                      className="w-full py-2.5 bg-accent text-white rounded-xl font-display text-sm font-bold hover:bg-accent/80 transition-all shadow-lg shadow-accent/20 hover:shadow-accent/40"
                    >
                      {t('dashboard.analyze')}
                    </button>
                  </div>

                  {/* Formula */}
                  <div className="bg-panel border border-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-sm text-subtle uppercase tracking-widest">{t('dashboard.formulaTitle')}</h3>
                      <FlaskConical size={15} className="text-accent" />
                    </div>
                    <div className="bg-void border border-accent/20 rounded-xl p-4 font-display">
                      <p className="text-accent text-center text-base font-bold mb-3">P = w₁×Sleep + w₂×Energy − w₃×Load</p>
                      <p className="text-[11px] text-subtle text-center mb-3">× Circadian Multiplier C(t)</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-[10px] text-muted">{t('dashboard.w1')}</p></div>
                        <div><p className="text-[10px] text-muted">{t('dashboard.w2')}</p></div>
                        <div><p className="text-[10px] text-muted">{t('dashboard.w3')}</p></div>
                      </div>
                      {prediction && (
                        <div className="mt-3 pt-3 border-t border-accent/10 text-center">
                          <p className="text-[11px] text-accent">
                            {t('dashboard.multiplier')}: {prediction.circadianMultiplier}% — {circadian.phase} {t('dashboard.phase')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <TaskList tasks={tasks} setTasks={setTasks} sleepHours={inputs.sleepHours} isTired={isTired} />
                  <StressHeatmap />
                </div>

                <div className="space-y-6">
                  {/* Radial chart */}
                  {prediction && (
                    <motion.div whileHover={{ scale: 1.02 }} className="bg-panel border border-border rounded-2xl p-5">
                      <h3 className="font-display text-sm text-subtle uppercase tracking-widest mb-4">{t('dashboard.prediction')}</h3>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart innerRadius="30%" outerRadius="90%" data={radialData} startAngle={180} endAngle={0}>
                            <RadialBar dataKey="value" cornerRadius={4} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-4">
                        {radialData.map(d => (
                          <div key={d.name} className="text-center">
                            <p style={{ color: d.fill }} className="text-lg font-display font-bold">{d.value}%</p>
                            <p className="text-[10px] text-muted font-display">{d.name}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* MEU Panel */}
                  <div className="bg-panel border border-border rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-sm text-subtle uppercase tracking-widest">{t('dashboard.meuCapacity')}</h3>
                      <span className="text-[10px] text-subtle font-display">{t('dashboard.meuFullName')}</span>
                    </div>
                    <div className="relative h-4 bg-border rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${meuPercent > 80 ? 'bg-gradient-to-r from-ember to-red-500' : meuPercent > 60 ? 'bg-gradient-to-r from-accent to-cyan' : 'bg-gradient-to-r from-mint to-cyan'}`}
                        style={{ width: `${meuPercent}%` }}
                      />
                    </div>
                    <p className={`text-center font-display font-bold ${meuPercent > 80 ? 'text-ember' : 'text-mint'}`}>
                      {meuUsed} / {DAILY_MEU_CAPACITY} {t('dashboard.meuUsed')}
                    </p>
                    {isTired && (
                      <p className="text-center text-ember text-xs font-display mt-2">
                        {t('dashboard.tiredModeAlert')}
                      </p>
                    )}
                  </div>

                  <div className="h-[500px]">
                    <Chatbot fatigueData={fatigueData} schedule={schedule} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── SCHEDULE TAB ──────────────────── */}
          {activeTab === 'schedule' && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold">{t('schedule.title')}</h2>
                  <p className="text-subtle text-sm">{t('schedule.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleTired}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-display border transition-all ${isTired ? 'bg-ember/20 border-ember/50 text-ember' : 'border-border text-subtle hover:border-accent/50 hover:text-text'
                      }`}
                  >
                    <Flame size={14} />
                    {isTired ? t('dashboard.tiredOn') : t('dashboard.tired')}
                  </button>
                  <button
                    onClick={() => handleReschedule()}
                    disabled={isRescheduling}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-display font-bold hover:bg-accent/80 transition-all shadow-lg shadow-accent/20"
                  >
                    <RefreshCw size={14} className={isRescheduling ? 'animate-spin' : ''} />
                    {t('dashboard.reschedule')}
                  </button>
                </div>
              </div>

              {inputs.sleepHours < 6 && (
                <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-center gap-3">
                  <Moon size={16} className="text-accent" />
                  <p className="text-accent/90 text-sm font-display">
                    {t('schedule.sleepAlert')}
                  </p>
                </div>
              )}

              {isTired && (
                <div className="bg-ember/10 border border-ember/30 rounded-xl p-4 flex items-center gap-3">
                  <Flame size={16} className="text-ember" />
                  <p className="text-ember/90 text-sm font-display">
                    {t('schedule.fatigueAlert')}
                  </p>
                </div>
              )}

              {schedule.length === 0 ? (
                <div className="bg-panel border border-border rounded-2xl p-12 text-center">
                  <Clock size={32} className="text-subtle mx-auto mb-4" />
                  <p className="text-subtle font-display">{t('schedule.emptyState')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Power Nap blocks */}
                  {powerNaps.map((nap, i) => (
                    <div key={i} className="bg-cyan/10 border border-cyan/30 rounded-xl p-4 flex items-center gap-4">
                      <div className="text-cyan font-display font-bold text-sm w-16 flex-shrink-0">{nap.time}</div>
                      <div className="flex-1">
                        <p className="text-cyan font-display font-bold text-sm">{nap.label.includes('Solitude') ? t('features.solitudeBlock') : nap.label}</p>
                        <p className="text-cyan/60 text-xs">{t('schedule.nsdrDesc')}</p>
                      </div>
                      <div className="px-2 py-1 bg-cyan/20 border border-cyan/30 rounded-lg text-[10px] text-cyan font-display">{t('schedule.restLabel')}</div>
                    </div>
                  ))}

                  {schedule.map(task => (
                    <div
                      key={task.id}
                      className={`bg-panel border rounded-xl p-4 flex items-center gap-4 transition-all ${task.overloaded ? 'border-ember/30 bg-ember/5' : 'border-border hover:border-accent/30'
                        }`}
                    >
                      <div className={`font-display font-bold text-sm w-16 flex-shrink-0 ${task.overloaded ? 'text-ember' : 'text-accent'}`}>
                        {task.time}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm text-text">{task.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-subtle font-display">{task.circadianLabel || 'Standard Slot'}</span>
                          <span className="text-[10px] text-muted font-display">·</span>
                          <span className="text-[10px] text-muted font-display flex items-center gap-1"><Clock size={8} />{task.duration}m</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`px-2 py-1 rounded-lg text-[10px] font-display border ${task.priority === 'high' ? 'text-ember border-ember/30 bg-ember/10' :
                          task.priority === 'medium' ? 'text-cyan border-cyan/30 bg-cyan/10' :
                            'text-muted border-muted/30 bg-muted/10'
                          }`}>
                          {task.priority}
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-[10px] font-display border ${task.overloaded ? 'text-ember border-ember/30' : 'text-accent border-accent/30'
                          }`}>
                          {task.meuCost} MEU
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* MEU summary */}
              {schedule.length > 0 && (
                <div className="bg-panel border border-border rounded-xl p-4 flex items-center justify-between">
                  <span className="text-subtle font-display text-sm">{t('schedule.totalMeu')}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 bg-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${totalMEU > 80 ? 'bg-ember' : 'bg-accent'}`} style={{ width: `${Math.min(100, totalMEU)}%` }} />
                    </div>
                    <span className={`font-display font-bold ${totalMEU > 80 ? 'text-ember' : 'text-mint'}`}>{totalMEU}/{DAILY_MEU_CAPACITY}</span>
                  </div>
                </div>
              )}

              {/* Deep Work Player */}
              <div className="bg-panel border border-border rounded-xl p-5 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display text-sm text-subtle uppercase tracking-widest">{t('features.deepWork')}</h3>
                    <p className="text-xs text-muted mt-1">
                      {circadian.phase === 'Peak' ? t('features.highCortisol') : t('features.lowCortisol')}
                    </p>
                  </div>
                  <div className="text-accent flex items-center gap-1.5"><Brain size={14}/> {t('features.autoTuned')}</div>
                </div>
                <iframe
                  title="Deep Work Player"
                  width="100%"
                  height="80"
                  src={`https://www.youtube.com/embed/${circadian.phase === 'Peak' ? 'jfKfPfyJRdk' : 'lTRiuFIWV54'}?autoplay=0&loop=1`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  className="rounded-xl border border-border/50"
                />
              </div>
            </motion.div>
          )}

          {/* ── COACH TAB ─────────────────────── */}
          {activeTab === 'coach' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }} 
              animate={{ opacity: 1, scale: 1 }} 
              transition={{ duration: 0.3 }}
              className="h-[calc(100vh-160px)]"
            >
              <Chatbot fatigueData={fatigueData} schedule={schedule} />
            </motion.div>
          )}

          {/* ── ANALYTICS TAB ─────────────────── */}
          {activeTab === 'analytics' && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <h2 className="font-display text-xl font-bold">{t('nav.analytics')}</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-panel border border-border rounded-2xl p-6">
                  <h3 className="font-display text-sm text-subtle uppercase tracking-widest mb-4">{t('analytics.prodCurve')}</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00e5a0" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#00e5a0" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="hour" tick={{ fill: '#4a4a6a', fontSize: 9 }} interval={3} />
                        <YAxis tick={{ fill: '#4a4a6a', fontSize: 9 }} />
                        <Tooltip contentStyle={{ background: '#16161f', border: '1px solid #2a2a3d', borderRadius: '12px' }} labelStyle={{ color: '#8888aa' }} />
                        <Area type="monotone" dataKey="productivity" stroke="#00e5a0" strokeWidth={2} fill="url(#prodGrad)" dot={false} />
                        <Line type="monotone" dataKey="fatigue" stroke="#ff6b35" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-panel border border-border rounded-2xl p-6">
                  <h3 className="font-display text-sm text-subtle uppercase tracking-widest mb-4">{t('analytics.cortisolCurve')}</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="cortGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6c63ff" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#6c63ff" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="hour" tick={{ fill: '#4a4a6a', fontSize: 9 }} interval={3} />
                        <YAxis tick={{ fill: '#4a4a6a', fontSize: 9 }} />
                        <Tooltip contentStyle={{ background: '#16161f', border: '1px solid #2a2a3d', borderRadius: '12px' }} labelStyle={{ color: '#8888aa' }} />
                        <Area type="monotone" dataKey="cortisol" stroke="#6c63ff" strokeWidth={2} fill="url(#cortGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-muted font-display mt-2 text-center">{t('analytics.cortisolTip')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="bg-panel border border-border rounded-2xl p-6">
                  <h3 className="font-display text-sm text-subtle uppercase tracking-widest mb-4">{t('analytics.energyCurve')}</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ffb347" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#ffb347" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#cf1f5b" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#cf1f5b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="hour" tick={{ fill: '#4a4a6a', fontSize: 9 }} interval={3} />
                        <YAxis tick={{ fill: '#4a4a6a', fontSize: 9 }} />
                        <Tooltip contentStyle={{ background: '#16161f', border: '1px solid #2a2a3d', borderRadius: '12px' }} labelStyle={{ color: '#8888aa' }} />
                        <Area type="monotone" dataKey="fatigue" name="Task Load" stroke="#cf1f5b" strokeWidth={2} fill="url(#loadGrad)" dot={false} />
                        <Line type="monotone" dataKey="productivity" name="Energy" stroke="#ffb347" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-muted font-display mt-2 text-center">{t('analytics.energyTip')}</p>
                </div>

                <StressHeatmap />
              </div>
            </motion.div>
          )}

          {/* ── PROFILE TAB ───────────────────── */}
          {activeTab === 'profile' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.5 }}
              className="space-y-6 max-w-2xl mx-auto mt-8"
            >
              <div className="flex items-center gap-5 mb-8">
                <div className="w-20 h-20 rounded-2xl bg-accent/20 flex items-center justify-center border border-accent/30 text-accent font-display font-bold text-3xl shadow-lg shadow-accent/10">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold">{user.name}</h2>
                  <p className="text-subtle text-sm">{t('profile.studentDesc')}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-mint" />
                    <span className="text-[11px] text-mint font-display">{t('profile.neuroActive')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-panel border border-border rounded-2xl p-6 space-y-5">
                {[
                  { label: t('profile.username'), value: `@${user.username}`, color: 'bg-mint' },
                  { label: t('profile.fullName'), value: user.name, color: 'bg-cyan' },
                  { label: t('profile.age'), value: `${user.age} ${t('profile.yearsOld')}`, color: 'bg-accent' },
                  { label: t('profile.userId'), value: `#${user.id}`, color: 'bg-ember' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center border-b border-white/5 pb-5 last:pb-0 last:border-0">
                    <span className="text-subtle font-display text-sm flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} /> {item.label}
                    </span>
                    <span className="font-bold text-text">{item.value}</span>
                  </div>
                ))}
              </div>

              {prediction && (
                <div className="bg-panel border border-border rounded-2xl p-6">
                  <h3 className="font-display text-sm text-subtle uppercase tracking-widest mb-4">{t('profile.snapshot')}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: t('dashboard.productivity'), value: `${prediction.productivity}%`, color: '#00e5a0' },
                      { label: t('dashboard.fatigue'), value: `${prediction.fatigueIndex}%`, color: '#ff6b35' },
                      { label: t('dashboard.burnoutRisk'), value: `${prediction.burnoutRisk}%`, color: '#6c63ff' },
                    ].map(item => (
                      <div key={item.label} className="text-center bg-void border border-border rounded-xl p-4">
                        <p style={{ color: item.color }} className="text-2xl font-display font-bold">{item.value}</p>
                        <p className="text-muted text-xs font-display mt-1">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setUser(null)}
                className="w-full py-3 border border-border text-subtle rounded-xl font-display text-sm hover:border-ember/40 hover:text-ember transition-all"
              >
                {t('profile.signOut')}
              </button>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  )
}
