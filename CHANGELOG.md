# Changelog

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