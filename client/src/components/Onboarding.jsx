import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, Sun, Moon, CloudSun, Target, Activity } from 'lucide-react'

export default function Onboarding({ onComplete }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    sleepDur: 7,
    peakProd: 'morning',
    stress: 5,
    goals: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    let chronotype = 'lark'
    if (form.peakProd === 'evening') chronotype = 'owl'
    if (form.peakProd === 'afternoon') chronotype = 'third_bird'
    
    // Output bio-profile
    onComplete({ ...form, chronotype })
  }

  return (
    <div className="min-h-screen bg-obsidian text-text font-body flex items-center justify-center relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-accent/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan/8 rounded-full blur-3xl pointer-events-none" />
      
      <div className="bg-panel border border-border rounded-2xl p-8 w-[500px] max-w-full shadow-2xl relative z-10">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-lg shadow-accent/40">
            <Brain size={22} className="text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-1 font-display text-center">{t('onboarding.title')}</h2>
        <p className="text-subtle text-center text-sm mb-8 font-display">{t('onboarding.subtitle')}</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-display text-subtle mb-2">{t('onboarding.sleepDur')} ({form.sleepDur}h)</label>
            <input 
              type="range" min="3" max="12" step="0.5" 
              value={form.sleepDur} 
              onChange={e => setForm({...form, sleepDur: e.target.value})}
              className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-display text-subtle mb-2">{t('onboarding.peakProd')}</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'morning', icon: Sun, label: t('onboarding.peakOptions.morning') },
                { id: 'afternoon', icon: CloudSun, label: t('onboarding.peakOptions.afternoon') },
                { id: 'evening', icon: Moon, label: t('onboarding.peakOptions.evening') },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setForm({...form, peakProd: opt.id})}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${form.peakProd === opt.id ? 'border-accent bg-accent/10 text-accent' : 'border-border text-subtle hover:border-accent/40'}`}
                >
                  <opt.icon size={20} />
                  <span className="text-[10px] text-center font-display font-bold leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-display text-subtle mb-2">
              <Activity size={14} className="text-ember"/>
              {t('onboarding.stress')} ({form.stress}/10)
            </label>
            <input 
              type="range" min="1" max="10" step="1" 
              value={form.stress} 
              onChange={e => setForm({...form, stress: e.target.value})}
              className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-ember"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-display text-subtle mb-2">
              <Target size={14} className="text-cyan"/>
              {t('onboarding.goals')}
            </label>
            <textarea 
              rows="2"
              required
              className="w-full bg-void border border-border rounded-xl p-3 text-sm outline-none focus:border-accent transition-colors placeholder-muted resize-none"
              placeholder={t('onboarding.placeholder')}
              value={form.goals}
              onChange={e => setForm({...form, goals: e.target.value})}
            />
          </div>

          <button
            className="w-full py-3 bg-accent text-white rounded-xl font-bold font-display hover:bg-accent/80 transition-all shadow-lg shadow-accent/20 mt-4"
            type="submit"
          >
            {t('onboarding.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
