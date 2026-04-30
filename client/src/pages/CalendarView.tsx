import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { useTimezone } from "@/hooks/use-user-settings";
import { nowLocal, formatLocal } from "@/lib/tz";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, Loader2, AlertCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useProfileContext } from "@/contexts/ProfileContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

interface EnhancedCalendarDay {
  date: string;
  completions: Array<{ id: number; title: string; completedAt: string; taskId: number }>;
  missed: Array<{ id: number; title: string; dueDate: string }>;
  dueSoon: Array<{ id: number; title: string; dueDate: string }>;
}

export default function CalendarView() {
  const tz = useTimezone();
  const [currentMonth, setCurrentMonth] = useState(() => nowLocal(tz));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { currentProfile, isAggregatedView } = useProfileContext();

  const [heatMapSource, setHeatMapSource] = useState<"combined" | "completions" | "missed" | "upcoming">("combined");

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    completions: true,
    missed: true,
    dueSoon: true,
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = format(monthStart, "yyyy-MM-dd");
  const endDate = format(monthEnd, "yyyy-MM-dd");

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set("start", startDate);
    params.set("end", endDate);
    if (!isAggregatedView && currentProfile) {
      params.set("profileId", currentProfile.id.toString());
    } else {
      params.set("excludeDemo", "true");
    }
    return params.toString();
  };

  const { data: calendarData, isLoading } = useQuery<EnhancedCalendarDay[]>({
    queryKey: ["/api/calendar/enhanced", startDate, endDate, isAggregatedView ? "all" : currentProfile?.id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      const res = await fetch(`/api/calendar/enhanced?${buildQueryParams()}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch calendar data");
      return res.json();
    },
  });

  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDataForDay = (date: Date): EnhancedCalendarDay | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return calendarData?.find(d => d.date === dateStr);
  };

  const selectedDayData = selectedDate ? getDataForDay(selectedDate) : null;

  const getCombinedRatio = (dayData: EnhancedCalendarDay | undefined): { ratio: number; intensity: number } => {
    if (!dayData) return { ratio: 0, intensity: 0 };
    const completed = dayData.completions.length;
    const missed = dayData.missed.length;
    const total = completed + missed;
    if (total === 0) return { ratio: 0, intensity: 0 };
    const ratio = (completed - missed) / total;
    const intensity = Math.min(5, Math.ceil(total / 2));
    return { ratio, intensity };
  };

  const getHeatMapValue = (dayData: EnhancedCalendarDay | undefined) => {
    if (!dayData) return 0;
    switch (heatMapSource) {
      case "combined":
        return dayData.completions.length + dayData.missed.length;
      case "completions": return dayData.completions.length;
      case "missed": return dayData.missed.length;
      case "upcoming": return dayData.dueSoon.length;
      default: return 0;
    }
  };

  const getCombinedColor = (dayData: EnhancedCalendarDay | undefined): string => {
    const { ratio, intensity } = getCombinedRatio(dayData);
    if (intensity === 0) return "";

    if (ratio > 0.6) {
      const colors = [
        "bg-green-100/70 dark:bg-green-900/30",
        "bg-green-200/70 dark:bg-green-800/40",
        "bg-green-300/60 dark:bg-green-700/50",
        "bg-green-400/50 dark:bg-green-600/60",
        "bg-green-500/40 dark:bg-green-500/70",
      ];
      return colors[Math.min(intensity - 1, 4)];
    } else if (ratio > 0.2) {
      const colors = [
        "bg-green-50/80 dark:bg-green-950/30",
        "bg-green-100/60 dark:bg-green-900/35",
        "bg-green-200/50 dark:bg-green-800/40",
        "bg-green-200/70 dark:bg-green-700/50",
        "bg-green-300/50 dark:bg-green-600/60",
      ];
      return colors[Math.min(intensity - 1, 4)];
    } else if (ratio > -0.2) {
      const colors = [
        "bg-muted/50",
        "bg-muted/70",
        "bg-muted",
        "bg-muted-foreground/15",
        "bg-muted-foreground/25",
      ];
      return colors[Math.min(intensity - 1, 4)];
    } else if (ratio > -0.6) {
      const colors = [
        "bg-red-50/80 dark:bg-red-950/30",
        "bg-red-100/60 dark:bg-red-900/35",
        "bg-red-200/50 dark:bg-red-800/40",
        "bg-red-200/70 dark:bg-red-700/50",
        "bg-red-300/50 dark:bg-red-600/60",
      ];
      return colors[Math.min(intensity - 1, 4)];
    } else {
      const colors = [
        "bg-red-100/70 dark:bg-red-900/30",
        "bg-red-200/70 dark:bg-red-800/40",
        "bg-red-300/60 dark:bg-red-700/50",
        "bg-red-400/50 dark:bg-red-600/60",
        "bg-red-500/40 dark:bg-red-500/70",
      ];
      return colors[Math.min(intensity - 1, 4)];
    }
  };

  const getHeatMapColors = () => {
    switch (heatMapSource) {
      case "combined":
        return {
          l1: "bg-muted/50",
          l2: "bg-muted/70",
          l3: "bg-muted",
          l4: "bg-muted-foreground/15",
          l5: "bg-muted-foreground/25",
        };
      case "completions":
        return {
          l1: "bg-green-100/70 dark:bg-green-900/30",
          l2: "bg-green-200/70 dark:bg-green-800/40",
          l3: "bg-green-300/60 dark:bg-green-700/50",
          l4: "bg-green-400/50 dark:bg-green-600/60",
          l5: "bg-green-500/40 dark:bg-green-500/70",
        };
      case "missed":
        return {
          l1: "bg-red-100/70 dark:bg-red-900/30",
          l2: "bg-red-200/70 dark:bg-red-800/40",
          l3: "bg-red-300/60 dark:bg-red-700/50",
          l4: "bg-red-400/50 dark:bg-red-600/60",
          l5: "bg-red-500/40 dark:bg-red-500/70",
        };
      case "upcoming":
        return {
          l1: "bg-amber-100/70 dark:bg-amber-900/30",
          l2: "bg-amber-200/70 dark:bg-amber-800/40",
          l3: "bg-amber-300/60 dark:bg-amber-700/50",
          l4: "bg-amber-400/50 dark:bg-amber-600/60",
          l5: "bg-amber-500/40 dark:bg-amber-500/70",
        };
    }
  };

  const getDensityColor = (count: number, dayData?: EnhancedCalendarDay) => {
    if (heatMapSource === "combined" && dayData) {
      return getCombinedColor(dayData);
    }
    if (count === 0) return "";
    const colors = getHeatMapColors();
    if (count === 1) return colors.l1;
    if (count === 2) return colors.l2;
    if (count <= 4) return colors.l3;
    if (count <= 6) return colors.l4;
    return colors.l5;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48 rounded-lg" />
          <Skeleton className="h-9 w-64 rounded-lg" />
        </div>
        <Skeleton className="h-[420px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold font-display tracking-tight text-foreground">
          Calendar
        </h2>
        <p className="text-muted-foreground mt-1">
          View your completion history, missed tasks, and upcoming due dates.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1">
          <Button
            variant={heatMapSource === "combined" ? "default" : "outline"}
            size="sm"
            onClick={() => setHeatMapSource("combined")}
            className="gap-1.5 w-full"
            data-testid="heatmap-combined"
          >
            <div className="flex items-center gap-0.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div className="w-2 h-2 rounded-full bg-red-500" />
            </div>
            Balance
          </Button>
          <Button
            variant={heatMapSource === "completions" ? "default" : "outline"}
            size="sm"
            onClick={() => setHeatMapSource("completions")}
            className="gap-1.5 w-full"
            data-testid="heatmap-completions"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </Button>
          <Button
            variant={heatMapSource === "missed" ? "default" : "outline"}
            size="sm"
            onClick={() => setHeatMapSource("missed")}
            className="gap-1.5 w-full"
            data-testid="heatmap-missed"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Missed
          </Button>
          <Button
            variant={heatMapSource === "upcoming" ? "default" : "outline"}
            size="sm"
            onClick={() => setHeatMapSource("upcoming")}
            className="gap-1.5 w-full"
            data-testid="heatmap-upcoming"
          >
            <Clock className="w-3.5 h-3.5" />
            Upcoming
          </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold font-display tracking-tight">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(nowLocal(tz))}
                data-testid="button-today"
              >
                <CalendarIcon className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
            {calendarDays.map((day, idx) => {
              const dayData = getDataForDay(day);
              const heatValue = getHeatMapValue(dayData);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isSameDay(day, nowLocal(tz));

              const getDisplayValue = () => {
                if (heatMapSource === "combined" && dayData) {
                  const completed = dayData.completions.length;
                  const missed = dayData.missed.length;
                  if (completed === 0 && missed === 0) return null;
                  const diff = completed - missed;
                  if (diff > 0) return `+${diff}`;
                  if (diff < 0) return `${diff}`;
                  return "=";
                }
                return heatValue > 0 ? heatValue : null;
              };

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "aspect-square p-1 rounded-lg text-sm transition-all relative",
                    "hover:ring-2 hover:ring-primary/40",
                    !isCurrentMonth && "text-muted-foreground/40 opacity-40",
                    isCurrentMonth && getDensityColor(heatValue, dayData),
                    isSelected && "ring-2 ring-primary shadow-sm",
                    isTodayDate && !isSelected && "ring-1 ring-primary/30"
                  )}
                  data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                >
                  <span className={cn(
                    "absolute top-1 left-1/2 -translate-x-1/2 text-xs",
                    isTodayDate && "text-primary font-semibold"
                  )}>
                    {format(day, "d")}
                  </span>

                  {isCurrentMonth && getDisplayValue() !== null && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-muted-foreground">
                      {getDisplayValue()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            {heatMapSource === "combined" ? (
              <>
                <span className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-destructive" />
                  Missed
                </span>
                <div className="flex gap-0.5">
                  <div className="w-3 h-3 rounded-sm bg-red-300/60 dark:bg-red-700/50" />
                  <div className="w-3 h-3 rounded-sm bg-red-100/70 dark:bg-red-900/30" />
                  <div className="w-3 h-3 rounded-sm bg-muted" />
                  <div className="w-3 h-3 rounded-sm bg-green-100/70 dark:bg-green-900/30" />
                  <div className="w-3 h-3 rounded-sm bg-green-300/60 dark:bg-green-700/50" />
                </div>
                <span className="flex items-center gap-1">
                  Completed
                  <CheckCircle2 className="w-3 h-3 text-[hsl(var(--urgency-later))]" />
                </span>
              </>
            ) : (
              <>
                <span>Less</span>
                <div className="flex gap-0.5">
                  <div className={cn("w-3 h-3 rounded-sm", getHeatMapColors().l1)} />
                  <div className={cn("w-3 h-3 rounded-sm", getHeatMapColors().l2)} />
                  <div className={cn("w-3 h-3 rounded-sm", getHeatMapColors().l3)} />
                  <div className={cn("w-3 h-3 rounded-sm", getHeatMapColors().l4)} />
                  <div className={cn("w-3 h-3 rounded-sm", getHeatMapColors().l5)} />
                </div>
                <span>More</span>
              </>
            )}
          </div>
        </div>

        {/* Day Details */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-lg font-semibold font-display tracking-tight flex items-center gap-2 mb-4">
            <CalendarIcon className="w-5 h-5 text-primary" />
            {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a day"}
          </h3>

          {!selectedDate ? (
            <p className="text-muted-foreground text-sm">
              Click on a day to see details.
            </p>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedDate.toISOString()}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {(heatMapSource === "combined" || heatMapSource === "completions") && selectedDayData && selectedDayData.completions.length > 0 && (
                  <Collapsible open={expandedSections.completions} onOpenChange={() => toggleSection("completions")}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full p-2.5 rounded-lg border border-border/60 hover:border-border transition-colors">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[hsl(var(--urgency-later))]" />
                          <span className="text-sm font-medium">Completed</span>
                          <Badge variant="secondary" className="text-xs">
                            {selectedDayData.completions.length}
                          </Badge>
                        </div>
                        {expandedSections.completions ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                        {selectedDayData.completions.map((task, idx) => (
                          <div
                            key={`completion-${task.id}-${idx}`}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm border-l-2 border-[hsl(var(--urgency-later))] bg-muted/30"
                            data-testid={`completion-item-${task.id}`}
                          >
                            <span className="truncate flex-1">{task.title}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatLocal(task.completedAt, tz, "h:mm a")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {(heatMapSource === "combined" || heatMapSource === "missed") && selectedDayData && selectedDayData.missed.length > 0 && (
                  <Collapsible open={expandedSections.missed} onOpenChange={() => toggleSection("missed")}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full p-2.5 rounded-lg border border-border/60 hover:border-border transition-colors">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-destructive" />
                          <span className="text-sm font-medium">Missed</span>
                          <Badge variant="secondary" className="text-xs text-destructive">
                            {selectedDayData.missed.length}
                          </Badge>
                        </div>
                        {expandedSections.missed ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                        {selectedDayData.missed.map((task, idx) => (
                          <div
                            key={`missed-${task.id}-${idx}`}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm border-l-2 border-destructive bg-muted/30"
                            data-testid={`missed-item-${task.id}`}
                          >
                            <span className="truncate flex-1">{task.title}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {heatMapSource === "upcoming" && selectedDayData && selectedDayData.dueSoon.length > 0 && (
                  <Collapsible open={expandedSections.dueSoon} onOpenChange={() => toggleSection("dueSoon")}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full p-2.5 rounded-lg border border-border/60 hover:border-border transition-colors">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[hsl(var(--urgency-soon))]" />
                          <span className="text-sm font-medium">Upcoming</span>
                          <Badge variant="secondary" className="text-xs">
                            {selectedDayData.dueSoon.length}
                          </Badge>
                        </div>
                        {expandedSections.dueSoon ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                        {selectedDayData.dueSoon.map((task, idx) => (
                          <div
                            key={`due-${task.id}-${idx}`}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm border-l-2 border-[hsl(var(--urgency-soon))] bg-muted/30"
                            data-testid={`due-item-${task.id}`}
                          >
                            <span className="truncate flex-1">{task.title}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {selectedDayData && (() => {
                  const showEmpty =
                    (heatMapSource === "combined" && selectedDayData.completions.length === 0 && selectedDayData.missed.length === 0) ||
                    (heatMapSource === "completions" && selectedDayData.completions.length === 0) ||
                    (heatMapSource === "missed" && selectedDayData.missed.length === 0) ||
                    (heatMapSource === "upcoming" && selectedDayData.dueSoon.length === 0);

                  if (!showEmpty) return null;

                  const emptyMessages: Record<typeof heatMapSource, string> = {
                    combined: "No completed or missed tasks.",
                    completions: "No completed tasks.",
                    missed: "No missed tasks.",
                    upcoming: "No upcoming tasks."
                  };

                  return (
                    <p className="text-muted-foreground text-sm text-center py-6">
                      {emptyMessages[heatMapSource]}
                    </p>
                  );
                })()}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
