import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUpdateTask, useTasks, useReassignTask } from "@/hooks/use-tasks";
import { insertTaskSchema, TaskWithDetails, TaskMetric, TaskVariation } from "@shared/schema";
import { z } from "zod";
import { useCategories } from "@/hooks/use-categories";
import { useTags } from "@/hooks/use-tags";
import { useProfiles } from "@/hooks/use-profiles";
import { useState, useEffect } from "react";
import { Loader2, Plus, X, BarChart3, ArrowRightLeft, Clock, Calendar, Layers } from "lucide-react";
import { Badge } from "./ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const DAYS_OF_WEEK = [
  { id: 0, label: "Sun" },
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
];

const formSchema = insertTaskSchema.partial().extend({
  intervalValue: z.coerce.number().min(1, "Interval must be at least 1").optional(),
  categoryId: z.coerce.number().optional().nullable(),
  targetCount: z.coerce.number().min(1).optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface MetricDef {
  name: string;
  unit?: string;
  dataType: "number" | "text";
}

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithDetails;
}

function convertMinutesToDisplay(minutes: number | null | undefined): { value: string; unit: 'minutes' | 'hours' | 'days' } {
  if (!minutes || minutes <= 0) return { value: '', unit: 'hours' };
  if (minutes >= 1440 && minutes % 1440 === 0) {
    return { value: String(minutes / 1440), unit: 'days' };
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return { value: String(minutes / 60), unit: 'hours' };
  }
  return { value: String(minutes), unit: 'minutes' };
}

function convertToMinutes(value: string, unit: 'minutes' | 'hours' | 'days'): number | null {
  const num = Number(value);
  if (!value || isNaN(num) || num <= 0) return null;
  if (unit === 'hours') return num * 60;
  if (unit === 'days') return num * 60 * 24;
  return num;
}

export function EditTaskDialog({ open, onOpenChange, task }: EditTaskDialogProps) {
  const updateMutation = useUpdateTask();
  const reassignMutation = useReassignTask();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const { data: profiles } = useProfiles();
  const { data: allTasks } = useTasks();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [newMetrics, setNewMetrics] = useState<MetricDef[]>([]);
  const [newMetricName, setNewMetricName] = useState("");
  const [newMetricUnit, setNewMetricUnit] = useState("");
  const [isSavingMetrics, setIsSavingMetrics] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<number | undefined>(task.profileId ?? undefined);
  
  const [taskType, setTaskType] = useState<'interval' | 'frequency' | 'scheduled'>(task.taskType as any || 'interval');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([]);
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledDaysOfMonth, setScheduledDaysOfMonth] = useState("");
  const [refractoryValue, setRefractoryValue] = useState("");
  const [refractoryUnit, setRefractoryUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const [variations, setVariations] = useState<TaskVariation[]>([]);
  const [newVariationName, setNewVariationName] = useState("");
  const [isLoadingVariations, setIsLoadingVariations] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task.title,
      description: task.description,
      intervalValue: task.intervalValue ?? undefined,
      intervalUnit: task.intervalUnit as any,
      categoryId: task.categoryId ?? undefined,
      targetCount: task.targetCount ?? undefined,
      targetPeriod: task.targetPeriod as any,
    }
  });

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description,
        intervalValue: task.intervalValue ?? undefined,
        intervalUnit: task.intervalUnit as any,
        categoryId: task.categoryId ?? undefined,
        targetCount: task.targetCount ?? undefined,
        targetPeriod: task.targetPeriod as any,
      });
      setSelectedTagIds(task.tags?.map(t => t.id) || []);
      setNewMetrics([]);
      setSelectedProfileId(task.profileId ?? undefined);
      setTaskType(task.taskType as any || 'interval');
      
      if (task.scheduledDaysOfWeek) {
        setSelectedDaysOfWeek(task.scheduledDaysOfWeek.split(',').map(Number));
      } else {
        setSelectedDaysOfWeek([]);
      }
      setScheduledTime(task.scheduledTime || '');
      setScheduledDaysOfMonth(task.scheduledDaysOfMonth || '');
      
      const refractoryDisplay = convertMinutesToDisplay(task.refractoryMinutes);
      setRefractoryValue(refractoryDisplay.value);
      setRefractoryUnit(refractoryDisplay.unit);
      
      loadVariations();
    }
  }, [task, reset]);

  const loadVariations = async () => {
    if (!task.id) return;
    setIsLoadingVariations(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/variations`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setVariations(data || []);
      }
    } catch (error) {
      console.error('Failed to load variations:', error);
    } finally {
      setIsLoadingVariations(false);
    }
  };

  const addVariation = async () => {
    if (!newVariationName.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/variations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newVariationName.trim() }),
        credentials: 'include',
      });
      if (res.ok) {
        const newVar = await res.json();
        setVariations(prev => [...prev, newVar]);
        setNewVariationName("");
        toast({ title: "Variation added", description: `"${newVar.name}" added to this task.` });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add variation", variant: "destructive" });
    }
  };

  const deleteVariation = async (variationId: number) => {
    try {
      const res = await fetch(`/api/variations/${variationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setVariations(prev => prev.filter(v => v.id !== variationId));
        toast({ title: "Variation removed", description: "Variation deleted from this task." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete variation", variant: "destructive" });
    }
  };

  const onSubmit = async (data: FormValues) => {
    setIsSavingMetrics(true);
    
    try {
      if (selectedProfileId && selectedProfileId !== task.profileId) {
        await reassignMutation.mutateAsync({ taskId: task.id, targetProfileId: selectedProfileId });
      }
      
      if (newMetrics.length > 0) {
        for (const metric of newMetrics) {
          await fetch(`/api/tasks/${task.id}/metrics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metric),
            credentials: 'include',
          });
        }
      }

      const updateData: any = {
        id: task.id,
        title: data.title,
        description: data.description,
        categoryId: data.categoryId || null,
        tagIds: selectedTagIds,
        taskType,
      };

      if (taskType === 'interval') {
        updateData.intervalValue = data.intervalValue;
        updateData.intervalUnit = data.intervalUnit;
        updateData.targetCount = null;
        updateData.targetPeriod = null;
        updateData.scheduledDaysOfWeek = null;
        updateData.scheduledDaysOfMonth = null;
        updateData.scheduledTime = null;
        updateData.refractoryMinutes = null;
      } else if (taskType === 'frequency') {
        updateData.targetCount = data.targetCount;
        updateData.targetPeriod = data.targetPeriod;
        updateData.refractoryMinutes = convertToMinutes(refractoryValue, refractoryUnit);
        updateData.intervalValue = null;
        updateData.intervalUnit = null;
        updateData.scheduledDaysOfWeek = null;
        updateData.scheduledDaysOfMonth = null;
        updateData.scheduledTime = null;
      } else if (taskType === 'scheduled') {
        if (selectedDaysOfWeek.length > 0) {
          updateData.scheduledDaysOfWeek = selectedDaysOfWeek.sort((a, b) => a - b).join(',');
        } else {
          updateData.scheduledDaysOfWeek = null;
        }
        if (scheduledDaysOfMonth.trim()) {
          const daysInput = scheduledDaysOfMonth.split(',')
            .map(d => parseInt(d.trim()))
            .filter(d => !isNaN(d) && d >= 1 && d <= 31)
            .sort((a, b) => a - b);
          updateData.scheduledDaysOfMonth = daysInput.length > 0 ? daysInput.join(',') : null;
        } else {
          updateData.scheduledDaysOfMonth = null;
        }
        updateData.scheduledTime = scheduledTime.trim() || null;
        updateData.intervalValue = null;
        updateData.intervalUnit = null;
        updateData.targetCount = null;
        updateData.targetPeriod = null;
        updateData.refractoryMinutes = null;
      }

      updateMutation.mutate(updateData, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
          setNewMetrics([]);
          onOpenChange(false);
        }
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setIsSavingMetrics(false);
    }
  };

  const toggleTag = (id: number) => {
    setSelectedTagIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const addMetric = () => {
    if (!newMetricName.trim()) return;
    setNewMetrics(prev => [...prev, { 
      name: newMetricName.trim(), 
      unit: newMetricUnit.trim() || undefined, 
      dataType: "number" 
    }]);
    setNewMetricName("");
    setNewMetricUnit("");
  };

  const removeNewMetric = (index: number) => {
    setNewMetrics(prev => prev.filter((_, i) => i !== index));
  };

  const deleteExistingMetric = async (metricId: number) => {
    try {
      const res = await fetch(`/api/metrics/${metricId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
        toast({ title: "Metric deleted", description: "Statistic removed from task." });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete metric", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Task Title</Label>
              <Input id="edit-title" data-testid="input-edit-title" {...register("title")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Input id="edit-description" data-testid="input-edit-description" {...register("description")} />
            </div>

            <div className="space-y-2">
              <Label>Task Type</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Changing the type preserves your completion history and streaks.
              </p>
              <Tabs value={taskType} onValueChange={(v) => setTaskType(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="interval" data-testid="tab-edit-interval">Every X Days</TabsTrigger>
                  <TabsTrigger value="frequency" data-testid="tab-edit-frequency">X Per Week</TabsTrigger>
                  <TabsTrigger value="scheduled" data-testid="tab-edit-scheduled">Scheduled</TabsTrigger>
                </TabsList>
                
                <TabsContent value="interval" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-intervalValue">Every</Label>
                      <Input 
                        type="number" 
                        id="edit-intervalValue" 
                        data-testid="input-edit-interval"
                        min="1" 
                        {...register("intervalValue")} 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-intervalUnit">Unit</Label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        data-testid="select-edit-unit"
                        {...register("intervalUnit")}
                      >
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                        <option value="years">Years</option>
                      </select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="frequency" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-targetCount">Times</Label>
                      <Input 
                        type="number" 
                        id="edit-targetCount" 
                        data-testid="input-edit-target-count"
                        min="1" 
                        {...register("targetCount")} 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-targetPeriod">Per</Label>
                      <select 
                        id="edit-targetPeriod"
                        data-testid="select-edit-target-period"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        {...register("targetPeriod")}
                      >
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="edit-refractoryValue">Minimum time between completions (optional)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        type="number" 
                        id="edit-refractoryValue" 
                        data-testid="input-edit-refractory-value"
                        min="0" 
                        placeholder="1"
                        value={refractoryValue}
                        onChange={(e) => setRefractoryValue(e.target.value)}
                      />
                      <select 
                        id="edit-refractoryUnit"
                        data-testid="select-edit-refractory-unit"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={refractoryUnit}
                        onChange={(e) => setRefractoryUnit(e.target.value as any)}
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Prevents gaming by requiring time between completions.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="scheduled" className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Days of the Week
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day.id}
                          type="button"
                          data-testid={`checkbox-edit-day-${day.id}`}
                          onClick={() => {
                            setSelectedDaysOfWeek(prev => 
                              prev.includes(day.id) 
                                ? prev.filter(d => d !== day.id) 
                                : [...prev, day.id]
                            );
                          }}
                          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                            selectedDaysOfWeek.includes(day.id)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-input hover-elevate"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-scheduledTime" className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Preferred Time (optional)
                    </Label>
                    <Input 
                      type="time" 
                      id="edit-scheduledTime" 
                      data-testid="input-edit-scheduled-time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-scheduledDaysOfMonth">Specific Days of Month (optional)</Label>
                    <Input 
                      id="edit-scheduledDaysOfMonth" 
                      data-testid="input-edit-days-of-month"
                      placeholder="e.g., 1,15 for 1st and 15th"
                      value={scheduledDaysOfMonth}
                      onChange={(e) => setScheduledDaysOfMonth(e.target.value)}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>


            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <select 
                id="edit-category"
                data-testid="select-edit-category"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("categoryId")}
              >
                <option value="">No category</option>
                {categories?.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {profiles && profiles.length > 1 && (
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="edit-profile" className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Move to Profile
                </Label>
                <select 
                  id="edit-profile"
                  data-testid="select-edit-profile"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedProfileId ?? ""}
                  onChange={(e) => setSelectedProfileId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}{profile.isDemo ? " (Demo)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Move this task and its history to a different profile.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 pt-2">
                {tags?.map(tag => (
                  <Badge
                    key={tag.id}
                    variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    data-testid={`badge-edit-tag-${tag.id}`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                <Label>Variations</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Add different ways to complete this task. When completing, you can select which variation you performed.
              </p>
              
              {isLoadingVariations ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading variations...
                </div>
              ) : variations.length > 0 ? (
                <div className="space-y-2">
                  {variations.map((v) => (
                    <div key={v.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                      <span className="text-sm">{v.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        data-testid={`button-delete-variation-${v.id}`}
                        onClick={() => deleteVariation(v.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              
              <div className="flex gap-2">
                <Input
                  placeholder="Add variation (e.g., Goblet Squat)"
                  value={newVariationName}
                  onChange={(e) => setNewVariationName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addVariation();
                    }
                  }}
                  data-testid="input-new-variation"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addVariation}
                  disabled={!newVariationName.trim()}
                  data-testid="button-add-variation"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <Label>Statistics to Track</Label>
              </div>
              
              {task.metrics && task.metrics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Existing statistics:</p>
                  {task.metrics.map((metric: TaskMetric) => (
                    <div key={metric.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                      <span className="text-sm">{metric.name} {metric.unit && `(${metric.unit})`}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        data-testid={`button-delete-metric-${metric.id}`}
                        onClick={() => deleteExistingMetric(metric.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Add new statistics to record when completing this task.
              </p>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Stat name (e.g., Weight)"
                  value={newMetricName}
                  onChange={(e) => setNewMetricName(e.target.value)}
                  data-testid="input-new-metric-name"
                />
                <Input
                  placeholder="Unit (e.g., lbs)"
                  value={newMetricUnit}
                  onChange={(e) => setNewMetricUnit(e.target.value)}
                  className="w-28"
                  data-testid="input-new-metric-unit"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addMetric}
                  disabled={!newMetricName.trim()}
                  data-testid="button-add-metric"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {newMetrics.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">New statistics to add:</p>
                  {newMetrics.map((m, i) => (
                    <div key={i} className="flex items-center justify-between bg-accent/30 rounded-md px-3 py-2">
                      <span className="text-sm">{m.name} {m.unit && `(${m.unit})`}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeNewMetric(i)}
                        data-testid={`button-remove-new-metric-${i}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending || isSavingMetrics} data-testid="button-save-task">
                {(updateMutation.isPending || isSavingMetrics) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
