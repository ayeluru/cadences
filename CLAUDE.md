# CLAUDE.md

This file provides guidance to AI agents (Claude Code, Cursor, etc.) when working with code in this repository. See also `AGENTS.md` for Cursor-Cloud-specific notes (env, lint caveats, dev startup).

## Build & Development Commands

```bash
npm run dev          # Sync prod→dev DB, then start API server (port 3001) + Vite frontend (port 5173)
npm run dev:api      # Start only the API dev server (port 3001) — no DB sync
npm run dev:frontend # Start only the Vite frontend (port 5173) — no DB sync
npm run build        # Build client for production (outputs to dist/public)
npm run check        # TypeScript type checking
npm run db:generate  # Generate a migration SQL file from schema changes
npm run db:migrate   # Apply pending migrations to the database
npm run db:studio    # Open Drizzle Studio to browse database
npm run db:push      # Directly apply schema (for throwaway/initial setup only)
```

This project has no automated test suite and no dedicated ESLint config — `npm run check` (TypeScript) is the lint step.

## Deployment & Releases

**Hosting**: Vercel (Hobby plan). **Database/Auth**: Supabase.

### How deploys happen
Vercel's GitHub integration is enabled, so deploys are automatic:
- **Push a branch** → Vercel builds a Preview deployment with its own URL (e.g. `cadence-<hash>-ayelurus-projects.vercel.app`)
- **Merge to `main`** → Vercel builds and promotes a Production deployment to `lifes-cadence.vercel.app`

You do not need to run `vercel --prod` manually. (It still works as an escape hatch, but the standard path is push/merge.)

**Preview-deploy gotcha**: Preview deployments use the *dev* Supabase project for auth/DB (different from Production). Logging into a preview URL with prod credentials will not work — the user simply won't appear in the dev project. Test data-dependent changes locally (see Local Development Architecture); reserve the preview URL for UI-only verification.

### Release Workflow
Version is tracked in `package.json` and displayed in the app sidebar via Vite's `define` config.

1. Merge feature/fix PRs to `main` first — auto-deploys to prod
2. On `main`, bump version in `package.json` (semver: `MAJOR.MINOR.PATCH`)
   - **PATCH** (1.0.1): Bug fixes
   - **MINOR** (1.1.0): New features, backward-compatible
   - **MAJOR** (2.0.0): Breaking changes
3. Add a CHANGELOG.md entry for the new version
4. Commit changes
5. Tag: `git tag -a vX.Y.Z -m "description of release"`
6. Push: `git push origin main --tags` — auto-deploy picks up the tagged commit

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

### Local Development Architecture
- **`npm run dev`** does three things in order:
  1. **Syncs prod→dev database** (`scripts/sync-dev-db.sh`) — snapshots production data into dev via pg_dump/pg_restore, then re-applies any pending migrations (~15s). This ensures the dev database always mirrors production.
  2. **API dev server** (`scripts/dev-api.ts`) on port 3001 — loads the Vercel serverless function handler directly via Node/tsx, reads env vars from `.env.local`
  3. **Vite frontend** on port 5173 — proxies all `/api` requests to the API server (configured in `vite.config.ts`)
- Access the app at **http://localhost:5173** (NOT port 3000 or 3001)
- Use `dev:api` / `dev:frontend` to skip the DB sync and restart individual servers quickly
- **Do NOT use `vercel dev`** — it has known proxy issues with this project's configuration

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
  - `_lib/auth.ts` - JWT verification (local via JWKS using `jose`, with HTTP fallback to Supabase Auth)
  - `_lib/db.ts` - Drizzle ORM + postgres.js connection
  - `_lib/storage.ts` - `DatabaseStorage` class (all database operations)
  - `_lib/task-utils.ts` - `enrichTask()` urgency/status calculation
  - `_lib/supabase.ts` - Supabase admin client
- `shared/` - Shared TypeScript code
  - `schema.ts` - Drizzle ORM schema + Zod validation (single source of truth)
- `scripts/` - Utility scripts
  - `dev-api.ts` - Local API dev server (adapts Vercel function handler to plain Node HTTP)
  - `sync-dev-db.sh` - Non-interactive prod→dev sync (runs automatically on `npm run dev`)
  - `snapshot-prod-to-dev.sh` - Interactive prod→dev snapshot with confirmation prompt (for manual use)

### Path Aliases
```typescript
@/       // → client/src/
@shared/ // → shared/
```

## Environment Variables

Required in `.env.local` (never committed):
```
VITE_SUPABASE_URL=https://xxx.supabase.co       # PRODUCTION Supabase URL (for auth)
VITE_SUPABASE_ANON_KEY=sb_publishable_...        # PRODUCTION anon key (for auth)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...           # PRODUCTION service role key (for JWT verification)
DATABASE_URL=postgresql://...                     # DEV database connection string
```

### Prod Auth + Dev Data Architecture
Local development uses a **split configuration**:
- **Auth** (Supabase URL, anon key, service role key) → **production** Supabase project. This means you log in with real production accounts and get the same user UUIDs as production.
- **Database** (DATABASE_URL) → **dev** Supabase PostgreSQL. All data reads/writes go to the isolated dev database.

This ensures the dev database can be a perfect mirror of production (user IDs match), while keeping dev data completely isolated from prod.

### Vercel Environment Settings
- **Production**: All four variables point to the production Supabase project
- **`.env.local`**: Auth credentials = production, DATABASE_URL = dev (as described above)
- **NEVER change `.env.local` auth credentials to point at the dev Supabase project** — this would break the user ID mapping between auth and database

## Key Domain Concepts

### Multi-profile model
Each user has one or more profiles (e.g. "Personal", "Work", "Exercise"). Tasks, categories, and tags belong to a profile (`profileId` FK). The UI supports a special **All Profiles** aggregated view (`isAggregatedView` in `ProfileContext`) that fans out across every non-demo profile the user owns. Profiles flagged `isDemo: true` (created via the demo seed flow) are excluded from the aggregated view and from aggregate stats.

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
- `paused` - Manually paused, or globally paused via vacation mode

### Timezone-aware scheduling
All due-date and period calculations respect the user's local timezone (stored in `user_settings.timezone`). The server-side `enrichTask`/`enrichTasks` functions in `task-utils.ts` thread the timezone through; the client uses `client/src/lib/tz.ts` helpers. Don't introduce new code that compares dates in UTC — use `toLocal`, `nowLocal`, `formatDateKey` from `tz.ts`.

## Development Patterns

### Adding an API Endpoint
1. Add the handler function as a named export in `api/_lib/all-handlers.ts`
2. Add a route entry in the `routes` array in `api/[[...path]].ts` with regex pattern, handler reference, and param names
3. Use `.js` extensions for all local imports (ESM requirement)
4. Add storage method in `api/_lib/storage.ts` if needed
5. Create React Query hook in `client/src/hooks/`

### Auth Pattern (API)
All API routes verify JWT via `verifyAuth(req)` which extracts the Supabase user from the `Authorization: Bearer` header. The fast path verifies the token locally against Supabase's JWKS (using `jose`) and returns `id` + `email` from the JWT claims. If local verification fails (e.g., during a key rotation window), it falls back to an HTTP round-trip to Supabase Auth. Local verification is stateless — it does not detect deleted users until their JWT expires (~1 hour).

### Auth Pattern (Client)
- `queryClient.ts` exports `getAuthHeaders()` and `apiRequest()` which auto-attach Bearer tokens
- Default `queryFn` in React Query automatically adds auth headers
- Custom `queryFn` implementations must manually get session via `supabase.auth.getSession()`

### Data Fetching Conventions
- React Query is configured with `staleTime: Infinity` and `refetchOnWindowFocus: false`. Queries cache for the entire session — they do **not** auto-revalidate. Revalidation is invalidate-driven: mutations call `queryClient.invalidateQueries({ queryKey: [...] })` in their `onSuccess`/`onSettled` to mark caches stale.
- When adding a new mutation that affects existing data, you must explicitly invalidate every query key that displays the affected data, or the UI will show stale state until the user navigates or hard-refreshes.

### Component Conventions
- Dialogs use shadcn/ui Dialog + React Hook Form
- TaskCard displays urgency status, metrics, actions
- All mutations invalidate relevant query keys for auto-revalidation
- useToast() for user feedback on success/error
- Loading states use shadcn `Skeleton` components shaped like the eventual content (not generic spinners) — see Dashboard, Stats, CalendarView for examples
- Global request feedback comes from `<TopProgressBar />` (mounted in `App.tsx`); per-page skeletons handle the empty-page case
- High-traffic mutations (complete, pause, resume, archive, cascade-delete) use TanStack Query optimistic updates: `onMutate` snapshots + patches the cache via `setQueriesData`, `onError` rolls back, `onSettled` invalidates. Use this pattern when instant visual feedback matters.
- Routes other than `/` and `/login` are lazy-loaded via `React.lazy()` in `App.tsx`. Wrap new pages in `lazy()` unless they need to ship in the initial bundle.

### Database
- Tables use snake_case columns
- All types derive from Drizzle schema with Zod integration
- **Core domain tables**: `profiles`, `tasks`, `completions`, `task_metrics`, `metric_values`, `task_streaks`, `task_variations`, `task_assignments` (weekly planner overrides), `categories`, `tags`, `task_tags`
- **Settings/activity tables**: `user_settings` (timezone, vacation mode), `user_activity` (last-active tracking shown in admin)
- **Roles & feedback**: `user_roles`, `feedback_submissions`, `feedback_votes`, `feedback_comments`
- User identity comes from Supabase Auth (userId is varchar UUID from Supabase)
- **Two separate Supabase projects**: production (`xodqmkmsrsmjrahuegfl`) and development (`lcqjaniziwjbeacpxexg`)
- Foreign keys use `ON DELETE CASCADE` (or `SET NULL` for optional refs like `categoryId`, `parentTaskId`, `variationId`)
- Indexes exist on all common query columns (userId, profileId, taskId, etc.)

## Database Safety Rules (MANDATORY)

**These rules are non-negotiable. Protecting production data is the highest priority.**

### NEVER do these things
- **NEVER run `db:push` against any database with real data.** It can silently drop columns and lose data. It exists only for blank/throwaway databases.
- **NEVER run raw SQL that drops, truncates, or alters tables directly.** Always go through the migration workflow.
- **NEVER modify `.env.local` to point at production credentials.** The local environment must always use the dev database.
- **NEVER run `db:migrate` or any schema-changing command without telling the user what the migration SQL will do and getting confirmation first.**

### Schema Change Workflow (ALWAYS follow this)

When a task requires changing `shared/schema.ts` (adding/removing/renaming columns, tables, types, constraints, etc.):

1. **Ensure dev mirrors prod.** `npm run dev` auto-syncs on every start, so if the dev server is already running the data is fresh. If not, run the sync manually:
   ```bash
   bash scripts/sync-dev-db.sh
   ```
   Requires `pg_dump`/`pg_restore` (install: `brew install libpq`). The sync handles migration tracking reset and re-apply automatically.
2. **Make the schema change** in `shared/schema.ts`
3. **Generate the migration**: run `npm run db:generate`
4. **Read and present the generated SQL file** (in `migrations/`) to the user. Explain what it does in plain language. Flag anything destructive (DROP, ALTER TYPE, column renames).
5. **Wait for user confirmation** before applying.
6. **Apply to dev only**: run `npm run db:migrate` (this uses DATABASE_URL from `.env.local`, which is the dev database)
7. **Verify** the app still works with `npm run dev` if appropriate.
8. **Tell the user** the migration succeeded on dev and remind them the same migration still needs to be applied to production when they're ready.

Do NOT apply migrations to production — that is the user's decision and action.

### Migration files
- Migration `.sql` files in `migrations/` must be committed to git.
- Never manually edit a migration file that has already been applied.
- Each `db:generate` produces a new sequential file — the history is append-only.
