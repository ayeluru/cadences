import { useState } from "react";
import { useStats } from "@/hooks/use-stats";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CheckCircle2, AlertTriangle, Flame, Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useProfileContext } from "@/contexts/ProfileContext";
import { supabase } from "@/lib/supabase";
import { differenceInDays } from "date-fns";

interface StreakData {
  id: number;
  taskId: number;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  lastCompletedAt: string | null;
  streakStartDate: string | null;
  taskTitle: string;
  intervalUnit?: string;
  intervalValue?: number;
}

// Calculate streak duration in human-readable format
function getStreakDuration(streak: StreakData): { days: number; label: string } {
  if (!streak.streakStartDate) return { days: 0, label: "No active streak" };
  
  const now = new Date();
  const startDate = new Date(streak.streakStartDate);
  const days = differenceInDays(now, startDate);
  
  // Format label based on duration and interval
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return { days, label: `${years}+ year${years > 1 ? 's' : ''}` };
  } else if (days >= 30) {
    const months = Math.floor(days / 30);
    return { days, label: `${months} month${months > 1 ? 's' : ''}` };
  } else if (days >= 7) {
    const weeks = Math.floor(days / 7);
    return { days, label: `${weeks} week${weeks > 1 ? 's' : ''}` };
  } else {
    return { days, label: `${days} day${days !== 1 ? 's' : ''}` };
  }
}

export default function Stats() {
  const { currentProfile, isAggregatedView } = useProfileContext();
  const profileId = isAggregatedView ? undefined : currentProfile?.id;
  const [showAllStreaks, setShowAllStreaks] = useState(false);
  const { data: stats, isLoading } = useStats(profileId);
  const { data: streaks = [], isLoading: streaksLoading } = useQuery<StreakData[]>({
    queryKey: ['/api/streaks', isAggregatedView ? 'all' : profileId],
    queryFn: async () => {
      const queryParams = profileId ? `?profileId=${profileId}` : '';
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/streaks${queryParams}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch streaks");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const chartData = stats?.completionsByMonth.map(item => ({
    name: new Date(item.date).toLocaleDateString('default', { month: 'short', year: '2-digit' }),
    completions: item.count
  })).reverse() || [];

  // Sort streaks by elapsed time (days since streak started) - longer duration first
  const activeStreaks = streaks
    .filter(s => s.currentStreak > 0)
    .map(s => ({
      ...s,
      duration: getStreakDuration(s)
    }))
    .sort((a, b) => b.duration.days - a.duration.days);

  const topStreaks = showAllStreaks ? activeStreaks : activeStreaks.slice(0, 5);
  const hasMoreStreaks = activeStreaks.length > 5;
  const longestAllTimeStreak = streaks.reduce((max, s) => s.longestStreak > max ? s.longestStreak : max, 0);
  const totalActiveStreaks = activeStreaks.length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold font-display tracking-tight" data-testid="text-stats-title">Statistics</h2>
        <p className="text-muted-foreground mt-1">Insights into your maintenance habits and streaks.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Completions</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-completions">{stats?.totalCompletions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All time maintenance</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Streaks</CardTitle>
            <Flame className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-active-streaks">{totalActiveStreaks}</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks with active streaks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Streak</CardTitle>
            <Trophy className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-best-streak">{longestAllTimeStreak}</div>
            <p className="text-xs text-muted-foreground mt-1">Longest streak ever</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Rate</CardTitle>
            <AlertTriangle className="w-4 h-4 text-[hsl(var(--urgency-overdue))]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-overdue-rate">{Math.round((stats?.overdueRate || 0) * 100)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks currently overdue</p>
          </CardContent>
        </Card>
      </div>

      {activeStreaks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Active Streaks
            </CardTitle>
            <CardDescription>
              Ranked by time maintained - your longest-running habits first
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {topStreaks.map((streak, index) => (
                <div key={streak.id} className="flex items-center gap-4" data-testid={`streak-item-${streak.taskId}`}>
                  <div className="w-6 text-center text-sm text-muted-foreground font-medium">
                    #{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium truncate">{streak.taskTitle}</span>
                      {streak.currentStreak === streak.longestStreak && streak.longestStreak >= 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300">
                          <Trophy className="w-3 h-3 mr-1 text-yellow-500" /> Personal Best
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Progress 
                        value={Math.min(100, (streak.currentStreak / Math.max(streak.longestStreak, 10)) * 100)} 
                        className="h-2 flex-1 min-w-[60px]" 
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {streak.duration.label} running
                      </span>
                    </div>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`text-sm px-2 h-7 ${
                      streak.currentStreak >= 30 
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" 
                        : streak.currentStreak >= 7 
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                          : ""
                    }`}
                  >
                    <Flame className={`w-4 h-4 mr-1 ${
                      streak.currentStreak >= 30 ? "text-red-500" : streak.currentStreak >= 7 ? "text-orange-500" : ""
                    }`} />
                    {streak.currentStreak}
                  </Badge>
                </div>
              ))}
            </div>
            {hasMoreStreaks && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowAllStreaks(!showAllStreaks)}
                className="w-full"
                data-testid="button-toggle-streaks"
              >
                {showAllStreaks ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Show All {activeStreaks.length} Streaks
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
          <CardDescription>Monthly completion volume over time</CardDescription>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis 
                dataKey="name" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar 
                dataKey="completions" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fillOpacity={index === chartData.length - 1 ? 1 : 0.6} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
