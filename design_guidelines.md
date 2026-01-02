# Task Tracking & Habit Management Application - Design Guidelines

## Design Approach
**System:** Linear-inspired productivity design with Notion's organizational clarity. This utility-focused application prioritizes efficiency, quick scanning, and data density while maintaining visual hierarchy and breathing room.

**Core Principles:**
- Information density without clutter
- Fast visual scanning for task status
- Clear progress indicators and feedback
- Minimal cognitive load for daily interactions

## Typography System

**Font Stack:** Inter (Google Fonts) - single family for cohesion
- Page titles: 2xl, semibold (24px)
- Section headers: xl, semibold (20px)
- Task items: base, medium (16px)
- Metadata/counts: sm, regular (14px)
- Micro-labels: xs, medium (12px)

## Layout & Spacing

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4 to p-6
- Section gaps: gap-6 to gap-8
- List item spacing: space-y-2
- Card padding: p-6

**Grid Structure:**
- Sidebar: 280px fixed width (hidden on mobile)
- Main content: flex-1 with max-w-6xl container
- Task cards: Full width, stacked vertically
- Category grid: grid-cols-2 md:grid-cols-3 lg:grid-cols-4

## Core Components

**Dashboard Layout:**
- Left sidebar: Categories, filters, streak overview
- Main area: Today's tasks, upcoming, completed sections
- Right panel (desktop only): Habit streaks, weekly progress charts

**Task Card:**
- Checkbox (20px) + task title + metadata row (due date, category badge)
- Subtasks indented with connecting lines
- Hover reveals quick actions (edit, delete, reschedule)
- Active tasks: white background, border
- Completed: reduced opacity, strikethrough text

**Category Pills:**
- Rounded-full badges with icon + label
- Size: px-3 py-1.5
- Used in task cards and sidebar filters

**Streak Counter:**
- Large number display (4xl weight: bold)
- Flame icon adjacent
- "day streak" label below
- Weekly mini-calendar showing completion dots

**Habit Tracker Grid:**
- 7-day horizontal strip per habit
- Small squares (24px) showing completion status
- Hover shows date + notes
- Current day highlighted with ring

**Progress Bars:**
- Height: h-2
- Rounded: rounded-full
- Shows daily/weekly completion percentage
- Label with fraction (e.g., "6/10 tasks")

**Quick Add Input:**
- Prominent at top of task list
- Placeholder: "+ Add task or habit"
- Keyboard shortcut indicator (⌘K)
- Expands to show category/recurrence options inline

**Empty States:**
- Centered content with illustration placeholder
- Encouraging message
- Primary action button

**Navigation Sidebar:**
- Compact icon + label list items
- Active state: subtle background fill
- Sections: Today, Upcoming, Categories, Habits, Completed
- Bottom: Settings, user profile

**Modal/Drawer Forms:**
- Task detail editor: Full-height right drawer (400px wide)
- Habit setup: Centered modal (max-w-2xl)
- Form fields: Stacked with consistent gap-4
- Action buttons: Right-aligned, gap-3

## Animations
- Checkbox: Smooth scale + checkmark draw (200ms)
- Task completion: Quick fade + slide (150ms)
- Streak increment: Subtle number count-up
- No scroll-triggered or decorative animations

## Images

**Hero Section:** No traditional hero. Dashboard-first design - users land directly in their task view.

**Empty State Illustrations:** 
- Clean, minimal line-art style illustrations (300x300px)
- Placement: Centered in empty task lists, empty category views
- Style: Simple, encouraging, single-color line drawings

**Profile/Avatar:**
- Top-right corner: 32px circular avatar
- Fallback: Initials on solid background

## Accessibility
- All interactive elements: min-height 44px (touch targets)
- Keyboard navigation: Full support with visible focus rings
- ARIA labels on icon-only buttons
- Color-independent status indicators (icons + patterns)

## Responsive Behavior
- Mobile (<768px): Hide sidebar, show hamburger menu, single column tasks
- Tablet (768-1024px): Collapsible sidebar, 2-column category grid
- Desktop (>1024px): Full three-column layout with persistent sidebar and stats panel

This design delivers a polished, professional productivity application that balances information density with visual clarity, optimized for daily habit tracking and task management workflows.