import { useStats } from "@/hooks/use-stats";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CheckCircle2, AlertTriangle, TrendingUp, Flame, Trophy, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useProfileContext } from "@/contexts/ProfileContext";

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
}

export default function Stats() {
  const { currentProfile } = useProfileContext();
  const { data: stats, isLoading } = useStats(currentProfile?.id);
  const { data: streaks = [], isLoading: streaksLoading } = useQuery<StreakData[]>({
    queryKey: ['/api/streaks', currentProfile?.id],
    queryFn: async () => {
      const queryParams = currentProfile?.id ? `?profileId=${currentProfile.id}` : '';
      const res = await fetch(`/api/streaks${queryParams}`, { credentials: "include" });
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

  const topStreaks = streaks.filter(s => s.currentStreak > 0).slice(0, 5);
  const longestAllTimeStreak = streaks.reduce((max, s) => s.longestStreak > max ? s.longestStreak : max, 0);
  const totalActiveStreaks = streaks.filter(s => s.currentStreak > 0).length;

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

      {topStreaks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Active Streaks
            </CardTitle>
            <CardDescription>Your current consecutive completion streaks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topStreaks.map((streak) => (
                <div key={streak.id} className="flex items-center gap-4" data-testid={`streak-item-${streak.taskId}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{streak.taskTitle}</span>
                      {streak.currentStreak === streak.longestStreak && streak.longestStreak >= 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300">
                          <Trophy className="w-3 h-3 mr-1 text-yellow-500" /> Personal Best
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={Math.min(100, (streak.currentStreak / Math.max(streak.longestStreak, 10)) * 100)} 
                        className="h-2 flex-1" 
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {streak.totalCompletions} total
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
