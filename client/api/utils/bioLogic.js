// api/utils/bioLogic.js
const W1 = 0.42, W2 = 0.31, W3 = 0.27
const MEU_WEIGHTS = { high: 5, medium: 3, low: 1 } 
const MEU_SCALAR = 5 
const DAILY_MEU = 100 

export function getCircadianMultiplier(hour, chronotype = 'lark') {
  let shift = 0
  if (chronotype === 'owl') shift = 3 
  if (chronotype === 'third_bird') shift = 1 
  
  const adjHour = hour - shift

  if (adjHour >= 8 && adjHour <= 11) return 1.0 
  if (adjHour >= 13 && adjHour <= 15) return 0.85 
  if (adjHour >= 16 && adjHour <= 18) return 0.7  
  if (adjHour >= 6 && adjHour < 8) return 0.6   
  if (adjHour >= 12 && adjHour < 13) return 0.55 
  return 0.5 
}

export function predictFatigue({ sleepHours, studyLoad, hoursSinceBreak, energyLevel, currentHour, chronotype = 'lark' }) {
  const S = Math.min(sleepHours / 9, 1)
  const E = energyLevel / 10
  const L = studyLoad / 10
  const B = Math.min(hoursSinceBreak / 4, 1) * 0.15
  const C = getCircadianMultiplier(currentHour, chronotype)
  const rawScore = W1 * S + W2 * E - W3 * L - B
  const productivity = Math.max(0, Math.min(100, rawScore * 100 * C + 30))
  const fatigueIndex = Math.max(0, Math.min(100, 100 - productivity))
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

export function generateAdaptiveSchedule({ tasks = [], sleepHours = 8, isTired = false, chronotype = 'lark', currentFatigue = 0 }) {
  const lowSleep = sleepHours < 6
  const needRecovery = lowSleep || currentFatigue > 70
  let shift = 0
  if (chronotype === 'owl') shift = 3
  if (chronotype === 'third_bird') shift = 1

  const getSlotScore = (hour) => {
    const adjHour = hour - shift
    if (needRecovery) {
      if (adjHour >= 10 && adjHour <= 12) return 1.0
      if (adjHour >= 14 && adjHour <= 16) return 0.75
      return 0.5
    }
    if (adjHour >= 8 && adjHour <= 11) return 1.0 
    if (adjHour >= 13 && adjHour <= 15) return 0.85
    if (adjHour >= 16 && adjHour <= 18) return 0.7
    return 0.5
  }

  const slots = []
  for (let h = 6; h < 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push({
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        hour: h, score: getSlotScore(h), blocked: false
      })
    }
  }

  const powerNapBlocks = []
  if (needRecovery) {
    powerNapBlocks.push({ time: '15:30', label: 'Power Nap / NSDR (30 min)', type: 'rest' })
    const nap = slots.find(s => s.time === '15:30')
    if (nap) nap.blocked = true 
    const morningSlots = slots.filter(s => s.hour >= 6 && s.hour < 8 + shift)
    morningSlots.forEach(s => s.score *= 0.5) 
  }

  const socialKeywords = ['meeting', 'group', 'call', 'party', 'interview', 'presentation']
  const socialTasks = tasks.filter(t => socialKeywords.some(kw => t.name.toLowerCase().includes(kw)))
  if (socialTasks.length > 1) {
    powerNapBlocks.push({ time: '16:00', label: 'Solitude Block (Recharge)', type: 'rest' })
    const sol = slots.find(s => s.time === '16:00' && !s.blocked)
    if (sol) sol.blocked = true
  }

  const pOrder = { high: 3, medium: 2, low: 1 }
  const sorted = [...tasks].sort((a, b) => (pOrder[b.priority] || 1) - (pOrder[a.priority] || 1))

  let scheduled = []
  let usedMEU = 0
  let si = 0 

  for (const task of sorted) {
    const baseWeight = MEU_WEIGHTS[task.priority] || 3
    const baseMEU = baseWeight * MEU_SCALAR 
    const meuCost = isTired ? baseMEU * 2 : baseMEU 

    while (si < slots.length && slots[si].blocked) si++

    if (usedMEU + meuCost > DAILY_MEU || si >= slots.length) {
      scheduled.push({ ...task, time: 'Tomorrow', meuCost, overloaded: true })
      continue
    }

    const slot = slots[si]
    const durSlots = Math.ceil((task.duration || 30) / 30)
    for (let i = si; i < Math.min(si + durSlots, slots.length); i++) slots[i].blocked = true
    si += durSlots
    usedMEU += meuCost

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
