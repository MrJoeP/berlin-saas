import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Relative Zeit für News-Items ("vor 2 Tagen", "heute", "vor 3 Std.").
export function formatRelative(input: string | null | undefined): string {
  if (!input) return "";
  const date = new Date(input);
  if (isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 60) return diffMin <= 1 ? "gerade eben" : `vor ${diffMin} Min.`;
  if (diffHr < 24) return `vor ${diffHr} Std.`;
  if (diffDay === 1) return "gestern";
  if (diffDay < 7) return `vor ${diffDay} Tagen`;
  if (diffDay < 30) return `vor ${Math.floor(diffDay / 7)} Wochen`;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}
