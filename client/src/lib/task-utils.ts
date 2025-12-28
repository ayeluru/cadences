import { TaskWithDetails } from "@shared/schema";

export type CadenceMagnitude = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function filterTasksByCadence(tasks: TaskWithDetails[], magnitude: CadenceMagnitude): TaskWithDetails[] {
  return tasks.filter(task => {
    const val = task.intervalValue;
    const unit = task.intervalUnit;

    switch (magnitude) {
      case 'daily':
        // 1-6 days
        return unit === 'days' && val >= 1 && val <= 6;
      
      case 'weekly':
        // 1-4 weeks, or 7-13 days
        return (unit === 'weeks' && val >= 1 && val <= 4) || 
               (unit === 'days' && val >= 7 && val <= 13);
      
      case 'monthly':
        // 1-3 months, or 2-12 weeks
        return (unit === 'months' && val >= 1 && val <= 3) ||
               (unit === 'weeks' && val >= 2 && val <= 12) ||
               (unit === 'days' && val >= 14 && val <= 89);
      
      case 'yearly':
        // 4+ months or any years
        return (unit === 'months' && val >= 4) || unit === 'years';
      
      default:
        return false;
    }
  });
}

export function getCadenceLabel(magnitude: CadenceMagnitude): string {
  const labels: Record<CadenceMagnitude, string> = {
    daily: 'Daily Tasks',
    weekly: 'Weekly Tasks',
    monthly: 'Monthly Tasks',
    yearly: 'Long-term Tasks'
  };
  return labels[magnitude];
}

export function getCadenceDescription(magnitude: CadenceMagnitude): string {
  const descriptions: Record<CadenceMagnitude, string> = {
    daily: 'Tasks that repeat daily to weekly',
    weekly: 'Tasks that repeat weekly to bi-weekly',
    monthly: 'Tasks that repeat monthly to quarterly',
    yearly: 'Tasks that repeat quarterly or longer'
  };
  return descriptions[magnitude];
}
