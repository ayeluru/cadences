import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateTask, useTasks } from "@/hooks/use-tasks";
import { insertTaskSchema, InsertTask, TaskWithDetails } from "@shared/schema";
import { z } from "zod";
import { useCategories, useCreateCategory } from "@/hooks/use-categories";
import { useTags } from "@/hooks/use-tags";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

const formSchema = insertTaskSchema.extend({
  intervalValue: z.coerce.number().min(1).optional().nullable(),
  targetCount: z.coerce.number().min(1).optional().nullable(),
  categoryId: z.coerce.number().optional().nullable(),
  parentTaskId: z.coerce.number().optional().nullable(),
  refractoryMinutes: z.coerce.number().min(0).optional().nullable(),
});

type FormValues = z.infer<typeof formSchema> & { tagIds: number[] };

interface MetricDef {
  name: string;
  unit: string;
  dataType: string;
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const createMutation = useCreateTask();
  const createCategoryMutation = useCreateCategory();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const { data: allTasks } = useTasks();
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [taskType, setTaskType] = useState<'interval' | 'frequency'>('interval');
  const [metrics, setMetrics] = useState<MetricDef[]>([]);
  const [newMetricName, setNewMetricName] = useState("");
  const [newMetricUnit, setNewMetricUnit] = useState("");

  const parentTasks = allTasks?.filter((t: TaskWithDetails) => 
    t.taskType === 'frequency' && !t.parentTaskId
  ) || [];

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      intervalValue: 1,
      intervalUnit: 'days',
      categoryId: null,
      tagIds: [],
      taskType: 'interval',
      targetCount: null,
      targetPeriod: 'week',
      parentTaskId: null,
      refractoryMinutes: null,
    }
  });

  const onSubmit = async (data: FormValues) => {
    const taskData: any = {
      title: data.title,
      description: data.description,
      taskType,
      categoryId: data.categoryId || undefined,
      tagIds: selectedTagIds,
      parentTaskId: data.parentTaskId || undefined,
    };

    if (taskType === 'interval') {
      taskData.intervalValue = data.intervalValue;
      taskData.intervalUnit = data.intervalUnit;
    } else {
      taskData.targetCount = data.targetCount;
      taskData.targetPeriod = data.targetPeriod;
      taskData.refractoryMinutes = data.refractoryMinutes || null;
    }

    createMutation.mutate(taskData, {
      onSuccess: async (newTask: any) => {
        if (metrics.length > 0 && newTask?.id) {
          for (const metric of metrics) {
            await fetch(`/api/tasks/${newTask.id}/metrics`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(metric),
              credentials: 'include'
            });
          }
        }
        onOpenChange(false);
        reset({
          intervalValue: 1,
          intervalUnit: 'days',
          categoryId: null,
          tagIds: [],
          taskType: 'interval',
          targetCount: null,
          targetPeriod: 'week',
          parentTaskId: null,
          refractoryMinutes: null,
        });
        setSelectedTagIds([]);
        setShowNewCategoryInput(false);
        setNewCategoryName("");
        setMetrics([]);
        setTaskType('interval');
      }
    });
  };

  const handleCreateNewCategory = () => {
    if (!newCategoryName.trim()) return;
    createCategoryMutation.mutate(
      { name: newCategoryName },
      {
        onSuccess: () => {
          setNewCategoryName("");
          setShowNewCategoryInput(false);
        }
      }
    );
  };

  const toggleTag = (id: number) => {
    setSelectedTagIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const addMetric = () => {
    if (!newMetricName.trim()) return;
    setMetrics(prev => [...prev, { name: newMetricName, unit: newMetricUnit, dataType: 'number' }]);
    setNewMetricName("");
    setNewMetricUnit("");
  };

  const removeMetric = (index: number) => {
    setMetrics(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new maintenance or exercise task to track.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input 
              id="title" 
              data-testid="input-task-title"
              placeholder="e.g., Replace Air Filter or Squats" 
              {...register("title")} 
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input 
              id="description" 
              data-testid="input-task-description"
              placeholder="Additional notes..." 
              {...register("description")} 
            />
          </div>

          <Tabs value={taskType} onValueChange={(v) => setTaskType(v as 'interval' | 'frequency')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="interval" data-testid="tab-interval">Every X Days/Weeks</TabsTrigger>
              <TabsTrigger value="frequency" data-testid="tab-frequency">X Times per Week</TabsTrigger>
            </TabsList>
            
            <TabsContent value="interval" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="intervalValue">Every</Label>
                  <Input 
                    type="number" 
                    id="intervalValue" 
                    data-testid="input-interval-value"
                    min="1" 
                    {...register("intervalValue")} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="intervalUnit">Unit</Label>
                  <select 
                    id="intervalUnit"
                    data-testid="select-interval-unit"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <Label htmlFor="parentTask">Counts toward (optional)</Label>
                <select 
                  id="parentTask"
                  data-testid="select-parent-task"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register("parentTaskId")}
                >
                  <option value="">None - standalone task</option>
                  {parentTasks.map((task: TaskWithDetails) => (
                    <option key={task.id} value={task.id}>
                      {task.title} ({task.targetCount}x per {task.targetPeriod})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  If this is a variation (e.g., "Back Squat" for "Squats"), select the parent task.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="frequency" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetCount">Times</Label>
                  <Input 
                    type="number" 
                    id="targetCount" 
                    data-testid="input-target-count"
                    min="1" 
                    placeholder="3"
                    {...register("targetCount")} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="targetPeriod">Per</Label>
                  <select 
                    id="targetPeriod"
                    data-testid="select-target-period"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...register("targetPeriod")}
                  >
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="refractoryMinutes">Minimum time between completions (optional)</Label>
                <div className="flex gap-2 items-center">
                  <Input 
                    type="number" 
                    id="refractoryMinutes" 
                    data-testid="input-refractory-minutes"
                    min="0" 
                    placeholder="60"
                    {...register("refractoryMinutes")} 
                  />
                  <span className="text-sm text-muted-foreground shrink-0">minutes</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Prevents gaming by requiring time between completions. E.g., 60 minutes means doing 3 squats in 3 minutes only counts as 1 completion.
                </p>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Create variations of this task to track different ways to fulfill this goal.
              </p>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="category">Category</Label>
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
                  data-testid="input-new-category"
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
                  data-testid="button-add-category"
                  onClick={handleCreateNewCategory}
                  disabled={createCategoryMutation.isPending || !newCategoryName.trim()}
                >
                  {createCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </Button>
              </div>
            ) : (
              <select 
                id="category"
                data-testid="select-category"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("categoryId")}
              >
                <option value="">Select a category...</option>
                {categories?.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 pt-2">
              {tags?.map(tag => (
                <Badge
                  key={tag.id}
                  variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  data-testid={`tag-${tag.id}`}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </Badge>
              ))}
              {tags?.length === 0 && <span className="text-sm text-muted-foreground">No tags available. Create some in Settings.</span>}
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label>Track Statistics (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Add metrics to record when completing this task (e.g., weight, sets, reps, tire pressure).
            </p>
            
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
            
            {metrics.length > 0 && (
              <div className="space-y-2">
                {metrics.map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                    <span className="text-sm">{m.name} {m.unit && `(${m.unit})`}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeMetric(i)}
                      data-testid={`button-remove-metric-${i}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-task">
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
