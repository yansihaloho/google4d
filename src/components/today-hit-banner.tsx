import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

const DRAW_LABELS: Record<string, string> = {
  draw0001: "00:01", draw1300: "13:00", draw1600: "16:00",
  draw1900: "19:00", draw2200: "22:00", draw2300: "23:00",
};

type SlotInfo = {
  key: string;
  value: string | null;
  hit: boolean | null;
};

interface TodayHitBannerProps {
  count: number;
  total: number;
  label: string;
  color: "amber" | "sky" | "red" | "green" | "violet" | "orange" | "teal" | "rose";
  slots: SlotInfo[];
  showBack?: boolean;
}

const COLOR_MAP = {
  amber: {
    bg: "bg-amber-500/10 border-amber-500/25",
    badge: "bg-amber-500 text-white",
    hit: "bg-amber-500/25 border-amber-500/45 text-amber-200",
    miss: "bg-slate-700/40 border-slate-600/30 text-slate-500",
    text: "text-amber-400",
  },
  sky: {
    bg: "bg-sky-500/10 border-sky-500/25",
    badge: "bg-sky-500 text-white",
    hit: "bg-sky-500/25 border-sky-500/45 text-sky-200",
    miss: "bg-slate-700/40 border-slate-600/30 text-slate-500",
    text: "text-sky-400",
  },
  red: {
    bg: "bg-red-500/10 border-red-500/25",
    badge: "bg-red-500 text-white",
    hit: "bg-red-500/25 border-red-500/45 text-red-200",
    miss: "bg-slate-700/40 border-slate-600/30 text-slate-500",
    text: "text-red-400",
  },
  green: {
    bg: "bg-green-500/10 border-green-500/25",
    badge: "bg-green-500 text-white",
    hit: "bg-green-500/25 border-green-500/45 text-green-200",
    miss: "bg-slate-700/40 border-slate-600/30 text-slate-500",
    text: "text-green-400",
  },
  violet: {
    bg: "bg-violet-500/10 border-violet-500/25",
    badge: "bg-violet-500 text-white",
    hit: "bg-violet-500/25 border-violet-500/45 text-violet-200",
    miss: "bg-slate-700/40 border-slate-600/30 text-slate-500",
    text: "text-violet-400",
  },
  orange: {
    bg: "bg-orange-500/10 border-orange-500/25",
    badge: "bg-orange-500 text-white",
    hit: "bg-orange-500/25 border-orange-500/45 text-orange-200",
    miss: "bg-slate-700/40 border-slate-600/30 text-slate-500",
    text: "text-orange-400",
  },
  teal: {
    bg: "bg-teal-500/10 border-teal-500/25",
    badge: "bg-teal-500 text-white",
    hit: "bg-teal-500/25 border-teal-500/45 text-teal-200",
    miss: "bg-slate-700/40 border-slate-600/30 text-slate-500",
    text: "text-teal-400",
  },
  rose: {
    bg: "bg-rose-500/10 border-rose-500/25",
    badge: "bg-rose-500 text-white",
    hit: "bg-rose-500/25 border-rose-500/45 text-rose-200",
    miss: "bg-slate-700/40 border-slate-600/30 text-slate-500",
    text: "text-rose-400",
  },
};

export function TodayHitBanner({ count, total, label, color, slots, showBack = false }: TodayHitBannerProps) {
  const c = COLOR_MAP[color];

  return (
    <div className={cn("rounded-xl border px-3 py-2.5 flex flex-wrap items-center gap-3", c.bg)}>
      <div className="flex items-center gap-2 shrink-0">
        <Flame className={cn("h-3.5 w-3.5", c.text)} />
        <span className={cn("text-xs font-semibold", c.text)}>Hari ini</span>
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold leading-none",
          c.badge
        )}>
          {count} kena
        </span>
        {total > 0 && (
          <span className="text-[10px] text-muted-foreground">dari {total} draw</span>
        )}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {slots.map((s) => {
          const displayVal = s.value
            ? (showBack ? s.value.slice(2, 4) : s.value.slice(0, 2))
            : null;
          return (
            <div
              key={s.key}
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-center",
                s.value === null
                  ? "opacity-30 border-slate-600/20 bg-slate-700/10"
                  : s.hit
                  ? c.hit
                  : c.miss
              )}
            >
              <div className="text-[9px] font-medium leading-none opacity-60 mb-0.5">
                {DRAW_LABELS[s.key]}
              </div>
              {displayVal ? (
                <div className="font-mono font-bold text-[12px] leading-none">
                  {displayVal}
                </div>
              ) : (
                <div className="text-[11px] leading-none opacity-30">—</div>
              )}
            </div>
          );
        })}
      </div>

      {showBack && (
        <span className="text-[9px] text-muted-foreground/50 w-full -mt-1">
          menampilkan 2D belakang
        </span>
      )}
    </div>
  );
}
