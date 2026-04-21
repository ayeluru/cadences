import { useTasks } from "@/hooks/use-tasks";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Plus, SlidersHorizontal, LayoutGrid, List, X, Folder, Tag as TagIcon, Check, ChevronDown, ChevronRight } from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { WeekView } from "@/components/WeekView";

const UNCATEGORIZED_FILTER = -1;

type DashboardTab = "today" | "week" | "all";

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
  const [activeTab, setActiveTab] = useState<DashboardTab>("today");
  const [showDueToday, setShowDueToday] = useState(true);
  const [showCouldDo, setShowCouldDo] = useState(false);
  const [showDueSoon, setShowDueSoon] = useState(false);
  const [showNeverDone, setShowNeverDone] = useState(false);
  const [showCompletedToday, setShowCompletedToday] = useState(false);

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

  const tasksFilteredByTags = useMemo(() => {
    if (!tasks) return [];
    if (filterTagIds.length === 0) return tasks;
    return tasks.filter(t =>
      filterTagIds.every(tagId => t.tags?.some((tag: any) => tag.id === tagId))
    );
  }, [tasks, filterTagIds]);

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

  // Today view: 5 sections — uses server-computed effectiveDueToday
  const todayTasks = useMemo(() => {
    const dueToday: TaskWithDetails[] = [];
    const couldDo: TaskWithDetails[] = [];
    const dueSoon: TaskWithDetails[] = [];
    const neverDone: TaskWithDetails[] = [];
    const completedToday: TaskWithDetails[] = [];

    filteredTasks.forEach(task => {
      if (task.status === 'never_done') {
        neverDone.push(task);
        return;
      }

      // Daily frequency tasks (e.g. 8x/day) stay actionable until the daily goal is fully met
      const isDailyFreqUnmet = task.taskType === 'frequency' && task.targetPeriod === 'day'
        && task.targetCount && (task.completionsThisPeriod ?? 0) < task.targetCount;

      if (task.completedToday && task.taskType === 'frequency' && !isDailyFreqUnmet) {
        completedToday.push(task);
        return;
      }

      const wouldBeDueToday = isDailyFreqUnmet || (task.effectiveDueToday ?? false);

      const frequencyGoalMet = task.taskType === 'frequency' && (task.targetProgress ?? 0) >= 100;

      const wouldBeCouldDo =
        !wouldBeDueToday && (
          (task.taskType === 'frequency' && (task.targetProgress ?? 0) < 100 && task.status === 'later') ||
          (!frequencyGoalMet && task.status === 'later' && task.daysUntilDue !== undefined && task.daysUntilDue <= 7 && task.daysUntilDue > 0)
        );

      const wouldBeDueSoon =
        !wouldBeDueToday && (
          task.status === 'due_soon' && task.daysUntilDue !== undefined && task.daysUntilDue > 0
        );

      const isRelevantToToday = wouldBeDueToday || wouldBeCouldDo || wouldBeDueSoon;

      if (task.completedToday && isRelevantToToday && !isDailyFreqUnmet) {
        completedToday.push(task);
        return;
      }

      if (task.completedToday && !isDailyFreqUnmet) return;

      if (wouldBeDueToday) {
        dueToday.push(task);
      } else if (wouldBeCouldDo) {
        couldDo.push(task);
      } else if (wouldBeDueSoon) {
        dueSoon.push(task);
      }
    });

    const byUrgency = (a: TaskWithDetails, b: TaskWithDetails) => (b.urgency || 0) - (a.urgency || 0);
    dueToday.sort(byUrgency);
    couldDo.sort(byUrgency);
    dueSoon.sort(byUrgency);
    neverDone.sort(byUrgency);
    completedToday.sort(byUrgency);

    return { dueToday, couldDo, dueSoon, neverDone, completedToday };
  }, [filteredTasks]);

  const todayTotal = todayTasks.dueToday.length + todayTasks.completedToday.length;
  const todayProgress = todayTotal > 0 ? Math.round((todayTasks.completedToday.length / todayTotal) * 100) : 0;

  // All Tasks view: grouped by status (existing behavior)
  const groupedTasks: Record<string, TaskWithDetails[]> = useMemo(() => {
    const groups: Record<string, TaskWithDetails[]> = {
      overdue: [],
      due_soon: [],
      later: [],
      never_done: []
    };

    filteredTasks.forEach(task => {
      const status = task.status || 'later';
      if (groups[status]) {
        groups[status].push(task);
      } else {
        groups['later'].push(task);
      }
    });

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => (a.daysUntilDue || 9999) - (b.daysUntilDue || 9999));
    });

    return groups;
  }, [filteredTasks]);

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

  const getSubtitle = () => {
    if (activeTab === "today") {
      if (todayTasks.completedToday.length === todayTotal && todayTotal > 0) {
        return "All done for today!";
      }
      return `${todayTasks.dueToday.length} task${todayTasks.dueToday.length !== 1 ? "s" : ""} remaining today.`;
    }
    if (activeTab === "week") {
      return "Plan and track your week.";
    }
    return `You have ${groupedTasks.overdue.length} urgent task${groupedTasks.overdue.length !== 1 ? "s" : ""}.`;
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display tracking-tight text-foreground">
            Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">
            {getSubtitle()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab !== "week" && (
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
          )}

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

      {/* Tab Bar */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DashboardTab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="today" className="flex-1 sm:flex-initial">
            Today
            {todayTasks.dueToday.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                {todayTasks.dueToday.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="week" className="flex-1 sm:flex-initial">This Week</TabsTrigger>
          <TabsTrigger value="all" className="flex-1 sm:flex-initial">
            All Tasks
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
              {filteredTasks.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab Content */}
      {activeTab === "today" && (
        <TodayView
          todayTasks={todayTasks}
          todayTotal={todayTotal}
          todayProgress={todayProgress}
          showDueToday={showDueToday}
          onToggleShowDueToday={() => setShowDueToday(!showDueToday)}
          showCouldDo={showCouldDo}
          onToggleShowCouldDo={() => setShowCouldDo(!showCouldDo)}
          showDueSoon={showDueSoon}
          onToggleShowDueSoon={() => setShowDueSoon(!showDueSoon)}
          showNeverDone={showNeverDone}
          onToggleShowNeverDone={() => setShowNeverDone(!showNeverDone)}
          showCompleted={showCompletedToday}
          onToggleShowCompleted={() => setShowCompletedToday(!showCompletedToday)}
          condensedView={condensedView}
          expandedTaskId={expandedTaskId}
          onToggleExpand={(id) => setExpandedTaskId(expandedTaskId === id ? null : id)}
          onCreateOpen={() => setCreateOpen(true)}
        />
      )}

      {activeTab === "week" && (
        <WeekView tasks={filteredTasks} />
      )}

      {activeTab === "all" && (
        <AllTasksView
          hasTasks={hasTasks}
          hasActiveFilters={hasActiveFilters}
          groupedTasks={groupedTasks}
          sections={sections}
          condensedView={condensedView}
          expandedTaskId={expandedTaskId}
          onToggleExpand={(id) => setExpandedTaskId(expandedTaskId === id ? null : id)}
          onCreateOpen={() => setCreateOpen(true)}
          clearAllFilters={clearAllFilters}
        />
      )}

      {createOpen && <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  );
}

// --- Today View ---

function TodayView({
  todayTasks,
  todayTotal,
  todayProgress,
  showDueToday,
  onToggleShowDueToday,
  showCouldDo,
  onToggleShowCouldDo,
  showDueSoon,
  onToggleShowDueSoon,
  showNeverDone,
  onToggleShowNeverDone,
  showCompleted,
  onToggleShowCompleted,
  condensedView,
  expandedTaskId,
  onToggleExpand,
  onCreateOpen,
}: {
  todayTasks: { dueToday: TaskWithDetails[]; couldDo: TaskWithDetails[]; dueSoon: TaskWithDetails[]; neverDone: TaskWithDetails[]; completedToday: TaskWithDetails[] };
  todayTotal: number;
  todayProgress: number;
  showDueToday: boolean;
  onToggleShowDueToday: () => void;
  showCouldDo: boolean;
  onToggleShowCouldDo: () => void;
  showDueSoon: boolean;
  onToggleShowDueSoon: () => void;
  showNeverDone: boolean;
  onToggleShowNeverDone: () => void;
  showCompleted: boolean;
  onToggleShowCompleted: () => void;
  condensedView: boolean;
  expandedTaskId: number | null;
  onToggleExpand: (id: number) => void;
  onCreateOpen: () => void;
}) {
  const hasAnything = todayTasks.dueToday.length + todayTasks.couldDo.length + todayTasks.dueSoon.length + todayTasks.neverDone.length + todayTasks.completedToday.length > 0;

  if (!hasAnything) {
    return (
      <div className="text-center py-20 border-2 border-dashed rounded-xl bg-card/50">
        <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
          <Check className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium">Nothing due today</h3>
        <p className="text-muted-foreground mb-4">You're all caught up! Create a new task or check the "All Tasks" tab.</p>
        <Button onClick={onCreateOpen}>Create Task</Button>
      </div>
    );
  }

  const allDone = todayTasks.dueToday.length === 0 && todayTasks.completedToday.length > 0;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      {todayTotal > 0 && (
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {allDone ? (
                <span className="text-green-500">All done for today!</span>
              ) : (
                <>
                  <span className="text-foreground">{todayTasks.completedToday.length}</span>
                  <span className="text-muted-foreground"> of {todayTotal} done</span>
                </>
              )}
            </span>
            <span className="text-sm font-medium text-muted-foreground">{todayProgress}%</span>
          </div>
          <Progress value={todayProgress} className="h-2" />
        </div>
      )}

      {/* 1. Due Today — collapsible, open by default */}
      {todayTasks.dueToday.length > 0 && (
        <CollapsibleTaskSection
          label="Due Today"
          color="text-foreground"
          tasks={todayTasks.dueToday}
          isOpen={showDueToday}
          onToggle={onToggleShowDueToday}
          condensedView={condensedView}
          expandedTaskId={expandedTaskId}
          onToggleExpand={onToggleExpand}
        />
      )}

      {/* 2. Could Do — collapsed by default */}
      {todayTasks.couldDo.length > 0 && (
        <CollapsibleTaskSection
          label="Could Do"
          color="text-[hsl(var(--urgency-later))]"
          tasks={todayTasks.couldDo}
          isOpen={showCouldDo}
          onToggle={onToggleShowCouldDo}
          condensedView={condensedView}
          expandedTaskId={expandedTaskId}
          onToggleExpand={onToggleExpand}
        />
      )}

      {/* 3. Due Soon — collapsed by default */}
      {todayTasks.dueSoon.length > 0 && (
        <CollapsibleTaskSection
          label="Due Soon"
          color="text-[hsl(var(--urgency-soon))]"
          tasks={todayTasks.dueSoon}
          isOpen={showDueSoon}
          onToggle={onToggleShowDueSoon}
          condensedView={condensedView}
          expandedTaskId={expandedTaskId}
          onToggleExpand={onToggleExpand}
        />
      )}

      {/* 4. Never Done — collapsed by default */}
      {todayTasks.neverDone.length > 0 && (
        <CollapsibleTaskSection
          label="Never Done"
          color="text-muted-foreground"
          tasks={todayTasks.neverDone}
          isOpen={showNeverDone}
          onToggle={onToggleShowNeverDone}
          condensedView={condensedView}
          expandedTaskId={expandedTaskId}
          onToggleExpand={onToggleExpand}
        />
      )}

      {/* 5. Completed Today — collapsed by default */}
      {todayTasks.completedToday.length > 0 && (
        <CollapsibleTaskSection
          label="Completed Today"
          color="text-green-500"
          icon={<Check className="w-4 h-4 text-green-500" />}
          tasks={todayTasks.completedToday}
          isOpen={showCompleted}
          onToggle={onToggleShowCompleted}
          condensedView={condensedView}
          expandedTaskId={expandedTaskId}
          onToggleExpand={onToggleExpand}
          dimmed
        />
      )}
    </div>
  );
}

// --- Reusable section components ---

function TaskSection({
  label,
  color,
  tasks,
  condensedView,
  expandedTaskId,
  onToggleExpand,
}: {
  label: string;
  color: string;
  tasks: TaskWithDetails[];
  condensedView: boolean;
  expandedTaskId: number | null;
  onToggleExpand: (id: number) => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${color}`}>
        {label}
        <span className="bg-muted px-2 py-0.5 rounded-full text-xs text-foreground font-normal">
          {tasks.length}
        </span>
      </h3>
      <div className={condensedView ? "space-y-1" : "space-y-4"}>
        <AnimatePresence mode="popLayout">
          {tasks.map(task => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <TaskCard
                task={task}
                condensed={condensedView}
                expanded={expandedTaskId === task.id}
                onToggleExpand={() => onToggleExpand(task.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

function CollapsibleTaskSection({
  label,
  color,
  icon,
  tasks,
  isOpen,
  onToggle,
  condensedView,
  expandedTaskId,
  onToggleExpand,
  dimmed,
}: {
  label: string;
  color: string;
  icon?: React.ReactNode;
  tasks: TaskWithDetails[];
  isOpen: boolean;
  onToggle: () => void;
  condensedView: boolean;
  expandedTaskId: number | null;
  onToggleExpand: (id: number) => void;
  dimmed?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider hover:text-foreground transition-colors ${color}`}
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {icon}
        {label}
        <span className="bg-muted px-2 py-0.5 rounded-full text-xs text-foreground font-normal">
          {tasks.length}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`${condensedView ? "space-y-1" : "space-y-4"} ${dimmed ? "opacity-55" : ""}`}>
              {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  condensed={condensedView}
                  expanded={expandedTaskId === task.id}
                  onToggleExpand={() => onToggleExpand(task.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// --- All Tasks View ---

function AllTasksView({
  hasTasks,
  hasActiveFilters,
  groupedTasks,
  sections,
  condensedView,
  expandedTaskId,
  onToggleExpand,
  onCreateOpen,
  clearAllFilters,
}: {
  hasTasks: boolean;
  hasActiveFilters: boolean;
  groupedTasks: Record<string, TaskWithDetails[]>;
  sections: { id: string; label: string; color: string; count: number }[];
  condensedView: boolean;
  expandedTaskId: number | null;
  onToggleExpand: (id: number) => void;
  onCreateOpen: () => void;
  clearAllFilters: () => void;
}) {
  return (
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
              <Button onClick={onCreateOpen}>Create Task</Button>
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
                    onToggleExpand={() => onToggleExpand(task.id)}
                  />
                ))}
              </div>
            </motion.section>
          );
        })
      )}
    </div>
  );
}
