# Changelog

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