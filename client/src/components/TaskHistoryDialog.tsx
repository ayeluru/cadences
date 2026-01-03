import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { History, Calendar, Trash2, TrendingUp, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TaskWithDetails, Completion, TaskMetric, MetricValue } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { 
  CHART_COLORS, 
  TimeRange, 
  filterByTimeRange, 
  buildVariationChartSeries,
  getChartDomain,
} from "@/lib/chartUtils";

interface CompletionWithMetrics extends Completion {
  metricValues: MetricValue[];
}

interface TaskHistoryData {
  task: TaskWithDetails;
  completions: CompletionWithMetrics[];
  metrics: TaskMetric[];
}

interface TaskHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: number;
  taskTitle: string;
}

export function TaskHistoryDialog({ open, onOpenChange, taskId, taskTitle }: TaskHistoryDialogProps) {
  const { toast } = useToast();
  const [selectedMetric, setSelectedMetric] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  const { data: historyData, isLoading } = useQuery<TaskHistoryData>({
    queryKey: ["/api/tasks", taskId, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/history`);
      if (!res.ok) throw new Error("Failed to fetch task history");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (historyData?.metrics && historyData.metrics.length > 0 && !selectedMetric) {
      const numericMetric = historyData.metrics.find(m => m.dataType === 'number');
      if (numericMetric) {
        setSelectedMetric(numericMetric.id);
      }
    }
  }, [historyData?.metrics, selectedMetric]);

  const deleteCompletionMutation = useMutation({
    mutationFn: async (completionId: number) => {
      await apiRequest("DELETE", `/api/completions/${completionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/completions/calendar"] });
      toast({ title: "Completion deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete completion", variant: "destructive" });
    },
  });

  const variations = historyData?.task?.variations || [];

  const getFilteredCompletions = () => {
    if (!historyData?.completions) return [];
    return filterByTimeRange(
      historyData.completions.map(c => ({
        ...c,
        completedAt: typeof c.completedAt === 'string' ? c.completedAt : new Date(c.completedAt).toISOString(),
      })),
      timeRange
    );
  };

  const buildChartSeries = (metricId: number) => {
    const filteredCompletions = getFilteredCompletions();
    if (!filteredCompletions.length) return [];
    
    const metricValues = filteredCompletions
      .map(c => {
        const mv = c.metricValues.find(m => m.metricId === metricId);
        if (!mv || mv.numericValue === null) return null;
        
        const variation = c.variationId ? variations.find(v => v.id === c.variationId) : null;
        
        return {
          id: mv.id,
          value: mv.numericValue,
          completedAt: c.completedAt,
          variationId: c.variationId,
          variationName: variation?.name || null,
        };
      })
      .filter(Boolean) as Array<{
        id: number;
        value: number;
        completedAt: string;
        variationId: number | null;
        variationName: string | null;
      }>;
    
    const metric = historyData?.metrics.find(m => m.id === metricId);
    return buildVariationChartSeries(metricValues, metric?.name, metric?.unit);
  };

  const hasMetrics = historyData?.metrics && historyData.metrics.length > 0;
  const hasCompletions = historyData?.completions && historyData.completions.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            {taskTitle} History
          </DialogTitle>
          <DialogDescription>
            View completion history and track metrics over time.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !hasCompletions ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No completions yet for this task.</p>
          </div>
        ) : (
          <Tabs defaultValue="timeline" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
              <TabsTrigger value="charts" disabled={!hasMetrics} data-testid="tab-charts">
                Charts {!hasMetrics && "(No metrics)"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="flex-1 min-h-0 mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {historyData?.completions.map((completion) => (
                    <Card key={completion.id} className="relative" data-testid={`completion-card-${completion.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">
                                {format(new Date(completion.completedAt), "EEEE, MMMM d, yyyy")}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(completion.completedAt), "h:mm a")}
                              </span>
                              {completion.variationId && historyData?.task?.variations && (
                                <Badge variant="secondary" className="text-xs">
                                  {historyData.task.variations.find(v => v.id === completion.variationId)?.name || "Unknown variation"}
                                </Badge>
                              )}
                            </div>
                            
                            {completion.notes && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {completion.notes}
                              </p>
                            )}
                            
                            {completion.metricValues.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {completion.metricValues.map(mv => {
                                  const metric = historyData.metrics.find(m => m.id === mv.metricId);
                                  const value = mv.numericValue !== null ? mv.numericValue : mv.textValue;
                                  return (
                                    <Badge key={mv.id} variant="outline" className="text-xs">
                                      {metric?.name}: {value} {metric?.unit}
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => {
                              if (confirm("Delete this completion?")) {
                                deleteCompletionMutation.mutate(completion.id);
                              }
                            }}
                            disabled={deleteCompletionMutation.isPending}
                            data-testid={`button-delete-completion-${completion.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="charts" className="flex-1 min-h-0 mt-4">
              {hasMetrics && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Metric:</span>
                    {historyData.metrics.map(metric => (
                      <Button
                        key={metric.id}
                        variant={selectedMetric === metric.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedMetric(metric.id)}
                        data-testid={`button-metric-${metric.id}`}
                      >
                        {metric.name}
                      </Button>
                    ))}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Time range:</span>
                    {(["all", "30d", "90d", "1y"] as const).map(range => (
                      <Button
                        key={range}
                        variant={timeRange === range ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange(range)}
                        data-testid={`button-range-${range}`}
                      >
                        {range === "all" ? "All time" : range === "30d" ? "30 days" : range === "90d" ? "90 days" : "1 year"}
                      </Button>
                    ))}
                  </div>
                  
                  {selectedMetric ? (() => {
                    const series = buildChartSeries(selectedMetric);
                    const showLegend = series.length > 1;
                    
                    if (!series.length || series.every(s => s.data.length === 0)) {
                      return (
                        <p className="text-center text-muted-foreground py-8">
                          No data for the selected time range.
                        </p>
                      );
                    }

                    const domain = getChartDomain(series);
                    
                    return (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            {historyData.metrics.find(m => m.id === selectedMetric)?.name} Over Time
                            {showLegend && <span className="text-xs text-muted-foreground ml-2">({series.length} variations)</span>}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis 
                                  dataKey="timestamp"
                                  type="number"
                                  domain={domain}
                                  tickFormatter={(ts) => format(new Date(ts), "MMM d")}
                                  tick={{ fontSize: 12 }}
                                  className="text-muted-foreground"
                                  allowDuplicatedCategory={false}
                                />
                                <YAxis 
                                  tick={{ fontSize: 12 }}
                                  className="text-muted-foreground"
                                />
                                <Tooltip 
                                  labelFormatter={(ts) => format(new Date(ts as number), "MMM d, yyyy h:mm a")}
                                  contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                  }}
                                />
                                {showLegend && <Legend />}
                                {series.map((s) => (
                                  <Line 
                                    key={s.key}
                                    data={s.data}
                                    type="monotone" 
                                    dataKey="value"
                                    name={s.name}
                                    stroke={s.color}
                                    strokeWidth={2}
                                    dot={{ fill: s.color, strokeWidth: 0, r: 3 }}
                                    activeDot={{ r: 5 }}
                                    connectNulls
                                  />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })() : (
                    <p className="text-center text-muted-foreground py-8">
                      Select a metric above to view its trend over time.
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
