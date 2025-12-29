import { useTasks } from "@/hooks/use-tasks";
import { useRoutines } from "@/hooks/use-routines";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Plus, SlidersHorizontal, LayoutGrid, List, Repeat } from "lucide-react";
import { useState } from "react";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { TaskWithDetails, Routine } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCategories } from "@/hooks/use-categories";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RoutineGroup {
  routine: Routine;
  tasks: TaskWithDetails[];
}

function groupTasksByRoutine(tasks: TaskWithDetails[], routines: Routine[] | undefined): { standalone: TaskWithDetails[]; routineGroups: RoutineGroup[] } {
  const routineMap = new Map<number, TaskWithDetails[]>();
  const standalone: TaskWithDetails[] = [];
  
  tasks.forEach(task => {
    if (task.routineId) {
      const existing = routineMap.get(task.routineId) || [];
      existing.push(task);
      routineMap.set(task.routineId, existing);
    } else {
      standalone.push(task);
    }
  });
  
  const routineGroups: RoutineGroup[] = [];
  routineMap.forEach((taskList, routineId) => {
    const routine = routines?.find(r => r.id === routineId);
    if (routine) {
      routineGroups.push({ routine, tasks: taskList });
    } else {
      standalone.push(...taskList);
    }
  });
  
  return { standalone, routineGroups };
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [filterCategory, setFilterCategory] = useState<number | undefined>();
  const { data: tasks, isLoading: tasksLoading } = useTasks({ categoryId: filterCategory });
  const { data: routines } = useRoutines();
  const { data: categories } = useCategories();
  const [createOpen, setCreateOpen] = useState(false);
  const [condensedView, setCondensedView] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  if (authLoading || tasksLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-10 w-48 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // Manually group tasks client-side for display order
  // Order: Overdue -> Due Soon -> Later -> Never Done
  // Filter out variations - they should only appear nested under their parent task
  const groupedTasks: Record<string, TaskWithDetails[]> = {
    overdue: [],
    due_soon: [],
    later: [],
    never_done: []
  };

  tasks?.forEach(task => {
    // Skip variations - they appear nested under their parent
    if (task.parentTaskId) return;
    
    const status = task.status || 'later'; // Default fallback
    if (groupedTasks[status]) {
      groupedTasks[status].push(task);
    } else {
      groupedTasks['later'].push(task);
    }
  });

  // Sort within groups by urgency (daysUntilDue)
  Object.keys(groupedTasks).forEach(key => {
    groupedTasks[key].sort((a, b) => (a.daysUntilDue || 9999) - (b.daysUntilDue || 9999));
  });

  const sections = [
    { id: 'overdue', label: 'Overdue', color: 'text-[hsl(var(--urgency-overdue))]', count: groupedTasks.overdue.length },
    { id: 'due_soon', label: 'Due Soon', color: 'text-[hsl(var(--urgency-soon))]', count: groupedTasks.due_soon.length },
    { id: 'later', label: 'Up Next', color: 'text-[hsl(var(--urgency-later))]', count: groupedTasks.later.length },
    { id: 'never_done', label: 'Never Completed', color: 'text-muted-foreground', count: groupedTasks.never_done.length },
  ];

  const hasTasks = tasks && tasks.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight text-foreground">
            Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user?.firstName}. You have {groupedTasks.overdue.length} urgent tasks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCondensedView(!condensedView)}
                data-testid="toggle-view-mode"
              >
                {condensedView ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {condensedView ? "Expanded view" : "Condensed view"}
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="w-4 h-4" /> Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem 
                checked={filterCategory === undefined}
                onCheckedChange={() => setFilterCategory(undefined)}
              >
                All Categories
              </DropdownMenuCheckboxItem>
              {categories?.map(cat => (
                <DropdownMenuCheckboxItem
                  key={cat.id}
                  checked={filterCategory === cat.id}
                  onCheckedChange={() => setFilterCategory(cat.id)}
                >
                  {cat.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => setCreateOpen(true)} className="shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" /> New Task
          </Button>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-8">
        {!hasTasks ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl bg-card/50">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No tasks yet</h3>
            <p className="text-muted-foreground mb-4">Create your first maintenance task to get started.</p>
            <Button onClick={() => setCreateOpen(true)}>Create Task</Button>
          </div>
        ) : (
          sections.map(section => {
            if (section.count === 0) return null;
            
            const sectionTasks = groupedTasks[section.id];
            const { standalone, routineGroups } = groupTasksByRoutine(sectionTasks, routines);
            
            return (
              <motion.section 
                key={section.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${section.color}`}>
                  {section.label}
                  <span className="bg-muted px-2 py-0.5 rounded-full text-xs text-foreground font-normal">
                    {section.count}
                  </span>
                </h3>
                <div className={condensedView ? "space-y-1" : "space-y-4"}>
                  {routineGroups.map(({ routine, tasks: routineTasks }) => (
                    <div 
                      key={`routine-${routine.id}`} 
                      className="border border-border/50 rounded-xl bg-muted/30 p-3 space-y-2"
                      data-testid={`routine-group-${routine.id}`}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2 px-1">
                        <Repeat className="w-4 h-4" />
                        <span>{routine.name}</span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {routineTasks.length} {routineTasks.length === 1 ? "task" : "tasks"}
                        </span>
                      </div>
                      <div className={condensedView ? "space-y-1" : "space-y-3"}>
                        {routineTasks.map(task => (
                          <TaskCard 
                            key={task.id} 
                            task={task} 
                            condensed={condensedView}
                            expanded={expandedTaskId === task.id}
                            onToggleExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {standalone.map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      condensed={condensedView}
                      expanded={expandedTaskId === task.id}
                      onToggleExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    />
                  ))}
                </div>
              </motion.section>
            );
          })
        )}
      </div>

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
