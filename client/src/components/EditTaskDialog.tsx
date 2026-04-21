import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUpdateTask, useTasks, useReassignTask } from "@/hooks/use-tasks";
import { apiRequest } from "@/lib/queryClient";
import { insertTaskSchema, TaskWithDetails, TaskMetric, TaskVariation } from "@shared/schema";
import { z } from "zod";
import { useCategories, useCreateCategory } from "@/hooks/use-categories";
import { useTags, useCreateTag } from "@/hooks/use-tags";
import { useProfiles } from "@/hooks/use-profiles";
import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Clock, Calendar, ChevronDown, Layers, BarChart3, ArrowRightLeft, Pencil, Check } from "lucide-react";
import { Badge } from "./ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

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
  const createCategoryMutation = useCreateCategory();
  const { data: tags } = useTags();
  const createTagMutation = useCreateTag();
  const { data: profiles } = useProfiles();
  const { data: allTasks } = useTasks();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newMetrics, setNewMetrics] = useState<MetricDef[]>([]);
  const [newMetricName, setNewMetricName] = useState("");
  const [newMetricUnit, setNewMetricUnit] = useState("");
  const [isSavingMetrics, setIsSavingMetrics] = useState(false);
  const [editingMetricId, setEditingMetricId] = useState<number | null>(null);
  const [editMetricName, setEditMetricName] = useState("");
  const [editMetricUnit, setEditMetricUnit] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<number | undefined>(task.profileId ?? undefined);
  
  const [taskType, setTaskType] = useState<'interval' | 'frequency' | 'scheduled'>(task.taskType as any || 'interval');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([]);
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledDaysOfMonth, setScheduledDaysOfMonth] = useState("");
  const [refractoryEnabled, setRefractoryEnabled] = useState(false);
  const [refractoryValue, setRefractoryValue] = useState("");
  const [refractoryUnit, setRefractoryUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const [variations, setVariations] = useState<TaskVariation[]>([]);
  const [newVariationName, setNewVariationName] = useState("");
  const [isLoadingVariations, setIsLoadingVariations] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [scheduledError, setScheduledError] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<FormValues>({
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
      
      const hasRefractory = task.refractoryMinutes != null && task.refractoryMinutes > 0;
      setRefractoryEnabled(hasRefractory);
      if (hasRefractory) {
        const refractoryDisplay = convertMinutesToDisplay(task.refractoryMinutes);
        setRefractoryValue(refractoryDisplay.value);
        setRefractoryUnit(refractoryDisplay.unit);
      } else {
        setRefractoryValue('1');
        setRefractoryUnit('hours');
      }
      
      // Auto-open advanced if task already has metrics or variations
      const hasExisting = (task.metrics && task.metrics.length > 0) || false;
      setAdvancedOpen(hasExisting);
      
      loadVariations();
    }
  }, [task, reset]);

  const loadVariations = async () => {
    if (!task.id) return;
    setIsLoadingVariations(true);
    try {
      const res = await apiRequest('GET', `/api/tasks/${task.id}/variations`);
      const data = await res.json();
      setVariations(data || []);
      if (data && data.length > 0) setAdvancedOpen(true);
    } catch (error) {
      console.error('Failed to load variations:', error);
    } finally {
      setIsLoadingVariations(false);
    }
  };

  const addVariation = async () => {
    if (!newVariationName.trim()) return;
    try {
      const res = await apiRequest('POST', `/api/tasks/${task.id}/variations`, { name: newVariationName.trim() });
      const newVar = await res.json();
      setVariations(prev => [...prev, newVar]);
      setNewVariationName("");
      toast({ title: "Variation added", description: `"${newVar.name}" added to this task.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add variation", variant: "destructive" });
    }
  };

  const deleteVariation = async (variationId: number) => {
    try {
      await apiRequest('DELETE', `/api/variations/${variationId}`);
      setVariations(prev => prev.filter(v => v.id !== variationId));
      toast({ title: "Variation removed", description: "Variation deleted from this task." });
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
          await apiRequest('POST', `/api/tasks/${task.id}/metrics`, metric);
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

      if (taskType === 'frequency' && (!data.targetCount || data.targetCount < 1)) {
        toast({ title: "Error", description: "Please specify how many times per period", variant: "destructive" });
        setIsSavingMetrics(false);
        return;
      }

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
        updateData.refractoryMinutes = refractoryEnabled ? convertToMinutes(refractoryValue, refractoryUnit) : null;
        updateData.intervalValue = null;
        updateData.intervalUnit = null;
        updateData.scheduledDaysOfWeek = null;
        updateData.scheduledDaysOfMonth = null;
        updateData.scheduledTime = null;
      } else if (taskType === 'scheduled') {
        const hasSchedule = selectedDaysOfWeek.length > 0 || scheduledDaysOfMonth.trim();
        if (!hasSchedule) {
          setScheduledError(true);
          toast({ title: "Schedule Required", description: "Please select days of week or days of month", variant: "destructive" });
          setIsSavingMetrics(false);
          return;
        }
        if (selectedDaysOfWeek.length > 0) {
          updateData.scheduledDaysOfWeek = selectedDaysOfWeek.sort((a, b) => a - b).join(',');
        } else {
          updateData.scheduledDaysOfWeek = null;
        }
        if (scheduledDaysOfMonth.trim()) {
          const positives = scheduledDaysOfMonth.split(',')
            .map(d => parseInt(d.trim()))
            .filter(d => !isNaN(d) && d >= 1 && d <= 31)
            .sort((a, b) => a - b);
          const negatives = scheduledDaysOfMonth.split(',')
            .map(d => parseInt(d.trim()))
            .filter(d => !isNaN(d) && d >= -31 && d <= -1)
            .sort((a, b) => a - b);
          const daysInput = [...positives, ...negatives];
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

  const handleCreateNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const newCategory = await createCategoryMutation.mutateAsync({ name: newCategoryName });
      setNewCategoryName("");
      await queryClient.refetchQueries({ queryKey: ['/api/categories'] });
      setShowNewCategoryInput(false);
      if (newCategory?.id) {
        setValue("categoryId", newCategory.id);
      }
    } catch {
      // Error toast handled by mutation hook
    }
  };

  const handleCreateNewTag = () => {
    if (!newTagName.trim()) return;
    createTagMutation.mutate(
      { name: newTagName, profileId: selectedProfileId },
      {
        onSuccess: (newTag: any) => {
          setNewTagName("");
          setShowNewTagInput(false);
          if (newTag?.id) {
            setSelectedTagIds(prev => [...prev, newTag.id]);
          }
        }
      }
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
      await apiRequest('DELETE', `/api/metrics/${metricId}`);
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      toast({ title: "Metric deleted", description: "Statistic and all its history removed from task." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete metric", variant: "destructive" });
    }
  };

  const startEditingMetric = (metric: TaskMetric) => {
    setEditingMetricId(metric.id);
    setEditMetricName(metric.name);
    setEditMetricUnit(metric.unit || "");
  };

  const saveMetricEdit = async () => {
    if (!editingMetricId || !editMetricName.trim()) return;
    try {
      await apiRequest('PATCH', `/api/metrics/${editingMetricId}`, {
        name: editMetricName.trim(),
        unit: editMetricUnit.trim(),
      });
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
      setEditingMetricId(null);
      toast({ title: "Metric updated", description: "Name and unit updated for all entries." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update metric", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Edit task settings, schedule, and tracking options.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Task Title</Label>
            <Input id="edit-title" data-testid="input-edit-title" {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Input id="edit-description" data-testid="input-edit-description" {...register("description")} />
          </div>

          {/* Profile selector — same position as Create dialog */}
          {profiles && profiles.length > 1 && (
            <div className="space-y-2">
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
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={refractoryEnabled}
                    onChange={(e) => {
                      setRefractoryEnabled(e.target.checked);
                      if (e.target.checked && !refractoryValue) {
                        setRefractoryValue('1');
                        setRefractoryUnit('hours');
                      }
                    }}
                    className="rounded border-input"
                    data-testid="checkbox-edit-refractory"
                  />
                  <span className="text-sm font-medium">Minimum time between completions</span>
                </label>
                {refractoryEnabled && (
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <Input 
                      type="number" 
                      id="edit-refractoryValue" 
                      data-testid="input-edit-refractory-value"
                      min="1" 
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
                )}
                <p className="text-xs text-muted-foreground pl-6">
                  Requires time between completions to prevent logging multiple at once.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="scheduled" className={`space-y-4 pt-4 rounded-lg transition-colors ${scheduledError ? 'ring-2 ring-destructive/50 p-3' : ''}`}>
              {scheduledError && (
                <p className="text-sm text-destructive font-medium">Select at least one schedule option below.</p>
              )}

              <div className="rounded-lg border p-3 space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="w-4 h-4" />
                  By weekday
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
                        setScheduledError(false);
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
                <p className="text-xs text-muted-foreground">
                  Pick which days of the week this task recurs on.
                </p>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <Label htmlFor="edit-scheduledDaysOfMonth" className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="w-4 h-4" />
                  By day of month
                </Label>
                <Input 
                  id="edit-scheduledDaysOfMonth" 
                  data-testid="input-edit-days-of-month"
                  placeholder="e.g., 1,15,-1"
                  value={scheduledDaysOfMonth}
                  onChange={(e) => { setScheduledDaysOfMonth(e.target.value); setScheduledError(false); }}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated day numbers (1-31). Use negative numbers to count from the end: -1 = last day, -2 = 2nd to last.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-scheduledTime" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Preferred time (optional)
                </Label>
                <Input 
                  type="time" 
                  id="edit-scheduledTime" 
                  data-testid="input-edit-scheduled-time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-category">Category</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setShowNewCategoryInput(!showNewCategoryInput)}
              >
                <Plus className="w-3 h-3 mr-1" /> New
              </Button>
            </div>
            {showNewCategoryInput ? (
              <div className="flex gap-2">
                <Input
                  data-testid="input-edit-new-category"
                  placeholder="Category name..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateNewCategory();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  data-testid="button-edit-add-category"
                  onClick={handleCreateNewCategory}
                  disabled={createCategoryMutation.isPending || !newCategoryName.trim()}
                >
                  {createCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            ) : (
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
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tags</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => setShowNewTagInput(!showNewTagInput)}
              >
                <Plus className="w-3 h-3 mr-1" /> New
              </Button>
            </div>
            {showNewTagInput && (
              <div className="flex gap-2">
                <Input
                  data-testid="input-edit-new-tag"
                  placeholder="Tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateNewTag();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  data-testid="button-edit-add-tag"
                  onClick={handleCreateNewTag}
                  disabled={createTagMutation.isPending || !newTagName.trim()}
                >
                  {createTagMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            )}
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
              {tags?.length === 0 && !showNewTagInput && <span className="text-sm text-muted-foreground">No tags yet. Click "New" to create one.</span>}
            </div>
          </div>

          {/* Advanced Configuration - Collapsed Section (matching Create dialog) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full flex items-center justify-between py-2 px-0"
                data-testid="button-toggle-advanced"
              >
                <span className="text-sm font-medium">Advanced Options</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              {/* Metrics */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Track Statistics (optional)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Add metrics to record when completing this task (e.g., weight, sets, reps, tire pressure).
                </p>

                {task.metrics && task.metrics.length > 0 && (
                  <div className="space-y-2">
                    {task.metrics.map((metric: TaskMetric) => (
                      <div key={metric.id} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                        {editingMetricId === metric.id ? (
                          <>
                            <Input
                              value={editMetricName}
                              onChange={(e) => setEditMetricName(e.target.value)}
                              className="h-7 text-sm flex-1"
                              placeholder="Name"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveMetricEdit(); } }}
                            />
                            <Input
                              value={editMetricUnit}
                              onChange={(e) => setEditMetricUnit(e.target.value)}
                              className="h-7 text-sm w-20"
                              placeholder="Unit"
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveMetricEdit(); } }}
                            />
                            <Button type="button" size="icon" variant="ghost" onClick={saveMetricEdit} className="h-7 w-7 shrink-0">
                              <Check className="h-4 w-4 text-primary" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="text-sm flex-1">{metric.name}{metric.unit ? ` (${metric.unit})` : ''}</span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              onClick={() => startEditingMetric(metric)}
                              data-testid={`button-edit-metric-${metric.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              data-testid={`button-delete-metric-${metric.id}`}
                              onClick={() => {
                                if (confirm("Delete this metric? All historical values for it will be lost.")) {
                                  deleteExistingMetric(metric.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Metric name (e.g., Weight)"
                    value={newMetricName}
                    onChange={(e) => setNewMetricName(e.target.value)}
                    data-testid="input-metric-name"
                  />
                  <Input
                    placeholder="Unit (e.g., lbs)"
                    value={newMetricUnit}
                    onChange={(e) => setNewMetricUnit(e.target.value)}
                    className="w-24"
                    data-testid="input-metric-unit"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={addMetric}
                    disabled={!newMetricName.trim()}
                    data-testid="button-add-metric"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {newMetrics.length > 0 && (
                  <div className="space-y-2">
                    {newMetrics.map((m, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                        <span className="text-sm">{m.name} {m.unit && `(${m.unit})`}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeNewMetric(i)}
                          data-testid={`button-remove-metric-${i}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Variations */}
              <div className="space-y-3 border-t pt-4">
                <Label className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Variations (optional)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Add variations to track different ways of completing this task. When completing, you can select which variation you did.
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
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
                
                <div className="flex gap-2">
                  <Input
                    placeholder="Variation name (e.g., Goblet Squat)"
                    value={newVariationName}
                    onChange={(e) => setNewVariationName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addVariation();
                      }
                    }}
                    data-testid="input-variation-name"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={addVariation}
                    disabled={!newVariationName.trim()}
                    data-testid="button-add-variation"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending || isSavingMetrics} data-testid="button-save-task">
              {(updateMutation.isPending || isSavingMetrics) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
