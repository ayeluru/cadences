import { format } from "date-fns";

export const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(200, 90%, 50%)",
  "hsl(350, 80%, 55%)",
];

export type TimeRange = "30d" | "90d" | "1y" | "all";

export interface MetricDataPoint {
  timestamp: number;
  value: number;
  date: string;
  fullDate: string;
}

export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  data: MetricDataPoint[];
}

export interface MetricValueWithVariation {
  id?: number;
  value: string | number;
  completedAt: string;
  variationId?: number | null;
  variationName?: string | null;
}

export function filterByTimeRange<T extends { completedAt: string }>(
  values: T[],
  timeRange: TimeRange
): T[] {
  if (timeRange === "all") return values;
  
  const now = new Date();
  let cutoff: Date;
  
  switch (timeRange) {
    case "30d":
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      return values;
  }
  
  return values.filter(v => new Date(v.completedAt) >= cutoff);
}

export function buildVariationChartSeries(
  values: MetricValueWithVariation[],
  metricName?: string,
  metricUnit?: string | null
): ChartSeries[] {
  if (!values.length) return [];
  
  const variationGroups = new Map<number | null, {
    id: number | null;
    name: string;
    dataPoints: MetricDataPoint[];
  }>();
  
  values.forEach(v => {
    const varId = v.variationId ?? null;
    const varName = v.variationName || (varId ? `Variation ${varId}` : "Default");
    
    if (!variationGroups.has(varId)) {
      variationGroups.set(varId, {
        id: varId,
        name: varName,
        dataPoints: [],
      });
    }
    
    const numericValue = typeof v.value === 'number' ? v.value : parseFloat(String(v.value));
    if (isNaN(numericValue)) return;
    
    variationGroups.get(varId)!.dataPoints.push({
      timestamp: new Date(v.completedAt).getTime(),
      value: numericValue,
      date: format(new Date(v.completedAt), "MMM d"),
      fullDate: format(new Date(v.completedAt), "MMM d, yyyy h:mm a"),
    });
  });
  
  variationGroups.forEach(group => {
    group.dataPoints.sort((a, b) => a.timestamp - b.timestamp);
  });
  
  const hasMultipleVariations = variationGroups.size > 1 || 
    (variationGroups.size === 1 && !variationGroups.has(null));
  
  return Array.from(variationGroups.entries()).map(([varId, group], idx) => {
    let name = group.name;
    if (metricName && hasMultipleVariations) {
      name = `${metricName}: ${group.name}`;
    } else if (metricName) {
      name = metricName;
    }
    if (metricUnit) {
      name += ` (${metricUnit})`;
    }
    
    return {
      key: varId !== null ? `var_${varId}` : "var_default",
      name,
      color: CHART_COLORS[idx % CHART_COLORS.length],
      data: group.dataPoints,
    };
  });
}

export function getChartDomain(series: ChartSeries[]): [number, number] | ["dataMin", "dataMax"] {
  const allTimestamps = series.flatMap(s => s.data.map(d => d.timestamp));
  if (allTimestamps.length === 0) return ["dataMin", "dataMax"];
  return [Math.min(...allTimestamps), Math.max(...allTimestamps)];
}
