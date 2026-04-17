import { 
  Clock, Target, Flame, AlertCircle, CheckCircle2, Calendar,
  BarChart2, FolderOpen, Tag, ArrowRight, Trophy,
  Zap, TrendingUp, CalendarDays, Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function UserGuide() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-1">
          User Guide
        </h1>
        <p className="text-muted-foreground text-sm">
          How to get the most out of Cadences.
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-2" defaultValue="profiles">
        {/* Profiles */}
        <AccordionItem value="profiles" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3" data-testid="accordion-profiles">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Profiles
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-6 space-y-4 text-sm text-muted-foreground">
            <p>
              Profiles separate your tasks into independent contexts — each with its own tasks, categories, and tags.
            </p>
            <div className="space-y-3 pl-1">
              <div>
                <p className="font-medium text-foreground text-xs mb-1">Creating profiles</p>
                <p>Go to <strong>Settings → Profiles</strong> and enter a name. Common setups:</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge variant="secondary" className="text-xs">Work</Badge>
                  <Badge variant="secondary" className="text-xs">Personal</Badge>
                  <Badge variant="secondary" className="text-xs">Exercise</Badge>
                  <Badge variant="secondary" className="text-xs">Home</Badge>
                </div>
              </div>
              <div>
                <p className="font-medium text-foreground text-xs mb-1">Switching profiles</p>
                <p>Use the profile switcher in the sidebar (or top header on mobile). Each profile only shows its own data.</p>
              </div>
              <div>
                <p className="font-medium text-foreground text-xs mb-1">All Profiles view</p>
                <p>Select "All Profiles" to see tasks from every profile combined (except demo profiles).</p>
              </div>
              <div>
                <p className="font-medium text-foreground text-xs mb-1">Demo profile</p>
                <p>Create one from Settings to explore the app with sample data — daily/weekly/monthly tasks, metrics, streaks, and more. Demo data never appears in the All Profiles view.</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Task Types */}
        <AccordionItem value="task-types" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3" data-testid="accordion-task-types">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Task Types
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-6 space-y-4 text-sm text-muted-foreground">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="font-medium text-foreground flex items-center gap-1.5 text-xs mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Interval-based
                </p>
                <p>Recurs every X days, weeks, months, or years. The next due date is calculated from your last completion.</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant="outline" className="text-[11px]">Every 1 day</Badge>
                  <Badge variant="outline" className="text-[11px]">Every 2 weeks</Badge>
                  <Badge variant="outline" className="text-[11px]">Every 3 months</Badge>
                </div>
                <p className="text-xs mt-1.5 text-muted-foreground/70">
                  e.g. brush teeth, change sheets, oil change
                </p>
              </div>

              <div>
                <p className="font-medium text-foreground flex items-center gap-1.5 text-xs mb-1.5">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  Frequency-based
                </p>
                <p>Hit a target number of completions per week or month. A progress bar tracks how close you are.</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge variant="secondary" className="text-[11px]">3× per week</Badge>
                  <Badge variant="secondary" className="text-[11px]">5× per month</Badge>
                </div>
                <p className="text-xs mt-1.5 text-muted-foreground/70">
                  e.g. exercise 3×/week, call parents 2×/month
                </p>
                <p className="text-xs mt-2 bg-muted/50 rounded-md px-2.5 py-1.5">
                  <strong>Refractory period:</strong> optional minimum time between completions to prevent rapid-fire logging. Useful for exercise tasks.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Urgency */}
        <AccordionItem value="urgency" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3" data-testid="accordion-urgency">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              Urgency & Status
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-6 space-y-4 text-sm text-muted-foreground">
            <p>
              Tasks are auto-sorted by urgency. The "due soon" window is 20% of a task's interval, clamped to 1–14 days.
              A daily task becomes "due soon" with 1 day left; a monthly task with ~6 days left; yearly tasks with 14 days left.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 py-1.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <div>
                  <span className="font-medium text-foreground text-xs">Overdue</span>
                  <span className="text-xs ml-2">— past due, needs attention now</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 py-1.5">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <span className="font-medium text-foreground text-xs">Due Soon</span>
                  <span className="text-xs ml-2">— coming up, plan for it</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 py-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <div>
                  <span className="font-medium text-foreground text-xs">Later</span>
                  <span className="text-xs ml-2">— not due yet, you're on track</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 py-1.5">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <span className="font-medium text-foreground text-xs">Never Done</span>
                  <span className="text-xs ml-2">— newly created, not yet completed</span>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Streaks */}
        <AccordionItem value="streaks" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3" data-testid="accordion-streaks">
            <span className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" />
              Streaks
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-6 space-y-4 text-sm text-muted-foreground">
            <p>
              Complete a task before it becomes overdue to maintain your streak. Miss the window (1.5× the interval) and it resets.
            </p>
            <div className="space-y-2 pl-1">
              <div className="flex items-center gap-2.5">
                <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                  <Flame className="w-3 h-3 mr-0.5" /> 5
                </Badge>
                <span className="text-xs">Standard streak</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Badge className="h-5 text-[10px] px-1.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                  <Flame className="w-3 h-3 mr-0.5 text-orange-500" /> 7
                </Badge>
                <span className="text-xs">7+ streak (orange)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Badge className="h-5 text-[10px] px-1.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <Flame className="w-3 h-3 mr-0.5 text-red-500" /> 30
                </Badge>
                <span className="text-xs">30+ streak (red)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Badge variant="outline" className="h-5 text-[10px] px-1.5 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300">
                  <Trophy className="w-3 h-3 mr-0.5 text-yellow-500" /> Best
                </Badge>
                <span className="text-xs">Your personal record for this task</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Metrics */}
        <AccordionItem value="metrics" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3" data-testid="accordion-metrics">
            <span className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Metrics
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-6 space-y-4 text-sm text-muted-foreground">
            <p>
              Attach custom metrics to any task to log data with each completion — weight, reps, duration, mileage, etc.
              View trends over time in task history or the dedicated Metrics page.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="font-medium text-foreground text-xs mb-2">Exercise example</p>
                <div className="space-y-1">
                  <p className="text-xs"><span className="text-muted-foreground">Weight:</span> <span className="text-foreground font-medium">135 lbs</span></p>
                  <p className="text-xs"><span className="text-muted-foreground">Sets:</span> <span className="text-foreground font-medium">3</span></p>
                  <p className="text-xs"><span className="text-muted-foreground">Reps:</span> <span className="text-foreground font-medium">10</span></p>
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="font-medium text-foreground text-xs mb-2">Maintenance example</p>
                <div className="space-y-1">
                  <p className="text-xs"><span className="text-muted-foreground">Tire PSI:</span> <span className="text-foreground font-medium">32</span></p>
                  <p className="text-xs"><span className="text-muted-foreground">Mileage:</span> <span className="text-foreground font-medium">45,230</span></p>
                </div>
              </div>
            </div>
            <p className="text-xs">
              Add metrics via <strong>Advanced Options</strong> when creating or editing a task.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Categories & Tags */}
        <AccordionItem value="organization" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3" data-testid="accordion-organization">
            <span className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              Categories & Tags
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-6 space-y-3 text-sm text-muted-foreground">
            <div className="space-y-3 pl-1">
              <div>
                <p className="font-medium text-foreground flex items-center gap-1.5 text-xs mb-1">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Categories
                </p>
                <p>Each task belongs to at most one category. Use them for broad areas:</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge variant="secondary" className="text-xs">Health</Badge>
                  <Badge variant="secondary" className="text-xs">Home</Badge>
                  <Badge variant="secondary" className="text-xs">Vehicle</Badge>
                  <Badge variant="secondary" className="text-xs">Finance</Badge>
                </div>
              </div>
              <div>
                <p className="font-medium text-foreground flex items-center gap-1.5 text-xs mb-1">
                  <Tag className="w-3.5 h-3.5" />
                  Tags
                </p>
                <p>A task can have multiple tags. Use them for cross-cutting labels:</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge variant="outline" className="text-xs">morning</Badge>
                  <Badge variant="outline" className="text-xs">quick</Badge>
                  <Badge variant="outline" className="text-xs">outdoors</Badge>
                </div>
              </div>
            </div>
            <p className="text-xs">
              Filter by category and/or tags on the Dashboard using the Filter button.
              You can create new categories inline during task creation or editing.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Variations */}
        <AccordionItem value="variations" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3" data-testid="accordion-variations">
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Variations
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-6 space-y-3 text-sm text-muted-foreground">
            <p>
              When a task can be done different ways, add variations to track which method you used each time.
            </p>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="font-medium text-foreground text-xs flex items-center gap-1.5 mb-2">
                <Target className="w-3.5 h-3.5 text-primary" />
                Squats
              </p>
              <div className="ml-4 space-y-1 border-l-2 border-primary/20 pl-3">
                <p className="text-xs flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-muted-foreground" /> Back Squat</p>
                <p className="text-xs flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-muted-foreground" /> Goblet Squat</p>
                <p className="text-xs flex items-center gap-1.5"><ArrowRight className="w-3 h-3 text-muted-foreground" /> Front Squat</p>
              </div>
            </div>
            <p className="text-xs">
              When completing a task with variations, you'll be prompted to select which one you did.
              Add variations in Advanced Options when creating or editing a task.
            </p>
          </AccordionContent>
        </AccordionItem>

        {/* Views */}
        <AccordionItem value="views" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3" data-testid="accordion-views">
            <span className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Views
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-6 space-y-3 text-sm text-muted-foreground">
            <p>Navigate by cadence to focus on what's relevant.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs pl-1">
              <div><span className="font-medium text-foreground">Dashboard</span> — all tasks by urgency</div>
              <div><span className="font-medium text-foreground">Daily</span> — every 1–6 days</div>
              <div><span className="font-medium text-foreground">Weekly</span> — every 1–4 weeks</div>
              <div><span className="font-medium text-foreground">Monthly</span> — every 1–12 months</div>
              <div><span className="font-medium text-foreground">Yearly</span> — yearly or less often</div>
              <div><span className="font-medium text-foreground">Calendar</span> — completion history</div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Tips */}
        <AccordionItem value="tips" className="border-b-0">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3" data-testid="accordion-tips">
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Tips
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-6 text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span>Start with a few tasks. Add more as the habit sticks.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span>Check the Daily view each morning for what needs attention.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span>Use metrics on exercise or maintenance tasks to see progress over time.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span>Don't stress about broken streaks — just start again.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span>You can backdate completions if you forgot to log something.</span>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
