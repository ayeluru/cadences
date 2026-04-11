# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev       # Start Vite dev server (client only, API calls go to Vercel or local proxy)
npm run build     # Build client for production (outputs to dist/public)
npm run check     # TypeScript type checking
npm run db:push   # Apply Drizzle schema to PostgreSQL (requires DATABASE_URL in .env.local)
```

## Architecture Overview

Cadences is a task/habit tracking application with multi-profile support, dynamic urgency calculation, and metric tracking.

### Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Vercel serverless functions (api/ directory) + Drizzle ORM + PostgreSQL
- **Auth**: Supabase Auth (email/password, Bearer JWT tokens)
- **Database**: Supabase PostgreSQL (via postgres.js driver)
- **Routing**: Wouter (client-side)
- **State**: TanStack React Query for server state, React Context for profile selection

### Directory Structure
- `client/src/` - React frontend
  - `components/ui/` - shadcn/ui base components
  - `components/` - Feature components (TaskCard, CreateTaskDialog, etc.)
  - `pages/` - Route-based pages
  - `hooks/` - React Query hooks for API calls
  - `contexts/` - ProfileContext for multi-profile management
  - `lib/` - Utilities (queryClient, supabase client, task-utils)
- `api/` - Vercel serverless functions
  - `_lib/` - Shared backend utilities (auth, db, storage, task-utils)
  - `auth/` - Auth endpoints
  - `tasks/` - Task CRUD + sub-resources (complete, archive, metrics, etc.)
  - `profiles/` - Profile management + demo + import
  - `categories/`, `tags/` - Organization endpoints
  - `stats/`, `streaks/`, `calendar/` - Analytics endpoints
  - `metrics/`, `variations/`, `completions/` - Supporting resource endpoints
- `shared/` - Shared TypeScript code
  - `schema.ts` - Drizzle ORM schema + Zod validation (single source of truth)
  - `routes.ts` - API route definitions with Zod schemas

### Path Aliases
```typescript
@/       // → client/src/
@shared/ // → shared/
```

## Environment Variables

Required in `.env.local` (never committed):
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
DATABASE_URL=postgresql://...
```

## Key Domain Concepts

### Task Types
1. **Interval-based**: Every X days/weeks/months/years
2. **Frequency-based**: X times per week/month with optional refractory period
3. **Scheduled**: Specific days/times (days of week, days of month, specific dates)

### Urgency Calculation
```typescript
dueSoonThreshold = Math.max(1, Math.min(14, Math.ceil(cadenceDays * 0.2)))
```
Urgency scores: never_done=1000, overdue=500+days, frequency=200+remaining*50, due_soon=100-days

### Task Status States
- `overdue` - Past due date
- `due_soon` - Within threshold
- `later` - Not due soon
- `never_done` - Never completed

## Development Patterns

### Adding an API Endpoint
1. Create a new file in `api/` following Vercel file-based routing (e.g., `api/tasks/[id]/newaction.ts`)
2. Import `verifyAuth`/`unauthorized` from `api/_lib/auth` and `storage` from `api/_lib/task-utils`
3. Export default async handler with auth check, method routing, try/catch
4. Add storage method in `api/_lib/storage.ts` if needed
5. Create React Query hook in `client/src/hooks/`

### Auth Pattern (API)
All API routes verify JWT via `verifyAuth(req)` which extracts the Supabase user from the `Authorization: Bearer` header.

### Auth Pattern (Client)
- `queryClient.ts` exports `getAuthHeaders()` and `apiRequest()` which auto-attach Bearer tokens
- Default `queryFn` in React Query automatically adds auth headers
- Custom `queryFn` implementations must manually get session via `supabase.auth.getSession()`

### Component Conventions
- Dialogs use shadcn/ui Dialog + React Hook Form
- TaskCard displays urgency status, metrics, actions
- All mutations invalidate relevant query keys for auto-revalidation
- useToast() for user feedback on success/error

### Database
- Tables use snake_case columns
- All types derive from Drizzle schema with Zod integration
- Key tables: profiles, tasks, completions, task_metrics, metric_values, task_streaks, task_variations
- User identity comes from Supabase Auth (userId is varchar UUID from Supabase)
