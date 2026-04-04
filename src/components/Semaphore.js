import { trafficLight } from "../utils/semaphores";

const dotColors = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-brand-electric",
  gray: "bg-neutral-400",
};

/**
 * Badge compacto para canto do card (manual de marca).
 * @param {{ light: 'green' | 'yellow' | 'red' | 'gray', label?: string, size?: 'sm' | 'md' }} props
 */
export function SemaphoreBadge({ light, label, size = "md" }) {
  const map = {
    green: "bg-emerald-100 text-emerald-900 border-emerald-300",
    yellow: "bg-amber-100 text-amber-950 border-amber-400",
    red: "bg-red-100 text-brand-plasma border-brand-electric",
    gray: "bg-neutral-100 text-brand-muted border-neutral-300",
  };
  const text = {
    green: "No objetivo",
    yellow: "Atenção",
    red: "Abaixo da meta",
    gray: "Sem dados",
  };
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium font-sans shadow-sm ${map[light]} ${pad}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotColors[light]}`} aria-hidden />
      <span className="max-w-[140px] truncate sm:max-w-none">{label ?? text[light]}</span>
    </span>
  );
}

/**
 * @param {{ ratioPct?: number | null, size?: 'sm' | 'md' | 'lg' }} props
 */
export function SemaphoreDot({ ratioPct, size = "md" }) {
  const light = trafficLight(ratioPct ?? null);
  const sz = size === "lg" ? "h-5 w-5" : size === "sm" ? "h-2.5 w-2.5" : "h-4 w-4";
  return (
    <span
      title={
        ratioPct != null && !Number.isNaN(ratioPct)
          ? `${ratioPct.toFixed(1)}% da meta`
          : "Sem referência"
      }
      className={`inline-block rounded-full ring-2 ring-black/10 ${dotColors[light]} ${sz}`}
      aria-label={`Semáforo ${light}`}
    />
  );
}
