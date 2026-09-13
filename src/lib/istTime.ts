// This app only serves Delhi NCR, so "current time" always means IST — but in production
// (Vercel) the server process runs in UTC, and `date.getHours()`/`getDay()` read the SERVER's
// local time, not Delhi's. That silently shifted every day/night and peak-hour boundary by
// 5.5 hours (e.g. 9 AM IST read as ~3:30 AM UTC, wrongly triggering "after sunset"). Reading
// the hour/weekday explicitly in Asia/Kolkata fixes this regardless of where the server runs.
export function istParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
  const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  // "24" shows up at midnight with hour12:false in some runtimes — normalize to 0.
  const hour = Number(hourPart) % 24;
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayPart);
  const isWeekend = weekdayPart === "Sat" || weekdayPart === "Sun";
  return { hour, dayOfWeek: weekdayIndex < 0 ? 0 : weekdayIndex, isWeekend };
}
