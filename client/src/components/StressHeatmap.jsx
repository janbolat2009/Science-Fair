import { useTranslation } from 'react-i18next'

const hours = Array.from({ length: 16 }, (_, i) => i + 6)

function getColor(value) {
  if (value === 0) return 'bg-surface border-border'
  if (value < 30) return 'bg-mint/20 border-mint/40'
  if (value < 50) return 'bg-cyan/20 border-cyan/40'
  if (value < 70) return 'bg-accent/30 border-accent/50'
  if (value < 85) return 'bg-ember/30 border-ember/50'
  return 'bg-red-500/40 border-red-500/60'
}

export default function StressHeatmap({ weekData }) {
  const { t } = useTranslation()
  const days = [
    t('dashboard.mon'), t('dashboard.tue'), t('dashboard.wed'),
    t('dashboard.thu'), t('dashboard.fri'), t('dashboard.sat'), t('dashboard.sun')
  ]

  // Procrastination is higher during circadian dips (e.g. 14-16 post-lunch dip, or very early/late)
  const getSimulatedProcrastination = (hour) => {
    let base = Math.random() * 40;
    if (hour >= 13 && hour <= 15) base += 40; // Post-lunch dip
    if (hour >= 20) base += 50; // Late evening fatigue
    if (hour < 8) base += 30; // Sleep inertia
    return Math.min(Math.round(base), 95);
  }

  return (
    <div className="bg-panel border border-border rounded-2xl p-6">
      <h3 className="font-display text-sm text-subtle uppercase tracking-widest mb-4">
        {t('features.procrastination')}
      </h3>
      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div className="flex gap-1 mb-2 ml-10">
            {hours.map(h => (
              <div key={h} className="w-7 text-center text-[10px] text-muted font-display">
                {h}h
              </div>
            ))}
          </div>
          {days.map((day, di) => (
            <div key={day} className="flex items-center gap-1 mb-1">
              <div className="w-8 text-[11px] text-subtle font-display text-right pr-2">{day}</div>
              {hours.map((h, hi) => {
                const val = weekData?.[di]?.[hi] ?? getSimulatedProcrastination(h)
                return (
                  <div
                    key={h}
                    title={`${t('analytics.delayProb')}: ${val}%`}
                    className={`w-7 h-5 rounded-sm border transition-all duration-200 hover:scale-110 cursor-default ${getColor(val)}`}
                  />
                )
              })}
            </div>
          ))}
          <div className="flex items-center gap-3 mt-3 ml-10">
            <span className="text-[10px] text-muted font-display">{t('analytics.low')}</span>
            <div className="flex gap-1">
              {['bg-mint/20', 'bg-cyan/20', 'bg-accent/30', 'bg-ember/30', 'bg-red-500/40'].map((c, i) => (
                <div key={i} className={`w-5 h-3 rounded-sm ${c}`} />
              ))}
            </div>
            <span className="text-[10px] text-muted font-display">{t('analytics.high')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
