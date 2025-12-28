import { TaskWithDetails } from "@shared/schema";
import { format, formatDistanceToNow, addDays, isPast } from "date-fns";
import { CheckCircle2, AlertCircle, Clock, Calendar, MoreVertical, Edit2, Trash2, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompleteTask, useDeleteTask } from "@/hooks/use-tasks";
import { useState } from "react";
import { EditTaskDialog } from "./EditTaskDialog";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface TaskCardProps {
  task: TaskWithDetails;
}

export function TaskCard({ task }: TaskCardProps) {
  const completeMutation = useCompleteTask();
  const deleteMutation = useDeleteTask();
  const [editOpen, setEditOpen] = useState(false);

  // Status visual helpers
  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'overdue': return 'border-l-4 border-l-[hsl(var(--urgency-overdue))] bg-red-50/50 dark:bg-red-900/10';
      case 'due_soon': return 'border-l-4 border-l-[hsl(var(--urgency-soon))] bg-amber-50/50 dark:bg-amber-900/10';
      case 'later': return 'border-l-4 border-l-[hsl(var(--urgency-later))]';
      case 'never_done': return 'border-l-4 border-l-[hsl(var(--urgency-never))] bg-gray-50/50 dark:bg-gray-900/10';
      default: return 'border-l-4 border-l-border';
    }
  };

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'overdue': return <AlertCircle className="w-5 h-5 text-[hsl(var(--urgency-overdue))]" />;
      case 'due_soon': return <Clock className="w-5 h-5 text-[hsl(var(--urgency-soon))]" />;
      case 'later': return <CheckCircle2 className="w-5 h-5 text-[hsl(var(--urgency-later))]" />;
      case 'never_done': return <Calendar className="w-5 h-5 text-muted-foreground" />;
      default: return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    if (task.status === 'never_done') return "Never completed";
    if (!task.nextDue) return "No due date";
    
    const dueDate = new Date(task.nextDue);
    if (isPast(dueDate) && task.status === 'overdue') {
      return `Overdue by ${formatDistanceToNow(dueDate)}`;
    }
    return `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`;
  };

  const handleComplete = () => {
    completeMutation.mutate({ id: task.id });
  };

  return (
    <>
      <motion.div 
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          "group relative bg-card hover:bg-card/80 transition-all duration-300 rounded-xl shadow-sm hover:shadow-md border p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4",
          getStatusColor(task.status)
        )}
      >
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
             {task.category && (
               <span className="text-xs font-semibold text-primary tracking-wide uppercase">
                 {task.category.name}
               </span>
             )}
             <div className="flex gap-1">
                {task.tags?.map(tag => (
                  <Badge key={tag.id} variant="secondary" className="text-[10px] px-1.5 h-5">
                    {tag.name}
                  </Badge>
                ))}
             </div>
          </div>
          
          <h3 className="text-lg font-bold font-display text-foreground leading-tight mb-1">
            {task.title}
          </h3>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getStatusIcon(task.status)}
            <span className={cn(
              "font-medium",
              task.status === 'overdue' && "text-[hsl(var(--urgency-overdue))]",
              task.status === 'due_soon' && "text-[hsl(var(--urgency-soon))]"
            )}>
              {getStatusText()}
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className="text-muted-foreground">
              Every {task.intervalValue} {task.intervalUnit}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2 md:mt-0 self-end md:self-center">
          <Button 
            onClick={handleComplete}
            disabled={completeMutation.isPending}
            className={cn(
              "rounded-full px-6 shadow-md transition-all duration-300",
              completeMutation.isPending ? "opacity-70" : "hover:scale-105 active:scale-95"
            )}
            size="sm"
          >
            {completeMutation.isPending ? "Saving..." : "Done"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-muted-foreground hover:text-foreground">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Edit2 className="w-4 h-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleComplete()}>
                <CalendarCheck className="w-4 h-4 mr-2" /> Mark Done
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this task?")) {
                    deleteMutation.mutate(task.id);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      <EditTaskDialog open={editOpen} onOpenChange={setEditOpen} task={task} />
    </>
  );
}
