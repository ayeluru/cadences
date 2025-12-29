import { TaskWithDetails, TaskMetric } from "@shared/schema";
import { format, formatDistanceToNow, addDays, isPast } from "date-fns";
import { CheckCircle2, AlertCircle, Clock, Calendar, MoreVertical, Edit2, Trash2, CalendarCheck, Target, ChevronDown, ChevronUp, BarChart2, Flame, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompleteTask, useDeleteTask } from "@/hooks/use-tasks";
import { useState } from "react";
import { EditTaskDialog } from "./EditTaskDialog";
import { CompleteTaskDialog } from "./CompleteTaskDialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface TaskCardProps {
  task: TaskWithDetails;
  showVariations?: boolean;
}

export function TaskCard({ task, showVariations = true }: TaskCardProps) {
  const completeMutation = useCompleteTask();
  const deleteMutation = useDeleteTask();
  const [editOpen, setEditOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [variationsExpanded, setVariationsExpanded] = useState(false);

  const isFrequencyTask = task.taskType === 'frequency';
  const hasVariations = task.variations && task.variations.length > 0;
  const hasMetrics = task.metrics && task.metrics.length > 0;
  const isVariation = !!task.parentTaskId;

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'overdue': return 'border-l-4 border-l-[hsl(var(--urgency-overdue))] bg-red-50/50 dark:bg-red-900/10';
      case 'due_soon': return 'border-l-4 border-l-[hsl(var(--urgency-soon))] bg-amber-50/50 dark:bg-amber-900/10';
      case 'later': return 'border-l-4 border-l-[hsl(var(--urgency-later))]';
      case 'never_done': return 'border-l-4 border-l-[hsl(var(--urgency-never))] bg-gray-50/50 dark:bg-gray-900/10';
      default: return 'border-l-4 border-l-border';
    }
  };

  const getStatusIcon = (status: string | undefined) => {
    if (isFrequencyTask) {
      return <Target className="w-5 h-5 text-primary" />;
    }
    switch (status) {
      case 'overdue': return <AlertCircle className="w-5 h-5 text-[hsl(var(--urgency-overdue))]" />;
      case 'due_soon': return <Clock className="w-5 h-5 text-[hsl(var(--urgency-soon))]" />;
      case 'later': return <CheckCircle2 className="w-5 h-5 text-[hsl(var(--urgency-later))]" />;
      case 'never_done': return <Calendar className="w-5 h-5 text-muted-foreground" />;
      default: return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    if (isFrequencyTask) {
      const done = task.completionsThisPeriod || 0;
      const target = task.targetCount || 0;
      if (done >= target) {
        return `Goal complete: ${done}/${target} this ${task.targetPeriod}`;
      }
      return `${done}/${target} this ${task.targetPeriod}`;
    }

    if (task.status === 'never_done') return "Never completed";
    if (!task.nextDue) return "No due date";
    
    const dueDate = new Date(task.nextDue);
    if (isPast(dueDate) && task.status === 'overdue') {
      return `Overdue by ${formatDistanceToNow(dueDate)}`;
    }
    return `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`;
  };

  const getScheduleText = () => {
    if (isFrequencyTask) {
      return `${task.targetCount}x per ${task.targetPeriod}`;
    }
    return `Every ${task.intervalValue} ${task.intervalUnit}`;
  };

  const handleComplete = () => {
    if (hasMetrics) {
      setCompleteDialogOpen(true);
    } else {
      completeMutation.mutate({ id: task.id });
    }
  };

  return (
    <>
      <motion.div 
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          "group relative bg-card hover:bg-card/80 transition-all duration-300 rounded-xl shadow-sm hover:shadow-md border p-4 md:p-5",
          getStatusColor(task.status),
          isVariation && "ml-6 border-l-2 border-l-primary/30"
        )}
        data-testid={`task-card-${task.id}`}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {task.category && (
                <span className="text-xs font-semibold text-primary tracking-wide uppercase">
                  {task.category.name}
                </span>
              )}
              {isVariation && (
                <Badge variant="outline" className="text-[10px] px-1.5 h-5">Variation</Badge>
              )}
              {isFrequencyTask && (
                <Badge variant="secondary" className="text-[10px] px-1.5 h-5">Goal</Badge>
              )}
              {hasMetrics && (
                <Badge variant="outline" className="text-[10px] px-1.5 h-5">
                  <BarChart2 className="w-3 h-3 mr-1" /> Tracked
                </Badge>
              )}
              {task.streak && task.streak.currentStreak > 0 && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-[10px] px-1.5 h-5",
                    task.streak.currentStreak >= 7 && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
                    task.streak.currentStreak >= 30 && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  )}
                >
                  <Flame className={cn(
                    "w-3 h-3 mr-1",
                    task.streak.currentStreak >= 7 && "text-orange-500",
                    task.streak.currentStreak >= 30 && "text-red-500"
                  )} />
                  {task.streak.currentStreak}
                </Badge>
              )}
              {task.streak && task.streak.currentStreak === task.streak.longestStreak && task.streak.longestStreak >= 5 && (
                <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300">
                  <Trophy className="w-3 h-3 mr-1 text-yellow-500" /> Best
                </Badge>
              )}
              <div className="flex gap-1">
                {task.tags?.map(tag => (
                  <Badge key={tag.id} variant="secondary" className="text-[10px] px-1.5 h-5">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
            
            <h3 className="text-lg font-bold font-display text-foreground leading-tight mb-1">
              {task.title}
            </h3>
            
            {task.description && (
              <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
            )}
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              {getStatusIcon(task.status)}
              <span className={cn(
                "font-medium",
                task.status === 'overdue' && "text-[hsl(var(--urgency-overdue))]",
                task.status === 'due_soon' && "text-[hsl(var(--urgency-soon))]"
              )}>
                {getStatusText()}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-muted-foreground">
                {getScheduleText()}
              </span>
            </div>

            {isFrequencyTask && task.targetCount && (
              <div className="mt-3 max-w-xs">
                <Progress 
                  value={task.targetProgress || 0} 
                  className="h-2" 
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 md:mt-0 self-end md:self-center">
            {hasVariations && showVariations && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVariationsExpanded(!variationsExpanded)}
                className="rounded-full"
                data-testid={`button-expand-variations-${task.id}`}
              >
                {variationsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span className="ml-1">{task.variations?.length}</span>
              </Button>
            )}

            {!isFrequencyTask && (
              <Button 
                onClick={handleComplete}
                disabled={completeMutation.isPending}
                className={cn(
                  "rounded-full px-6 shadow-md transition-all duration-300",
                  completeMutation.isPending ? "opacity-70" : "hover:scale-105 active:scale-95"
                )}
                size="sm"
                data-testid={`button-complete-${task.id}`}
              >
                {completeMutation.isPending ? "Saving..." : "Done"}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-muted-foreground hover:text-foreground">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setEditOpen(true)} data-testid={`menu-edit-${task.id}`}>
                  <Edit2 className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
                {!isFrequencyTask && (
                  <DropdownMenuItem onClick={handleComplete} data-testid={`menu-complete-${task.id}`}>
                    <CalendarCheck className="w-4 h-4 mr-2" /> Mark Done
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  data-testid={`menu-delete-${task.id}`}
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this task?")) {
                      deleteMutation.mutate(task.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <AnimatePresence>
          {variationsExpanded && hasVariations && showVariations && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-3"
            >
              <p className="text-sm text-muted-foreground font-medium">
                Complete any of these to count toward your goal:
              </p>
              {task.variations?.map(variation => (
                <TaskCard key={variation.id} task={variation as TaskWithDetails} showVariations={false} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <EditTaskDialog open={editOpen} onOpenChange={setEditOpen} task={task} />
      {hasMetrics && (
        <CompleteTaskDialog 
          open={completeDialogOpen} 
          onOpenChange={setCompleteDialogOpen} 
          task={task} 
        />
      )}
    </>
  );
}
