import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import { Loader2, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TaskWithDetails } from "@shared/schema";

interface MetricHistory {
  metricId: number;
  metricName: string;
  taskId: number;
  taskTitle: string;
  unit: string | null;
  values: Array<{
    id: number;
    value: string;
    completedAt: string;
  }>;
}

export default function MetricsPage() {
  const { data: tasks, isLoading: tasksLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/tasks"],
  });

  // Gather all metrics from all tasks
  const allMetrics = tasks?.flatMap(task => 
    (task.metrics || []).map(metric => ({
      ...metric,
      taskId: task.id,
      taskTitle: task.title,
    }))
  ) || [];

  // Fetch history for each metric
  const { data: metricsHistory, isLoading: historyLoading } = useQuery<MetricHistory[]>({
    queryKey: ["/api/metrics/all-history"],
    queryFn: async () => {
      if (!allMetrics.length) return [];
      
      const historyPromises = allMetrics.map(async (metric) => {
        const res = await fetch(`/api/metrics/${metric.id}/history?limit=100`);
        if (!res.ok) return null;
        const values = await res.json();
        return {
          metricId: metric.id,
          metricName: metric.name,
          taskId: metric.taskId,
          taskTitle: metric.taskTitle,
          unit: metric.unit,
          values,
        };
      });
      
      const results = await Promise.all(historyPromises);
      return results.filter(Boolean) as MetricHistory[];
    },
    enabled: allMetrics.length > 0,
  });

  const isLoading = tasksLoading || historyLoading;

  // Calculate trend for a metric
  const calculateTrend = (values: Array<{ value: string }>) => {
    if (!values || values.length < 2) return null;
    
    const numericValues = values
      .map(v => parseFloat(v.value))
      .filter(v => !isNaN(v))
      .slice(0, 10); // Last 10 values
    
    if (numericValues.length < 2) return null;
    
    const recent = numericValues.slice(0, Math.ceil(numericValues.length / 2));
    const older = numericValues.slice(Math.ceil(numericValues.length / 2));
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    return {
      direction: percentChange > 2 ? "up" : percentChange < -2 ? "down" : "stable",
      percentChange: Math.abs(percentChange).toFixed(1),
    };
  };

  // Prepare chart data for a metric
  const prepareChartData = (metric: MetricHistory) => {
    return metric.values
      .map(v => ({
        date: format(new Date(v.completedAt), "MMM d"),
        value: parseFloat(v.value) || 0,
        fullDate: format(new Date(v.completedAt), "MMM d, yyyy h:mm a"),
      }))
      .reverse()
      .slice(-20); // Last 20 data points
  };

  const TrendIcon = ({ direction }: { direction: string }) => {
    if (direction === "up") return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (direction === "down") return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">
          Metrics
        </h1>
        <p className="text-muted-foreground">
          Track trends across all your custom metrics.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !metricsHistory || metricsHistory.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No metrics tracked yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Add custom metrics to your tasks to track things like weight, reps, duration, or any other measurement you want to monitor over time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metricsHistory.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {new Set(metricsHistory.map(m => m.taskId)).size} tasks
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Data Points
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metricsHistory.reduce((sum, m) => sum + m.values.length, 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Recorded measurements
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Trending Up
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">
                  {metricsHistory.filter(m => {
                    const trend = calculateTrend(m.values);
                    return trend?.direction === "up";
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Metrics improving
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Individual Metric Charts */}
          {metricsHistory.map((metric) => {
            const trend = calculateTrend(metric.values);
            const chartData = prepareChartData(metric);
            const latestValue = metric.values[0]?.value;
            
            if (chartData.length === 0) return null;
            
            return (
              <Card key={metric.metricId} data-testid={`metric-card-${metric.metricId}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                        {metric.metricName}
                        {metric.unit && (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {metric.unit}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {metric.taskTitle}
                      </CardDescription>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold">
                        {latestValue}
                        {metric.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{metric.unit}</span>}
                      </div>
                      {trend && (
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <TrendIcon direction={trend.direction} />
                          <span className={`text-xs ${
                            trend.direction === "up" ? "text-green-500" : 
                            trend.direction === "down" ? "text-red-500" : 
                            "text-muted-foreground"
                          }`}>
                            {trend.percentChange}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11 }} 
                          className="text-muted-foreground"
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          tick={{ fontSize: 11 }} 
                          className="text-muted-foreground"
                          width={40}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          labelFormatter={(_, payload) => payload[0]?.payload?.fullDate || ""}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 3 }}
                          activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {metric.values.length} data point{metric.values.length !== 1 ? "s" : ""} recorded
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
