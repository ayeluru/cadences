import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, TrendingUp, TrendingDown, Minus, Activity, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TaskWithDetails } from "@shared/schema";
import { useProfileContext } from "@/contexts/ProfileContext";
import { supabase } from "@/lib/supabase";
import { 
  CHART_COLORS, 
  TimeRange, 
  filterByTimeRange, 
  buildVariationChartSeries,
  getChartDomain,
  ChartSeries,
} from "@/lib/chartUtils";

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
    variationId?: number | null;
    variationName?: string;
  }>;
}

export default function MetricsPage() {
  const { currentProfile } = useProfileContext();
  const queryParams = currentProfile?.id ? `?profileId=${currentProfile.id}` : '';
  
  const { data: tasks, isLoading: tasksLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/tasks", currentProfile?.id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      const res = await fetch(`/api/tasks${queryParams}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  const allMetrics = tasks?.flatMap(task => 
    (task.metrics || []).map(metric => ({
      ...metric,
      taskId: task.id,
      taskTitle: task.title,
    }))
  ) || [];

  const metricIds = allMetrics.map(m => m.id).sort().join(',');

  const { data: metricsHistory, isLoading: historyLoading } = useQuery<MetricHistory[]>({
    queryKey: ["/api/metrics/all-history", metricIds],
    queryFn: async () => {
      if (!allMetrics.length) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      const historyPromises = allMetrics.map(async (metric) => {
        const res = await fetch(`/api/metrics/${metric.id}/history?limit=100`, { headers });
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
  const [timeRange, setTimeRange] = useState<TimeRange>("90d");

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

  const prepareChartSeriesForTask = (taskMetrics: MetricHistory[]): ChartSeries[] => {
    const allSeries: ChartSeries[] = [];
    let colorIndex = 0;
    
    taskMetrics.forEach((metric) => {
      const filteredValues = filterByTimeRange(metric.values, timeRange);
      
      const series = buildVariationChartSeries(
        filteredValues,
        metric.metricName,
        metric.unit,
        colorIndex
      );
      
      allSeries.push(...series);
      colorIndex += series.length;
    });
    
    return allSeries;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            Metrics
          </h1>
          <p className="text-muted-foreground">
            Track trends across all your custom metrics. Toggle individual metrics on/off per task.
          </p>
        </div>
        <div className="flex gap-1" data-testid="time-range-filter">
          {(["30d", "90d", "1y", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              data-testid={`time-range-${range}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                timeRange === range
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {range === "all" ? "All" : range}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !metricsHistory || metricsHistory.length === 0 ? (
        <div className="py-16 text-center">
          <Activity className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-2">No metrics tracked yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
            Add custom metrics to your tasks to track things like weight, reps, duration, or any other measurement you want to monitor over time.
            Edit any task and look for "Track Statistics" in the Advanced Options section.
          </p>
          <Link href="/">
            <Button variant="outline">
              Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-8">
          <div className="grid grid-cols-3 gap-4 md:gap-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total Metrics</p>
              <div className="text-2xl md:text-3xl font-bold tracking-tight">{metricsHistory.length}</div>
              <p className="text-[11px] text-muted-foreground">across {taskIds.length} tasks</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Data Points</p>
              <div className="text-2xl md:text-3xl font-bold tracking-tight">
                {metricsHistory.reduce((sum, m) => sum + m.values.length, 0)}
              </div>
              <p className="text-[11px] text-muted-foreground">recorded</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Trending Up</p>
              <div className="text-2xl md:text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">
                {metricsHistory.filter(m => {
                  const trend = calculateTrend(m.values);
                  return trend?.direction === "up";
                }).length}
              </div>
              <p className="text-[11px] text-muted-foreground">improving</p>
            </div>
          </div>

          {taskIds.map((taskId) => {
            const taskMetrics = getTaskMetrics(taskId);
            if (taskMetrics.length === 0) return null;
            
            const taskTitle = taskMetrics[0].taskTitle;
            const visibleTaskMetrics = taskMetrics.filter(m => isMetricVisible(taskId, m.metricId));
            const chartSeries = prepareChartSeriesForTask(visibleTaskMetrics);
            const hasData = chartSeries.some(s => s.data.length > 0);
            const domain = getChartDomain(chartSeries);
            
            return (
              <section key={taskId} className="border-t border-border pt-6" data-testid={`task-metrics-${taskId}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{taskTitle}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {taskMetrics.length} metric{taskMetrics.length !== 1 ? "s" : ""} tracked
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {taskMetrics.map((metric, idx) => {
                      const isVisible = isMetricVisible(taskId, metric.metricId);
                      const trend = calculateTrend(metric.values);
                      const latestValue = metric.values[0]?.value;
                      
                      return (
                        <button
                          key={metric.metricId}
                          onClick={() => toggleMetricVisibility(taskId, metric.metricId)}
                          data-testid={`toggle-metric-${metric.metricId}`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                            isVisible
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {metric.metricName}
                          {latestValue && (
                            <span 
                              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                isVisible ? "bg-primary-foreground/20" : "bg-foreground/10"
                              }`}
                              style={{ borderLeft: `2px solid ${CHART_COLORS[idx % CHART_COLORS.length]}` }}
                            >
                              {latestValue}{metric.unit ? ` ${metric.unit}` : ""}
                            </span>
                          )}
                          {trend && <TrendIcon direction={trend.direction} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {visibleTaskMetrics.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                    Select at least one metric to display the chart
                  </div>
                ) : !hasData ? (
                  <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                    No data points in selected time range
                  </div>
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="timestamp"
                          type="number"
                          domain={domain}
                          tickFormatter={(ts) => format(new Date(ts), "MMM d")}
                          tick={{ fontSize: 11 }} 
                          className="text-muted-foreground"
                          allowDuplicatedCategory={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 11 }} 
                          className="text-muted-foreground"
                          width={50}
                        />
                        <Tooltip 
                          labelFormatter={(ts) => format(new Date(ts as number), "MMM d, yyyy")}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend />
                        {chartSeries.map((series) => (
                          <Line 
                            key={series.key}
                            data={series.data}
                            type="monotone" 
                            dataKey="value"
                            name={series.name}
                            stroke={series.color}
                            strokeWidth={2}
                            dot={{ fill: series.color, strokeWidth: 0, r: 3 }}
                            activeDot={{ r: 5 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  {chartSeries.reduce((sum, s) => sum + s.data.length, 0)} data points
                </p>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
