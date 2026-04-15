import { useTasks } from "@/hooks/use-tasks";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, SlidersHorizontal, Calendar, LayoutGrid, List, Tag as TagIcon, X, Folder } from "lucide-react";
import { useState, useMemo } from "react";
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
import { useTags } from "@/hooks/use-tags";
import { motion } from "framer-motion";
import { filterTasksByCadence, getCadenceLabel, getCadenceDescription, type CadenceMagnitude } from "@/lib/task-utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const UNCATEGORIZED_FILTER = -1;

interface TasksByMagnitudeProps {
  magnitude: CadenceMagnitude;
}

export function TasksByMagnitude({ magnitude }: TasksByMagnitudeProps) {
  const [filterCategory, setFilterCategory] = useState<number | undefined>();
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const { data: allTasks, isLoading: tasksLoading } = useTasks();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const [createOpen, setCreateOpen] = useState(false);
  const [condensedView, setCondensedView] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  const hasActiveFilters = filterCategory !== undefined || filterTagIds.length > 0;

  const toggleTagFilter = (tagId: number) => {
    setFilterTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const clearAllFilters = () => {
    setFilterCategory(undefined);
    setFilterTagIds([]);
  };

  const filteredByOrg = useMemo(() => {
    if (!allTasks) return [];
    let result = allTasks;
    if (filterCategory === UNCATEGORIZED_FILTER) {
      result = result.filter(t => !t.categoryId);
    } else if (filterCategory !== undefined) {
      result = result.filter(t => t.categoryId === filterCategory);
    }
    if (filterTagIds.length > 0) {
      result = result.filter(t =>
        filterTagIds.every(tagId => t.tags?.some((tag: any) => tag.id === tagId))
      );
    }
    return result;
  }, [allTasks, filterCategory, filterTagIds]);

  // All tasks scoped to this magnitude (before org filters)
  const magnitudeTasks = useMemo(() => {
    if (!allTasks) return [];
    return filterTasksByCadence(allTasks, magnitude);
  }, [allTasks, magnitude]);

  // Tasks in this magnitude filtered by tags only (for category overlap counts)
  const tasksFilteredByTags = useMemo(() => {
    if (filterTagIds.length === 0) return magnitudeTasks;
    return magnitudeTasks.filter(t =>
      filterTagIds.every(tagId => t.tags?.some((tag: any) => tag.id === tagId))
    );
  }, [magnitudeTasks, filterTagIds]);

  // Tasks in this magnitude filtered by category only (for tag overlap counts)
  const tasksFilteredByCategory = useMemo(() => {
    if (filterCategory === undefined) return magnitudeTasks;
    if (filterCategory === UNCATEGORIZED_FILTER) return magnitudeTasks.filter(t => !t.categoryId);
    return magnitudeTasks.filter(t => t.categoryId === filterCategory);
  }, [magnitudeTasks, filterCategory]);

  const tasks = filteredByOrg ? filterTasksByCadence(filteredByOrg, magnitude) : [];

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
              <Button variant={hasActiveFilters ? "default" : "outline"} className="gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Filter
                {hasActiveFilters && (
                  <span className="ml-1 bg-primary-foreground/20 text-primary-foreground px-1.5 py-0.5 rounded-full text-xs">
                    {tasks.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5" />
                Category
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem 
                checked={filterCategory === undefined}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => setFilterCategory(undefined)}
              >
                <span className="flex-1">All Categories</span>
                <span className="text-xs text-muted-foreground">{tasksFilteredByTags.length}</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterCategory === UNCATEGORIZED_FILTER}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => setFilterCategory(filterCategory === UNCATEGORIZED_FILTER ? undefined : UNCATEGORIZED_FILTER)}
              >
                <span className="flex-1 italic">Uncategorized</span>
                <span className="text-xs text-muted-foreground">{tasksFilteredByTags.filter(t => !t.categoryId).length}</span>
              </DropdownMenuCheckboxItem>
              {categories?.map(cat => (
                <DropdownMenuCheckboxItem
                  key={cat.id}
                  checked={filterCategory === cat.id}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => setFilterCategory(filterCategory === cat.id ? undefined : cat.id)}
                >
                  <span className="flex-1">{cat.name}</span>
                  <span className="text-xs text-muted-foreground">{tasksFilteredByTags.filter(t => t.categoryId === cat.id).length}</span>
                </DropdownMenuCheckboxItem>
              ))}

              {tags && tags.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="flex items-center gap-1.5">
                    <TagIcon className="w-3.5 h-3.5" />
                    Tags
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {tags.map(tag => (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={filterTagIds.includes(tag.id)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={() => toggleTagFilter(tag.id)}
                    >
                      <span className="flex-1">{tag.name}</span>
                      <span className="text-xs text-muted-foreground">{tasksFilteredByCategory.filter(t => t.tags?.some((tt: any) => tt.id === tag.id)).length}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </>
              )}

              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs text-muted-foreground flex justify-between">
                <span>Showing</span>
                <span className="font-medium text-foreground">{tasks.length} of {magnitudeTasks.length} tasks</span>
              </div>

              {hasActiveFilters && (
                <DropdownMenuCheckboxItem
                  checked={false}
                  onCheckedChange={clearAllFilters}
                  className="text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear all filters
                </DropdownMenuCheckboxItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => setCreateOpen(true)} className="shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" /> New Task
          </Button>
        </div>
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filtering:</span>
          {filterCategory !== undefined && (
            <Badge
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => setFilterCategory(undefined)}
            >
              <Folder className="w-3 h-3" />
              {filterCategory === UNCATEGORIZED_FILTER
                ? "Uncategorized"
                : categories?.find(c => c.id === filterCategory)?.name ?? "Category"}
              <X className="w-3 h-3 ml-0.5" />
            </Badge>
          )}
          {filterTagIds.map(tagId => {
            const tag = tags?.find(t => t.id === tagId);
            if (!tag) return null;
            return (
              <Badge
                key={tagId}
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-secondary/80"
                onClick={() => toggleTagFilter(tagId)}
              >
                <TagIcon className="w-3 h-3" />
                {tag.name}
                <X className="w-3 h-3 ml-0.5" />
              </Badge>
            );
          })}
          <button
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

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

      {createOpen && <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  );
}
