import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Bot, User, Loader, Brain } from 'lucide-react'
import axios from 'axios'

export default function Chatbot({ fatigueData, schedule = [] }) {
  const { t, i18n } = useTranslation()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: t('coach.welcome'), stateData: null }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const baseURL = import.meta.env.VITE_API_URL || ''
      const res = await axios.post(`${baseURL}/api/coach`, {
        message: input,
        fatigueData,
        lang: i18n.language,
        history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        schedule: schedule.slice(0, 8),
      })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.message,
        stateData: res.data.stateData
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Please check your API key in server/.env',
        stateData: null
      }])
    }
    setLoading(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-full bg-panel border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-border bg-surface">
        <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center">
          <Brain size={18} className="text-accent" />
        </div>
        <div>
          <h3 className="font-display text-sm font-bold text-text">{t('coach.title')}</h3>
          <p className="text-[11px] text-subtle">{t('coach.subtitle')}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-mint animate-pulse-slow" />
          <span className="text-[10px] text-mint font-display">ONLINE</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-accent/20 border border-accent/30' : 'bg-surface border border-border'
              }`}>
              {msg.role === 'assistant' ? <Bot size={15} className="text-accent" /> : <User size={15} className="text-subtle" />}
            </div>
            <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed font-body ${msg.role === 'assistant'
                ? 'bg-surface border border-border text-text rounded-tl-none'
                : 'bg-accent text-white rounded-tr-none'
                }`}>
                {msg.content}
              </div>
              {msg.stateData && (
                <div className="bg-void border border-border rounded-xl p-3 text-[11px] font-display space-y-1 w-full">
                  <div className="text-subtle uppercase tracking-widest mb-2">{t('coach.stateAnalysis')}</div>
                  {Object.entries(msg.stateData).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-muted capitalize">{k.replace('_', ' ')}</span>
                      <span className="text-cyan">{typeof v === 'number' ? v + '/10' : v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
              <Bot size={15} className="text-accent" />
            </div>
            <div className="bg-surface border border-border rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
              <Loader size={13} className="text-accent animate-spin" />
              <span className="text-subtle text-xs font-display">{t('coach.thinking')}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('coach.placeholder')}
            rows={2}
            className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text placeholder-muted resize-none focus:outline-none focus:border-accent/60 font-body transition-colors"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-11 h-11 self-end rounded-xl bg-accent hover:bg-accent/80 disabled:bg-surface disabled:border disabled:border-border flex items-center justify-center transition-all duration-200 hover:shadow-lg hover:shadow-accent/30"
          >
            <Send size={16} className={input.trim() && !loading ? 'text-white' : 'text-muted'} />
          </button>
        </div>
      </div>
    </div>
  )
}
