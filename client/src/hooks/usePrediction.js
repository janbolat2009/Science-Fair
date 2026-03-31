/**
 * CogniFlow Scientific Algorithm Engine
 * Based on: P_efficiency = f(Sleep, Cortisol, TaskWeight)
 *
 * Formula:
 *   Let:
 *     S = normalized sleep score (0-1): min(sleepHours / 9, 1)
 *     E = normalized energy (0-1): energyLevel / 10
 *     L = cognitive load (0-1): studyLoad / 10
 *     B = break penalty = min(hoursSinceBreak / 4, 1) × 0.15
 *     C = circadian multiplier [0.5, 1.0] based on time of day
 *
 *   P_raw = W1 × S + W2 × E - W3 × L - B
 *   P_efficiency = clamp(P_raw × 100 × C + 30, 0, 100)
 *   FatigueIndex = 100 - P_efficiency
 *   BurnoutRisk = f(low sleep, high load, low breaks, trend over time)
 *
 * MEU (Mental Energy Units):
 *   Daily capacity: 100 MEU
 *   High task = 30 MEU, Medium = 20 MEU, Low = 10 MEU
 *   When "I'm tired" triggered: MEU cost of remaining tasks doubles.
 *
 * Circadian Scheduling:
 *   Cortisol Peak (8-11 AM): place HIGH intensity tasks
 *   < 6h sleep: shift peak window to 10-12 AM, add Power Nap block at 13:00
 */

export const W1 = 0.42  // Sleep weight (most critical factor)
export const W2 = 0.31  // Energy weight
export const W3 = 0.27  // Cognitive load weight

export const MEU_WEIGHTS = { high: 5, medium: 3, low: 1 }
export const MEU_SCALAR = 5
export const DAILY_MEU_CAPACITY = 100

/**
 * Core fatigue prediction function
 * Simulates ML regression model trained on Kaggle student performance datasets
 */
export function predictFatigue({ sleepHours, studyLoad, hoursSinceBreak, energyLevel }) {
  const S = Math.min(sleepHours / 9, 1)
  const E = energyLevel / 10
  const L = studyLoad / 10
  const B = Math.min(hoursSinceBreak / 4, 1) * 0.15

  const currentHour = new Date().getHours()
  const circadianMultiplier = getCircadianMultiplier(currentHour)

  const P_raw = W1 * S + W2 * E - W3 * L - B
  const productivity = Math.max(0, Math.min(100, P_raw * 100 * circadianMultiplier + 30))
  const fatigueIndex = Math.max(0, Math.min(100, 100 - productivity))

  // Burnout Risk: non-linear combination of sleep deficit + high load + no breaks
  const sleepDeficit = Math.max(0, (8 - sleepHours) / 8)
  const loadOverload = Math.max(0, (studyLoad - 5) / 5)
  const breakDeficit = Math.min(hoursSinceBreak / 6, 1)
  const burnoutRisk = Math.round(
    Math.min(100, (sleepDeficit * 40 + loadOverload * 35 + breakDeficit * 25))
  )

  return {
    productivity: Math.round(productivity),
    fatigueIndex: Math.round(fatigueIndex),
    burnoutRisk,
    circadianMultiplier: Math.round(circadianMultiplier * 100),
    recommendation: getRecommendation(fatigueIndex, sleepHours, hoursSinceBreak, burnoutRisk),
    alerts: getAlerts(sleepHours, studyLoad, hoursSinceBreak, burnoutRisk),
  }
}

function getCircadianMultiplier(hour) {
  // Cortisol curve approximation based on chronobiology research
  if (hour >= 8 && hour <= 11) return 1.0   // Cortisol Peak — optimal for deep work
  if (hour >= 13 && hour <= 15) return 0.85  // Secondary peak post-lunch recovery
  if (hour >= 16 && hour <= 18) return 0.7   // Late afternoon lift
  if (hour >= 6 && hour < 8) return 0.6      // Rising phase
  if (hour >= 12 && hour < 13) return 0.55   // Post-lunch dip
  return 0.5                                  // Night/early morning — rest phase
}

function getRecommendation(fatigue, sleep, breakHours, burnout) {
  if (burnout > 70) return 'critical'
  if (fatigue > 75) return 'critical'
  if (fatigue > 55 || burnout > 50) return 'moderate'
  if (fatigue > 35) return 'good'
  return 'excellent'
}

function getAlerts(sleep, load, breakHours, burnout) {
  const alerts = []
  if (sleep < 6) alerts.push({ type: 'sleep', severity: 'critical' })
  if (burnout > 70) alerts.push({ type: 'burnout', severity: 'critical' })
  if (breakHours > 3) alerts.push({ type: 'break', severity: 'warn' })
  if (load >= 8) alerts.push({ type: 'overload', severity: 'warn' })
  return alerts
}

/**
 * Dynamic Circadian Rescheduler
 * Assigns optimal start time and slot to each task based on:
 *   - Cortisol curve
 *   - Sleep hours (if < 6: shift peak window to 10:00-12:00)
 *   - Task priority and MEU cost
 *   - Remaining MEU capacity
 */
export function rescheduleByCircadian(tasks, sleepHours, isTired = false) {
  const lowSleep = sleepHours < 6

  // Build time slots (each slot = 30 min from 6:00 to 22:00)
  const slots = []
  for (let h = 6; h < 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const score = getSlotScore(h, lowSleep)
      slots.push({ time: label, hour: h, min: m, score, blocked: false })
    }
  }

  // If low sleep: insert Power Nap block at 13:00 (30 min)
  const powerNapBlocks = []
  if (lowSleep) {
    powerNapBlocks.push({ time: '13:00', label: '💤 Power Nap / NSDR', type: 'rest' })
    // Block 13:00-13:30 slot
    const nap = slots.find(s => s.hour === 13 && s.min === 0)
    if (nap) nap.blocked = true
  }

  // Sort tasks by priority then by MEU
  const priorityOrder = { high: 3, medium: 2, low: 1 }
  const sorted = [...tasks].sort((a, b) => (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1))

  let scheduledTasks = []
  let usedMEU = 0
  let slotIdx = 0

  for (const task of sorted) {
    const baseMEU = (MEU_WEIGHTS[task.priority] || 3) * MEU_SCALAR
    const meuCost = isTired ? baseMEU * 2 : baseMEU

    if (usedMEU + meuCost > DAILY_MEU_CAPACITY) {
      scheduledTasks.push({ ...task, time: 'Tomorrow', meuCost, rescheduled: true, overloaded: true })
      continue
    }

    // Advance slotIdx past blocked slots
    while (slotIdx < slots.length && slots[slotIdx].blocked) slotIdx++

    const slot = slots[slotIdx] || slots[slots.length - 1]
    const durationSlots = Math.ceil((task.duration || 30) / 30)

    // Block used slots
    for (let i = slotIdx; i < Math.min(slotIdx + durationSlots, slots.length); i++) {
      slots[i].blocked = true
    }
    slotIdx += durationSlots

    usedMEU += meuCost
    scheduledTasks.push({
      ...task,
      time: slot.time,
      slotScore: slot.score,
      meuCost,
      rescheduled: false,
      overloaded: false,
      circadianLabel: getCircadianLabel(slot.hour, lowSleep),
    })
  }

  return { scheduledTasks, powerNapBlocks, totalMEU: usedMEU, lowSleep }
}

function getSlotScore(hour, lowSleep) {
  if (lowSleep) {
    // Shift peak to 10-12 when sleep-deprived
    if (hour >= 10 && hour <= 12) return 1.0
    if (hour >= 14 && hour <= 16) return 0.75
    return 0.5
  }
  if (hour >= 8 && hour <= 11) return 1.0
  if (hour >= 13 && hour <= 15) return 0.85
  if (hour >= 16 && hour <= 18) return 0.7
  return 0.5
}

function getCircadianLabel(hour, lowSleep) {
  if (lowSleep) {
    if (hour >= 10 && hour <= 12) return 'Shifted Peak'
    if (hour >= 14 && hour <= 16) return 'Recovery Window'
    return 'Low Energy Zone'
  }
  if (hour >= 8 && hour <= 11) return 'Cortisol Peak'
  if (hour >= 13 && hour <= 15) return 'Secondary Peak'
  if (hour >= 16 && hour <= 18) return 'Afternoon Lift'
  return 'Rest Zone'
}

/**
 * Rank tasks for the simple list view (no full reschedule)
 */
export function rankTasksByCircadian(tasks, currentHour, sleepHours = 8, isTired = false) {
  const lowSleep = sleepHours < 6
  const peakScore = getSlotScore(currentHour, lowSleep)
  const priorityWeights = { high: 3, medium: 2, low: 1 }

  return [...tasks]
    .map(task => {
      const meuCost = isTired
        ? ((MEU_WEIGHTS[task.priority] || 3) * MEU_SCALAR) * 2
        : ((MEU_WEIGHTS[task.priority] || 3) * MEU_SCALAR)
      return {
        ...task,
        adaptiveScore: (priorityWeights[task.priority] || 1) * peakScore * (task.completed ? 0 : 1),
        meuCost,
      }
    })
    .sort((a, b) => b.adaptiveScore - a.adaptiveScore)
}

export function getCircadianPhase(hour) {
  if (hour >= 6 && hour < 8) return { phase: 'rising', color: '#ff6b35', icon: '🌅' }
  if (hour >= 8 && hour < 12) return { phase: 'peak', color: '#00e5a0', icon: '⚡' }
  if (hour >= 12 && hour < 14) return { phase: 'dip', color: '#6c63ff', icon: '🌀' }
  if (hour >= 14 && hour < 17) return { phase: 'recovery', color: '#00d4ff', icon: '🔄' }
  if (hour >= 17 && hour < 20) return { phase: 'evening', color: '#ff6b35', icon: '🌇' }
  return { phase: 'rest', color: '#4a4a6a', icon: '🌙' }
}
