/**
 * Converte valor de <input type="week"> (ex.: 2026-W14) na segunda-feira da semana ISO (YYYY-MM-DD).
 */
export function mondayFromWeekValue(weekValue) {
  if (!weekValue || typeof weekValue !== "string") return "";
  const m = weekValue.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return "";
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!year || !week || week > 53) return "";

  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const start = new Date(simple);
  if (dow <= 4) {
    start.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    start.setDate(simple.getDate() + 8 - simple.getDay());
  }
  return start.toISOString().slice(0, 10);
}
