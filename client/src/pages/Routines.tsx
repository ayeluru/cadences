import { useState } from "react";
import { 
  useRoutines, 
  useRoutineComponents,
  useEligibleTasks,
  useDeleteRoutine,
  useStartRoutineRun,
  useCompleteRoutineRun,
  useRemoveRoutineComponent,
  RoutineComponentWithTask
} from "@/hooks/use-routines";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronRight, 
  Play, 
  Trash2, 
  Loader2, 
  Clock, 
  CheckCircle2, 
  Target, 
  Plus, 
  Repeat,
  CalendarClock,
  X
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Routine, TaskWithDetails } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { CreateRoutineDialog } from "@/components/CreateRoutineDialog";
import { AddTasksToRoutineDialog } from "@/components/AddTasksToRoutineDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

function getStatusBadge(task: TaskWithDetails) {
  const status = task.status;
  if (!status) return null;
  
  const variants: Record<string, { variant: "destructive" | "default" | "secondary" | "outline"; label: string }> = {
    overdue: { variant: "destructive", label: "Overdue" },
    due_soon: { variant: "default", label: "Due Soon" },
    later: { variant: "secondary", label: "Later" },
    never_done: { variant: "outline", label: "Never Done" },
  };
  
  const config = variants[status];
  if (!config) return null;
  
  return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
}

function getRuleLabel(ruleType: string, ruleValue: number) {
  switch (ruleType) {
    case 'always': return 'Every run';
    case 'every_n': return `Every ${ruleValue}${ruleValue === 2 ? 'nd' : ruleValue === 3 ? 'rd' : 'th'} run`;
    case 'when_due': return 'When due';
    default: return 'Every run';
  }
}

function ComponentsList({ 
  routineId, 
  onAddTasks 
}: { 
  routineId: number; 
  onAddTasks: () => void;
}) {
  const { data: components, isLoading } = useRoutineComponents(routineId);
  const removeComponent = useRemoveRoutineComponent();
  
  if (isLoading) {
    return (
      <div className="space-y-2 pt-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    );
  }
  
  if (!components || components.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground mb-3">
          No tasks added yet. Add tasks to run them together.
        </p>
        <Button variant="outline" size="sm" onClick={onAddTasks} data-testid="button-add-first-task">
          <Plus className="w-4 h-4 mr-1" />
          Add Tasks
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-2 pt-2">
      {components.map((comp) => (
        <div 
          key={comp.id} 
          className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
          data-testid={`component-task-${comp.task.id}`}
        >
          <CheckCircle2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="flex-1 text-sm truncate">{comp.task.title}</span>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {getRuleLabel(comp.ruleType, comp.ruleValue ?? 1)}
          </Badge>
          {getStatusBadge(comp.task)}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground"
            onClick={() => removeComponent.mutate({ routineId, componentId: comp.id })}
            disabled={removeComponent.isPending}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={onAddTasks} className="w-full mt-2">
        <Plus className="w-4 h-4 mr-1" />
        Add More Tasks
      </Button>
    </div>
  );
}

function RunRoutineDialog({
  open,
  onOpenChange,
  routine,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: Routine;
}) {
  const { data: eligibleData, isLoading } = useEligibleTasks(open ? routine.id : undefined);
  const startRun = useStartRoutineRun();
  const completeRun = useCompleteRoutineRun();
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [runId, setRunId] = useState<number | null>(null);

  const eligibleTasks = eligibleData?.eligibleTasks || [];
  const nextRunNumber = eligibleData?.nextRunNumber || 1;

  const handleStartRun = async () => {
    try {
      const result = await startRun.mutateAsync(routine.id);
      setRunId(result.run.id);
      setSelectedTaskIds(new Set(result.eligibleTasks.map((t: RoutineComponentWithTask) => t.task.id)));
    } catch (error) {
      console.error("Failed to start run:", error);
    }
  };

  const toggleTask = (taskId: number) => {
    const newSelected = new Set(selectedTaskIds);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTaskIds(newSelected);
  };

  const handleComplete = async () => {
    if (!runId) return;
    try {
      await completeRun.mutateAsync({
        routineId: routine.id,
        runId,
        taskIds: Array.from(selectedTaskIds),
      });
      onOpenChange(false);
      setRunId(null);
      setSelectedTaskIds(new Set());
    } catch (error) {
      console.error("Failed to complete run:", error);
    }
  };

  const isSubmitting = startRun.isPending || completeRun.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) {
        setRunId(null);
        setSelectedTaskIds(new Set());
      }
      onOpenChange(o);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Run: {routine.name}</DialogTitle>
          <DialogDescription>
            {runId 
              ? `Run #${nextRunNumber} - Select tasks to complete`
              : `${eligibleTasks.length} tasks eligible for this run`
            }
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !runId ? (
          <div className="py-4">
            {eligibleTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">
                No tasks to run. Add tasks to this routine first.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {eligibleTasks.map((comp) => (
                  <div 
                    key={comp.id} 
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 text-sm">{comp.task.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {getRuleLabel(comp.ruleType, comp.ruleValue ?? 1)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 space-y-2 max-h-60 overflow-y-auto">
            {eligibleTasks.map((comp) => (
              <label 
                key={comp.id} 
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 cursor-pointer hover-elevate"
              >
                <Checkbox
                  checked={selectedTaskIds.has(comp.task.id)}
                  onCheckedChange={() => toggleTask(comp.task.id)}
                />
                <span className="flex-1 text-sm">{comp.task.title}</span>
                {getStatusBadge(comp.task)}
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          {!runId ? (
            <Button 
              onClick={handleStartRun} 
              disabled={isSubmitting || eligibleTasks.length === 0}
              data-testid="button-start-run"
            >
              {startRun.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Play className="w-4 h-4 mr-1" />
              Start Run
            </Button>
          ) : (
            <Button 
              onClick={handleComplete} 
              disabled={isSubmitting || selectedTaskIds.size === 0}
              data-testid="button-complete-run"
            >
              {completeRun.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Complete {selectedTaskIds.size} Task{selectedTaskIds.size !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoutineCard({ routine }: { routine: Routine }) {
  const [isOpen, setIsOpen] = useState(false);
  const [addTasksOpen, setAddTasksOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const { data: components } = useRoutineComponents(routine.id);
  const deleteRoutineMutation = useDeleteRoutine();
  
  const taskCount = components?.length || 0;
  const overdueCount = components?.filter(c => c.task.status === "overdue").length || 0;
  const dueSoonCount = components?.filter(c => c.task.status === "due_soon").length || 0;
  
  return (
    <>
      <Card data-testid={`routine-card-${routine.id}`}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CollapsibleTrigger className="flex items-center gap-2 text-left group flex-1 min-w-0">
                {isOpen ? (
                  <ChevronDown className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
                    {routine.name}
                  </CardTitle>
                  {routine.description && (
                    <CardDescription className="truncate">{routine.description}</CardDescription>
                  )}
                </div>
              </CollapsibleTrigger>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={() => setRunOpen(true)}
                  disabled={taskCount === 0}
                  data-testid={`button-run-routine-${routine.id}`}
                >
                  <Play className="w-4 h-4" />
                  <span className="ml-1 hidden sm:inline">Run</span>
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      data-testid={`button-delete-routine-${routine.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{routine.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the routine. Tasks will not be deleted - they'll just be unlinked from this routine.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteRoutineMutation.mutate(routine.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 pt-2">
              {routine.intervalValue && (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="w-3 h-3" />
                  Every {routine.intervalValue} {routine.intervalUnit}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1">
                <Target className="w-3 h-3" />
                {taskCount} {taskCount === 1 ? "task" : "tasks"}
              </Badge>
              {overdueCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  {overdueCount} overdue
                </Badge>
              )}
              {dueSoonCount > 0 && (
                <Badge variant="default" className="gap-1">
                  {dueSoonCount} due soon
                </Badge>
              )}
            </div>
          </CardHeader>
          
          <AnimatePresence>
            {isOpen && (
              <CollapsibleContent forceMount>
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardContent className="pt-0 pb-4">
                    <ComponentsList 
                      routineId={routine.id} 
                      onAddTasks={() => setAddTasksOpen(true)} 
                    />
                  </CardContent>
                </motion.div>
              </CollapsibleContent>
            )}
          </AnimatePresence>
        </Collapsible>
      </Card>
      
      <AddTasksToRoutineDialog
        open={addTasksOpen}
        onOpenChange={setAddTasksOpen}
        routine={routine}
      />
      
      <RunRoutineDialog
        open={runOpen}
        onOpenChange={setRunOpen}
        routine={routine}
      />
    </>
  );
}

export default function Routines() {
  const { data: routines, isLoading } = useRoutines();
  const [createOpen, setCreateOpen] = useState(false);
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Routines</h2>
          <p className="text-muted-foreground mt-1">Group tasks together and run them as a set.</p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Routines</h2>
          <p className="text-muted-foreground mt-1">
            Group tasks together like a playlist - run them together with flexible rules.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-create-routine">
          <Plus className="w-4 h-4 mr-2" />
          New Routine
        </Button>
      </div>
      
      {(!routines || routines.length === 0) ? (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Repeat className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium mb-2">No routines yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a routine to group tasks and run them together. Tasks stay independent - like a playlist!
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Routine
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {routines.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} />
          ))}
        </div>
      )}
      
      <CreateRoutineDialog 
        open={createOpen} 
        onOpenChange={setCreateOpen} 
      />
    </div>
  );
}
