# Cadences - Personal Productivity & Maintenance Tracking App

## Overview

Cadences is a personal productivity and maintenance tracking application designed to help users track recurring tasks based on cadence intervals rather than specific calendar dates. The core concept focuses on time since last completion, where each task has an interval (e.g., every 1 day, 2 weeks, 3 months) and the app continuously computes urgency based on how close tasks are to being overdue.

The application supports two task types:
- **Interval-based tasks**: Complete every X days/weeks/months/years
- **Frequency-based tasks**: Complete X times per week/month (with optional refractory period)

Tasks can be organized with categories and tags, grouped into routines, and track custom metrics (like weight, reps, duration) with each completion.

### Key Features
- **Profiles**: Organize tasks into separate contexts (Work, Personal, Exercise, Demo) with independent data
- **Dynamic Urgency Calculation**: "Due soon" threshold is 20% of task cadence, clamped between 1-14 days
- **Refractory Period**: For frequency tasks, prevents gaming by requiring minimum time between completions
- **Enhanced Calendar**: Shows completions, missed tasks, and future due dates with toggleable views
- **Metrics Tracking**: Custom metrics per task with trend charts and history
- **Streaks**: Visual streak tracking with grace period of 1.5x the interval
- **Task Variations**: Link tasks to frequency-based goals (e.g., "Back Squat" counts toward "Exercise 3x/week")

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Animations**: Framer Motion for smooth transitions
- **Charts**: Recharts for metric trend visualization
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a mobile-first design with:
- Sidebar navigation on desktop, hamburger menu on mobile
- Task cards showing urgency status (overdue, due soon, later, never done)
- Views filtered by cadence magnitude (daily, weekly, monthly, yearly)
- Calendar view with completion heatmap and day details
- Dedicated Metrics page for trend analysis

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
- `profiles` - User profiles for organizing tasks into contexts (Work, Personal, etc.)
- `tasks` - Task definitions with interval/frequency settings and refractoryMinutes (scoped by profileId)
- `completions` - Append-only log of task completions
- `categories` - Hierarchical task organization (scoped by profileId)
- `tags` - Flexible task labeling (scoped by profileId)
- `routines` - Groups of related tasks (scoped by profileId)
- `task_metrics` - Custom metrics per task
- `metric_values` - Recorded metric values per completion

### Authentication
- **Provider**: Replit Auth (OpenID Connect)
- **Session Management**: express-session with connect-pg-simple for PostgreSQL session storage
- **Implementation**: Located in `server/replit_integrations/auth/`

## Recent Changes

### December 29, 2025
- Renamed application from "Maintain" to "Cadences"
- Implemented percentage-based urgency calculation (20% of cadence, clamped 1-14 days)
- Added refractoryMinutes field for frequency tasks to prevent gaming
- Created enhanced calendar API with completions, missed tasks, and future due dates
- Added calendar UI toggles (completed/missed/upcoming) with condensed mode
- Implemented collapsible task summaries in calendar day details
- Created dedicated Metrics page with trend charts for all tracked metrics
- Updated User Guide with dynamic urgency info and routine creation steps
- Implemented Profiles system: users can create multiple profiles (Work, Personal, Exercise, etc.)
- Added ProfileContext for state management with localStorage persistence
- Created ProfileSwitcher component in sidebar header for quick profile switching
- Added Profiles management section in Settings page with create/delete functionality
- Demo profile feature allows users to try the app with sample data

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
