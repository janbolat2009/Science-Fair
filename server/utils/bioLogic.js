// bioLogic.js - The Circadian Engine
// This module contains the scientific logic for the "Bio-Adaptive Academic Planner".

// ─── Constants & Weights ──────────────────────────────────────────────────────
const W1 = 0.42, W2 = 0.31, W3 = 0.27
// Task MEU Weights (1-5 scale) scaled by a factor to fit the 100 Daily Limit realistically
const MEU_WEIGHTS = { high: 5, medium: 3, low: 1 } 
const MEU_SCALAR = 5 // Base multiplier to scale 1-5 weights into the 100 MEU economy
const DAILY_MEU = 100 // Maximum Mental Energy Units per day

/**
 * Returns a circadian multiplier based on the current hour.
 * Models natural cortisol peaks and troughs based on Chronotype.
 */
export function getCircadianMultiplier(hour, chronotype = 'lark') {
  let shift = 0
  if (chronotype === 'owl') shift = 3 // Shift 3 hours late
  if (chronotype === 'third_bird') shift = 1 // Shift 1 hour late
  
  const adjHour = hour - shift

  if (adjHour >= 8 && adjHour <= 11) return 1.0 // Primary Cortisol Peak
  if (adjHour >= 13 && adjHour <= 15) return 0.85 // Secondary Peak
  if (adjHour >= 16 && adjHour <= 18) return 0.7  // Evening Decline
  if (adjHour >= 6 && adjHour < 8) return 0.6   // Waking phase / Sleep inertia
  if (adjHour >= 12 && adjHour < 13) return 0.55 // Post-lunch dip
  return 0.5 // Nighttime low
}


/**
 * Simulates a Linear Regression model to predict Burnout Risk %.
 * Based on basic psychophysiological markers: sleep, load, breaks, energy.
 */
export function predictFatigue({ sleepHours, studyLoad, hoursSinceBreak, energyLevel, currentHour, chronotype = 'lark' }) {
  // Normalize variables (0 to 1 scales)
  const S = Math.min(sleepHours / 9, 1)
  const E = energyLevel / 10
  const L = studyLoad / 10
  const B = Math.min(hoursSinceBreak / 4, 1) * 0.15
  const C = getCircadianMultiplier(currentHour, chronotype)

  // Linear Regression simulation for base raw score
  const rawScore = W1 * S + W2 * E - W3 * L - B
  
  // Calculate productivity mapped to 0-100% and adjusted by circadian rhythm
  const productivity = Math.max(0, Math.min(100, rawScore * 100 * C + 30))
  const fatigueIndex = Math.max(0, Math.min(100, 100 - productivity))

  // Burnout risk calculation based on sustained deficits
  const sleepDeficit = Math.max(0, (8 - sleepHours) / 8)
  const loadOverload = Math.max(0, (studyLoad - 5) / 5)
  const breakDeficit = Math.min(hoursSinceBreak / 6, 1)
  const burnoutRisk = Math.round(Math.min(100, sleepDeficit * 40 + loadOverload * 35 + breakDeficit * 25))

  return {
    productivity: Math.round(productivity),
    fatigueIndex: Math.round(fatigueIndex),
    burnoutRisk,
    formula: `P = ${W1}×${S.toFixed(2)} + ${W2}×${E.toFixed(2)} − ${W3}×${L.toFixed(2)}`,
    circadianMultiplier: Math.round(C * 100)
  }
}

/**
 * Generates an adaptive schedule based on cortisol levels and sleep deprivation.
 */
export function generateAdaptiveSchedule({ tasks = [], sleepHours = 8, isTired = false, chronotype = 'lark', currentFatigue = 0 }) {
  // Flag for sleep deprivation (affects cognitive capacity and shifts cortisol peaks)
  const lowSleep = sleepHours < 6
  // Trigger recovery mode if sleep < 6 or fatigue > 70
  const needRecovery = lowSleep || currentFatigue > 70

  let shift = 0
  if (chronotype === 'owl') shift = 3
  if (chronotype === 'third_bird') shift = 1

  // Helper to determine the cognitive efficiency of a specific time slot
  const getSlotScore = (hour) => {
    const adjHour = hour - shift
    if (needRecovery) {
      // If low sleep/high fatigue, morning peak is delayed, afternoon dip is more severe
      if (adjHour >= 10 && adjHour <= 12) return 1.0
      if (adjHour >= 14 && adjHour <= 16) return 0.75
      return 0.5
    }
    // Normal sleep pattern
    if (adjHour >= 8 && adjHour <= 11) return 1.0 // Standard morning peak
    if (adjHour >= 13 && adjHour <= 15) return 0.85
    if (adjHour >= 16 && adjHour <= 18) return 0.7
    return 0.5
  }

  // Generate 30-min slots from 06:00 to 22:00
  const slots = []
  for (let h = 6; h < 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push({
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        hour: h, score: getSlotScore(h), blocked: false
      })
    }
  }

  // Adjusting for sleep inertia and recovery
  const powerNapBlocks = []
  if (needRecovery) {
    // Concept: "Power Nap" smart-block. If fatigue is high, insert a 20-min rest window at 15:30.
    powerNapBlocks.push({ time: '15:30', label: 'Power Nap / NSDR (30 min)', type: 'rest' })
    const nap = slots.find(s => s.time === '15:30')
    if (nap) nap.blocked = true // Block this time from tasks

    // Add 15-min "Sleep Inertia" buffers by penalizing early morning slots 
    const morningSlots = slots.filter(s => s.hour >= 6 && s.hour < 8 + shift)
    morningSlots.forEach(s => s.score *= 0.5) // Less likely to put high intensity here
  }

  // Social Battery Tracker
  const socialKeywords = ['meeting', 'group', 'call', 'party', 'interview', 'presentation']
  const socialTasks = tasks.filter(t => socialKeywords.some(kw => t.name.toLowerCase().includes(kw)))
  if (socialTasks.length > 1) {
    powerNapBlocks.push({ time: '16:00', label: 'Solitude Block (Recharge)', type: 'rest' })
    const sol = slots.find(s => s.time === '16:00' && !s.blocked)
    if (sol) sol.blocked = true
  }

  // Sort tasks by priority (Highest priority High MEU first)
  const pOrder = { high: 3, medium: 2, low: 1 }
  const sorted = [...tasks].sort((a, b) => (pOrder[b.priority] || 1) - (pOrder[a.priority] || 1))

  let scheduled = []
  let usedMEU = 0
  let si = 0 // slot index

  // Greedy scheduling algorithm mapping to highest available mental capacity
  for (const task of sorted) {
    const baseWeight = MEU_WEIGHTS[task.priority] || 3
    const baseMEU = baseWeight * MEU_SCALAR // converting 1-5 weight to scaled points
    const meuCost = isTired ? baseMEU * 2 : baseMEU // Taxes are doubled if tired

    // Find next available slot
    while (si < slots.length && slots[si].blocked) si++

    // Prevent scheduling if Daily Mental Energy Unit limit is exceeded
    if (usedMEU + meuCost > DAILY_MEU || si >= slots.length) {
      scheduled.push({ ...task, time: 'Tomorrow', meuCost, overloaded: true })
      continue
    }

    const slot = slots[si]
    const durSlots = Math.ceil((task.duration || 30) / 30)
    for (let i = si; i < Math.min(si + durSlots, slots.length); i++) slots[i].blocked = true
    si += durSlots
    usedMEU += meuCost

    // Assign dynamic scientific label based on time slot
    let label = 'Standard Slot'
    if (lowSleep) {
      label = (slot.hour >= 10 && slot.hour <= 12) ? 'Delayed Peak Zone' : 'Recovery Zone'
    } else {
      label = (slot.hour >= 8 && slot.hour <= 11) ? 'Cortisol Peak' : (slot.hour >= 13 && slot.hour <= 15) ? 'Secondary Peak' : 'Standard Slot'
    }

    scheduled.push({ ...task, time: slot.time, meuCost, circadianLabel: label, overloaded: false, rescheduled: false })
  }

  return { scheduledTasks: scheduled, powerNapBlocks, totalMEU: usedMEU, lowSleep }
}
