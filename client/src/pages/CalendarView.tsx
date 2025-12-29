import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TaskWithDetails } from "@shared/schema";

interface CalendarCompletion {
  date: string;
  count: number;
  tasks: Array<{
    id: number;
    title: string;
    completedAt: string;
  }>;
}

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: calendarData, isLoading } = useQuery<CalendarCompletion[]>({
    queryKey: ["/api/completions/calendar", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/completions/calendar?start=${startDate}&end=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch calendar data");
      return res.json();
    },
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getCompletionsForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return calendarData?.find(d => d.date === dateStr);
  };

  const selectedDayData = selectedDate ? getCompletionsForDay(selectedDate) : null;

  const getDensityColor = (count: number) => {
    if (count === 0) return "";
    if (count <= 2) return "bg-green-100 dark:bg-green-900/30";
    if (count <= 5) return "bg-green-200 dark:bg-green-800/40";
    if (count <= 10) return "bg-green-300 dark:bg-green-700/50";
    return "bg-green-400 dark:bg-green-600/60";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">
          Calendar
        </h1>
        <p className="text-muted-foreground">
          View your completion history at a glance.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
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
                  const dayData = getCompletionsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const count = dayData?.count || 0;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "aspect-square p-1 rounded-lg text-sm transition-all relative",
                        "hover:ring-2 hover:ring-primary/50",
                        !isCurrentMonth && "text-muted-foreground/40",
                        isCurrentMonth && getDensityColor(count),
                        isSelected && "ring-2 ring-primary",
                        isToday && "font-bold"
                      )}
                      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <span className={cn(
                        "absolute top-1 left-1/2 -translate-x-1/2",
                        isToday && "text-primary"
                      )}>
                        {format(day, "d")}
                      </span>
                      {count > 0 && isCurrentMonth && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-green-700 dark:text-green-300 font-medium">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="w-4 h-4 rounded bg-muted border" />
                <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30" />
                <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-800/40" />
                <div className="w-4 h-4 rounded bg-green-300 dark:bg-green-700/50" />
                <div className="w-4 h-4 rounded bg-green-400 dark:bg-green-600/60" />
              </div>
              <span>More</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a day"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-muted-foreground text-sm">
                Click on a day to see what was completed.
              </p>
            ) : selectedDayData && selectedDayData.tasks.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  {selectedDayData.count} task{selectedDayData.count !== 1 ? "s" : ""} completed
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {selectedDayData.tasks.map((task, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                      data-testid={`completion-item-${task.id}-${idx}`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <span className="text-sm font-medium truncate">{task.title}</span>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {format(new Date(task.completedAt), "h:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No tasks completed on this day.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
