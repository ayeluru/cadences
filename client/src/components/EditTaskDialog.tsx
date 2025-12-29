import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUpdateTask, useTasks } from "@/hooks/use-tasks";
import { insertTaskSchema, TaskWithDetails, TaskMetric } from "@shared/schema";
import { z } from "zod";
import { useCategories } from "@/hooks/use-categories";
import { useTags } from "@/hooks/use-tags";
import { useState, useEffect } from "react";
import { Loader2, Plus, X, BarChart3 } from "lucide-react";
import { Badge } from "./ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "./ui/scroll-area";

const formSchema = insertTaskSchema.partial().extend({
  intervalValue: z.coerce.number().min(1, "Interval must be at least 1").optional(),
  categoryId: z.coerce.number().optional().nullable(),
  parentTaskId: z.coerce.number().optional().nullable(),
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

export function EditTaskDialog({ open, onOpenChange, task }: EditTaskDialogProps) {
  const updateMutation = useUpdateTask();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const { data: allTasks } = useTasks();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [newMetrics, setNewMetrics] = useState<MetricDef[]>([]);
  const [newMetricName, setNewMetricName] = useState("");
  const [newMetricUnit, setNewMetricUnit] = useState("");
  const [isSavingMetrics, setIsSavingMetrics] = useState(false);

  const parentTasks = allTasks?.filter((t: TaskWithDetails) => 
    t.taskType === 'frequency' && !t.parentTaskId && t.id !== task.id
  ) || [];

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task.title,
      intervalValue: task.intervalValue ?? undefined,
      intervalUnit: task.intervalUnit as any,
      categoryId: task.categoryId ?? undefined,
      parentTaskId: task.parentTaskId ?? undefined,
    }
  });

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        intervalValue: task.intervalValue ?? undefined,
        intervalUnit: task.intervalUnit as any,
        categoryId: task.categoryId ?? undefined,
        parentTaskId: task.parentTaskId ?? undefined,
      });
      setSelectedTagIds(task.tags?.map(t => t.id) || []);
      setNewMetrics([]);
    }
  }, [task, reset]);

  const onSubmit = async (data: FormValues) => {
    setIsSavingMetrics(true);
    
    try {
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

      updateMutation.mutate({
        id: task.id,
        ...data,
        parentTaskId: data.parentTaskId || null,
        tagIds: selectedTagIds
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
          setNewMetrics([]);
          onOpenChange(false);
        }
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save metrics", variant: "destructive" });
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Task Title</Label>
              <Input id="edit-title" data-testid="input-edit-title" {...register("title")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-intervalValue">Frequency Value</Label>
                <Input type="number" id="edit-intervalValue" data-testid="input-edit-interval" min="1" {...register("intervalValue")} />
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

            {parentTasks.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="edit-parentTask">Counts Toward</Label>
                <p className="text-xs text-muted-foreground">
                  Link this task to a frequency-based goal (e.g., "Exercise 3x/week")
                </p>
                <select 
                  id="edit-parentTask"
                  data-testid="select-edit-parent-task"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register("parentTaskId")}
                >
                  <option value="">None - standalone task</option>
                  {parentTasks.map((t: TaskWithDetails) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.targetCount}x/{t.targetPeriod})
                    </option>
                  ))}
                </select>
                {task.parentTask && (
                  <p className="text-xs text-muted-foreground">
                    Currently linked to: <span className="font-medium">{task.parentTask.title}</span>
                  </p>
                )}
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
                Add new statistics to record when completing this task (e.g., weight, sets, reps).
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
