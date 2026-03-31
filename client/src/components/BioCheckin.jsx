import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, Coffee, Moon, Sun } from 'lucide-react'

export default function BioCheckin({ onComplete }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    feeling: 5,
    sleepQuality: 5,
    mood: 'Neutral'
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onComplete(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-sm">
      <div className="bg-panel border border-border rounded-2xl p-8 w-[400px] max-w-full shadow-2xl relative animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-mint/20 text-mint flex items-center justify-center border border-mint/30 shadow-lg shadow-mint/20">
            <Sun size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display">{t('checkin.title')}</h2>
            <p className="text-xs text-subtle font-display">{t('checkin.subtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-display text-subtle mb-2">
              <Activity size={14} className="text-accent"/>
              {t('checkin.feeling')} ({form.feeling}/10)
            </label>
            <input 
              type="range" min="1" max="10" step="1" 
              value={form.feeling} 
              onChange={e => setForm({...form, feeling: Number(e.target.value)})}
              className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-display text-subtle mb-2">
              <Moon size={14} className="text-cyan"/>
              {t('checkin.sleepQuality')} ({form.sleepQuality}/10)
            </label>
            <input 
              type="range" min="1" max="10" step="1" 
              value={form.sleepQuality} 
              onChange={e => setForm({...form, sleepQuality: Number(e.target.value)})}
              className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-cyan"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-display text-subtle mb-2">
              <Coffee size={14} className="text-mint"/>
              {t('checkin.mood')}
            </label>
            <select 
              className="w-full bg-void border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-mint transition-colors text-text"
              value={form.mood}
              onChange={e => setForm({...form, mood: e.target.value})}
            >
              <option value="Energetic">{t('checkin.moodOptions.energetic')}</option>
              <option value="Neutral">{t('checkin.moodOptions.neutral')}</option>
              <option value="Groggys">{t('checkin.moodOptions.groggy')}</option>
              <option value="Stressed">{t('checkin.moodOptions.stressed')}</option>
            </select>
          </div>

          <button
            className="w-full py-3 bg-mint text-obsidian rounded-xl font-bold font-display hover:bg-mint/80 transition-all shadow-lg shadow-mint/20 mt-2"
            type="submit"
          >
            {t('checkin.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
