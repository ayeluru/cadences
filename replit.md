# Maintain - Personal Productivity & Maintenance Tracking App

## Overview

Maintain is a personal productivity and maintenance tracking application designed to help users track recurring tasks based on cadence intervals rather than specific calendar dates. The core concept focuses on time since last completion, where each task has an interval (e.g., every 1 day, 2 weeks, 3 months) and the app continuously computes urgency based on how close tasks are to being overdue.

The application supports two task types:
- **Interval-based tasks**: Complete every X days/weeks/months/years
- **Frequency-based tasks**: Complete X times per week/month

Tasks can be organized with categories and tags, grouped into routines, and track custom metrics (like weight, reps, duration) with each completion.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Animations**: Framer Motion for smooth transitions
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a mobile-first design with:
- Bottom navigation on mobile screens
- Sidebar navigation on desktop
- Task cards showing urgency status (overdue, due soon, later, never done)
- Views filtered by cadence magnitude (daily, weekly, monthly, yearly)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful endpoints defined in `shared/routes.ts`
- **Validation**: Zod schemas for request/response validation
- **Build**: esbuild for server bundling, Vite for client

The server uses a storage abstraction layer (`server/storage.ts`) that implements all database operations through a defined interface, making it easier to test and modify data access patterns.

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with Zod integration for type-safe schemas
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with `db:push` command

Key database tables:
- `users` - User accounts (managed by Replit Auth)
- `sessions` - Session storage for authentication
- `tasks` - Task definitions with interval/frequency settings
- `completions` - Append-only log of task completions
- `categories` - Hierarchical task organization
- `tags` - Flexible task labeling
- `routines` - Groups of related tasks
- `task_metrics` - Custom metrics per task
- `metric_values` - Recorded metric values per completion

### Authentication
- **Provider**: Replit Auth (OpenID Connect)
- **Session Management**: express-session with connect-pg-simple for PostgreSQL session storage
- **Implementation**: Located in `server/replit_integrations/auth/`

## External Dependencies

### Third-Party Services
- **Replit Auth**: OpenID Connect authentication via Replit's identity provider
- **PostgreSQL**: Primary database (provisioned via Replit)

### Key Libraries
- **Frontend**: React, TanStack Query, Wouter, Framer Motion, Recharts, date-fns, shadcn/ui (Radix primitives)
- **Backend**: Express, Drizzle ORM, Passport.js, Zod
- **Shared**: Zod schemas and route definitions shared between client and server

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for session encryption
- `ISSUER_URL` - Replit OIDC issuer (defaults to https://replit.com/oidc)
- `REPL_ID` - Replit deployment identifier