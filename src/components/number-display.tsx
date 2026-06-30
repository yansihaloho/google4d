import { cn } from "@/lib/utils";
import { classify, computeHits } from "@/lib/classify";

// ─── Hit Badge ────────────────────────────────────────────────────────────────

interface HitBadgeProps {
  value: string | null;
  taruhanSet: Set<string>;
  size?: "sm" | "lg";
}

export function HitBadge({ value, taruhanSet, size = "sm" }: HitBadgeProps) {
  if (!value || taruhanSet.size === 0) return null;
  const hits = computeHits(value, taruhanSet);
  const star = hits >= 3;

  const colorCls =
    hits === 0 ? "bg-slate-700/50 text-slate-500 border-slate-600/40" :
    hits === 1 ? "bg-amber-500/25 text-amber-300 border-amber-500/40" :
    hits === 2 ? "bg-amber-500/35 text-amber-200 border-amber-500/50" :
    hits === 3 ? "bg-orange-500/35 text-orange-200 border-orange-500/50" :
                 "bg-green-500/35 text-green-200 border-green-500/50";

  if (size === "lg") {
    return (
      <span className={cn(
        "inline-flex items-center justify-center rounded-full border font-bold tabular-nums",
        "h-7 w-7 text-sm",
        colorCls
      )}>
        {hits}
      </span>
    );
  }

  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded-full border px-1 py-0 font-bold tabular-nums leading-none",
      "text-[9px]",
      colorCls
    )}>
      {star && <span className="text-[8px]">☆</span>}
      {hits}
    </span>
  );
}

// ─── NumberDisplay ─────────────────────────────────────────────────────────────
// Used in analysis tables — 2D depan bold besar, 2D belakang kecil di sebelah

interface NumberDisplayProps {
  value: string | null;
  className?: string;
  ekorMode?: boolean;
}

export function NumberDisplay({ value, className, ekorMode = false }: NumberDisplayProps) {
  if (!value) return <span className="text-slate-600 text-base font-bold">—</span>;

  const front = value.slice(0, 2);
  const back = value.slice(2);

  if (ekorMode) {
    return (
      <span className={cn("inline-flex items-baseline gap-px font-mono", className)}>
        <span className="text-[9px] sm:text-xs font-bold tabular-nums leading-none opacity-40">{front}</span>
        <span className="text-lg sm:text-2xl font-black tabular-nums leading-none tracking-tight">{back}</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-baseline gap-px font-mono", className)}>
      <span className="text-lg sm:text-2xl font-black tabular-nums leading-none tracking-tight">{front}</span>
      <span className="text-[9px] sm:text-xs font-bold tabular-nums leading-none opacity-60">{back}</span>
    </span>
  );
}

// ─── NumberDisplayBadged ───────────────────────────────────────────────────────
// Used in home page cards — larger, with Ganjil/Genap Besar/Kecil tags

interface NumberDisplayBadgedProps extends NumberDisplayProps {
  showTags?: boolean;
}

export function NumberDisplayBadged({ value, showTags = true, className }: NumberDisplayBadgedProps) {
  if (!value) return <span className="text-slate-600/60 text-2xl font-bold">—</span>;

  const front = value.slice(0, 2);
  const back = value.slice(2);
  const cls = classify(value);

  return (
    <span className={cn("inline-flex flex-col items-center gap-2 font-mono", className)}>
      <span className="inline-flex items-baseline gap-1">
        <span className="text-4xl sm:text-5xl font-black tabular-nums leading-none tracking-tight text-white">{front}</span>
        <span className="text-base sm:text-lg font-bold tabular-nums leading-none text-slate-400">{back}</span>
      </span>
      {showTags && cls && (
        <span className="flex gap-1">
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-bold",
            cls.ganjil ? "bg-amber-500/25 text-amber-300" : "bg-sky-500/25 text-sky-300"
          )}>
            {cls.ganjil ? "Ganjil" : "Genap"}
          </span>
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-bold",
            cls.besar ? "bg-red-500/25 text-red-300" : "bg-green-500/25 text-green-300"
          )}>
            {cls.besar ? "Besar" : "Kecil"}
          </span>
        </span>
      )}
    </span>
  );
}
