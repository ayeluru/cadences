import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday, isBefore } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, Loader2, AlertCircle, Clock, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  
  // Toggle states for visibility
  const [showCompletions, setShowCompletions] = useState(true);
  const [showMissed, setShowMissed] = useState(true);
  const [showFutureDue, setShowFutureDue] = useState(true);
  const [condensedMode, setCondensedMode] = useState(false);
  
  // Collapsible states for day details
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    completions: true,
    missed: true,
    dueSoon: true,
  });

  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: calendarData, isLoading } = useQuery<EnhancedCalendarDay[]>({
    queryKey: ["/api/calendar/enhanced", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/calendar/enhanced?start=${startDate}&end=${endDate}`);
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
      completions: showCompletions ? dayData.completions.length : 0,
      missed: showMissed ? dayData.missed.length : 0,
      dueSoon: showFutureDue ? dayData.dueSoon.length : 0,
    };
  };

  const getDensityColor = (count: number) => {
    if (count === 0) return "";
    if (count <= 2) return "bg-green-100 dark:bg-green-900/30";
    if (count <= 5) return "bg-green-200 dark:bg-green-800/40";
    if (count <= 10) return "bg-green-300 dark:bg-green-700/50";
    return "bg-green-400 dark:bg-green-600/60";
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
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="show-completions"
              checked={showCompletions}
              onCheckedChange={setShowCompletions}
              data-testid="toggle-completions"
            />
            <Label htmlFor="show-completions" className="flex items-center gap-1.5 text-sm cursor-pointer">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Completed
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-missed"
              checked={showMissed}
              onCheckedChange={setShowMissed}
              data-testid="toggle-missed"
            />
            <Label htmlFor="show-missed" className="flex items-center gap-1.5 text-sm cursor-pointer">
              <AlertCircle className="w-4 h-4 text-destructive" />
              Missed
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-future"
              checked={showFutureDue}
              onCheckedChange={setShowFutureDue}
              data-testid="toggle-future"
            />
            <Label htmlFor="show-future" className="flex items-center gap-1.5 text-sm cursor-pointer">
              <Clock className="w-4 h-4 text-amber-500" />
              Upcoming
            </Label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Switch
              id="condensed-mode"
              checked={condensedMode}
              onCheckedChange={setCondensedMode}
              data-testid="toggle-condensed"
            />
            <Label htmlFor="condensed-mode" className="text-sm cursor-pointer">
              Condensed
            </Label>
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
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);
                  const totalCompletions = indicators.completions;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "aspect-square p-1 rounded-lg text-sm transition-all relative",
                        "hover:ring-2 hover:ring-primary/50",
                        !isCurrentMonth && "text-muted-foreground/40",
                        isCurrentMonth && showCompletions && getDensityColor(totalCompletions),
                        isSelected && "ring-2 ring-primary",
                        isTodayDate && "font-bold"
                      )}
                      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <span className={cn(
                        "absolute top-1 left-1/2 -translate-x-1/2",
                        isTodayDate && "text-primary"
                      )}>
                        {format(day, "d")}
                      </span>
                      
                      {!condensedMode && isCurrentMonth && (
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {indicators.completions > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" title={`${indicators.completions} completed`} />
                          )}
                          {indicators.missed > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-destructive" title={`${indicators.missed} missed`} />
                          )}
                          {indicators.dueSoon > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" title={`${indicators.dueSoon} upcoming`} />
                          )}
                        </div>
                      )}
                      
                      {condensedMode && isCurrentMonth && (totalCompletions > 0 || indicators.missed > 0 || indicators.dueSoon > 0) && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground font-medium">
                          {totalCompletions + indicators.missed + indicators.dueSoon}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                <span>Missed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Upcoming</span>
              </div>
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
                  {showCompletions && selectedDayData && selectedDayData.completions.length > 0 && (
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

                  {showMissed && selectedDayData && selectedDayData.missed.length > 0 && (
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

                  {showFutureDue && selectedDayData && selectedDayData.dueSoon.length > 0 && (
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

                  {selectedDayData && 
                    selectedDayData.completions.length === 0 && 
                    selectedDayData.missed.length === 0 && 
                    selectedDayData.dueSoon.length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      Nothing scheduled for this day.
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
