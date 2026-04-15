import { useTasks } from "@/hooks/use-tasks";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Plus, SlidersHorizontal, LayoutGrid, List, X, Folder, Tag as TagIcon } from "lucide-react";
import { useState, useMemo } from "react";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { TaskWithDetails } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { useTags } from "@/hooks/use-tags";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const UNCATEGORIZED_FILTER = -1;

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [filterCategory, setFilterCategory] = useState<number | undefined>();
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const [createOpen, setCreateOpen] = useState(false);
  const [condensedView, setCondensedView] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  const hasActiveFilters = filterCategory !== undefined || filterTagIds.length > 0;

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    let result = tasks;

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
  }, [tasks, filterCategory, filterTagIds]);

  // Tasks filtered by tags only (for computing category counts with tag overlap)
  const tasksFilteredByTags = useMemo(() => {
    if (!tasks) return [];
    if (filterTagIds.length === 0) return tasks;
    return tasks.filter(t =>
      filterTagIds.every(tagId => t.tags?.some((tag: any) => tag.id === tagId))
    );
  }, [tasks, filterTagIds]);

  // Tasks filtered by category only (for computing tag counts with category overlap)
  const tasksFilteredByCategory = useMemo(() => {
    if (!tasks) return [];
    if (filterCategory === undefined) return tasks;
    if (filterCategory === UNCATEGORIZED_FILTER) return tasks.filter(t => !t.categoryId);
    return tasks.filter(t => t.categoryId === filterCategory);
  }, [tasks, filterCategory]);

  const toggleTagFilter = (tagId: number) => {
    setFilterTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const clearAllFilters = () => {
    setFilterCategory(undefined);
    setFilterTagIds([]);
  };

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

  const groupedTasks: Record<string, TaskWithDetails[]> = {
    overdue: [],
    due_soon: [],
    later: [],
    never_done: []
  };

  filteredTasks.forEach(task => {
    const status = task.status || 'later';
    if (groupedTasks[status]) {
      groupedTasks[status].push(task);
    } else {
      groupedTasks['later'].push(task);
    }
  });

  Object.keys(groupedTasks).forEach(key => {
    groupedTasks[key].sort((a, b) => (a.daysUntilDue || 9999) - (b.daysUntilDue || 9999));
  });

  const sections = [
    { id: 'overdue', label: 'Overdue', color: 'text-[hsl(var(--urgency-overdue))]', count: groupedTasks.overdue.length },
    { id: 'due_soon', label: 'Due Soon', color: 'text-[hsl(var(--urgency-soon))]', count: groupedTasks.due_soon.length },
    { id: 'later', label: 'Up Next', color: 'text-[hsl(var(--urgency-later))]', count: groupedTasks.later.length },
    { id: 'never_done', label: 'Never Completed', color: 'text-muted-foreground', count: groupedTasks.never_done.length },
  ];

  const hasTasks = filteredTasks.length > 0;
  const totalUnfiltered = tasks?.length ?? 0;

  const getActiveFilterLabel = () => {
    if (filterCategory === UNCATEGORIZED_FILTER) return "Uncategorized";
    if (filterCategory !== undefined) {
      return categories?.find(c => c.id === filterCategory)?.name ?? "Category";
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight text-foreground">
            Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">
            Welcome back. You have {groupedTasks.overdue.length} urgent tasks.
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
              <Button variant={hasActiveFilters ? "default" : "outline"} className="gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Filter
                {hasActiveFilters && (
                  <span className="ml-1 bg-primary-foreground/20 text-primary-foreground px-1.5 py-0.5 rounded-full text-xs">
                    {filteredTasks.length}
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
                <span className="font-medium text-foreground">{filteredTasks.length} of {tasks?.length ?? 0} tasks</span>
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
          {getActiveFilterLabel() && (
            <Badge
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => setFilterCategory(undefined)}
            >
              <Folder className="w-3 h-3" />
              {getActiveFilterLabel()}
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
          {totalUnfiltered !== filteredTasks.length && (
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredTasks.length} of {totalUnfiltered} tasks
            </span>
          )}
        </div>
      )}

      {/* Task List */}
      <div className="space-y-8">
        {!hasTasks ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl bg-card/50">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            {hasActiveFilters ? (
              <>
                <h3 className="text-lg font-medium">No matching tasks</h3>
                <p className="text-muted-foreground mb-4">No tasks match your current filters.</p>
                <Button variant="outline" onClick={clearAllFilters}>Clear Filters</Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium">No tasks yet</h3>
                <p className="text-muted-foreground mb-4">Create your first maintenance task to get started.</p>
                <Button onClick={() => setCreateOpen(true)}>Create Task</Button>
              </>
            )}
          </div>
        ) : (
          sections.map(section => {
            if (section.count === 0) return null;
            
            const sectionTasks = groupedTasks[section.id];
            
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
                  {sectionTasks.map(task => (
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

      {createOpen && <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  );
}
