import { useGetTotoMonths } from "@workspace/api-client-react";
import { PageSeo } from "@/components/page-seo";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { NumberDisplay } from "@/components/number-display";
import { isGanjil } from "@/lib/classify";
import { useState, useMemo } from "react";
import { Copy, Check, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { useTodayStats } from "@/hooks/use-today-stats";
import { TodayHitBanner } from "@/components/today-hit-banner";
import { useGetNomorTaruhan } from "@workspace/api-client-react";

const GANJIL_LIST = [
  "01","03","05","07","09","10","12","14","16","18",
  "19","21","23","25","27","28","30","32","34","36",
  "37","39","41","43","45","46","48","50","52","54",
  "55","57","59","61","63","64","66","68","70","72",
  "73","75","77","79","81","82","84","86","88","90",
  "91","93","95","97","99",
];

const DRAW_TIMES = ["0001", "1300", "1600", "1900", "2200", "2300"] as const;
const DRAW_LABELS: Record<string, string> = {
  "0001": "00:01", "1300": "13:00", "1600": "16:00",
  "1900": "19:00", "2200": "22:00", "2300": "23:00",
};

type DrawTimeKey = "draw0001" | "draw1300" | "draw1600" | "draw1900" | "draw2200" | "draw2300";
function drawKey(t: string): DrawTimeKey {
  return `draw${t}` as DrawTimeKey;
}

function RefGanjil() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = GANJIL_LIST.join("*");

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 w-full">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-400">Daftar 2D Ganjil</span>
          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">55 nomor</Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Disalin!" : "Copy"}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1">
          {GANJIL_LIST.map((n) => (
            <span key={n} className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
              {n}
            </span>
          ))}
        </div>
      )}
      {open && (
        <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
          {text}
        </p>
      )}
    </div>
  );
}

export default function GanjilPage() {
  const { data: months, isLoading } = useGetTotoMonths();
  const todayStats = useTodayStats();
  const { data: nomorTaruhan } = useGetNomorTaruhan();
  const taruhanSet = useMemo(() => new Set<string>(nomorTaruhan?.numbers ?? []), [nomorTaruhan]);

  const [selectedTime, setSelectedTime] = useState<"all" | typeof DRAW_TIMES[number]>("all");
  const displayedTimes = selectedTime === "all" ? DRAW_TIMES : [selectedTime];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-24 pt-6 md:pb-6">
      <PageSeo title="Ganjil" description="Analisis angka ganjil berdasarkan 2D depan Toto Macau" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/30">
              <TrendingUp className="h-5 w-5 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Analisis Ganjil</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-13 pl-0.5">
            55 nomor berdasarkan 2D depan — disorot kuning
          </p>
        </div>
        <div className="sm:w-80 lg:w-96 shrink-0">
          <RefGanjil />
        </div>
      </div>

      {todayStats && (
        <TodayHitBanner
          count={todayStats.ganjil}
          total={todayStats.total}
          label="Ganjil"
          color="amber"
          slots={todayStats.slots.map((s) => ({ key: s.key, value: s.value, hit: s.ganjil }))}
        />
      )}

      {/* Responsive Column Filter & Scroll Cue */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Filter Tampilan Jam Draw (Responsif Mobile)
          </span>
          {selectedTime === "all" && (
            <span className="text-[10px] text-muted-foreground/80 sm:hidden">
              ← Geser tabel ke samping untuk melihat jam lainnya →
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedTime("all")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border",
              selectedTime === "all"
                ? "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-sm font-bold"
                : "bg-muted/10 text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            Semua Jam
          </button>
          {DRAW_TIMES.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTime(t)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border",
                selectedTime === t
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-sm font-bold"
                  : "bg-muted/10 text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {DRAW_LABELS[t]} WIB
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : months && months.length > 0 ? (
        <div className="space-y-6">
          {months.map((monthGroup) => (
            <div key={`${monthGroup.year}-${monthGroup.month}`} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-muted/10">
                <span className="font-semibold text-foreground">{monthGroup.monthName} {monthGroup.year}</span>
                <Badge variant="outline" className="text-xs">{monthGroup.totalDays} hari</Badge>
              </div>
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
                <table className="w-full text-sm table-auto min-w-[320px]">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="sticky left-0 z-10 bg-muted-header border-r border-border/40 px-1 py-1.5 text-left text-[10px] font-medium text-muted-foreground sm:px-3 sm:text-xs w-[52px] sm:w-auto" style={{ backgroundColor: "var(--color-bg-muted-header, rgb(24, 24, 27))" }}>Tanggal</th>
                      {displayedTimes.map((t) => (
                        <th key={t} className="px-0 py-1.5 text-center text-[10px] font-medium text-muted-foreground sm:px-2 sm:text-xs">{DRAW_LABELS[t]}</th>
                      ))}
                      <th className="px-0.5 py-1.5 text-center text-[10px] font-medium text-amber-400/80 sm:px-3">
                        <span className="block">HIT</span>
                        <span className="block text-[9px] text-amber-400/50 font-normal">ganjil/6</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthGroup.results.map((row) => {
                      const rowHits = DRAW_TIMES.filter((t) => isGanjil(row[drawKey(t)] ?? null) === true).length;
                      return (
                      <tr key={row.drawDate} className="group border-t border-border/50 hover:bg-muted/20">
                        <td className="sticky left-0 z-10 group-hover:bg-muted/20 border-r border-border/30 transition-colors px-1 py-1 font-medium text-foreground sm:px-3 sm:py-2 w-[52px] sm:w-auto" style={{ backgroundColor: "var(--color-bg-card, rgb(9, 9, 11))" }}>
                          <div className="whitespace-nowrap">
                            <span className="hidden sm:inline text-xs text-muted-foreground mr-1">{row.dayName}</span>
                            <span className="hidden sm:inline">{row.drawDate}</span>
                            <span className="sm:hidden block text-[10px] text-muted-foreground leading-none">{row.dayName.slice(0,3)}</span>
                            <span className="sm:hidden block font-mono text-xs leading-tight">{row.drawDate.slice(5).replace('-','/')}</span>
                          </div>
                        </td>
                        {displayedTimes.map((t) => {
                          const val = row[drawKey(t)] ?? null;
                          const ganjil = isGanjil(val);
                          return (
                            <td key={t} className={cn("px-0 py-1.5 text-center sm:px-2 sm:py-2", ganjil === true ? "bg-amber-500/20" : "")}>
                              <NumberDisplay
                                value={val}
                                className={ganjil === true ? "text-amber-300" : "opacity-15"}
                              />
                            </td>
                          );
                        })}
                        <td className="px-0.5 py-1 text-center sm:px-2 sm:py-2">
                          <span className={cn(
                            "inline-flex items-center justify-center rounded-full border font-bold h-6 w-6 text-xs sm:h-7 sm:w-7 sm:text-sm",
                            rowHits >= 5 ? "bg-amber-500/35 text-amber-200 border-amber-500/55" :
                            rowHits >= 4 ? "bg-amber-500/25 text-amber-300 border-amber-500/40" :
                            rowHits >= 2 ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                            rowHits === 1 ? "bg-slate-600/50 text-slate-300 border-slate-500/40" :
                                           "bg-slate-700/30 text-slate-500 border-slate-600/20"
                          )}>{rowHits}</span>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          Belum ada data. Refresh di halaman Home terlebih dahulu.
        </div>
      )}
    </div>
  );
}
