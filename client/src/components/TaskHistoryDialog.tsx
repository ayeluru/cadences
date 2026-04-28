import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTimezone } from "@/hooks/use-user-settings";
import { formatLocal } from "@/lib/tz";
import { History, Calendar, Trash2, TrendingUp, Loader2, Circle, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TaskWithDetails, Completion, TaskMetric, MetricValue, TaskVariation } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { useUpdateCompletion } from "@/hooks/use-tasks";
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

interface EditCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  completion: CompletionWithMetrics;
  metrics: TaskMetric[];
  variations: TaskVariation[];
  taskId: number;
  timezone: string;
}

function EditCompletionDialog({ open, onOpenChange, completion, metrics, variations, taskId, timezone }: EditCompletionDialogProps) {
  const updateMutation = useUpdateCompletion();

  const [date, setDate] = useState(formatLocal(completion.completedAt, timezone, "yyyy-MM-dd"));
  const [time, setTime] = useState(formatLocal(completion.completedAt, timezone, "HH:mm"));
  const [notes, setNotes] = useState(completion.notes || "");
  const [variationId, setVariationId] = useState<number | null>(completion.variationId);
  const [metricInputs, setMetricInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    setDate(formatLocal(completion.completedAt, timezone, "yyyy-MM-dd"));
    setTime(formatLocal(completion.completedAt, timezone, "HH:mm"));
    setNotes(completion.notes || "");
    setVariationId(completion.variationId);
    const inputs: Record<number, string> = {};
    for (const metric of metrics) {
      const mv = completion.metricValues.find(v => v.metricId === metric.id);
      if (mv) {
        inputs[metric.id] = mv.numericValue !== null ? String(mv.numericValue) : (mv.textValue || "");
      } else {
        inputs[metric.id] = "";
      }
    }
    setMetricInputs(inputs);
  }, [completion, metrics]);

  const handleSave = () => {
    const completedAt = new Date(`${date}T${time}`);
    const metricData = metrics
      .filter(m => metricInputs[m.id] !== undefined && metricInputs[m.id] !== "")
      .map(m => ({
        metricId: m.id,
        value: m.dataType === "number" ? Number(metricInputs[m.id]) : metricInputs[m.id],
      }));

    updateMutation.mutate(
      {
        completionId: completion.id,
        completedAt: completedAt.toISOString(),
        notes: notes || null,
        variationId,
        metrics: metricData.length > 0 ? metricData : undefined,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "history"] });
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Completion</DialogTitle>
          <DialogDescription>
            Update the details for this completion entry.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-comp-date">Date</Label>
              <Input
                id="edit-comp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-comp-time">Time</Label>
              <Input
                id="edit-comp-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-comp-notes">Notes</Label>
            <Input
              id="edit-comp-notes"
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {variations.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="edit-comp-variation">Variation</Label>
              <select
                id="edit-comp-variation"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={variationId ?? ""}
                onChange={(e) => setVariationId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">No variation</option>
                {variations.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}

          {metrics.length > 0 && (
            <div className="space-y-3">
              <Label>Metrics</Label>
              {metrics.map((metric) => (
                <div key={metric.id} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground min-w-[80px]">
                    {metric.name}{metric.unit ? ` (${metric.unit})` : ""}
                  </span>
                  <Input
                    type={metric.dataType === "number" ? "number" : "text"}
                    value={metricInputs[metric.id] || ""}
                    onChange={(e) => setMetricInputs(prev => ({ ...prev, [metric.id]: e.target.value }))}
                    placeholder={metric.dataType === "number" ? "0" : "Value"}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TaskHistoryDialog({ open, onOpenChange, taskId, taskTitle }: TaskHistoryDialogProps) {
  const tz = useTimezone();
  const { toast } = useToast();
  const [selectedMetric, setSelectedMetric] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [editingCompletion, setEditingCompletion] = useState<CompletionWithMetrics | null>(null);

  const { data: historyData, isLoading, isError } = useQuery<TaskHistoryData>({
    queryKey: ["/api/tasks", taskId, "history"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tasks/${taskId}/history`);
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
      queryClient.invalidateQueries({ queryKey: ["/api/streaks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
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
    return buildVariationChartSeries(metricValues, metric?.name, metric?.unit, 0, tz);
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
        ) : isError ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Failed to load history. Please try again.</p>
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
                <div className="relative ml-3">
                  <div className="absolute left-0 top-2 bottom-2 w-px bg-border" />
                  {historyData?.completions.map((completion, idx) => (
                    <div 
                      key={completion.id} 
                      className="group relative pl-6 pb-6 last:pb-0"
                      data-testid={`completion-card-${completion.id}`}
                    >
                      <Circle className="absolute left-0 top-1.5 w-[7px] h-[7px] -translate-x-[3px] fill-muted-foreground/40 text-muted-foreground/40" />
                      
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">
                              {formatLocal(completion.completedAt, tz, "MMM d, yyyy")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatLocal(completion.completedAt, tz, "h:mm a")}
                            </span>
                            {completion.variationId && historyData?.task?.variations && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 h-5 font-normal">
                                {historyData.task.variations.find(v => v.id === completion.variationId)?.name || "Unknown"}
                              </Badge>
                            )}
                          </div>
                          
                          {completion.notes && (
                            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                              {completion.notes}
                            </p>
                          )}
                          
                          {completion.metricValues.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {completion.metricValues.map(mv => {
                                const metric = historyData.metrics.find(m => m.id === mv.metricId);
                                const value = mv.numericValue !== null ? mv.numericValue : mv.textValue;
                                return (
                                  <span key={mv.id} className="text-xs text-muted-foreground">
                                    {metric?.name}: <span className="text-foreground font-medium">{value}</span>{metric?.unit ? ` ${metric.unit}` : ''}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground transition-colors"
                            onClick={() => setEditingCompletion(completion)}
                            data-testid={`button-edit-completion-${completion.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive transition-colors"
                            onClick={() => {
                              if (confirm("Delete this completion?")) {
                                deleteCompletionMutation.mutate(completion.id);
                              }
                            }}
                            disabled={deleteCompletionMutation.isPending}
                            data-testid={`button-delete-completion-${completion.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="charts" className="flex-1 min-h-0 mt-4">
              {hasMetrics && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">Metric</span>
                    {historyData.metrics.map(metric => (
                      <button
                        key={metric.id}
                        onClick={() => setSelectedMetric(metric.id)}
                        data-testid={`button-metric-${metric.id}`}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          selectedMetric === metric.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {metric.name}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">Range</span>
                    {(["all", "30d", "90d", "1y"] as const).map(range => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        data-testid={`button-range-${range}`}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          timeRange === range
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {range === "all" ? "All" : range === "30d" ? "30d" : range === "90d" ? "90d" : "1y"}
                      </button>
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
                      <div>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5 mb-3">
                          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                          {historyData.metrics.find(m => m.id === selectedMetric)?.name} Over Time
                          {showLegend && <span className="text-xs text-muted-foreground ml-1">({series.length} variations)</span>}
                        </p>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis 
                                dataKey="timestamp"
                                type="number"
                                domain={domain}
                                tickFormatter={(ts) => formatLocal(new Date(ts), tz, "MMM d")}
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
                                labelFormatter={(ts) => formatLocal(new Date(ts as number), tz, "MMM d, yyyy h:mm a")}
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
                      </div>
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

      {editingCompletion && historyData && (
        <EditCompletionDialog
          open={!!editingCompletion}
          onOpenChange={(open) => { if (!open) setEditingCompletion(null); }}
          completion={editingCompletion}
          metrics={historyData.metrics}
          variations={variations}
          taskId={taskId}
          timezone={tz}
        />
      )}
    </Dialog>
  );
}
