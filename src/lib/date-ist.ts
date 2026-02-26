/**
 * IST (Indian Standard Time, Asia/Kolkata) date/time helpers.
 * Use these everywhere we display or set dates/times so the app is consistent in IST.
 */

const IST = "Asia/Kolkata";

/** Current calendar date in IST (for comparisons / date-only use). */
export function getTodayIST(): Date {
  const str = new Date().toLocaleDateString("en-CA", { timeZone: IST });
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Current date as YYYY-MM-DD in IST. */
export function getTodayISTString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: IST });
}

/** Format a date as YYYY-MM-DD in IST (for API payloads). */
export function formatDateOnlyIST(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: IST });
}

/** Parse API date-only string as that calendar day (IST). */
export function parseDateOnlyIST(value: string | Date): Date {
  if (typeof value === "string") {
    const part = value.slice(0, 10);
    const [y, m, d] = part.split("-").map(Number);
    if (y !== undefined && m !== undefined && d !== undefined) {
      return new Date(y, m - 1, d);
    }
    return new Date(value);
  }
  const x = new Date(value);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

/** Format date/time for display in IST. */
export function formatInIST(
  date: Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return date.toLocaleString("en-IN", { timeZone: IST, ...options });
}

/** Format date only in IST (e.g. dd MMM yyyy). */
export function formatDateIST(
  date: Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return date.toLocaleDateString("en-IN", { timeZone: IST, ...options });
}

/** Current Date object representing "now" in IST (for display). */
export function nowIST(): Date {
  return new Date();
}

export { IST };
