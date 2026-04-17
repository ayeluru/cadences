import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { TaskWithDetails, TaskAssignment } from "@shared/schema";
import { useAssignments, useCreateAssignment, useDeleteAssignment, useResetAssignments } from "@/hooks/use-assignments";
import { useCompleteTask } from "@/hooks/use-tasks";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, Calendar, MoveHorizontal, RotateCcw, Undo2, Lock } from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, isSameDay, isAfter, isBefore, parseISO } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WeekViewProps {
  tasks: TaskWithDetails[];
}

type SelectedTask = {
  taskId: number;
  sourceDate?: string;
  assignmentId?: number;
  rootOriginalDate?: string;
};

type UndoAction = {
  createdAssignmentId: number;
  previousAssignment?: {
    taskId: number;
    plannedDate: string;
    originalDate?: string;
  };
};

type DayTaskEntry = {
  task: TaskWithDetails;
  assignmentId?: number;
  rootOriginalDate?: string;
  isMovable: boolean;
  isCompletedPlacement?: boolean;
};

type DayTasks = {
  date: Date;
  dateStr: string;
  tasks: DayTaskEntry[];
};

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function formatDateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function WeekView({ tasks }: WeekViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedTask, setSelectedTask] = useState<SelectedTask | null>(null);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [expandedCardKey, setExpandedCardKey] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [moveMode, setMoveMode] = useState(false);

  const now = new Date();
  const weekStart = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 0 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const weekDays = getWeekDays(weekStart);

  const startStr = formatDateKey(weekStart);
  const endStr = formatDateKey(weekEnd);

  const { data: assignments = [] } = useAssignments(startStr, endStr);
  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const resetAssignments = useResetAssignments();
  const completeMutation = useCompleteTask();

  useEffect(() => {
    setSelectedTask(null);
    setUndoStack([]);
    setConfirmReset(false);
    setMoveMode(false);
  }, [weekOffset]);

  useEffect(() => {
    if (!selectedTask && !moveMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedTask(null);
        setMoveMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTask, moveMode]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const top = containerRef.current.getBoundingClientRect().top;
        setContainerHeight(window.innerHeight - top);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const tasksById = useMemo(() => {
    const map = new Map<number, TaskWithDetails>();
    tasks.forEach(t => map.set(t.id, t));
    return map;
  }, [tasks]);

  // Build auto-schedule, then apply override suppressions
  const { effectiveSchedule, overrideEntries } = useMemo(() => {
    const schedule = new Map<string, Set<number>>();
    weekDays.forEach(d => schedule.set(formatDateKey(d), new Set()));

    tasks.forEach(task => {
      if (task.isArchived) return;

      if (task.taskType === 'scheduled' && task.scheduledDaysOfWeek) {
        const scheduledDays = task.scheduledDaysOfWeek.split(',').map(Number);
        weekDays.forEach(d => {
          if (scheduledDays.includes(d.getDay())) {
            schedule.get(formatDateKey(d))!.add(task.id);
          }
        });
      } else if (task.taskType === 'interval' && task.intervalValue && task.intervalUnit) {
        if (task.intervalUnit === 'days' && task.intervalValue === 1) {
          weekDays.forEach(d => {
            schedule.get(formatDateKey(d))!.add(task.id);
          });
        } else if (task.nextDue) {
          const nextDue = parseISO(task.nextDue);
          weekDays.forEach(d => {
            if (isSameDay(d, nextDue)) {
              schedule.get(formatDateKey(d))!.add(task.id);
            }
          });
        }
      } else if (task.taskType === 'scheduled' && task.scheduledDates) {
        const dates = task.scheduledDates.split(',').map(s => s.trim());
        dates.forEach(dateStr => {
          try {
            const d = parseISO(dateStr);
            const key = formatDateKey(d);
            if (schedule.has(key)) {
              schedule.get(key)!.add(task.id);
            }
          } catch {}
        });
      }
    });

    const overrides: TaskAssignment[] = [];
    for (const a of assignments) {
      if (a.originalDate) {
        overrides.push(a);
        const origSet = schedule.get(a.originalDate);
        if (origSet) origSet.delete(a.taskId);
        const plannedSet = schedule.get(a.plannedDate);
        if (plannedSet) plannedSet.add(a.taskId);
      }
    }

    return { effectiveSchedule: schedule, overrideEntries: overrides };
  }, [tasks, weekDays, assignments]);

  // Reverse map: taskId -> set of dateStrs where it appears (across schedule + manual)
  const taskDaysMap = useMemo(() => {
    const map = new Map<number, Set<string>>();
    effectiveSchedule.forEach((taskIds, dateStr) => {
      taskIds.forEach(id => {
        if (!map.has(id)) map.set(id, new Set());
        map.get(id)!.add(dateStr);
      });
    });
    assignments.forEach(a => {
      if (a.originalDate) return;
      if (!map.has(a.taskId)) map.set(a.taskId, new Set());
      map.get(a.taskId)!.add(a.plannedDate);
    });
    return map;
  }, [effectiveSchedule, assignments]);

  const allDateStrs = useMemo(() => weekDays.map(formatDateKey), [weekDays]);

  // Manual assignments (non-override)
  const manualMap = useMemo(() => {
    const map = new Map<string, { assignmentId: number; taskId: number }[]>();
    assignments.forEach(a => {
      if (a.originalDate) return;
      const key = a.plannedDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ assignmentId: a.id, taskId: a.taskId });
    });
    return map;
  }, [assignments]);

  // Override assignment map
  const overrideMap = useMemo(() => {
    const map = new Map<string, { assignmentId: number; taskId: number; originalDate: string }[]>();
    for (const a of overrideEntries) {
      if (!a.originalDate) continue;
      const key = a.plannedDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ assignmentId: a.id, taskId: a.taskId, originalDate: a.originalDate });
    }
    return map;
  }, [overrideEntries]);

  const assignedTaskIds = useMemo(() => {
    const ids = new Set<number>();
    effectiveSchedule.forEach(taskIds => taskIds.forEach(id => ids.add(id)));
    assignments.filter(a => !a.originalDate).forEach(a => ids.add(a.taskId));
    return ids;
  }, [effectiveSchedule, assignments]);

  // Tasks completed this week that aren't auto-scheduled — place on calendar at completion date
  const completedUnscheduledMap = useMemo(() => {
    const map = new Map<string, TaskWithDetails[]>();
    const weekDateStrs = new Set(weekDays.map(formatDateKey));
    tasks.forEach(task => {
      if (task.isArchived) return;
      if (assignedTaskIds.has(task.id)) return;
      if (!task.lastCompletedAt) return;
      const completedDateStr = formatDateKey(new Date(task.lastCompletedAt));
      if (!weekDateStrs.has(completedDateStr)) return;
      if (!map.has(completedDateStr)) map.set(completedDateStr, []);
      map.get(completedDateStr)!.push(task);
    });
    return map;
  }, [tasks, assignedTaskIds, weekDays]);

  const completedOnCalendarIds = useMemo(() => {
    const ids = new Set<number>();
    completedUnscheduledMap.forEach(tasks => tasks.forEach(t => ids.add(t.id)));
    return ids;
  }, [completedUnscheduledMap]);

  const unscheduledTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.isArchived) return false;
      if (assignedTaskIds.has(task.id)) return false;

      // Task completed this week and placed on calendar
      if (completedOnCalendarIds.has(task.id)) {
        // Keep in unscheduled only if it's a frequency task with remaining instances
        if (task.taskType === 'frequency' && task.targetCount &&
            (task.completionsThisPeriod ?? 0) < task.targetCount) {
          return true;
        }
        return false;
      }

      if (task.nextDue) {
        const nextDue = parseISO(task.nextDue);
        return (isBefore(nextDue, weekEnd) || isSameDay(nextDue, weekEnd)) &&
               (isAfter(nextDue, weekStart) || isSameDay(nextDue, weekStart) || task.status === 'overdue');
      }
      return task.status === 'overdue' || task.status === 'due_soon' || task.status === 'never_done';
    });
  }, [tasks, assignedTaskIds, completedOnCalendarIds, weekStart, weekEnd]);

  const dayColumns: DayTasks[] = useMemo(() => {
    return weekDays.map(date => {
      const dateStr = formatDateKey(date);
      const autoIds = effectiveSchedule.get(dateStr) || new Set();
      const manualEntries = manualMap.get(dateStr) || [];
      const overrideEntriesForDay = overrideMap.get(dateStr) || [];

      const taskEntries: DayTaskEntry[] = [];
      const seenIds = new Set<number>();

      for (const id of Array.from(autoIds)) {
        if (seenIds.has(id)) continue;
        const task = tasksById.get(id);
        if (!task) continue;
        seenIds.add(id);
        const overrideEntry = overrideEntriesForDay.find(o => o.taskId === id);
        const daysPresent = taskDaysMap.get(id)?.size ?? 0;
        taskEntries.push({
          task,
          assignmentId: overrideEntry?.assignmentId,
          rootOriginalDate: overrideEntry?.originalDate,
          isMovable: daysPresent < 7,
        });
      }

      for (const e of manualEntries) {
        if (seenIds.has(e.taskId)) continue;
        const task = tasksById.get(e.taskId);
        if (!task) continue;
        seenIds.add(e.taskId);
        taskEntries.push({
          task,
          assignmentId: e.assignmentId,
          isMovable: true,
        });
      }

      // Add completed-this-week unscheduled tasks on their completion date
      const completedEntries = completedUnscheduledMap.get(dateStr) || [];
      for (const task of completedEntries) {
        if (seenIds.has(task.id)) continue;
        seenIds.add(task.id);
        taskEntries.push({
          task,
          isMovable: false,
          isCompletedPlacement: true,
        });
      }

      return { date, dateStr, tasks: taskEntries };
    });
  }, [weekDays, effectiveSchedule, manualMap, overrideMap, tasksById, taskDaysMap, completedUnscheduledMap]);

  // Viable target days for the currently selected task
  const viableTargetDays = useMemo(() => {
    if (!selectedTask) return new Set<string>();
    const occupiedDays = taskDaysMap.get(selectedTask.taskId) ?? new Set<string>();
    const viable = new Set<string>();
    for (const d of allDateStrs) {
      if (d === selectedTask.sourceDate) continue;
      if (!occupiedDays.has(d)) viable.add(d);
    }
    return viable;
  }, [selectedTask, taskDaysMap, allDateStrs]);

  const weekStats = useMemo(() => {
    let total = 0;
    let done = 0;
    dayColumns.forEach(col => {
      col.tasks.forEach(({ task }) => {
        total++;
        if (isTaskDoneOnDay(task, col.date)) {
          done++;
        }
      });
    });
    return { total, done };
  }, [dayColumns]);

  const weekProgress = weekStats.total > 0 ? Math.round((weekStats.done / weekStats.total) * 100) : 0;
  const hasManualAssignments = assignments.length > 0;

  const movableTaskCount = useMemo(() => {
    let count = 0;
    dayColumns.forEach(col => {
      col.tasks.forEach(({ isMovable, task }) => {
        if (isMovable && !isTaskDoneOnDay(task, col.date)) count++;
      });
    });
    return count;
  }, [dayColumns]);

  const handleMoveClick = useCallback((taskId: number, sourceDate?: string, assignmentId?: number, rootOriginalDate?: string) => {
    setSelectedTask(prev => {
      if (prev && prev.taskId === taskId && prev.sourceDate === sourceDate) return null;
      return { taskId, sourceDate, assignmentId, rootOriginalDate };
    });
    setExpandedCardKey(null);
  }, []);

  const handleDayClick = useCallback(async (targetDate: string) => {
    if (!selectedTask) return;
    if (selectedTask.sourceDate === targetDate) {
      setSelectedTask(null);
      return;
    }

    const previousAssignment = selectedTask.assignmentId
      ? {
          taskId: selectedTask.taskId,
          plannedDate: selectedTask.sourceDate!,
          originalDate: selectedTask.rootOriginalDate,
        }
      : undefined;

    const originalDate = selectedTask.rootOriginalDate || selectedTask.sourceDate || undefined;

    setSelectedTask(null);

    try {
      if (selectedTask.assignmentId) {
        await deleteAssignment.mutateAsync(selectedTask.assignmentId);
      }

      const data = await createAssignment.mutateAsync(
        { taskId: selectedTask.taskId, plannedDate: targetDate, originalDate },
      );

      setUndoStack(prev => [...prev, {
        createdAssignmentId: data.id,
        previousAssignment,
      }]);
    } catch {
      // Mutations already show toast on error via the hook
    }
  }, [selectedTask, createAssignment, deleteAssignment]);

  const handleUndo = useCallback(async () => {
    const lastAction = undoStack[undoStack.length - 1];
    if (!lastAction) return;

    setUndoStack(prev => prev.slice(0, -1));

    try {
      await deleteAssignment.mutateAsync(lastAction.createdAssignmentId);

      if (lastAction.previousAssignment) {
        await createAssignment.mutateAsync(lastAction.previousAssignment);
      }
    } catch {
      // Mutations already show toast on error via the hook
    }
  }, [undoStack, createAssignment, deleteAssignment]);

  const handleReset = useCallback(() => {
    resetAssignments.mutate(
      { start: startStr, end: endStr },
      {
        onSuccess: () => {
          setUndoStack([]);
          setConfirmReset(false);
          setSelectedTask(null);
          setMoveMode(false);
        },
      },
    );
  }, [resetAssignments, startStr, endStr]);

  const handleCardClick = useCallback((key: string) => {
    setExpandedCardKey(prev => prev === key ? null : key);
  }, []);

  const toggleMoveMode = useCallback(() => {
    setMoveMode(prev => {
      if (!prev) setSelectedTask(null);
      return !prev;
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-3"
      style={containerHeight ? { height: containerHeight } : undefined}
    >
      {/* Week navigation + progress */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(o => o - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <button
            onClick={() => setWeekOffset(0)}
            className="text-sm font-medium hover:text-primary transition-colors px-1"
          >
            {weekOffset === 0 ? "This Week" : format(weekStart, "MMM d") + " – " + format(weekEnd, "MMM d, yyyy")}
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(o => o + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} className="text-xs h-7 ml-1">
              <Calendar className="w-3 h-3 mr-1" /> Today
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Progress value={weekProgress} className="h-1.5 w-20" />
            <span className="text-xs text-muted-foreground tabular-nums">
              {weekStats.done}/{weekStats.total}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="h-7 w-7"
                >
                  {showCompleted ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showCompleted ? "Hide completed" : "Show completed"}
              </TooltipContent>
            </Tooltip>
            {undoStack.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleUndo} className="h-7 w-7">
                    <Undo2 className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo ({undoStack.length})</TooltipContent>
              </Tooltip>
            )}
            {hasManualAssignments && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => confirmReset ? handleReset() : setConfirmReset(true)}
                    disabled={resetAssignments.isPending}
                    className={`h-7 w-7 ${confirmReset ? "text-destructive" : ""}`}
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${resetAssignments.isPending ? "animate-spin" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {confirmReset ? "Click again to confirm reset" : "Reset week to defaults"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {movableTaskCount > 0 && (
            <Button
              variant={moveMode ? "default" : "outline"}
              size="sm"
              onClick={toggleMoveMode}
              className="h-7 text-xs gap-1"
            >
              <MoveHorizontal className="w-3 h-3" />
              {moveMode ? "Done" : "Rearrange"}
            </Button>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      {selectedTask && (
        <div className="text-xs text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 flex items-center justify-between">
          <span>
            Click a highlighted day to move <strong>{tasksById.get(selectedTask.taskId)?.title}</strong> there
          </span>
          <button onClick={() => setSelectedTask(null)} className="text-primary hover:text-primary/70 font-medium ml-2">
            Cancel
          </button>
        </div>
      )}

      {/* Move mode indicator */}
      {moveMode && !selectedTask && (
        <div className="text-xs text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
          Click a highlighted task to select it, then click a day to move it there
        </div>
      )}

      {/* Weekly grid */}
      <div className="overflow-x-auto -mx-2 px-2 flex-1 min-h-0">
        <div className="grid grid-cols-7 gap-2 min-w-[700px] h-full">
          {dayColumns.map(col => (
            <DayColumn
              key={col.dateStr}
              day={col}
              isToday={isSameDay(col.date, now)}
              isPast={isBefore(col.date, now) && !isSameDay(col.date, now)}
              showCompleted={showCompleted}
              isDropTarget={!!selectedTask}
              isViableTarget={viableTargetDays.has(col.dateStr)}
              selectedTaskId={selectedTask?.taskId ?? null}
              selectedSourceDate={selectedTask?.sourceDate}
              expandedCardKey={expandedCardKey}
              moveMode={moveMode}
              onDayClick={handleDayClick}
              onCardClick={handleCardClick}
              onMoveClick={handleMoveClick}
            />
          ))}
        </div>
      </div>

      {/* Unscheduled tasks */}
      {unscheduledTasks.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Unscheduled
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
              {unscheduledTasks.length}
            </Badge>
          </h4>
          <div className="flex flex-wrap gap-2">
            {unscheduledTasks.map(task => {
              const freqLabel = task.taskType === 'frequency' && task.targetCount
                ? `${task.completionsThisPeriod ?? 0}/${task.targetCount}`
                : undefined;
              return (
                <CompactCard
                  key={task.id}
                  task={task}
                  cardKey={`${task.id}-unscheduled`}
                  isExpanded={expandedCardKey === `${task.id}-unscheduled`}
                  isSelected={selectedTask?.taskId === task.id && !selectedTask?.sourceDate}
                  isMovable={true}
                  moveMode={moveMode}
                  frequencyLabel={freqLabel}
                  onCardClick={(e) => {
                    e.stopPropagation();
                    if (moveMode) {
                      handleMoveClick(task.id);
                    } else {
                      handleCardClick(`${task.id}-unscheduled`);
                    }
                  }}
                  onMoveClick={(e) => {
                    e.stopPropagation();
                    handleMoveClick(task.id);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

// --- Day Column ---

function DayColumn({
  day,
  isToday,
  isPast,
  showCompleted,
  isDropTarget,
  isViableTarget,
  selectedTaskId,
  selectedSourceDate,
  expandedCardKey,
  moveMode,
  onDayClick,
  onCardClick,
  onMoveClick,
}: {
  day: DayTasks;
  isToday: boolean;
  isPast: boolean;
  showCompleted: boolean;
  isDropTarget: boolean;
  isViableTarget: boolean;
  selectedTaskId: number | null;
  selectedSourceDate?: string;
  expandedCardKey: string | null;
  moveMode: boolean;
  onDayClick: (dateStr: string) => void;
  onCardClick: (key: string) => void;
  onMoveClick: (taskId: number, sourceDate?: string, assignmentId?: number, rootOriginalDate?: string) => void;
}) {
  const incompleteTasks = day.tasks.filter(({ task }) => !isTaskDoneOnDay(task, day.date));
  const completedTasks = day.tasks.filter(({ task }) => isTaskDoneOnDay(task, day.date));
  const visibleTasks = showCompleted ? [...incompleteTasks, ...completedTasks] : incompleteTasks;

  const isSourceDay = selectedSourceDate === day.dateStr;
  const canDrop = isDropTarget && isViableTarget && !isSourceDay;

  return (
    <div
      onClick={canDrop ? () => onDayClick(day.dateStr) : undefined}
      className={`
        rounded-xl border p-2 flex flex-col gap-1.5 transition-colors
        ${isToday ? "border-primary/50 bg-primary/5" : "border-border bg-card/50"}
        ${canDrop ? "cursor-pointer border-primary bg-primary/10 ring-1 ring-primary/40" : ""}
        ${isDropTarget && !canDrop && !isSourceDay ? "opacity-40" : ""}
        ${isPast && !isDropTarget ? "opacity-70" : ""}
      `}
    >
      <div className={`text-xs font-medium mb-1 flex items-center justify-between ${isToday ? "text-primary" : "text-muted-foreground"}`}>
        <span>
          {isToday ? "Today" : format(day.date, "EEE")}
        </span>
        <span className={isToday ? "text-primary font-bold" : ""}>
          {format(day.date, "d")}
        </span>
      </div>

      {visibleTasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground/50">—</span>
        </div>
      )}

      {visibleTasks.map(({ task, assignmentId, rootOriginalDate, isMovable }) => {
        const isDone = isTaskDoneOnDay(task, day.date);
        const cardKey = `${task.id}-${day.dateStr}`;
        const isSelected = selectedTaskId === task.id && selectedSourceDate === day.dateStr;
        const isExpanded = expandedCardKey === cardKey;
        return (
          <div key={task.id} className={isDone ? "opacity-50" : ""}>
            <CompactCard
              task={task}
              cardKey={cardKey}
              isDone={isDone}
              isSelected={isSelected}
              isExpanded={isExpanded}
              isMovable={isMovable}
              moveMode={moveMode}
              compact
              onCardClick={(e) => {
                e.stopPropagation();
                if (moveMode && isMovable && !isDone) {
                  onMoveClick(task.id, day.dateStr, assignmentId, rootOriginalDate);
                } else {
                  onCardClick(cardKey);
                }
              }}
              onMoveClick={(e) => {
                e.stopPropagation();
                if (isMovable) {
                  onMoveClick(task.id, day.dateStr, assignmentId, rootOriginalDate);
                }
              }}
            />
          </div>
        );
      })}

      {!showCompleted && completedTasks.length > 0 && (
        <div className="text-[10px] text-muted-foreground/60 text-center mt-auto pt-1">
          <Check className="w-3 h-3 inline mr-0.5" />{completedTasks.length} done
        </div>
      )}
    </div>
  );
}

// --- Compact Card ---

function CompactCard({
  task,
  cardKey,
  isDone,
  isSelected,
  isExpanded,
  isMovable,
  moveMode,
  compact,
  frequencyLabel,
  onCardClick,
  onMoveClick,
}: {
  task: TaskWithDetails;
  cardKey: string;
  isDone?: boolean;
  isSelected?: boolean;
  isExpanded?: boolean;
  isMovable: boolean;
  moveMode: boolean;
  compact?: boolean;
  frequencyLabel?: string;
  onCardClick: (e: React.MouseEvent) => void;
  onMoveClick: (e: React.MouseEvent) => void;
}) {
  const movableHighlight = moveMode && isMovable && !isDone;
  const statusColor = isDone
    ? "border-green-500/30"
    : task.status === "overdue"
    ? "border-red-500/40"
    : task.status === "due_soon"
    ? "border-yellow-500/40"
    : "border-border";

  return (
    <div
      onClick={onCardClick}
      className={`
        group flex items-start gap-1.5 rounded-lg border px-2 py-1.5 cursor-pointer
        transition-all select-none relative
        ${statusColor}
        ${isSelected ? "ring-2 ring-primary bg-primary/10" : "hover:bg-accent/50"}
        ${isDone ? "line-through text-muted-foreground" : ""}
        ${compact ? "text-[11px]" : "text-xs"}
        ${movableHighlight ? "ring-1 ring-primary/50 bg-primary/5 shadow-sm" : ""}
        ${moveMode && !movableHighlight && !isSelected ? "opacity-40" : ""}
      `}
    >
      {isDone && (
        <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
      )}
      {movableHighlight && !isSelected && (
        <MoveHorizontal className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
      )}
      <span className={`font-medium leading-tight ${isExpanded ? "" : "line-clamp-2"}`}>
        {task.title}
      </span>
      {frequencyLabel && (
        <span className="flex-shrink-0 text-[10px] text-muted-foreground bg-muted rounded px-1 py-0.5 leading-none">
          {frequencyLabel}
        </span>
      )}
      {!isDone && !moveMode && (
        isMovable ? (
          <button
            onClick={onMoveClick}
            className="flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity p-0.5 -mr-1"
            title="Move to another day"
          >
            <MoveHorizontal className="w-3 h-3" />
          </button>
        ) : (
          <span
            className="flex-shrink-0 ml-auto opacity-0 group-hover:opacity-40 transition-opacity p-0.5 -mr-1"
            title="This task is on every day and cannot be moved"
          >
            <Lock className="w-2.5 h-2.5" />
          </span>
        )
      )}
      {task.category && !compact && (
        <span className="text-[10px] text-muted-foreground line-clamp-1 ml-auto flex-shrink-0">
          {task.category.name}
        </span>
      )}
    </div>
  );
}

// --- Helpers ---

function isTaskDoneOnDay(task: TaskWithDetails, day: Date): boolean {
  const today = new Date();
  if (isSameDay(day, today) && task.completedToday) return true;
  if (task.lastCompletedAt) {
    const completedDate = new Date(task.lastCompletedAt);
    if (isSameDay(completedDate, day)) return true;
  }
  return false;
}
