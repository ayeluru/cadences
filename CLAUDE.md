# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev        # Start development server (Express + Vite HMR)
npm run build      # Build for production (Vite + esbuild)
npm run check      # TypeScript type checking
npm run db:push    # Apply Drizzle schema migrations to PostgreSQL
npm start          # Run production build
```

## Architecture Overview

Cadences is a task/habit tracking application with multi-profile support, dynamic urgency calculation, and metric tracking.

### Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express + TypeScript + Drizzle ORM + PostgreSQL
- **Routing**: Wouter (client), Express (server)
- **State**: TanStack React Query for server state, React Context for profile selection

### Directory Structure
- `client/src/` - React frontend
  - `components/ui/` - shadcn/ui base components
  - `components/` - Feature components (TaskCard, CreateTaskDialog, etc.)
  - `pages/` - Route-based pages
  - `hooks/` - React Query hooks for API calls
  - `contexts/` - ProfileContext for multi-profile management
- `server/` - Express backend
  - `routes.ts` - All API route handlers
  - `storage.ts` - DatabaseStorage class implementing IStorage interface
  - `db.ts` - Drizzle ORM setup
- `shared/` - Shared TypeScript code
  - `schema.ts` - Drizzle ORM schema + Zod validation (single source of truth)
  - `routes.ts` - API route definitions with Zod schemas

### Path Aliases
```typescript
@/        // → client/src/
@shared/  // → shared/
```

## Key Domain Concepts

### Task Types
1. **Interval-based**: Every X days/weeks/months/years
2. **Frequency-based**: X times per week/month with optional refractory period
3. **Scheduled**: Specific days/times (future use)

### Urgency Calculation
```typescript
dueSoonThreshold = Math.max(1, Math.min(14, Math.ceil(cadenceDays * 0.2)))
```

### Task Status States
- `overdue` - Past due date
- `due_soon` - Within threshold
- `later` - Not due soon
- `never_done` - Never completed

## Development Patterns

### Adding an API Endpoint
1. Define Zod schema in `shared/routes.ts`
2. Implement handler in `server/routes.ts`
3. Add storage method in `server/storage.ts`
4. Create React Query hook in `client/src/hooks/`

### Component Conventions
- Dialogs use shadcn/ui Dialog + React Hook Form
- TaskCard displays urgency status, metrics, actions
- All mutations invalidate relevant query keys for auto-revalidation
- useToast() for user feedback on success/error

### Database
- Tables use snake_case columns
- All types derive from Drizzle schema with Zod integration
- Key tables: profiles, tasks, completions, task_metrics, metric_values, task_streaks, task_variations
