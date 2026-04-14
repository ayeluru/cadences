# CLAUDE.md

This file provides guidance to AI agents (Claude Code, Cursor, etc.) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev       # Start Vite dev server for frontend (localhost:5173)
vercel dev        # Start full local dev (Vite frontend + serverless API functions)
npm run build     # Build client for production (outputs to dist/public)
npm run check     # TypeScript type checking
npm run db:push   # Apply Drizzle schema to PostgreSQL (requires DATABASE_URL in .env.local)
```

## Deployment & Releases

**Hosting**: Vercel (Hobby plan). **Database/Auth**: Supabase.

### Deploying to Production
```bash
vercel --prod     # Build & deploy to production (lifes-cadence.vercel.app)
```
`vercel --prod` builds the Vite frontend and bundles the serverless API functions, then deploys everything to the live production URL. Without `--prod`, it creates a temporary preview deployment for testing.

### Release Workflow
Version is tracked in `package.json` and displayed in the app sidebar via Vite's `define` config.

1. Bump version in `package.json` (semver: `MAJOR.MINOR.PATCH`)
   - **PATCH** (1.0.1): Bug fixes
   - **MINOR** (1.1.0): New features, backward-compatible
   - **MAJOR** (2.0.0): Breaking changes
2. Commit changes
3. Tag: `git tag -a vX.Y.Z -m "description of release"`
4. Push: `git push origin main --tags`
5. Deploy: `vercel --prod`

### Important Vercel Constraints
- **Hobby plan limit**: Max 12 serverless functions per deployment. All API handlers are consolidated into a single catch-all function (`api/[[...path]].ts`).
- **Max duration**: 60 seconds per function invocation (configured in the catch-all).
- **ESM imports**: All local imports in `api/` must use `.js` extensions (e.g., `from './auth.js'`) because the project uses `"type": "module"`.

## Architecture Overview

Cadences is a task/habit tracking application with multi-profile support, dynamic urgency calculation, and metric tracking.

### Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Vercel serverless functions (`api/` directory) + Drizzle ORM + PostgreSQL
- **Auth**: Supabase Auth (email/password, Bearer JWT tokens)
- **Database**: Supabase PostgreSQL (via `postgres.js` driver)
- **Routing**: Wouter (client-side)
- **State**: TanStack React Query for server state, React Context for profile selection

### How Vite and Vercel Work Together
- **Vite** builds the React frontend into static HTML/CSS/JS files (`dist/public/`). It is NOT the backend server.
- **Vercel** serves the static frontend via its CDN and runs the API as serverless functions. In production, there is no Express or Node.js server — just static files + on-demand functions.
- **`vercel dev`** runs both locally: Vite for the frontend with HMR, and the serverless functions as a local API.

### Directory Structure
- `client/src/` - React frontend
  - `components/ui/` - shadcn/ui base components
  - `components/` - Feature components (TaskCard, CreateTaskDialog, etc.)
  - `pages/` - Route-based pages
  - `hooks/` - React Query hooks for API calls
  - `contexts/` - ProfileContext for multi-profile management
  - `lib/` - Utilities (queryClient, supabase client)
- `api/` - Vercel serverless functions
  - `[[...path]].ts` - **Catch-all router**: single entry point for all API requests, dispatches to handlers via regex pattern matching
  - `_lib/all-handlers.ts` - All API handler functions (named exports)
  - `_lib/auth.ts` - JWT verification via Supabase
  - `_lib/db.ts` - Drizzle ORM + postgres.js connection
  - `_lib/storage.ts` - `DatabaseStorage` class (all database operations)
  - `_lib/task-utils.ts` - `enrichTask()` urgency/status calculation
  - `_lib/supabase.ts` - Supabase admin client
- `shared/` - Shared TypeScript code
  - `schema.ts` - Drizzle ORM schema + Zod validation (single source of truth)

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

The same variables must be set in Vercel's environment settings for production.

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
1. Add the handler function as a named export in `api/_lib/all-handlers.ts`
2. Add a route entry in the `routes` array in `api/[[...path]].ts` with regex pattern, handler reference, and param names
3. Use `.js` extensions for all local imports (ESM requirement)
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
