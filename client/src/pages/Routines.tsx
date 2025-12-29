import { useState } from "react";
import { useRoutines, useRoutineTasks, useLinkedTasks, useCompleteRoutine, useDeleteRoutine } from "@/hooks/use-routines";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Play, Trash2, Loader2, Clock, CheckCircle2, Target, Plus, Link2, CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import type { Routine, TaskWithDetails } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { CreateRoutineDialog } from "@/components/CreateRoutineDialog";
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

function RoutineTasksList({ routineId, routineType }: { routineId: number; routineType: string }) {
  const isDynamic = routineType === 'dynamic';
  const { data: fixedTasks, isLoading: fixedLoading } = useRoutineTasks(isDynamic ? undefined : routineId);
  const { data: linkedTasks, isLoading: linkedLoading } = useLinkedTasks(isDynamic ? routineId : undefined);
  
  const tasks = isDynamic ? linkedTasks : fixedTasks;
  const isLoading = isDynamic ? linkedLoading : fixedLoading;
  
  if (isLoading) {
    return (
      <div className="space-y-2 pl-4 pt-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }
  
  if (!tasks || tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground pl-4 pt-2 italic">
        {routineType === 'dynamic' 
          ? "No tasks linked. Edit this routine to add tasks."
          : "No tasks in this routine. Edit to add tasks."}
      </p>
    );
  }
  
  return (
    <div className="space-y-2 pl-4 pt-2">
      {tasks.map((task) => (
        <div 
          key={task.id} 
          className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
          data-testid={`routine-task-${task.id}`}
        >
          <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          <span className="flex-1 text-sm">{task.title}</span>
          {routineType === 'dynamic' && task.intervalValue && (
            <span className="text-xs text-muted-foreground">
              Every {task.intervalValue} {task.intervalUnit}
            </span>
          )}
          {getStatusBadge(task)}
        </div>
      ))}
    </div>
  );
}

function RoutineCard({ routine }: { routine: Routine }) {
  const [isOpen, setIsOpen] = useState(false);
  const isDynamic = routine.routineType === 'dynamic';
  const { data: fixedTasks } = useRoutineTasks(isDynamic ? undefined : routine.id);
  const { data: linkedTasks } = useLinkedTasks(isDynamic ? routine.id : undefined);
  const completeRoutineMutation = useCompleteRoutine();
  const deleteRoutineMutation = useDeleteRoutine();
  
  const tasks = isDynamic ? linkedTasks : fixedTasks;
  const taskCount = tasks?.length || 0;
  const overdueCount = tasks?.filter(t => t.status === "overdue").length || 0;
  const dueSoonCount = tasks?.filter(t => t.status === "due_soon").length || 0;
  
  const completedTodayCount = tasks?.filter(t => {
    if (!t.lastCompletedAt) return false;
    const completedDate = new Date(t.lastCompletedAt);
    const today = new Date();
    return completedDate.toDateString() === today.toDateString();
  }).length || 0;
  
  const completionPercentage = taskCount > 0 ? Math.round((completedTodayCount / taskCount) * 100) : 0;
  const isFixed = !isDynamic;
  
  return (
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
                onClick={() => completeRoutineMutation.mutate(routine.id)}
                disabled={completeRoutineMutation.isPending || taskCount === 0}
                data-testid={`button-complete-routine-${routine.id}`}
              >
                {completeRoutineMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span className="ml-1 hidden sm:inline">Complete All</span>
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
                      This will remove the routine. Tasks in this routine will be kept but will no longer be grouped.
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
            {isFixed && routine.intervalValue && (
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
            {completionPercentage > 0 && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {completionPercentage}% today
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
                  <RoutineTasksList routineId={routine.id} routineType={routine.routineType || 'fixed'} />
                </CardContent>
              </motion.div>
            </CollapsibleContent>
          )}
        </AnimatePresence>
      </Collapsible>
    </Card>
  );
}

export default function Routines() {
  const { data: routines, isLoading } = useRoutines();
  const [createFixedOpen, setCreateFixedOpen] = useState(false);
  const [createDynamicOpen, setCreateDynamicOpen] = useState(false);
  
  const fixedRoutines = routines?.filter(r => r.routineType === 'fixed') || [];
  const dynamicRoutines = routines?.filter(r => r.routineType === 'dynamic') || [];
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight">Routines</h2>
          <p className="text-muted-foreground mt-1">Group related tasks together and complete them as a set.</p>
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
          <p className="text-muted-foreground mt-1">Group related tasks together and complete them as a set.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setCreateFixedOpen(true)} data-testid="button-create-fixed-routine">
            <CalendarClock className="w-4 h-4 mr-2" />
            Fixed Routine
          </Button>
          <Button variant="outline" onClick={() => setCreateDynamicOpen(true)} data-testid="button-create-dynamic-routine">
            <Link2 className="w-4 h-4 mr-2" />
            Dynamic Routine
          </Button>
        </div>
      </div>
      
      {(!routines || routines.length === 0) ? (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Clock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium mb-2">No routines yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a Fixed Routine (with its own schedule) or a Dynamic Routine (to group existing tasks).
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {fixedRoutines.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Fixed Routines</h3>
                <Badge variant="secondary">{fixedRoutines.length}</Badge>
              </div>
              <p className="text-sm text-muted-foreground -mt-2">
                Tasks with a shared schedule - complete all together.
              </p>
              <div className="space-y-4">
                {fixedRoutines.map((routine) => (
                  <RoutineCard key={routine.id} routine={routine} />
                ))}
              </div>
            </section>
          )}
          
          {dynamicRoutines.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Dynamic Routines</h3>
                <Badge variant="secondary">{dynamicRoutines.length}</Badge>
              </div>
              <p className="text-sm text-muted-foreground -mt-2">
                Groups of tasks with their own schedules - see what's due.
              </p>
              <div className="space-y-4">
                {dynamicRoutines.map((routine) => (
                  <RoutineCard key={routine.id} routine={routine} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      
      <CreateRoutineDialog 
        open={createFixedOpen} 
        onOpenChange={setCreateFixedOpen} 
        routineType="fixed" 
      />
      <CreateRoutineDialog 
        open={createDynamicOpen} 
        onOpenChange={setCreateDynamicOpen} 
        routineType="dynamic" 
      />
    </div>
  );
}
