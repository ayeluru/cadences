# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Cadences is a React + TypeScript task/habit tracker. See `CLAUDE.md` for full architecture, commands, and coding conventions.

### Required secrets

The app requires four environment variables in `.env.local` (see `CLAUDE.md` > Environment Variables):

- `VITE_SUPABASE_URL` — production Supabase project URL (for auth)
- `VITE_SUPABASE_ANON_KEY` — production Supabase anon key (for auth)
- `SUPABASE_SERVICE_ROLE_KEY` — production Supabase service role key (for JWT verification)
- `DATABASE_URL` — dev Supabase PostgreSQL connection string

Without these, the frontend renders a blank page and the API server crashes on startup.

### Running the dev environment

- **Frontend only**: `npm run dev:frontend` (port 5173)
- **API only**: `npm run dev:api` (port 3001) — requires `.env.local`
- **Both + DB sync**: `npm run dev` — runs sync script first (gracefully skips if `pg_dump` not installed), then starts both servers concurrently
- Access the app at `http://localhost:5173` (NOT port 3001)
- The Vite proxy in `vite.config.ts` forwards `/api` requests to `localhost:3001`

### Key caveats

- The API server (`scripts/dev-api.ts`) reads `.env.local` manually and crashes immediately if `VITE_SUPABASE_URL` is not set. Start frontend-only with `npm run dev:frontend` if you only need the build/lint toolchain.
- `npm run dev` runs `scripts/sync-dev-db.sh` first, which requires `pg_dump`/`pg_restore`. It gracefully skips if those tools are not installed.
- Do NOT use `vercel dev` — it has known proxy issues with this project.
- Lint: this project does not have a dedicated ESLint config. Use `npm run check` (TypeScript type-checking) as the lint step.
- No automated test suite exists in this codebase.
