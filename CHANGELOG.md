# Changelog

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