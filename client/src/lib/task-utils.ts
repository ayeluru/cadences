import type { CadenceMagnitude } from "@shared/schema";

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
