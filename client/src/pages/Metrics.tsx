import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, TrendingUp, TrendingDown, Minus, Activity, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(200, 90%, 50%)",
  "hsl(350, 80%, 55%)",
];

export default function MetricsPage() {
  const { data: tasks, isLoading: tasksLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/tasks"],
  });

  const allMetrics = tasks?.flatMap(task => 
    (task.metrics || []).map(metric => ({
      ...metric,
      taskId: task.id,
      taskTitle: task.title,
    }))
  ) || [];

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

  const [hiddenMetrics, setHiddenMetrics] = useState<Record<number, number[]>>({});

  const toggleMetricVisibility = (taskId: number, metricId: number) => {
    setHiddenMetrics(prev => {
      const hidden = prev[taskId] || [];
      if (hidden.includes(metricId)) {
        return { ...prev, [taskId]: hidden.filter(id => id !== metricId) };
      } else {
        return { ...prev, [taskId]: [...hidden, metricId] };
      }
    });
  };

  const isMetricVisible = (taskId: number, metricId: number) => {
    const hidden = hiddenMetrics[taskId] || [];
    return !hidden.includes(metricId);
  };

  const calculateTrend = (values: Array<{ value: string }>) => {
    if (!values || values.length < 2) return null;
    
    const numericValues = values
      .map(v => parseFloat(v.value))
      .filter(v => !isNaN(v))
      .slice(0, 10);
    
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

  const TrendIcon = ({ direction }: { direction: string }) => {
    if (direction === "up") return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (direction === "down") return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const taskIds = Array.from(new Set(metricsHistory?.map(m => m.taskId) || []));
  
  const getTaskMetrics = (taskId: number) => {
    return metricsHistory?.filter(m => m.taskId === taskId) || [];
  };

  const prepareUnifiedChartData = (taskMetrics: MetricHistory[]) => {
    const allDates = new Map<string, Record<string, string | number>>();
    
    taskMetrics.forEach((metric) => {
      metric.values.forEach(v => {
        const dateKey = format(new Date(v.completedAt), "MMM d");
        const existing = allDates.get(dateKey) || {};
        existing[`metric_${metric.metricId}`] = parseFloat(v.value) || 0;
        existing.fullDate = format(new Date(v.completedAt), "MMM d, yyyy");
        allDates.set(dateKey, existing);
      });
    });
    
    return Array.from(allDates.entries())
      .map(([date, values]) => ({ date, ...values }))
      .slice(-30);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">
          Metrics
        </h1>
        <p className="text-muted-foreground">
          Track trends across all your custom metrics. Toggle individual metrics on/off per task.
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
                  Across {taskIds.length} tasks
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

          {taskIds.map((taskId) => {
            const taskMetrics = getTaskMetrics(taskId);
            if (taskMetrics.length === 0) return null;
            
            const taskTitle = taskMetrics[0].taskTitle;
            const chartData = prepareUnifiedChartData(taskMetrics);
            const visibleTaskMetrics = taskMetrics.filter(m => isMetricVisible(taskId, m.metricId));
            
            return (
              <Card key={taskId} data-testid={`task-metrics-${taskId}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-lg">{taskTitle}</CardTitle>
                      <CardDescription className="mt-1">
                        {taskMetrics.length} metric{taskMetrics.length !== 1 ? "s" : ""} tracked
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {taskMetrics.map((metric, idx) => {
                        const isVisible = isMetricVisible(taskId, metric.metricId);
                        const trend = calculateTrend(metric.values);
                        const latestValue = metric.values[0]?.value;
                        
                        return (
                          <Button
                            key={metric.metricId}
                            variant={isVisible ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleMetricVisibility(taskId, metric.metricId)}
                            className="gap-2"
                            data-testid={`toggle-metric-${metric.metricId}`}
                          >
                            {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            <span>{metric.metricName}</span>
                            {latestValue && (
                              <Badge 
                                variant="secondary" 
                                className="ml-1 text-[10px]"
                                style={{ 
                                  borderLeft: `3px solid ${CHART_COLORS[idx % CHART_COLORS.length]}` 
                                }}
                              >
                                {latestValue}{metric.unit ? ` ${metric.unit}` : ""}
                              </Badge>
                            )}
                            {trend && <TrendIcon direction={trend.direction} />}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {visibleTaskMetrics.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      <p>Select at least one metric to display the chart</p>
                    </div>
                  ) : chartData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                      <p>No data points recorded yet</p>
                    </div>
                  ) : (
                    <div className="h-64">
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
                            width={50}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))", 
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Legend />
                          {visibleTaskMetrics.map((metric, idx) => {
                            const originalIdx = taskMetrics.findIndex(m => m.metricId === metric.metricId);
                            return (
                              <Line 
                                key={metric.metricId}
                                type="monotone" 
                                dataKey={`metric_${metric.metricId}`}
                                name={`${metric.metricName}${metric.unit ? ` (${metric.unit})` : ""}`}
                                stroke={CHART_COLORS[originalIdx % CHART_COLORS.length]}
                                strokeWidth={2}
                                dot={{ fill: CHART_COLORS[originalIdx % CHART_COLORS.length], strokeWidth: 0, r: 3 }}
                                activeDot={{ r: 5 }}
                                connectNulls
                              />
                            );
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {taskMetrics.reduce((sum, m) => sum + m.values.length, 0)} total data points
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
