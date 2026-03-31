import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// ─── Fake In-Memory Database ──────────────────────────────────────────────────
const usersDb = []

app.post('/api/auth/register', (req, res) => {
  const { username, password, name, age } = req.body
  if (usersDb.find(u => u.username === username)) {
    return res.status(400).json({ error: 'User already exists' })
  }
  const id = String(usersDb.length + 1)
  const newUser = { id, username, password, name, age }
  usersDb.push(newUser)
  res.json({ success: true, user: { id, username, name, age } })
})

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  const user = usersDb.find(u => u.username === username && u.password === password)
  if (user) {
    res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, age: user.age } })
  } else {
    res.status(401).json({ error: 'Invalid credentials' })
  }
})

app.get('/api/user/profile/:id', (req, res) => {
  const user = usersDb.find(u => u.id === req.params.id)
  if (user) {
    res.json({ success: true, profile: user })
  } else {
    res.status(404).json({ error: 'User not found' })
  }
})

app.put('/api/user/profile/:id', (req, res) => {
  const userIndex = usersDb.findIndex(u => u.id === req.params.id)
  if (userIndex !== -1) {
    usersDb[userIndex] = { ...usersDb[userIndex], ...req.body }
    res.json({ success: true, profile: usersDb[userIndex] })
  } else {
    res.status(404).json({ error: 'User not found' })
  }
})

import { predictFatigue, generateAdaptiveSchedule } from './utils/bioLogic.js'

// /api/predict — fatigue + burnout risk ML simulation
app.post('/api/predict', (req, res) => {
  const { sleepHours, studyLoad, hoursSinceBreak, energyLevel, chronotype } = req.body
  const currentHour = new Date().getHours()
  const result = predictFatigue({ sleepHours, studyLoad, hoursSinceBreak, energyLevel, currentHour, chronotype })
  res.json(result)
})

// /api/reschedule — cortisol-based adaptive rescheduler
app.post('/api/reschedule', (req, res) => {
  const { tasks = [], sleepHours = 8, isTired = false, chronotype, currentFatigue } = req.body
  const result = generateAdaptiveSchedule({ tasks, sleepHours, isTired, chronotype, currentFatigue })
  res.json(result)
})


// ─── Gemini Bio-Analyst Coach ─────────────────────────────────────────────────
const langInstructions = {
  en: 'Respond in English.',
  ru: 'Отвечай на русском языке.',
  kk: 'Қазақ тілінде жауап бер.',
}

function parseStateData(text) {
  const stressMatch = text.match(/stress[_\s]level[:\s]+(\d+)/i)
  const energyMatch = text.match(/energy[:\s]+(\d+)/i)
  const focusMatch = text.match(/focus[:\s]+(\d+)/i)
  const moodMatch = text.match(/mood[:\s]+(\w+)/i)
  if (stressMatch || energyMatch) {
    return {
      stress_level: stressMatch ? parseInt(stressMatch[1]) : null,
      energy: energyMatch ? parseInt(energyMatch[1]) : null,
      focus: focusMatch ? parseInt(focusMatch[1]) : null,
      mood: moodMatch ? moodMatch[1] : null,
    }
  }
  return null
}

app.post('/api/coach', async (req, res) => {
  const { message, fatigueData, lang = 'en', history = [], schedule = [] } = req.body

  const scheduleContext = schedule.length > 0
    ? `\nStudent's current rescheduled tasks:\n${schedule.map(t => `- ${t.time}: ${t.name} [${t.circadianLabel || 'Standard'}]`).join('\n')}`
    : ''

  const systemPrompt = `You are CogniFlow Bio-Analyst — an AI psychophysiological performance coach for students at NIS Astana Science Fair.
${langInstructions[lang] || langInstructions.en}

Your role:
- You are NOT just a chatbot. You are a PROACTIVE bio-analyst.
- Analyze the student's biometric data and give SPECIFIC, time-based recommendations.
- Reference circadian rhythm science, cortisol curves, and cognitive load theory.
- If the student has low sleep, tell them exactly which task was moved and when.
- Example style: "Based on your 5h of sleep, I've shifted your Physics study to 10:00 AM — your cortisol peak. I've inserted a 15-min Power Nap at 13:00 for NSDR recovery."

Current biometric data:
- Fatigue Index: ${fatigueData?.fatigue_index ?? 'unknown'}%
- Predicted Productivity: ${fatigueData?.productivity ?? 'unknown'}%
- Burnout Risk: ${fatigueData?.burnout_risk ?? 'unknown'}%
- Sleep Hours: ${fatigueData?.sleep_hours ?? 'unknown'}h
- Energy Level: ${fatigueData?.energy_level ?? 'unknown'}/10
- Study Load: ${fatigueData?.study_load ?? 'unknown'}/10
${scheduleContext}

When the user describes their feelings, extract state data and include it like this (on its own line):
STATE_DATA: stress_level: X, energy: Y, focus: Z, mood: WORD

Be concise, scientific, actionable. Max 3 paragraphs. Use terms like "Circadian Alignment", "Cognitive Load", "Neuro-Optimization", "MEU capacity".`

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content || ' '
      })),
      { role: 'user', content: message }
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to fetch from OpenAI')
    }

    const data = await response.json()
    const rawText = data.choices[0].message.content

    const stateData = parseStateData(rawText)
    const cleanText = rawText.replace(/STATE_DATA:[^\n]*/i, '').trim()

    res.json({ message: cleanText, stateData })
  } catch (err) {
    console.error('OpenAI API error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Server ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`CogniFlow server running on http://localhost:${PORT}`)
})
