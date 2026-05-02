/** Data civil YYYY-MM-DD em IANA time zone (ex.: America/Sao_Paulo). */
export function todayYmdInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) {
    throw new Error(`todayYmdInTimeZone: invalid parts for ${timeZone}`);
  }
  return `${y}-${m}-${d}`;
}

/** Normaliza prazo (date ou timestamptz em string) para YYYY-MM-DD. */
export function prazoToYmd(prazo: string | null | undefined): string | null {
  if (!prazo || typeof prazo !== "string") return null;
  const s = prazo.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
}
