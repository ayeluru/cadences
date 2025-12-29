import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday, isBefore } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, Loader2, AlertCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useProfileContext } from "@/contexts/ProfileContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface EnhancedCalendarDay {
  date: string;
  completions: Array<{ id: number; title: string; completedAt: string; taskId: number }>;
  missed: Array<{ id: number; title: string; dueDate: string }>;
  dueSoon: Array<{ id: number; title: string; dueDate: string }>;
}

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { currentProfile, isAggregatedView } = useProfileContext();
  
  // Heatmap mode determines what's shown in both heatmap and details
  const [heatMapSource, setHeatMapSource] = useState<"combined" | "completions" | "missed" | "upcoming">("combined");
  
  // Collapsible states for day details
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    completions: true,
    missed: true,
    dueSoon: true,
  });

  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  // Build query params with profile filtering
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set("start", startDate);
    params.set("end", endDate);
    if (!isAggregatedView && currentProfile) {
      params.set("profileId", currentProfile.id.toString());
    } else {
      // Aggregate view: exclude demo profiles
      params.set("excludeDemo", "true");
    }
    return params.toString();
  };

  const { data: calendarData, isLoading } = useQuery<EnhancedCalendarDay[]>({
    queryKey: ["/api/calendar/enhanced", startDate, endDate, isAggregatedView ? "all" : currentProfile?.id],
    queryFn: async () => {
      const res = await fetch(`/api/calendar/enhanced?${buildQueryParams()}`);
      if (!res.ok) throw new Error("Failed to fetch calendar data");
      return res.json();
    },
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDataForDay = (date: Date): EnhancedCalendarDay | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return calendarData?.find(d => d.date === dateStr);
  };

  const selectedDayData = selectedDate ? getDataForDay(selectedDate) : null;

  const getDayIndicators = (dayData: EnhancedCalendarDay | undefined) => {
    if (!dayData) return { completions: 0, missed: 0, dueSoon: 0 };
    return {
      completions: dayData.completions.length,
      missed: dayData.missed.length,
      dueSoon: dayData.dueSoon.length,
    };
  };

  // Get combined ratio: positive = more completions, negative = more missed
  const getCombinedRatio = (dayData: EnhancedCalendarDay | undefined): { ratio: number; intensity: number } => {
    if (!dayData) return { ratio: 0, intensity: 0 };
    const completed = dayData.completions.length;
    const missed = dayData.missed.length;
    const total = completed + missed;
    if (total === 0) return { ratio: 0, intensity: 0 };
    
    // Ratio: 1 = all completed, -1 = all missed, 0 = equal
    const ratio = (completed - missed) / total;
    // Intensity: based on total count (more items = more intense)
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

  // Get combined color based on ratio and intensity
  const getCombinedColor = (dayData: EnhancedCalendarDay | undefined): string => {
    const { ratio, intensity } = getCombinedRatio(dayData);
    if (intensity === 0) return "";
    
    // Ratio-based colors: green for positive, red for negative, neutral for zero
    if (ratio > 0.6) {
      // Strong green (more completions)
      const greenColors = [
        "bg-green-100 dark:bg-green-900/30",
        "bg-green-200 dark:bg-green-800/50",
        "bg-green-300 dark:bg-green-700/60",
        "bg-green-400 dark:bg-green-600/70",
        "bg-green-500 dark:bg-green-500/80",
      ];
      return greenColors[Math.min(intensity - 1, 4)];
    } else if (ratio > 0.2) {
      // Light green
      const lightGreenColors = [
        "bg-green-50 dark:bg-green-950/30",
        "bg-green-100 dark:bg-green-900/40",
        "bg-green-150 dark:bg-green-800/50",
        "bg-green-200 dark:bg-green-700/60",
        "bg-green-250 dark:bg-green-600/70",
      ];
      return lightGreenColors[Math.min(intensity - 1, 4)] || "bg-green-100 dark:bg-green-900/30";
    } else if (ratio > -0.2) {
      // Neutral (close to equal) - gray tones
      const neutralColors = [
        "bg-gray-100 dark:bg-gray-800/30",
        "bg-gray-150 dark:bg-gray-700/40",
        "bg-gray-200 dark:bg-gray-600/50",
        "bg-gray-250 dark:bg-gray-500/60",
        "bg-gray-300 dark:bg-gray-400/70",
      ];
      return neutralColors[Math.min(intensity - 1, 4)] || "bg-gray-100 dark:bg-gray-800/30";
    } else if (ratio > -0.6) {
      // Light red
      const lightRedColors = [
        "bg-red-50 dark:bg-red-950/30",
        "bg-red-100 dark:bg-red-900/40",
        "bg-red-150 dark:bg-red-800/50",
        "bg-red-200 dark:bg-red-700/60",
        "bg-red-250 dark:bg-red-600/70",
      ];
      return lightRedColors[Math.min(intensity - 1, 4)] || "bg-red-100 dark:bg-red-900/30";
    } else {
      // Strong red (more missed)
      const redColors = [
        "bg-red-100 dark:bg-red-900/30",
        "bg-red-200 dark:bg-red-800/50",
        "bg-red-300 dark:bg-red-700/60",
        "bg-red-400 dark:bg-red-600/70",
        "bg-red-500 dark:bg-red-500/80",
      ];
      return redColors[Math.min(intensity - 1, 4)];
    }
  };

  const getHeatMapColors = () => {
    switch (heatMapSource) {
      case "combined":
        return {
          l1: "bg-gray-100 dark:bg-gray-800/30",
          l2: "bg-gray-200 dark:bg-gray-700/50",
          l3: "bg-gray-300 dark:bg-gray-600/60",
          l4: "bg-gray-400 dark:bg-gray-500/70",
          l5: "bg-gray-500 dark:bg-gray-400/80",
        };
      case "completions":
        return {
          l1: "bg-green-100 dark:bg-green-900/30",
          l2: "bg-green-200 dark:bg-green-800/50",
          l3: "bg-green-300 dark:bg-green-700/60",
          l4: "bg-green-400 dark:bg-green-600/70",
          l5: "bg-green-500 dark:bg-green-500/80",
        };
      case "missed":
        return {
          l1: "bg-red-100 dark:bg-red-900/30",
          l2: "bg-red-200 dark:bg-red-800/50",
          l3: "bg-red-300 dark:bg-red-700/60",
          l4: "bg-red-400 dark:bg-red-600/70",
          l5: "bg-red-500 dark:bg-red-500/80",
        };
      case "upcoming":
        return {
          l1: "bg-amber-100 dark:bg-amber-900/30",
          l2: "bg-amber-200 dark:bg-amber-800/50",
          l3: "bg-amber-300 dark:bg-amber-700/60",
          l4: "bg-amber-400 dark:bg-amber-600/70",
          l5: "bg-amber-500 dark:bg-amber-500/80",
        };
    }
  };

  const getDensityColor = (count: number, dayData?: EnhancedCalendarDay) => {
    // For combined mode, use ratio-based coloring
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">
          Calendar
        </h1>
        <p className="text-muted-foreground">
          View your completion history, missed tasks, and upcoming due dates.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Heat map shows:</span>
            <div className="flex flex-wrap gap-1">
              <Button
                variant={heatMapSource === "combined" ? "default" : "outline"}
                size="sm"
                onClick={() => setHeatMapSource("combined")}
                className="gap-1.5"
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
                className="gap-1.5"
                data-testid="heatmap-completions"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completed
              </Button>
              <Button
                variant={heatMapSource === "missed" ? "default" : "outline"}
                size="sm"
                onClick={() => setHeatMapSource("missed")}
                className="gap-1.5"
                data-testid="heatmap-missed"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Missed
              </Button>
              <Button
                variant={heatMapSource === "upcoming" ? "default" : "outline"}
                size="sm"
                onClick={() => setHeatMapSource("upcoming")}
                className="gap-1.5"
                data-testid="heatmap-upcoming"
              >
                <Clock className="w-3.5 h-3.5" />
                Upcoming
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xl font-display">
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
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
                  onClick={() => setCurrentMonth(new Date())}
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
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, idx) => {
                  const dayData = getDataForDay(day);
                  const indicators = getDayIndicators(dayData);
                  const heatValue = getHeatMapValue(dayData);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);
                  
                  // For combined mode, show +/- indicator
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
                        "aspect-square p-1 rounded-md text-sm transition-all relative",
                        "hover:ring-2 hover:ring-primary/50",
                        !isCurrentMonth && "text-muted-foreground/40 opacity-50",
                        isCurrentMonth && getDensityColor(heatValue, dayData),
                        isSelected && "ring-2 ring-primary",
                        isTodayDate && "font-bold ring-1 ring-primary/30"
                      )}
                      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <span className={cn(
                        "absolute top-1 left-1/2 -translate-x-1/2 text-xs",
                        isTodayDate && "text-primary"
                      )}>
                        {format(day, "d")}
                      </span>
                      
                      {isCurrentMonth && getDisplayValue() !== null && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold">
                          {getDisplayValue()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              {heatMapSource === "combined" ? (
                <>
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-destructive" />
                    Missed
                  </span>
                  <div className="flex gap-0.5">
                    <div className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-600/70" />
                    <div className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-800/50" />
                    <div className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-600/50" />
                    <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-800/50" />
                    <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-600/70" />
                  </div>
                  <span className="flex items-center gap-1">
                    Completed
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a day"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
                        <button className="flex items-center justify-between w-full p-2 rounded-lg bg-green-50 dark:bg-green-900/20 hover-elevate">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
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
                        <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                          {selectedDayData.completions.map((task, idx) => (
                            <div
                              key={`completion-${task.id}-${idx}`}
                              className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm"
                              data-testid={`completion-item-${task.id}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                              <span className="truncate flex-1">{task.title}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {format(new Date(task.completedAt), "h:mm a")}
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
                        <button className="flex items-center justify-between w-full p-2 rounded-lg bg-destructive/10 hover-elevate">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-destructive" />
                            <span className="text-sm font-medium">Missed</span>
                            <Badge variant="destructive" className="text-xs">
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
                        <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                          {selectedDayData.missed.map((task, idx) => (
                            <div
                              key={`missed-${task.id}-${idx}`}
                              className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm"
                              data-testid={`missed-item-${task.id}`}
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
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
                        <button className="flex items-center justify-between w-full p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover-elevate">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-medium">Upcoming</span>
                            <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
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
                        <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                          {selectedDayData.dueSoon.map((task, idx) => (
                            <div
                              key={`due-${task.id}-${idx}`}
                              className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm"
                              data-testid={`due-item-${task.id}`}
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="truncate flex-1">{task.title}</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {selectedDayData && (() => {
                    // Check if there's nothing to show based on current mode
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
                      <p className="text-muted-foreground text-sm text-center py-4">
                        {emptyMessages[heatMapSource]}
                      </p>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
