// Date helpers. All "today" logic uses Taipei time, because the price source rejects
// a window that starts before today at the origin airport.

const TAIPEI = "Asia/Taipei";

/** Returns YYYY-MM-DD for the given instant in Taipei time. */
export function taipeiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

/**
 * Splits the next `months` calendar months into windows of at most 31 days.
 * The first window starts today (Taipei), later windows start on the 1st.
 * Returns [{ month: "YYYY-MM", start: "YYYY-MM-DD", end: "YYYY-MM-DD" }].
 */
export function monthWindows(today, months = 12) {
  const [y, m, d] = today.split("-").map(Number);
  const windows = [];
  for (let i = 0; i < months; i += 1) {
    const monthIndex = m - 1 + i;
    const year = y + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startDay = i === 0 ? d : 1;
    windows.push({
      month: `${year}-${pad(month)}`,
      start: `${year}-${pad(month)}-${pad(startDay)}`,
      end: `${year}-${pad(month)}-${pad(lastDay)}`,
    });
  }
  return windows;
}

/** Whole days between two YYYY-MM-DD strings (b - a). */
export function daysBetween(a, b) {
  const toUtc = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}
