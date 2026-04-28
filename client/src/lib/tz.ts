import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";

export function toLocal(date: Date, timezone: string): Date {
  return toZonedTime(date, timezone);
}

export function nowLocal(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

export function formatDateKey(d: Date, timezone: string): string {
  return format(toZonedTime(d, timezone), "yyyy-MM-dd");
}

export function formatLocal(d: Date | string, timezone: string, fmt: string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return format(toZonedTime(date, timezone), fmt);
}
