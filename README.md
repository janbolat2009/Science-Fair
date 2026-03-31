# CogniFlow — AI Adaptive Time Management Platform

## Project Structure

```
project/
├── client/          # React frontend (Vite + Tailwind)
│   └── src/
│       ├── components/
│       │   ├── Dashboard.jsx
│       │   ├── Chatbot.jsx
│       │   ├── TaskList.jsx
│       │   ├── MetricCard.jsx
│       │   ├── StressHeatmap.jsx
│       │   └── LanguageSwitcher.jsx
│       ├── hooks/
│       │   └── usePrediction.js
│       ├── locales/
│       │   ├── en.json
│       │   ├── ru.json
│       │   └── kk.json
│       ├── i18n.js
│       ├── main.jsx
│       └── index.css
└── server/          # Node.js Express backend
    ├── index.js
    ├── .env.example
    └── package.json
```

## Setup & Run

### 1. Server Setup
```bash
cd server
npm install
cp .env.example .env
# Add your Anthropic API key to .env
npm run dev
```

### 2. Client Setup
```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173

## ML Formula

```
P = w1 * Sleep + w2 * Energy - w3 * Load - BreakPenalty

Where:
  w1 = 0.42  (sleep weight - primary recovery factor)
  w2 = 0.31  (energy weight - current cognitive capacity)
  w3 = 0.27  (load weight - cognitive demand)
  BreakPenalty = min(hoursSinceBreak / 4, 1) * 0.15

All inputs normalized to [0, 1] range.
Productivity P ∈ [0, 100]
Fatigue Index = 100 - P
```

## API Endpoints

- `POST /api/coach` — AI coaching messages
- `POST /api/predict` — ML fatigue prediction
- `POST /api/tasks/rank` — Circadian task ranking
- `GET /api/health` — Server status

## Languages

- English (EN)
- Russian (RU)
- Kazakh (ҚЗ / KK)
