import { 
  Clock, Target, Flame, AlertCircle, CheckCircle2, Calendar,
  BarChart2, FolderOpen, Tag, ArrowRight, Trophy,
  HelpCircle, Zap, TrendingUp, CalendarDays, Users, Sparkles
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function UserGuide() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">
          User Guide
        </h1>
        <p className="text-muted-foreground">
          Everything you need to know about using Cadences to track your recurring tasks.
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-4" defaultValue="profiles">
        <AccordionItem value="profiles" className="border rounded-xl px-4 bg-card">
          <AccordionTrigger className="text-lg font-semibold" data-testid="accordion-profiles">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              Profiles
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <p className="text-muted-foreground">
              Profiles let you organize your tasks into separate contexts. Each profile has its own tasks, categories, and tags - completely isolated from other profiles.
            </p>
            <div className="grid gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Creating Profiles
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Create profiles for different areas of your life:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Work</Badge>
                    <Badge>Personal</Badge>
                    <Badge>Exercise</Badge>
                    <Badge>Home</Badge>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 mt-2">
                    <p className="text-xs">
                      Go to <strong>Settings</strong>, scroll to <strong>Profiles</strong>, and enter a name to create a new profile.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    Switching Profiles
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Use the profile switcher in the sidebar header to switch between profiles. Each profile shows only its own data.</p>
                  <p className="text-xs">On mobile, the profile switcher is in the top header bar.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    All Profiles View
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Select "All Profiles" in the profile switcher to see an aggregated view of tasks from all your non-demo profiles combined.</p>
                  <p className="text-xs">Note: Demo profile data is excluded from the All Profiles view.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Demo Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Create a Demo profile from Settings to explore the app with sample data. The demo includes:</p>
                  <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                    <li>Daily, weekly, and monthly tasks</li>
                    <li>Exercise tasks with metrics</li>
                    <li>Sample categories and tags</li>
                    <li>Completion history with streaks</li>
                  </ul>
                  <p className="text-xs mt-2">Demo data won't appear in the "All Profiles" view - it's just for testing.</p>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="task-types" className="border rounded-xl px-4 bg-card">
          <AccordionTrigger className="text-lg font-semibold" data-testid="accordion-task-types">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              Task Types
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Interval-Based Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Complete these every X days, weeks, months, or years.</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Every 1 day</Badge>
                    <Badge variant="outline">Every 2 weeks</Badge>
                    <Badge variant="outline">Every 3 months</Badge>
                  </div>
                  <p className="text-xs">
                    Examples: Brush teeth (daily), Change sheets (weekly), Oil change (every 3 months)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Frequency-Based Goals
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>Complete X times per week or month.</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">3x per week</Badge>
                    <Badge variant="secondary">5x per month</Badge>
                  </div>
                  <p className="text-xs">
                    Examples: Exercise 3x/week, Call parents 2x/month
                  </p>
                  <div className="bg-muted/50 rounded-lg p-2 mt-2">
                    <p className="text-xs">
                      <strong>Refractory Period:</strong> For frequency tasks, you can set a minimum time between completions to prevent gaming. 
                      E.g., if you set 60 minutes, doing squats 3 times in 3 minutes only counts as 1 completion toward your weekly goal.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="urgency" className="border rounded-xl px-4 bg-card">
          <AccordionTrigger className="text-lg font-semibold" data-testid="accordion-urgency">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <AlertCircle className="w-5 h-5 text-primary" />
              </div>
              Urgency Status
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <p className="text-muted-foreground">
              Tasks are automatically sorted by urgency based on when they were last completed and their interval. 
              The "due soon" threshold is dynamic - it's 20% of the task's cadence, clamped between 1 and 14 days.
            </p>
            <Card className="bg-muted/50 mb-4">
              <CardContent className="pt-4">
                <p className="text-sm">
                  <strong>Dynamic threshold examples:</strong> A daily task shows "due soon" when less than 1 day remains. 
                  A monthly task (30 days) shows "due soon" when less than 6 days remain. 
                  A yearly task shows "due soon" 14 days before it's due.
                </p>
              </CardContent>
            </Card>
            <div className="grid gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-900/10">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="font-medium">Overdue</p>
                  <p className="text-sm text-muted-foreground">Past the due date. Needs attention now.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10">
                <Clock className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="font-medium">Due Soon</p>
                  <p className="text-sm text-muted-foreground">Due within the next day. Plan to do this soon.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-900/10">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium">Later</p>
                  <p className="text-sm text-muted-foreground">Not due yet. You're on track.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border-l-4 border-l-gray-400 bg-gray-50/50 dark:bg-gray-900/10">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium">Never Done</p>
                  <p className="text-sm text-muted-foreground">New task that hasn't been completed yet.</p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="streaks" className="border rounded-xl px-4 bg-card">
          <AccordionTrigger className="text-lg font-semibold" data-testid="accordion-streaks">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Flame className="w-5 h-5 text-primary" />
              </div>
              Streaks
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <p className="text-muted-foreground">
              Build momentum by completing tasks consistently. Streaks help motivate you to maintain habits.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="h-6">
                  <Flame className="w-3 h-3 mr-1" /> 5
                </Badge>
                <span className="text-sm text-muted-foreground">Standard streak (5 consecutive completions)</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="h-6 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                  <Flame className="w-3 h-3 mr-1 text-orange-500" /> 7
                </Badge>
                <span className="text-sm text-muted-foreground">Week-long streak (orange flame at 7+)</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="h-6 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <Flame className="w-3 h-3 mr-1 text-red-500" /> 30
                </Badge>
                <span className="text-sm text-muted-foreground">Month-long streak (red flame at 30+)</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="h-6 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300">
                  <Trophy className="w-3 h-3 mr-1 text-yellow-500" /> Best
                </Badge>
                <span className="text-sm text-muted-foreground">Personal record - your longest streak for this task</span>
              </div>
            </div>
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <p className="text-sm">
                  <strong>How streaks work:</strong> Complete a task before it becomes overdue to maintain your streak. 
                  You have a grace period of 1.5x the interval to complete it. Miss that window and your streak resets to zero.
                </p>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="metrics" className="border rounded-xl px-4 bg-card">
          <AccordionTrigger className="text-lg font-semibold" data-testid="accordion-metrics">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart2 className="w-5 h-5 text-primary" />
              </div>
              Tracking Metrics
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <p className="text-muted-foreground">
              Add custom metrics to tasks to track data with each completion. Perfect for exercises, measurements, or any value you want to monitor over time.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Exercise Example</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Weight</Badge>
                    <span className="text-muted-foreground">135 lbs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Sets</Badge>
                    <span className="text-muted-foreground">3</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Reps</Badge>
                    <span className="text-muted-foreground">10</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Maintenance Example</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Front Left PSI</Badge>
                    <span className="text-muted-foreground">32</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Front Right PSI</Badge>
                    <span className="text-muted-foreground">32</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Mileage</Badge>
                    <span className="text-muted-foreground">45,230</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            <p className="text-sm text-muted-foreground">
              View metric trends over time in the task history to see your progress.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="organization" className="border rounded-xl px-4 bg-card">
          <AccordionTrigger className="text-lg font-semibold" data-testid="accordion-organization">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderOpen className="w-5 h-5 text-primary" />
              </div>
              Categories & Tags
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <div className="grid gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Categories
                  </CardTitle>
                  <CardDescription>Group tasks by area of life</CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge>Health</Badge>
                    <Badge>Home</Badge>
                    <Badge>Vehicle</Badge>
                    <Badge>Finance</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Tags
                  </CardTitle>
                  <CardDescription>Add labels for flexible filtering</CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">morning</Badge>
                    <Badge variant="secondary">quick</Badge>
                    <Badge variant="secondary">outdoors</Badge>
                  </div>
                </CardContent>
              </Card>

            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="variations" className="border rounded-xl px-4 bg-card">
          <AccordionTrigger className="text-lg font-semibold" data-testid="accordion-variations">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              Task Variations
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <p className="text-muted-foreground">
              Some tasks have multiple ways to complete them. Add variations to track which specific method you used each time.
            </p>
            <Card className="bg-muted/50">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  <span className="font-medium">Squats</span>
                </div>
                <div className="ml-6 space-y-2 border-l-2 border-primary/30 pl-4">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Back Squat</span>
                    <Badge variant="outline" className="text-xs">Variation</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Goblet Squat</span>
                    <Badge variant="outline" className="text-xs">Variation</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Front Squat</span>
                    <Badge variant="outline" className="text-xs">Variation</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">
              When completing a task with variations, you can select which variation you performed. Add variations in the Advanced Options when creating or editing any task type.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="views" className="border rounded-xl px-4 bg-card">
          <AccordionTrigger className="text-lg font-semibold" data-testid="accordion-views">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              Views & Navigation
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <p className="text-muted-foreground">
              Filter tasks by their cadence to focus on what's relevant now.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="p-3 rounded-lg border">
                <p className="font-medium">Dashboard</p>
                <p className="text-sm text-muted-foreground">All tasks sorted by urgency</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="font-medium">Daily</p>
                <p className="text-sm text-muted-foreground">Tasks done every 1-6 days</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="font-medium">Weekly</p>
                <p className="text-sm text-muted-foreground">Tasks done every 1-4 weeks</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="font-medium">Monthly</p>
                <p className="text-sm text-muted-foreground">Tasks done every 1-12 months</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="font-medium">Long-term</p>
                <p className="text-sm text-muted-foreground">Tasks done yearly or less often</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="font-medium">Calendar</p>
                <p className="text-sm text-muted-foreground">See completions on a calendar</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tips" className="border rounded-xl px-4 bg-card">
          <AccordionTrigger className="text-lg font-semibold" data-testid="accordion-tips">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              Tips for Success
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <span>Start with just a few tasks and add more as you build the habit of checking in.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <span>Check the Daily view each morning to see what needs attention today.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <span>Use metrics for exercises and maintenance tasks to track progress over time.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <span>Build streaks for motivation, but don't stress if one breaks - just start again.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                <span>Backdate completions if you forgot to log something - your history stays accurate.</span>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
