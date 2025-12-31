import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAddRoutineComponent } from "@/hooks/use-routines";
import { useTasks } from "@/hooks/use-tasks";
import { Loader2, Search, X, Clock, Repeat, CalendarClock } from "lucide-react";
import type { Routine } from "@shared/schema";

interface AddTasksToRoutineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: Routine;
}

type RuleType = 'always' | 'every_n' | 'when_due';

interface TaskSelection {
  taskId: number;
  ruleType: RuleType;
  ruleValue: number;
}

export function AddTasksToRoutineDialog({ open, onOpenChange, routine }: AddTasksToRoutineDialogProps) {
  const addComponent = useAddRoutineComponent();
  const { data: allTasks } = useTasks();

  const [selections, setSelections] = useState<TaskSelection[]>([]);
  const [taskSearch, setTaskSearch] = useState("");

  const resetForm = () => {
    setSelections([]);
    setTaskSearch("");
  };

  const availableTasks = allTasks?.filter(task => 
    !task.isArchived &&
    task.title.toLowerCase().includes(taskSearch.toLowerCase())
  ) || [];

  const toggleTask = (taskId: number) => {
    if (selections.find(s => s.taskId === taskId)) {
      setSelections(selections.filter(s => s.taskId !== taskId));
    } else {
      setSelections([...selections, { taskId, ruleType: 'always', ruleValue: 1 }]);
    }
  };

  const updateRule = (taskId: number, ruleType: RuleType, ruleValue?: number) => {
    setSelections(selections.map(s => 
      s.taskId === taskId 
        ? { ...s, ruleType, ruleValue: ruleValue ?? s.ruleValue }
        : s
    ));
  };

  const handleSubmit = async () => {
    if (selections.length === 0) return;

    try {
      for (let i = 0; i < selections.length; i++) {
        const sel = selections[i];
        await addComponent.mutateAsync({
          routineId: routine.id,
          taskId: sel.taskId,
          orderIndex: i,
          ruleType: sel.ruleType,
          ruleValue: sel.ruleValue,
        });
      }

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to add tasks:", error);
    }
  };

  const isSubmitting = addComponent.isPending;
  const canSubmit = selections.length > 0 && !isSubmitting;

  const getRuleLabel = (ruleType: RuleType, ruleValue: number) => {
    switch (ruleType) {
      case 'always': return 'Every time';
      case 'every_n': return `Every ${ruleValue}${ruleValue === 2 ? 'nd' : ruleValue === 3 ? 'rd' : 'th'} time`;
      case 'when_due': return 'When due';
      default: return 'Every time';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Tasks to {routine.name}</DialogTitle>
          <DialogDescription>
            Select tasks and choose when they should be included in this routine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          {selections.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected Tasks</Label>
              {selections.map(sel => {
                const task = allTasks?.find(t => t.id === sel.taskId);
                if (!task) return null;
                return (
                  <div key={sel.taskId} className="flex items-center gap-2 p-3 rounded-md bg-muted">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                    </div>
                    <Select 
                      value={sel.ruleType} 
                      onValueChange={(v: RuleType) => updateRule(sel.taskId, v)}
                    >
                      <SelectTrigger className="w-32" data-testid={`select-rule-${sel.taskId}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">
                          <div className="flex items-center gap-2">
                            <Repeat className="w-3 h-3" />
                            <span>Every time</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="every_n">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span>Every Nth</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="when_due">
                          <div className="flex items-center gap-2">
                            <CalendarClock className="w-3 h-3" />
                            <span>When due</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {sel.ruleType === 'every_n' && (
                      <Input
                        type="number"
                        min="2"
                        value={sel.ruleValue}
                        onChange={(e) => updateRule(sel.taskId, sel.ruleType, parseInt(e.target.value) || 2)}
                        className="w-16"
                        data-testid={`input-rule-value-${sel.taskId}`}
                      />
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleTask(sel.taskId)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Available Tasks</Label>
            <div className="max-h-60 overflow-y-auto border rounded-md">
              {availableTasks.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground text-center">
                  No tasks available
                </p>
              ) : (
                availableTasks
                  .filter(task => !selections.find(s => s.taskId === task.id))
                  .map(task => (
                    <label
                      key={task.id}
                      className="flex items-center gap-3 p-3 hover-elevate cursor-pointer border-b last:border-b-0"
                      data-testid={`task-option-${task.id}`}
                    >
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => toggleTask(task.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        {task.intervalValue && (
                          <p className="text-xs text-muted-foreground">
                            Every {task.intervalValue} {task.intervalUnit}
                          </p>
                        )}
                      </div>
                    </label>
                  ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} data-testid="button-add-tasks">
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Add {selections.length} Task{selections.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
