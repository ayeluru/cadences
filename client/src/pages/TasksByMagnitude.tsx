import { useTasks } from "@/hooks/use-tasks";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Plus, SlidersHorizontal, Calendar, LayoutGrid, List } from "lucide-react";
import { useState } from "react";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { TaskWithDetails } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
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
import { filterTasksByCadence, getCadenceLabel, getCadenceDescription, type CadenceMagnitude } from "@/lib/task-utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TasksByMagnitudeProps {
  magnitude: CadenceMagnitude;
}

export function TasksByMagnitude({ magnitude }: TasksByMagnitudeProps) {
  const [filterCategory, setFilterCategory] = useState<number | undefined>();
  const { data: allTasks, isLoading: tasksLoading } = useTasks({ categoryId: filterCategory });
  const { data: categories } = useCategories();
  const [createOpen, setCreateOpen] = useState(false);
  const [condensedView, setCondensedView] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  const tasks = allTasks ? filterTasksByCadence(allTasks, magnitude) : [];

  if (tasksLoading) {
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

  // Group tasks by urgency
  const groupedTasks: Record<string, TaskWithDetails[]> = {
    overdue: [],
    due_soon: [],
    later: [],
    never_done: []
  };

  tasks.forEach(task => {
    const status = task.status || 'later';
    if (groupedTasks[status]) {
      groupedTasks[status].push(task);
    } else {
      groupedTasks['later'].push(task);
    }
  });

  // Sort within groups
  Object.keys(groupedTasks).forEach(key => {
    groupedTasks[key].sort((a, b) => (a.daysUntilDue || 9999) - (b.daysUntilDue || 9999));
  });

  const sections = [
    { id: 'overdue', label: 'Overdue', count: groupedTasks.overdue.length },
    { id: 'due_soon', label: 'Due Soon', count: groupedTasks.due_soon.length },
    { id: 'later', label: 'Up Next', count: groupedTasks.later.length },
    { id: 'never_done', label: 'Never Completed', count: groupedTasks.never_done.length },
  ];

  const hasTasks = tasks.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-6 h-6 text-primary" />
            <h2 className="text-3xl font-bold font-display tracking-tight text-foreground">
              {getCadenceLabel(magnitude)}
            </h2>
          </div>
          <p className="text-muted-foreground">
            {getCadenceDescription(magnitude)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCondensedView(!condensedView)}
                data-testid="button-toggle-view"
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
              <Calendar className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">No tasks at this cadence yet</p>
            <Button onClick={() => setCreateOpen(true)} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" /> Create One
            </Button>
          </div>
        ) : (
          sections.map((section) => (
            groupedTasks[section.id as keyof typeof groupedTasks].length > 0 && (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  {section.label}
                  <span className="text-sm font-normal text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                    {section.count}
                  </span>
                </h3>
                <div className={condensedView ? "space-y-1" : "space-y-3"}>
                  {groupedTasks[section.id as keyof typeof groupedTasks].map((task, index) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <TaskCard 
                        task={task} 
                        condensed={condensedView}
                        expanded={expandedTaskId === task.id}
                        onToggleExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )
          ))
        )}
      </div>

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
