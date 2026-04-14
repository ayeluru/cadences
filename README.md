# Cadences

**A smart task and habit tracker with dynamic urgency, flexible scheduling, and rich analytics.**

Cadences helps you stay on top of recurring tasks — from daily habits to yearly rituals — by calculating real-time urgency, tracking streaks, recording metrics, and surfacing what needs your attention *right now*.

> **Live at [lifes-cadence.vercel.app](https://lifes-cadence.vercel.app)**

---

## Features

### Three Scheduling Modes

- **Interval** — Every N days / weeks / months / years from last completion
- **Frequency** — N times per week or month, with optional refractory period (minimum gap between completions)
- **Scheduled** — Specific days of the week, days of the month, or exact dates with optional time-of-day

### Dynamic Urgency System

Tasks are automatically scored and sorted by urgency based on their schedule and completion history:

| Status | When | Urgency Score |
|--------|------|---------------|
| Never Done | No completions recorded | 1000 |
| Overdue | Past due date | 500 + days overdue |
| Due Soon | Within adaptive threshold | 100 − days remaining |
| Later | Not yet due | Negative (lower = more slack) |

The "due soon" threshold adapts to each task's cadence — a daily task becomes due soon within 1 day, while a monthly task gets a ~6-day warning window.

### Completion Tracking

- Log completions with optional notes, backdated timestamps, and task variations
- Track numeric/text metrics per completion (e.g., weight lifted, distance run, mood rating)
- Streak tracking with current streak, longest streak, and total completions

### Multi-Profile Support

- Create separate profiles to organize different life areas (Work, Health, Home, etc.)
- Aggregate "All Profiles" view across all data
- Demo profiles with sample data for trying out the app
- Per-profile categories and tags for flexible organization

### Analytics & Visualization

- **Dashboard** — Tasks grouped by urgency: Overdue → Due Soon → Up Next → Never Completed
- **Cadence Views** — Filter tasks by magnitude: Daily, Weekly, Monthly, Yearly
- **Calendar** — Month view with heatmap-style coloring for completions, missed tasks, and upcoming due dates
- **Stats** — Total completions, active streaks, best streaks, overdue rate, monthly completion bar charts
- **Metrics** — Per-metric history with interactive line charts, time range selection, and variation toggling

### Quality of Life

- Condensed and expanded card views
- Category and tag filtering
- Optimistic UI updates for snappy interactions
- Animated transitions via Framer Motion
- Lazy-loaded routes for fast initial page load
- In-app user guide

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Vercel Serverless Functions, Drizzle ORM |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (email/password, JWT) |
| Routing | Wouter |
| State | TanStack React Query |
| Charts | Recharts |
| Animations | Framer Motion |

---

## Project Structure

```
cadences/
├── client/src/          # React frontend
│   ├── components/      # Feature components (TaskCard, dialogs, etc.)
│   │   └── ui/          # shadcn/ui primitives
│   ├── pages/           # Route-based pages
│   ├── hooks/           # React Query hooks for API calls
│   ├── contexts/        # ProfileContext for multi-profile management
│   └── lib/             # Utilities, query client, Supabase client
├── api/                 # Vercel serverless functions
│   ├── [[...path]].ts   # Catch-all router (single entry point)
│   └── _lib/            # Handlers, storage, auth, task enrichment
├── shared/              # Shared TypeScript code
│   └── schema.ts        # Drizzle schema + Zod validation (source of truth)
├── scripts/             # Dev tooling (API server, DB sync)
└── migrations/          # Drizzle migration SQL files
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (for auth and PostgreSQL)
- `pg_dump` / `pg_restore` for dev database sync (`brew install libpq` on macOS)

### Setup

1. **Clone the repository**
   ```bash
   git clone git@github.com:ayeluru/cadences.git
   cd cadences
   npm install
   ```

2. **Configure environment variables** — create `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=postgresql://...your-dev-database-url
   ```

3. **Start development**
   ```bash
   npm run dev
   ```
   This syncs the dev database, starts the API server on port 3001, and the Vite frontend on port 5173. Open **http://localhost:5173**.

### Other Commands

| Command | Description |
|---------|-------------|
| `npm run dev:api` | Start only the API server (no DB sync) |
| `npm run dev:frontend` | Start only the Vite frontend (no DB sync) |
| `npm run build` | Build for production |
| `npm run check` | TypeScript type checking |
| `npm run db:generate` | Generate migration SQL from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio to browse the database |

---

## Deployment

Hosted on **Vercel** (Hobby plan). Deploy to production:

```bash
vercel --prod
```

All API handlers are consolidated into a single catch-all serverless function to stay within the 12-function Hobby plan limit.

---

## Data Model

```
profiles ──┬── tasks ──┬── completions ── metric_values
            │           ├── task_metrics
            │           ├── task_variations
            │           └── task_streaks
            ├── categories (hierarchical)
            └── tags ── task_tags
```

User identity is managed by Supabase Auth; all data is scoped by `userId` and `profileId`.

---

## License

MIT
