import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useCreateRoutine, useAddTaskToRoutine } from "@/hooks/use-routines";
import { useTasks, useCreateTask } from "@/hooks/use-tasks";
import { useProfileContext } from "@/contexts/ProfileContext";
import { Loader2, Plus, X, Search } from "lucide-react";
import type { TaskWithDetails } from "@shared/schema";

interface CreateRoutineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routineType: 'fixed' | 'dynamic';
}

interface NewStep {
  id: string;
  title: string;
  description: string;
}

export function CreateRoutineDialog({ open, onOpenChange, routineType }: CreateRoutineDialogProps) {
  const { currentProfile } = useProfileContext();
  const createRoutine = useCreateRoutine();
  const createTask = useCreateTask();
  const addTaskToRoutine = useAddTaskToRoutine();
  const { data: existingTasks } = useTasks();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [intervalValue, setIntervalValue] = useState("1");
  const [intervalUnit, setIntervalUnit] = useState("days");
  
  const [steps, setSteps] = useState<NewStep[]>([]);
  const [newStepTitle, setNewStepTitle] = useState("");
  
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [taskSearch, setTaskSearch] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setIntervalValue("1");
    setIntervalUnit("days");
    setSteps([]);
    setNewStepTitle("");
    setSelectedTaskIds([]);
    setTaskSearch("");
  };

  const handleAddStep = () => {
    if (!newStepTitle.trim()) return;
    setSteps([...steps, { id: crypto.randomUUID(), title: newStepTitle.trim(), description: "" }]);
    setNewStepTitle("");
  };

  const handleRemoveStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const toggleTaskSelection = (taskId: number) => {
    if (selectedTaskIds.includes(taskId)) {
      setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
    } else {
      setSelectedTaskIds([...selectedTaskIds, taskId]);
    }
  };

  const filteredTasks = existingTasks?.filter(task => 
    !task.routineId && 
    task.intervalValue &&
    task.title.toLowerCase().includes(taskSearch.toLowerCase())
  ) || [];

  const handleSubmit = async () => {
    if (!name.trim() || !currentProfile) return;

    try {
      const routineData: any = {
        name: name.trim(),
        description: description.trim() || null,
        profileId: currentProfile.id,
        routineType,
      };

      if (routineType === 'fixed') {
        routineData.intervalValue = parseInt(intervalValue) || 1;
        routineData.intervalUnit = intervalUnit;
      }

      const newRoutine = await createRoutine.mutateAsync(routineData);

      if (routineType === 'fixed' && steps.length > 0) {
        for (const step of steps) {
          await createTask.mutateAsync({
            title: step.title,
            description: step.description || null,
            taskType: 'interval',
            intervalValue: null,
            intervalUnit: null,
            routineId: newRoutine.id,
            profileId: currentProfile.id,
          });
        }
      } else if (routineType === 'dynamic' && selectedTaskIds.length > 0) {
        for (let i = 0; i < selectedTaskIds.length; i++) {
          await addTaskToRoutine.mutateAsync({
            routineId: newRoutine.id,
            taskId: selectedTaskIds[i],
            orderIndex: i,
          });
        }
      }

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create routine:", error);
    }
  };

  const isSubmitting = createRoutine.isPending || createTask.isPending || addTaskToRoutine.isPending;
  const canSubmit = name.trim() && currentProfile && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {routineType === 'fixed' ? 'Create Fixed Routine' : 'Create Dynamic Routine'}
          </DialogTitle>
          <DialogDescription>
            {routineType === 'fixed' 
              ? 'A fixed routine has its own schedule. All tasks in it are completed together.'
              : 'A dynamic routine groups existing tasks. It shows which ones are due.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="routine-name">Name</Label>
            <Input
              id="routine-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={routineType === 'fixed' ? "Morning Routine" : "Workout Tasks"}
              data-testid="input-routine-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="routine-description">Description (optional)</Label>
            <Textarea
              id="routine-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this routine for?"
              className="resize-none"
              rows={2}
              data-testid="input-routine-description"
            />
          </div>

          {routineType === 'fixed' && (
            <>
              <div className="space-y-2">
                <Label>Cadence</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(e.target.value)}
                    className="w-20"
                    data-testid="input-routine-interval-value"
                  />
                  <Select value={intervalUnit} onValueChange={setIntervalUnit}>
                    <SelectTrigger className="flex-1" data-testid="select-routine-interval-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Steps (Tasks)</Label>
                <div className="flex gap-2">
                  <Input
                    value={newStepTitle}
                    onChange={(e) => setNewStepTitle(e.target.value)}
                    placeholder="Add a task to this routine"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddStep())}
                    data-testid="input-new-step"
                  />
                  <Button type="button" size="icon" onClick={handleAddStep} disabled={!newStepTitle.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {steps.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {steps.map((step, index) => (
                      <div key={step.id} className="flex items-center gap-2 p-2 rounded-md bg-muted">
                        <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                        <span className="flex-1 text-sm">{step.title}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveStep(step.id)}
                          className="h-6 w-6"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {routineType === 'dynamic' && (
            <div className="space-y-2">
              <Label>Link Existing Tasks</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="Search tasks..."
                  className="pl-9"
                  data-testid="input-task-search"
                />
              </div>
              
              {selectedTaskIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedTaskIds.map(taskId => {
                    const task = existingTasks?.find(t => t.id === taskId);
                    return task ? (
                      <Badge key={taskId} variant="secondary" className="gap-1">
                        {task.title}
                        <button onClick={() => toggleTaskSelection(taskId)} className="ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto border rounded-md">
                {filteredTasks.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground text-center">
                    No tasks with their own cadence found
                  </p>
                ) : (
                  filteredTasks.map(task => (
                    <label
                      key={task.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                      data-testid={`task-option-${task.id}`}
                    >
                      <Checkbox
                        checked={selectedTaskIds.includes(task.id)}
                        onCheckedChange={() => toggleTaskSelection(task.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Every {task.intervalValue} {task.intervalUnit}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} data-testid="button-create-routine">
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Routine
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
