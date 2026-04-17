import { useState } from "react";
import { useStats } from "@/hooks/use-stats";
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
            Completions
          </div>
          <div className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-total-completions">{stats?.totalCompletions || 0}</div>
          <p className="text-[11px] text-muted-foreground">all time</p>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            Active Streaks
          </div>
          <div className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-active-streaks">{totalActiveStreaks}</div>
          <p className="text-[11px] text-muted-foreground">tasks on a roll</p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Trophy className="w-3.5 h-3.5 text-yellow-500" />
            Best Streak
          </div>
          <div className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-best-streak">{longestAllTimeStreak}</div>
          <p className="text-[11px] text-muted-foreground">longest ever</p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--urgency-overdue))]" />
            Overdue
          </div>
          <div className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-overdue-rate">{Math.round((stats?.overdueRate || 0) * 100)}%</div>
          <p className="text-[11px] text-muted-foreground">overdue rate</p>
        </div>
      </div>

      {activeStreaks.length > 0 && (
        <section>
          <div className="mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Active Streaks
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ranked by duration — your longest-running habits first
            </p>
          </div>
          <div className="space-y-3">
            {topStreaks.map((streak, index) => (
              <div key={streak.id} className="flex items-center gap-3" data-testid={`streak-item-${streak.taskId}`}>
                <span className="text-xs text-muted-foreground w-5 text-right tabular-nums shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium truncate">{streak.taskTitle}</span>
                    {streak.currentStreak === streak.longestStreak && streak.longestStreak >= 3 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300">
                        <Trophy className="w-3 h-3 mr-1 text-yellow-500" /> Best
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Progress 
                      value={Math.min(100, (streak.currentStreak / Math.max(streak.longestStreak, 10)) * 100)} 
                      className="h-1.5 flex-1 min-w-[60px]" 
                    />
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {streak.duration.label}
                    </span>
                  </div>
                </div>
                <span className={`text-sm font-semibold tabular-nums flex items-center gap-1 ${
                  streak.currentStreak >= 30 
                    ? "text-red-600 dark:text-red-400" 
                    : streak.currentStreak >= 7 
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-muted-foreground"
                }`}>
                  <Flame className={`w-3.5 h-3.5 ${
                    streak.currentStreak >= 30 ? "text-red-500" : streak.currentStreak >= 7 ? "text-orange-500" : "text-muted-foreground/60"
                  }`} />
                  {streak.currentStreak}
                </span>
              </div>
            ))}
          </div>
          {hasMoreStreaks && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowAllStreaks(!showAllStreaks)}
              className="w-full mt-3 text-xs"
              data-testid="button-toggle-streaks"
            >
              {showAllStreaks ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 mr-1.5" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 mr-1.5" />
                  Show All {activeStreaks.length} Streaks
                </>
              )}
            </Button>
          )}
        </section>
      )}

      <section>
        <div className="mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Activity History</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Monthly completions over time</p>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis 
                dataKey="name" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--card))',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  fontSize: '12px',
                }}
              />
              <Bar 
                dataKey="completions" 
                fill="hsl(var(--primary))" 
                radius={[3, 3, 0, 0]}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fillOpacity={index === chartData.length - 1 ? 1 : 0.5} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
