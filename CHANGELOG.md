# Changelog

## 2.4.20

- **Fixed: new tasks no longer appear on week/month days before they were created**. The week-view planner placed daily-interval, daily-frequency, weekly/monthly frequency pseudo-schedules, scheduled days, and the overdue fallback on every matching day in the visible range, ignoring `task.createdAt` — so a task created mid-week showed up (and could be flagged "missed") on earlier days of the same week. The calendar (month) view had the same issue on its scheduled branch, where a UTC-instant comparison also filtered the task out of its own creation day for users west of UTC. Both views now compare local date-keys against the task's creation date-key, so a brand-new task appears only from its creation day forward

## 2.4.19

- **Frequency tasks now show pacing**. A new "Behind / On pace / Ahead" chip appears next to the title of every frequency task that hasn't yet hit its target this period. The chip is computed server-side from how far along you are in the period (e.g. 5/7 of the week) versus how much of the target you've completed. Color-coded — amber for Behind, neutral for On pace, emerald for Ahead — so the signal reads at a glance
- **Pacing now drives the Today bucket**. A frequency task that's fallen behind goes to **Overdue** — same urgency tier as a missed interval task. A frequency task that's on pace today but will fall behind tomorrow if you don't act gets promoted to **Due today** as a soft nudge ("act today to stay on track"). Ahead-of-pace and on-pace-and-fine tasks stay in **Could do** as optional reps. The bucket is the action signal; the chip is the explanation
- **Could do is now frequency-only**. Interval and scheduled tasks no longer appear in Could do regardless of cadence. Previously a 3-day-interval task completed yesterday would land in Could do (2 days out, within the old 7-day window) and clutter Today view despite already being handled. Now interval and scheduled tasks only appear in Today when they're genuinely actionable: Overdue, Due today, or Due soon (within their cadence-aware threshold)
- **Could do sort: on-pace floats above ahead**. Within the Could do bucket, on-pace tasks come first since they're closer to slipping — ahead-of-pace tasks are optional bonus work and sit lower
- **9 new regression test cases** in the bucket verifier (25 total) covering every pacing transition — Behind → Overdue, will-be-behind-tomorrow → Due today, on-pace + ahead staying in Could do, intervals correctly excluded from Could do

## 2.4.18

- **Today view redesigned with underline tabs**. The six stacked collapsibles are gone — replaced with a single underline tab strip at the top. Action buckets (Overdue, Due today, Could do, Due soon) are always visible with live counts. Not started, Done today, and Paused appear only when they have items, so a clean day doesn't carry empty rows. Default tab is Due today on every load. The tab strip scrolls horizontally on narrow screens
- **Overdue is its own bucket**. Interval and scheduled tasks past their due date now route to a dedicated Overdue tab instead of mixing with on-schedule due-today tasks — the visual distinction between "behind" and "on track" is finally clean. Frequency tasks behind pace stay in Could do, since "overdue" for a soft pace target is misleading. Completing an overdue task today still shows it in Done today (completion always wins the bucket race)
- **Fixed: long-interval tasks completed today no longer disappear from the dashboard**. A 2-week (or longer) interval task completed today would vanish from Today view because the bucketing logic required the task to also be "relevant to today" (next due ≤ 7 days) to land in the Done today bucket. Frequency tasks dodged this via a short-circuit; interval and scheduled tasks didn't. Now any task completed today shows up in Done today regardless of how far out the next occurrence sits — except a daily-frequency task with unmet target, which still nags for the remaining reps
- **Table-driven regression test for Today view bucketing**. `scripts/verify-today-bucket.ts` runs 21 representative task shapes through `getTodayBucket` on every `npm run check`. The asymmetry that caused this PR's bug fix is now permanently captured as a passing test case — future bucket-logic changes get caught at type-check time, not after a user reports a vanishing task

## 2.4.17

- **Fixed: pull-to-refresh fired from any scroll position on mobile**. The mobile layout root has no explicit height constraint, so the document itself scrolls instead of `<main>` — meaning `<main>.scrollTop` stayed at `0` even when visually scrolled, and any downward pull triggered a hard reload. The "at the top" check now consults `document.scrollingElement.scrollTop` alongside the element's own `scrollTop`, and re-checks mid-gesture so a brief upward scroll before pulling down can't accidentally trigger a refresh. Pull-to-refresh now behaves like iOS native — only triggers when you're already at the top of the page

## 2.4.16

- **Hard-reload button in the sidebar and mobile header**. iOS standalone PWAs have no native pull-to-refresh and the persisted React Query cache can leave the UI on stale state with no obvious way out. A new refresh icon is now visible at all times — between the avatar and logout in the desktop sidebar, between the profile switcher and the menu in the mobile header. One tap clears the in-memory query cache, removes the persisted cache from localStorage, signals any waiting service worker to activate, and reloads the page. Brief spinner state on tap so you can see it's working
- **Pull-to-refresh on mobile**. Pulling down from the top of any page now triggers the same hard reload, with an iOS-style spinner indicator that follows the drag, dampens past the threshold, and shifts to the primary color once you've crossed it. The gesture is direction-locked at the first meaningful touch movement so WeekView's horizontal swipes never trigger a fake refresh, and it's disabled while the mobile menu overlay is open

## 2.4.15

- **What's New popup now actually opens on a version bump**. Previously a pulsing dot appeared next to the sidebar version number, but the dialog itself never auto-opened — the auto-open logic was dead code because `false ?? autoOpen` always short-circuits to `false`. The open state now lives in `AppLayout` as the single source of truth, lazy-initialized from `hasUnseenNotes()`, so the dialog appears on first render after each new deploy
- **Release notes dialog leads with the current version**. The dialog now shows the latest version's changes prominently and tucks previous versions behind a "Show older versions (N)" collapsible. Clicking the sidebar version button still opens the same dialog any time, and the older-versions section gives you the full history one click away

## 2.4.14

- **Fixed: WeekView Saturday column was always empty on production**. The new `/api/planner/range` endpoint shipped in 2.4.13 silently dropped the last day of the visible range whenever the server's timezone differed from the user's (i.e. always on Vercel, where the server runs in UTC). The root cause was ad-hoc composition of `parseISO("yyyy-MM-dd")` + `eachDayOfInterval` + `formatInTimeZone` across several handlers — each individually correct, but their composition was timezone-poisoned. The bug never reproduced locally because the dev API server runs in the user's own timezone
- **Isolated server-side timezone primitives in a new `api/_lib/tz.ts` boundary module**. Two value types are now explicit: UTC instants and local date keys ("yyyy-MM-dd" anchored to the user's tz). Helpers (`parseLocalDateKey`, `endOfLocalDateKey`, `formatDateKey`, `localDaysInRange`, `toLocal` / `toUTC`, `nowLocal`, `startOfLocalDay` / `endOfLocalDay`) are the only legal way to cross between them. Every handler that previously stitched these together inline — `plannerRange`, `calendarEnhanced`, the assignments-range endpoint, streaks grace-window math in `streaksIndex`, completion bucketing and streak gap math in `storage.ts`, and the assignment-driven `nextDue` override in `enrichTask` — now goes through the module
- **Lint guard prevents the pattern from coming back**: `scripts/check-tz-boundary.sh` bans `parseISO` / `eachDayOfInterval` / `formatInTimeZone` / `toZonedTime` / `fromZonedTime` outside `api/_lib/tz.ts`. Wired into `npm run check`, so future handlers can't reintroduce ad-hoc timezone handling

## 2.4.13

- **Centralized task scheduling logic**: all the math behind how interval, frequency, and scheduled tasks decide what's due when now lives in one place (`api/_lib/task-utils.ts`). Previously the same concepts were re-implemented across the server enricher, the storage layer, the calendar handler, the weekly planner, and the Daily/Weekly/Monthly/Yearly pages — with subtle disagreements between them. The refactor lands as four commits and ships several behavior fixes that fall out of unifying the implementations
- **Fixed: scheduled "1st of month" tasks were stuck on the Daily Tasks page**. The Daily/Weekly/Monthly/Yearly pages used a client-only categorizer that pinned every scheduled task to Daily regardless of its actual cadence. Pages now filter on a server-computed `cadenceMagnitude` field derived from the unified `getCadenceDays`, so a "1st and 15th of month" task correctly lands in Monthly Tasks (avg cadence 15 days)
- **Fixed: daily-frequency and yearly-frequency tasks were hidden from all four cadence pages**. The old client categorizer only handled `targetPeriod='week'` and `'month'` and silently dropped anything else. These tasks now bucket correctly
- **Fixed: scheduled tasks with `scheduledDaysOfMonth` never appeared in WeekView**. The client-side weekly planner had no branch for day-of-month scheduling, so a "1st of every month" task simply didn't show up in the week containing the 1st. The planner is now sourced from a new `/api/planner/range` endpoint that uses the same occurrence-enumeration helper as the calendar, so day-of-month and "31 on Feb 28" edge cases work consistently
- **Fixed: daily-frequency tasks had a ~547-day streak grace window**. The streak-grace heuristic for frequency tasks fell through to the year-period default when `targetPeriod='day'`, giving daily-frequency tasks a grace window of `365 / targetCount × 1.5`. Streaks on these tasks effectively never broke. Now the grace window is `1.5 × (1 / targetCount)` as intended — existing daily-freq streaks will reset on their next missed day
- **WeekView frequency pseudo-scheduling now uses the server's period bounds**. Previously the client computed its own week/month start, which could disagree with the server at week boundaries and place tasks on slightly different days from one render to the next
- **Dashboard Today buckets are computed server-side**. The Today view's `due_today` / `could_do` / `due_soon` / `never_done` / `completed_today` / `paused` bucketing logic moved from the client into `getTodayBucket`. Visible behavior is unchanged; the bucketing rules now have a single owner
- **New `/api/planner/range` endpoint**: returns per-day natural task occurrences for a date range. Used by WeekView; available for future planner-style views

## 2.4.12

- **Fixed demo data leaking into All Profiles**: switching to the "All Profiles" aggregated view now correctly excludes demo-profile data from the tasks, categories, and tags lists. Previously, `useTasks` / `useCategories` / `useTags` sent neither `profileId` nor `excludeDemo=true` when aggregated, so the API returned every record (including those scoped to demo profiles), which contradicted the documented "fans out across every non-demo profile" behavior. The hooks now append `excludeDemo=true` whenever `isAggregatedView` is set, and the `categoriesIndex` / `tagsIndex` handlers thread that flag through to storage. Stats, streaks, and calendar were already correct
- **Demo banner button + sparkles icon polish**: the "Exit demo" / "Create a real profile" CTA now uses the same gradient-pill aesthetic as the rest of the redesigned controls (gradient amber background, soft amber shadow, hover lift, active scale-down) instead of the stock outline button. The leading Sparkles icon is now wrapped in a matching gradient avatar tile so the banner reads as one cohesive piece

## 2.4.11

- **Fixed WeekView per-day completion display**: completing a task on a new day no longer erases the prior day's "done" indicator. WeekView now reads completion history from `/api/completions/calendar` and looks up "done on day" per-cell, so a daily task completed on Wed and again on Thu correctly shows ✓ on both days. Previously, `isTaskDoneOnDay` short-circuited on `targetPeriod==='day'` frequency tasks (returning the same value for every day in the week) and fell back to `lastCompletedAt` (which only stores the most recent completion) for interval/scheduled tasks — causing earlier completions to vanish from the grid. Past weeks now also surface their full historical completions instead of just the latest one
- **Optimistic completion patches WeekView immediately**: `useCompleteTask` now optimistically updates the calendar query cache, so completing a task (including backdated completions from WeekView itself) flips the cell to ✓ instantly without waiting for a network round-trip
- **Renamed task type tabs**: "Every X Days" → **Interval**, "X Per Week" → **Frequency**, with one-line descriptions added under each tab (Interval, Frequency, and Scheduled) explaining when to pick each — clearer mental model for new tasks
- **Renamed "Never Done" → "Not Yet Started"**: friendlier label across the Today view, All Tasks view, Tasks-by-Magnitude page, individual TaskCard status, and the User Guide. Internal status enum unchanged
- **Calendar shows full missed-task history**: navigating to past months now surfaces every missed cycle/occurrence, not just a single entry on the original `nextDue`. Interval tasks walk every cycle from `lastCompletedAt` (or `createdAt`) forward through today and place a missed entry on each cycle's due date — so a daily task last done two months ago now shows ~60 missed marks spread across those months. Scheduled tasks iterate every day-of-week / day-of-month occurrence in the visible range and mark a miss on any past day with no completion. Frequency-task period accounting unchanged
- **Persistent demo-mode banner**: switching to a demo profile now displays an amber banner across every page identifying demo mode and offering a one-click "Exit demo" that switches back to a real profile. The banner is sticky to the top of the working area so it remains visible while scrolling
- **Profile switcher redesign**: the trigger is now a rounded-pill control with a gradient avatar tile (initial-of-name for real profiles, Sparkles for demo, Layers for All Profiles). The dropdown groups options into "All Profiles", "Your profiles", and "Demo" sections — demo gets its own labeled section with amber theming so it's no longer visually indistinguishable from real profiles
- **Settings timezone control**: replaced the generic outline button with a styled rounded-pill matching the new switcher, with a Globe avatar tile and the GMT offset surfaced in a tabular-numerals chip on both the trigger and the in-popover items
- **Calendar view aesthetic refresh**: the heat-map source picker (Balance / Completed / Missed / Upcoming) is now a single segmented pill control with a primary-gradient active state instead of four detached buttons. The month nav is grouped into a matching rounded container and the middle button now shows a "Today" label alongside the calendar icon

## 2.4.10

- **Service worker for instant repeat launches**: Cadences is now a real PWA — `vite-plugin-pwa` precaches the app shell so iPhone home-screen launches no longer pay the network roundtrip for HTML/JS/CSS on every cold start. Updates apply on next session via `registerType: autoUpdate`. iOS 16.4+ devices benefit; older fall back to the previous behavior
- **Persisted React Query cache**: query results now hydrate from `localStorage` on launch, so the dashboard renders with last-known tasks/profiles/categories immediately while the app revalidates silently in the background. iOS aggressively evicts standalone PWAs from memory, so without persistence every cold launch was re-fetching everything despite `staleTime: Infinity`. Cache busts on app version change and is cleared on sign-out so user A's data never shows for user B on the same device
- **Trimmed Google Fonts**: dropped 23 unused font families from the `index.html` font request; only DM Sans and Outfit (weights 400-700, no italics) are now loaded. Removed the duplicate `@import` in `index.css` that was loading the same fonts a second time

## 2.4.9

- **Calendar "Upcoming" cleanup**: in-progress frequency tasks no longer show on today's "Upcoming" bucket. The calendar's Upcoming section now only contains tasks with hard due dates (interval and scheduled) — much quieter and more accurate to the label

## 2.4.8

- **Calendar correctness — timezone bucketing**: completions are now bucketed into the user's local YYYY-MM-DD instead of UTC. Evening completions in non-UTC timezones (most users) no longer slip onto the next day's square or fall outside the visible range
- **Calendar correctness — frequency-task miss accounting**: frequency tasks (X per week / month) are no longer marked "missed" every day they're behind pace. They're only marked missed once a period closes with the target unmet, attributed to the period's last day. While the period is open they show as a soft "due soon" cue on today's square
- **Documentation refresh**: CLAUDE.md updated to reflect the React Query session-cache convention, optimistic-update pattern, lazy-loaded routes, multi-profile model, no-test/no-ESLint reality, and the GitHub auto-deploy flow

## 2.4.7

- **DB connection pool bump**: raised the postgres.js `max` on serverless from 3 to 10 to allow more of the dashboard's batched queries to run in parallel. Saves ~150ms on the warm-path dashboard load
- **CLAUDE.md refresh**: documentation now reflects the GitHub auto-deploy flow, local JWKS auth, paused task state, timezone scheduling, and the full set of DB tables

## 2.4.6

- **Top-of-page loading bar**: a thin animated bar appears at the very top of the viewport whenever any API request or mutation is in flight, giving constant feedback during page loads, completions, and cache revalidations
- **Mobile sidebar version + What's New**: the changelog launcher and version label now appear in the mobile menu footer (previously only on desktop). The button is correctly positioned above the bottom nav and clears the iPhone home indicator
- **Mobile menu scroll lock**: opening the menu now locks the page behind it — touch-scrolls inside the menu no longer bleed through to the page underneath
- **Settings: Timezone row layout on mobile**: the row now stacks vertically on phone-width viewports so the description text no longer overflows next to the fixed-width timezone picker

## 2.4.5

- **Faster authenticated requests**: `verifyAuth` now verifies JWTs locally against Supabase's published JWKS instead of round-tripping to Supabase Auth on every request, saving ~150ms per call. Falls back to the HTTP verification path if local verification fails (e.g. during a key rotation window)
- **Higher serverless DB concurrency**: bumped the postgres.js connection pool from `max: 1` to `max: 3` on Vercel. The single-connection limit was a defensive choice from earlier Supavisor scares; the dashboard's batched queries can now actually run in parallel

## 2.4.4

- **Fixed admin page timeout (resolved)**: the admin user list now reliably loads on production. Two changes: (1) replaced the `SELECT * FROM public.list_auth_users()` strategy with a direct GoTrue HTTP call, eliminating the connection-pool deadlock from queries leaked via `Promise.race` timeouts; (2) serialized the `Promise.all` that fetched `user_roles` and `user_activity` — pipelined queries through the Supavisor transaction pooler were stalling the single serverless connection indefinitely

## 2.4.3

- **Attempted admin page fix**: introduced a SECURITY DEFINER SQL function (`public.list_auth_users`) and an HTTP fallback for listing auth users. Did not fully resolve the production hang — superseded by 2.4.4

## 2.4.2

- **Fixed serverless performance**: removed `touchLastActive` DB write from the task loading hot path (now only fires on task completion), deduplicated `getUserSettings` queries, and added connection/query timeouts to prevent 60-second hangs

## 2.4.1

- **Fixed admin page timeout**: replaced `supabaseAdmin.auth.admin.listUsers()` HTTP call — which was hanging on Vercel — with a direct `auth.users` database query

## 2.4.0

- **Task pausing**: pause individual tasks indefinitely or until a specific date — paused tasks are hidden from the Today view and grouped in a collapsible "Paused" section
- **Vacation mode**: global toggle in Settings that pauses all tasks at once, with an optional end date; a banner shows on the Dashboard while active
- **Streak preservation**: streaks are frozen during pauses and resume cleanly — no streak loss for time away
- **Pause UI**: pause/resume actions in the task card dropdown menu, with a date-picker dialog for scheduled pauses
- **Fixed resume scheduling**: ending vacation no longer marks all tasks as "done for today" — `resumedAt` is now only used for streak grace windows, not for shifting `nextDue` calculations

## 2.3.1

- **Fixed serverless timeout**: moved activity tracking out of `verifyAuth` to prevent deadlocking the single DB connection on Vercel, which caused 60-second timeouts on all authenticated endpoints

## 2.3.0

- **Last active tracking in admin view**: each user row now shows when they were last active (e.g. "5m ago", "3d ago"), tracked via a `user_activity` table updated on every authenticated API request

## 2.2.4

- **Fixed frequency tasks incorrectly showing as Due Today**: frequency tasks whose pseudo-scheduled date passed (e.g. yesterday) no longer get force-promoted to "Due Today" — they correctly route to "Could Do" instead, since they remain completable anytime within the period

## 2.2.3

- **Today View "Could Do" section for frequency tasks**: non-daily frequency tasks with incomplete progress now appear in "Could Do" on non-pseudo-scheduled days instead of being hidden
- **"Suggested" indicator for pseudo-scheduled frequency tasks**: frequency tasks that land in "Due Today" via pseudo-scheduling show a dashed border and "Suggested" badge to distinguish them from hard-due tasks
- **Prevented section overlap**: added `!wouldBeCouldDo` guard to `wouldBeDueSoon` so tasks don't appear in multiple sections

## 2.2.2

- **Fixed missing "Could Do" and "Due Soon" sections**: `daysUntilDue` now uses calendar-day difference in the user's timezone instead of raw 24-hour periods, so tasks due tomorrow correctly get `daysUntilDue = 1` regardless of the time of day

## 2.2.1

- **Fixed aggressive overdue marking**: interval tasks now snap to end-of-day (11:59 PM local) instead of start-of-day (midnight), so tasks stay "due today" throughout the day and only become "overdue" after the day ends

## 2.2.0

- **Timezone-aware task scheduling**: all task due dates, completion tracking, and period boundaries (day/week/month) now respect the user's local timezone instead of defaulting to UTC
- **User timezone settings**: new `user_settings` table and Settings page section with searchable timezone combobox; auto-detects browser timezone on first visit
- **Shared date utilities**: centralized `client/src/lib/tz.ts` module (`toLocal`, `nowLocal`, `formatDateKey`, `formatLocal`) used across all views for consistent timezone handling
- **Server-side timezone enrichment**: `enrichTask`, `getPeriodBounds`, and all API handlers thread the user's timezone through period calculations, completion date mapping, and streak logic
- **Fixed backdated completions**: completions on past days now correctly appear on the intended calendar day in WeekView for all task types (interval, frequency, scheduled)
- **Fixed interval task projection**: "every N days" tasks now show all future occurrences within the week, not just the next due date
- **Fixed optimistic update for frequency tasks**: `useCompleteTask` now optimistically updates `recentCompletionDates` so completion dots appear immediately
- **Fixed double timezone conversion**: removed incorrect `fromZonedTime` calls in CompleteTaskDialog and TaskHistoryDialog that shifted completion timestamps by the timezone offset
- **Proper error reporting**: user settings API handlers now log and return errors instead of silently falling back to UTC

## 2.1.2

- **Calendar page aesthetic refresh**: updated to match the site-wide design language — lighter open layout (`bg-card border rounded-xl`) instead of heavy Card blocks, `max-w-4xl` width constraint, `tracking-tight` header, theme CSS variable colors (`--urgency-*`) for accent stripes, softer heatmap opacity values, and fixed non-standard Tailwind classes (`bg-green-150`, etc.)
- **Heatmap filter buttons**: moved to a dedicated full-width row below the page title; evenly distributed via `grid-cols-4`
- **Day detail sections**: collapsible triggers use subtle bordered style with left-border urgency stripes instead of solid colored backgrounds

## 2.1.1

- **Mobile bottom bar active indicator**: top-edge colored bar with primary-colored icon/text replaces subtle color-only highlight
- **Mobile nav: "Home" renamed to "Dashboard"** to match desktop sidebar
- **Mobile More menu**: opening More deactivates the current page highlight; tapping the current page closes the menu and re-highlights it
- Bottom bar items now explicitly close the More menu on tap (fixes menu staying open when tapping current route)

## 2.1.0

- **Unified scheduling engine**: `enrichTask` is the single source of truth for `nextDue`, respecting all manual assignments across TodayView, WeekView, and Cadences
- **Server-computed `effectiveDueToday`**: eliminates client-side assignment logic in Dashboard for cleaner, consistent "Due Today" determination
- **Frequency task auto-scheduling**: pseudo-dated instances appear on WeekView calendar columns with dashed-border styling
- **Completion calendar**: all frequency task completions shown on their respective days via `recentCompletionDates`
- **Missed task handling**: past incomplete tasks show a red X icon; clicking offers backdate completion (immovable) or move/backdate choice (movable)
- **Hover tooltips with delay**: hovering over WeekView cards shows bold text + darker border immediately; detail tooltip appears after 800ms with task info and action hints
- **View filters**: segmented controls for Done (show/hide), Immovable (show/highlight/hide), and Movable (show/highlight/hide) with distinct highlight colors
- **Day columns fill viewport**: weekly grid fills available height without page scrollbar; individual days scroll when overflowing
- **Refractory period enforcement**: API rejects completions within the refractory window (429 error) instead of silently ignoring them
- **Refractory period UI**: checkbox-based control in Create/Edit dialogs; editing does not retroactively invalidate past completions
- **"Day" frequency period**: added Day option for frequency tasks (e.g. 8x/day)
- **Undo/Reset clarity**: labeled buttons replace ambiguous icons; Reset requires two-click confirmation
- Backdate completion flow uses AlertDialog confirmation before opening CompleteTaskDialog
- Improved API error messages with parsed JSON error responses
- Fixed frequency pseudo-date distribution formula (centered within slots)
- Fixed timezone mismatch for completion date keys (server now uses local time)
- Fixed daily frequency tasks staying in "Completed Today" after one completion

## 2.0.0

- **Weekly planner**: 7-day calendar grid with auto-populated tasks from schedules/intervals; completed unscheduled tasks appear on the calendar at their completion date
- **Task rearranging**: move tasks between days with undo and reset; dedicated "Rearrange" mode highlights movable tasks and valid destinations
- **Today view**: focused daily view with Due Today, Could Do, Due Soon sections and daily progress tracking
- **Dashboard tabs**: restructured into Today, This Week, and All Tasks views
- **Week-aware Today view**: tasks moved to/from today in the weekly planner are reflected in the Today tab
- **Frequency task tracking**: partially-done frequency tasks show completion progress (e.g. "2/3") in the unscheduled section; fully-done tasks placed on calendar at completion date
- **Dynamic layout**: weekly grid fills available viewport height automatically
- Task assignments backend with create, list, delete, and week-reset API endpoints
- Override assignments preserve original date for accurate undo
- Task enrichment includes `completedToday` flag and assignment overrides for `nextDue` calculation
- Auth session timeout handling prevents indefinite loading on flaky connections
- Fixed dev API server: request body now consumed for all HTTP methods (fixes 405 on DELETE)
- Fixed prod→dev sync: migration tracking included in dump/restore cycle
- Fixed migration 0006 to use `IF NOT EXISTS` for idempotent enum values

## 1.10.1

- Fix feedback status dropdown on production: applied missing enum migration (needs_info, duplicate, backlog, released)
- Add error toasts to all feedback mutation hooks so API failures are no longer silent

## 1.10.0

- Edit Task dialog now matches the Create Task dialog layout: same section ordering, DialogDescription, collapsible Advanced Options, inline tag creation, and consistent icon usage
- Past completions can now be edited: date/time, notes, variation, and metric values can all be updated from the task history timeline
- Metric names and units can now be renamed inline from the edit task dialog — changes apply retroactively to all historical data without data loss
- Deleting a metric now shows a confirmation warning that historical values will be lost
- Added PATCH endpoint for completions with full metric value upsert support
- Added PATCH endpoint for metrics to update name and unit
- Streak and lastCompletedAt are automatically recalculated when a completion's date is changed

## 1.9.2

- Account deletion now fully cleans up feedback submissions, votes, comments, and role records (previously only cascade-deleted profile data)

## 1.9.1

- Expanded feedback statuses from 6 to 10: added Needs Info, Duplicate, Backlog, and Released
- Feedback list performance: replaced 3N+1 individual queries with 4 batched queries
- Completed/closed feedback items (Done, Released, Declined) are now collapsed by default with a toggle to reveal them
- Terminal feedback items appear with reduced opacity, strikethrough title, and a checkmark icon
- Feedback detail page shows a contextual banner for completed, shipped, or declined items
- "Needs Info" items now count as unreviewed alongside "New" items in admin stats

## 1.9.0

- Users can now change their own password from the Account page (verifies current password first)
- Admins can reset any user's password from the Admin panel (requires typing RESET to confirm)
- Admins can permanently delete any user's account from the Admin panel (requires typing DELETE to confirm)
- Both admin actions are blocked for the admin's own account to prevent accidents
- Redesigned Account page: flat section-based layout, consistent with rest of the app

## 1.8.4

- Redesigned task history timeline: lightweight vertical timeline replaces heavy bordered cards
- Lightened Statistics page: flat metric blocks, cleaner streaks list, borderless chart
- Lightened Metrics page: flat summary stats, section dividers instead of card wrappers, pill-style toggles
- Rewrote User Guide for clarity and concision; removed card-heavy layout
- Lightened Admin page: flat stats, section-based layout, slimmer user rows

## 1.8.3

- Fixed task history not loading (missing auth headers on API request)
- Fixed metrics not saving on task creation or edit (same auth issue)
- Fixed variations not loading or saving in edit dialog (same auth issue)
- Fixed error state for history dialog (no longer shows "no completions" on failure)
- Sped up history loading by batching metric value queries (was N+1, now single query)
- Prevented creating frequency tasks without specifying a count
- Category and tags are now top-level fields in create task dialog (not hidden in Advanced)
- New categories created during task creation/edit now auto-assign to the task
- Added inline "New" category creation to the edit task dialog
- Mobile: scroll resets to top on page navigation (no more landing mid-page)
- Mobile: FAB on feedback page now opens the feedback form instead of task creation
- Extracted SubmitFeedbackDialog to shared component

## 1.8.2

- Redesigned app icon: bold white wave motif on teal-green background
- Icon scales cleanly from favicon (32px) to iOS home screen (180px) to splash (512px)

## 1.8.1

- Branded app icon replacing generic placeholder favicon
- Web app manifest and iOS meta tags for proper "Add to Home Screen" experience
- Standalone display mode, theme-color, and safe-area-inset handling on iOS

## 1.8.0

- Tag deletion with confirmation dialog and task count
- Category deletion now shows how many tasks will become uncategorized
- Combined category + tag filter dropdown on Dashboard and Tasks by Magnitude
- Filter dropdown stays open for multi-select
- Dynamic overlap counts — selecting a tag updates category counts and vice versa
- "Showing X of Y tasks" total in filter dropdown
- Task magnitude pages show counts scoped to that magnitude only
- Category filtering is now instant (client-side instead of API refetch)
- "Uncategorized" filter option for tasks without a category
- Folder and Tag icons on TaskCards for visual distinction
- DELETE /api/tags/:id endpoint for tag management

## 1.7.3

- Streaks use calendar-day comparison instead of raw millisecond diff (fixes midnight edge cases)
- Fixed frequency task grace window: uses per-completion interval instead of full period
- Scheduled task streaks survive normal schedule gaps (e.g. Fri to Mon)
- Backdated completions no longer alter streak count or overwrite lastCompletedAt
- Passive streak expiry at read time — stale streaks show as broken
- Deleting a completion recalculates streak from remaining history
- Same-day completions no longer double-increment streak

## 1.7.2

- Auto-create "Personal" profile on first login so users never land with no profile
- Fixed profile auto-switch after creating a new profile or demo profile
- Demo profile dropdown stays open with spinner during creation
- Optimized demo data seeding with batch inserts (3 months of data)
- Fixed demo seeding crash from missing unique constraint on task_streaks
- Dev API server no longer crashes on transient database timeouts

## 1.7.1

- Fixed profile creation failing due to missing slug generation
- Fixed "Copy tasks from" import not completing before profile switch

## 1.7.0

- Streamlined settings page: flat layout with all sections visible at a glance
- Profiles displayed as a list with dropdown menus for actions (mobile-friendly)
- Categories and tags unified into an "Organization" section with parallel UI patterns
- Added descriptions explaining when to use categories vs tags
- Danger Zone section with clear destructive action styling

## 1.6.0

- Name collection at signup — new users now provide their first and last name
- Existing users without a name are prompted to set one on login
- Added "What's New" release notes dialog accessible from the sidebar

## 1.5.1

- Fixed slow page loads by optimizing database queries and user profile resolution
- Improved caching for feedback stats

## 1.5.0

- Added Feedback Board for submitting and voting on feature requests and bug reports
- Added Admin Panel with user role management
- Admin comments are badged and can be pinned as official responses
- Submissions start private until reviewed and made public by an admin
- Status and visibility filters on the feedback board

## 1.4.2

- Fixed stale session handling: expired tokens are detected and force re-login

## 1.4.1

- Fixed auth session bugs: expired tokens, sign-out persistence

## 1.4.0

- Added user display name support and separate Account page

## 1.3.0

- Negative day-of-month values now display as readable text (e.g. "last day")
- Restructured scheduled task creation with clear weekday/monthly sections

## 1.2.1

- Added mobile bottom navigation bar
- One-click quick-complete for simple tasks
- Fixed stats to show aggregate data in All Profiles view
- Added inline validation for scheduled task creation
- Fixed scheduled tasks appearing in wrong cadence view

## 1.2.0

- New slate green color palette
- Smooth page transitions

## 1.1.0

- Auto-sync production database into dev on startup
- Database safety infrastructure and local dev tooling

## 1.0.0

- Initial release
- Recurring task tracking with interval, frequency, and scheduled types
- Multi-profile support
- Dashboard with urgency-based task sorting
- Calendar view, statistics, and metrics
- Category and tag organization