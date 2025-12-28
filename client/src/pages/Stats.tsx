import { useStats } from "@/hooks/use-stats";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CheckCircle2, AlertTriangle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Stats() {
  const { data: stats, isLoading } = useStats();

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

  // Format chart data
  const chartData = stats?.completionsByMonth.map(item => ({
    name: new Date(item.date).toLocaleDateString('default', { month: 'short', year: '2-digit' }),
    completions: item.count
  })).reverse() || [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold font-display tracking-tight">Statistics</h2>
        <p className="text-muted-foreground mt-1">Insights into your maintenance habits.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Completions</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalCompletions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All time maintenance</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Rate</CardTitle>
            <AlertTriangle className="w-4 h-4 text-[hsl(var(--urgency-overdue))]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Math.round((stats?.overdueRate || 0) * 100)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks currently overdue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            <TrendingUp className="w-4 h-4 text-[hsl(var(--urgency-later))]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats?.completionsByMonth[0]?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tasks completed recently</p>
          </CardContent>
        </Card>
      </div>

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
