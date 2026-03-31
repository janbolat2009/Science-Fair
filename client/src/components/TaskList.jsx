import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Check, Trash2, Clock } from 'lucide-react'
import { rankTasksByCircadian } from '../hooks/usePrediction'

const priorityColors = {
  high: 'text-ember border-ember/30 bg-ember/10',
  medium: 'text-cyan border-cyan/30 bg-cyan/10',
  low: 'text-muted border-muted/30 bg-muted/10',
}

export default function TaskList({ tasks, setTasks, sleepHours = 8, isTired = false }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [priority, setPriority] = useState('medium')
  const [duration, setDuration] = useState(30)
  const [showForm, setShowForm] = useState(false)

  const addTask = () => {
    if (!name.trim()) return
    setTasks(prev => [...prev, {
      id: Date.now(),
      name,
      priority,
      duration,
      completed: false,
      createdAt: new Date().toISOString(),
    }])
    setName('')
    setShowForm(false)
  }

  const toggle = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  const remove = (id) => setTasks(prev => prev.filter(t => t.id !== id))

  const ranked = rankTasksByCircadian(tasks, new Date().getHours(), sleepHours, isTired)

  return (
    <div className="bg-panel border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-subtle uppercase tracking-widest">{t('dashboard.tasks')}</h3>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 border border-accent/30 text-accent rounded-lg text-xs font-display hover:bg-accent/30 transition-all"
        >
          <Plus size={13} />
          {t('dashboard.addTask')}
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('dashboard.taskPlaceholder')}
            className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent/60 font-body"
          />
          <div className="flex gap-3">
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="flex-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/60 font-body"
            >
              <option value="high">{t('dashboard.high')}</option>
              <option value="medium">{t('dashboard.medium')}</option>
              <option value="low">{t('dashboard.low')}</option>
            </select>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              placeholder={t('dashboard.duration')}
              className="w-24 bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/60 font-body"
            />
          </div>
          <button
            onClick={addTask}
            className="w-full py-2 bg-accent text-white rounded-lg text-sm font-display font-bold hover:bg-accent/80 transition-all shadow-lg shadow-accent/20"
          >
            {t('dashboard.add')}
          </button>
        </div>
      )}

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {ranked.length === 0 && (
          <p className="text-center text-muted text-xs font-display py-6">No tasks yet</p>
        )}
        {ranked.map(task => (
          <div
            key={task.id}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${task.completed ? 'opacity-40 bg-surface border-border' : 'bg-surface border-border hover:border-accent/30'
              }`}
          >
            <button
              onClick={() => toggle(task.id)}
              className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all flex-shrink-0 ${task.completed ? 'bg-mint border-mint' : 'border-border hover:border-mint'
                }`}
            >
              {task.completed && <Check size={12} className="text-obsidian" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-body ${task.completed ? 'line-through text-muted' : 'text-text'}`}>
                {task.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-display border ${priorityColors[task.priority]}`}>
                  {t(`dashboard.${task.priority}`)}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-muted">
                  <Clock size={9} />
                  {task.duration}m
                </span>
                <span className="text-[10px] text-accent font-display">
                  {task.meuCost} MEU{isTired ? ' ×2' : ''}
                </span>
              </div>
            </div>
            <button onClick={() => remove(task.id)} className="text-muted hover:text-ember transition-colors p-1">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
