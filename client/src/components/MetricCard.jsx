export default function MetricCard({ label, value, unit, color, icon: Icon, trend }) {
  const colorMap = {
    accent: 'border-accent/30 shadow-accent/10',
    cyan: 'border-cyan/30 shadow-cyan/10',
    ember: 'border-ember/30 shadow-ember/10',
    mint: 'border-mint/30 shadow-mint/10',
  }

  const textColorMap = {
    accent: 'text-accent',
    cyan: 'text-cyan',
    ember: 'text-ember',
    mint: 'text-mint',
  }

  return (
    <div className={`bg-panel border rounded-2xl p-5 shadow-lg ${colorMap[color] || colorMap.accent}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] text-subtle uppercase tracking-widest font-display">{label}</p>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center`}>
            <Icon size={15} className={textColorMap[color]} />
          </div>
        )}
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-3xl font-display font-bold ${textColorMap[color]}`}>{value}</span>
        {unit && <span className="text-subtle text-sm mb-1 font-body">{unit}</span>}
      </div>
      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          <div className="h-1 flex-1 bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700`}
              style={{ width: `${Math.min(trend, 100)}%`, backgroundColor: `var(--color-${color}, #6c63ff)` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
