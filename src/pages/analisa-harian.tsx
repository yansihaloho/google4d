import { useMemo, useState } from "react";
import { useGetTotoMonths, useGetTotoLatest } from "@workspace/api-client-react";
import { PageSeo } from "@/components/page-seo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  isGanjil, isGenap, isBesar, isKecil,
  isGanjilEkor, isGenapEkor, isBesarEkor, isKecilEkor,
  getFront2D,
} from "@/lib/classify";
import { BarChart2, TrendingUp, TrendingDown, Flame, Zap, ChevronDown, ChevronUp, LineChart as LineChartIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAW_TIMES = ["0001", "1300", "1600", "1900", "2200", "2300"] as const;
type DrawTime = typeof DRAW_TIMES[number];

const DRAW_LABELS: Record<string, string> = {
  "0001": "00:01", "1300": "13:00", "1600": "16:00",
  "1900": "19:00", "2200": "22:00", "2300": "23:00",
};

type DrawTimeKey = `draw${DrawTime}`;
function drawKey(t: string): DrawTimeKey { return `draw${t}` as DrawTimeKey; }

// ─── Types ────────────────────────────────────────────────────────────────────

type CatStat = {
  label: string;
  count: number;
  pct: number;
  color: string;
  textColor: string;
  borderColor: string;
};

type DualStat = {
  a: CatStat;
  b: CatStat;
  winner: "a" | "b" | "tie";
  confidence: number;
};

type StreakItem = { val: string; label: string; color: string };

type SlotAnalysis = {
  slot: DrawTime;
  total: number;
  depanGanjilGenap: DualStat;
  depanBesarKecil: DualStat;
  ekorGanjilGenap: DualStat;
  ekorBesarKecil: DualStat;
  streak: StreakItem[];
  recentDepanGanjilGenap: DualStat;
  recentDepanBesarKecil: DualStat;
  recentEkorGanjilGenap: DualStat;
  recentEkorBesarKecil: DualStat;
  todayVal: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDual(
  aLabel: string, aCount: number, aColor: string, aText: string, aBorder: string,
  bLabel: string, bCount: number, bColor: string, bText: string, bBorder: string,
): DualStat {
  const total = aCount + bCount;
  const aPct = total > 0 ? Math.round((aCount / total) * 100) : 50;
  const bPct = total > 0 ? 100 - aPct : 50;
  const winner = aPct > bPct ? "a" : bPct > aPct ? "b" : "tie";
  const confidence = Math.abs(aPct - bPct);
  return {
    a: { label: aLabel, count: aCount, pct: aPct, color: aColor, textColor: aText, borderColor: aBorder },
    b: { label: bLabel, count: bCount, pct: bPct, color: bColor, textColor: bText, borderColor: bBorder },
    winner,
    confidence,
  };
}

function buildSlotHistory(months: ReturnType<typeof useGetTotoMonths>["data"], slot: DrawTime): Array<{ date: string; val: string }> {
  if (!months) return [];
  return months
    .flatMap((m) => m.results)
    .sort((a, b) => a.drawDate.localeCompare(b.drawDate))
    .filter((r) => !!r[drawKey(slot)])
    .map((r) => ({ date: r.drawDate, val: r[drawKey(slot)]! }));
}

function buildStreakItems(history: Array<{ val: string }>, n = 12): StreakItem[] {
  return history.slice(-n).map(({ val }) => {
    const g = isGanjil(val);
    const b = isBesar(val);
    let label = "";
    let color = "";
    if (g === true && b === true)  { label = "GB"; color = "bg-orange-500/80" }
    else if (g === true && b === false) { label = "GK"; color = "bg-amber-500/80" }
    else if (g === false && b === true)  { label = "AB"; color = "bg-rose-500/80" }
    else if (g === false && b === false) { label = "AK"; color = "bg-sky-500/80" }
    else { label = "?"; color = "bg-muted" }
    return { val, label, color };
  });
}

const STREAK_LEGEND = [
  { label: "GB", desc: "Ganjil + Besar",  color: "bg-orange-500/80" },
  { label: "GK", desc: "Ganjil + Kecil",  color: "bg-amber-500/80" },
  { label: "AB", desc: "Genap + Besar",   color: "bg-rose-500/80" },
  { label: "AK", desc: "Genap + Kecil",   color: "bg-sky-500/80" },
];

function buildAnalysis(
  months: ReturnType<typeof useGetTotoMonths>["data"],
  todayData: ReturnType<typeof useGetTotoLatest>["data"],
  slot: DrawTime,
): SlotAnalysis {
  const history = buildSlotHistory(months, slot);
  const recent = history.slice(-30);

  function counts(arr: Array<{ val: string }>) {
    let ganCount = 0, genCount = 0, besCount = 0, kecCount = 0;
    let eGanCount = 0, eGenCount = 0, eBesCount = 0, eKecCount = 0;
    for (const { val } of arr) {
      if (isGanjil(val) === true) ganCount++;
      else if (isGenap(val) === true) genCount++;
      if (isBesar(val) === true) besCount++;
      else if (isKecil(val) === true) kecCount++;
      if (isGanjilEkor(val) === true) eGanCount++;
      else if (isGenapEkor(val) === true) eGenCount++;
      if (isBesarEkor(val) === true) eBesCount++;
      else if (isKecilEkor(val) === true) eKecCount++;
    }
    return { ganCount, genCount, besCount, kecCount, eGanCount, eGenCount, eBesCount, eKecCount };
  }

  const all = counts(history);
  const rec = counts(recent);

  return {
    slot,
    total: history.length,
    depanGanjilGenap: makeDual(
      "Ganjil", all.ganCount, "bg-amber-500/20", "text-amber-300", "border-amber-500/40",
      "Genap",  all.genCount, "bg-sky-500/20",   "text-sky-300",  "border-sky-500/40",
    ),
    depanBesarKecil: makeDual(
      "Besar", all.besCount, "bg-rose-500/20",  "text-rose-300",  "border-rose-500/40",
      "Kecil", all.kecCount, "bg-green-500/20", "text-green-300", "border-green-500/40",
    ),
    ekorGanjilGenap: makeDual(
      "Ekor Ganjil", all.eGanCount, "bg-violet-500/20", "text-violet-300", "border-violet-500/40",
      "Ekor Genap",  all.eGenCount, "bg-teal-500/20",   "text-teal-300",   "border-teal-500/40",
    ),
    ekorBesarKecil: makeDual(
      "Ekor Besar", all.eBesCount, "bg-orange-500/20", "text-orange-300", "border-orange-500/40",
      "Ekor Kecil", all.eKecCount, "bg-cyan-500/20",   "text-cyan-300",   "border-cyan-500/40",
    ),
    recentDepanGanjilGenap: makeDual(
      "Ganjil", rec.ganCount, "bg-amber-500/20", "text-amber-300", "border-amber-500/40",
      "Genap",  rec.genCount, "bg-sky-500/20",   "text-sky-300",  "border-sky-500/40",
    ),
    recentDepanBesarKecil: makeDual(
      "Besar", rec.besCount, "bg-rose-500/20",  "text-rose-300",  "border-rose-500/40",
      "Kecil", rec.kecCount, "bg-green-500/20", "text-green-300", "border-green-500/40",
    ),
    recentEkorGanjilGenap: makeDual(
      "Ekor Ganjil", rec.eGanCount, "bg-violet-500/20", "text-violet-300", "border-violet-500/40",
      "Ekor Genap",  rec.eGenCount, "bg-teal-500/20",   "text-teal-300",   "border-teal-500/40",
    ),
    recentEkorBesarKecil: makeDual(
      "Ekor Besar", rec.eBesCount, "bg-orange-500/20", "text-orange-300", "border-orange-500/40",
      "Ekor Kecil", rec.eKecCount, "bg-cyan-500/20",   "text-cyan-300",   "border-cyan-500/40",
    ),
    streak: buildStreakItems(history),
    todayVal: todayData?.[drawKey(slot)] ?? null,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DualBar({ stat, label }: { stat: DualStat; label: string }) {
  const winner = stat.winner === "a" ? stat.a : stat.winner === "b" ? stat.b : null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {winner && (
          <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold border", winner.color, winner.textColor, winner.borderColor)}>
            → {winner.label} {winner.pct}%
          </span>
        )}
      </div>
      {/* Bar */}
      <div className="relative flex h-6 w-full overflow-hidden rounded-full border border-border/40 bg-muted/20">
        <div
          className={cn("flex items-center justify-center text-[9px] font-bold transition-all", stat.a.color, stat.a.textColor)}
          style={{ width: `${stat.a.pct}%` }}
        >
          {stat.a.pct >= 20 && `${stat.a.pct}%`}
        </div>
        <div
          className={cn("flex flex-1 items-center justify-center text-[9px] font-bold transition-all", stat.b.color, stat.b.textColor)}
        >
          {stat.b.pct >= 20 && `${stat.b.pct}%`}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{stat.a.label} <span className="font-bold text-foreground">({stat.a.count}x)</span></span>
        <span><span className="font-bold text-foreground">({stat.b.count}x)</span> {stat.b.label}</span>
      </div>
    </div>
  );
}

function RecommendationBadge({ stat, label }: { stat: DualStat; label: string }) {
  const winner = stat.winner === "a" ? stat.a : stat.winner === "b" ? stat.b : null;
  if (!winner) return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-center text-xs text-muted-foreground">
      {label}: Seimbang
    </div>
  );
  const conf = stat.confidence;
  const confLabel = conf >= 15 ? "Kuat" : conf >= 8 ? "Sedang" : "Lemah";
  const confColor = conf >= 15 ? "text-green-400" : conf >= 8 ? "text-amber-400" : "text-muted-foreground";
  return (
    <div className={cn(
      "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
      winner.color, winner.borderColor
    )}>
      <div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("text-sm font-bold", winner.textColor)}>PASANG {winner.label.toUpperCase()}</div>
      </div>
      <div className="text-right">
        <div className={cn("text-xs font-bold", confColor)}>{confLabel}</div>
        <div className="text-[10px] text-muted-foreground">{conf}% selisih</div>
      </div>
    </div>
  );
}

function SlotCard({ analysis, defaultOpen }: { analysis: SlotAnalysis; defaultOpen: boolean; key?: any }) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<"semua" | "30hari">("30hari");
  const depGG  = tab === "semua" ? analysis.depanGanjilGenap  : analysis.recentDepanGanjilGenap;
  const depBK  = tab === "semua" ? analysis.depanBesarKecil   : analysis.recentDepanBesarKecil;
  const ekorGG = tab === "semua" ? analysis.ekorGanjilGenap   : analysis.recentEkorGanjilGenap;
  const ekorBK = tab === "semua" ? analysis.ekorBesarKecil    : analysis.recentEkorBesarKecil;

  const todayVal = analysis.todayVal;
  const todayFront = getFront2D(todayVal);
  const todayGanjil = isGanjil(todayVal);
  const todayBesar  = isBesar(todayVal);
  const todayEkorGanjil = isGanjilEkor(todayVal);
  const todayEkorBesar  = isBesarEkor(todayVal);

  return (
    <div className={cn(
      "overflow-hidden rounded-3xl border transition-all shadow-sm backdrop-blur-xl",
      todayVal ? "border-primary/40 bg-gradient-to-b from-primary/5 to-card" : "border-border/50 bg-gradient-to-b from-card to-background"
    )}>
      {/* Header */}
      <button
        className="flex w-full items-center justify-between px-4 py-4 text-left hover:bg-muted/10 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <span className="font-mono text-sm font-black text-primary">{DRAW_LABELS[analysis.slot]}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">Draw {DRAW_LABELS[analysis.slot]} WIB</span>
              {todayVal && (
                <span className="rounded-full border border-green-500/40 bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400">
                  Hari ini: {todayVal}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {analysis.total} data historis
              {todayVal && (
                <span className="ml-2 font-medium text-foreground/70">
                  · {todayGanjil ? "Ganjil" : "Genap"}{" "}
                  · {todayBesar ? "Besar" : "Kecil"}{" "}
                  · Ekor {todayEkorGanjil ? "Ganjil" : "Genap"}{" "}
                  · Ekor {todayEkorBesar ? "Besar" : "Kecil"}
                  {todayFront && <span className="ml-1 font-mono text-primary">({todayFront})</span>}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!open && (
            <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
              {[depGG, depBK, ekorGG, ekorBK].map((s, i) => {
                const w = s.winner === "a" ? s.a : s.winner === "b" ? s.b : null;
                if (!w) return null;
                return (
                  <span key={i} className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold", w.color, w.textColor, w.borderColor)}>
                    {w.label}
                  </span>
                );
              })}
            </div>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60 px-4 pb-5 pt-4 space-y-5">
          {/* Tab toggle */}
          <div className="flex rounded-lg border border-border bg-muted/20 p-0.5 w-fit">
            {(["30hari", "semua"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold transition-all",
                  tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "30hari" ? "30 Draw Terakhir" : "Semua Data"}
              </button>
            ))}
          </div>

          {/* Recommendation Row */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Zap className="h-3 w-3" />
              Rekomendasi Pasang
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <RecommendationBadge stat={depGG}  label="2D Depan" />
              <RecommendationBadge stat={depBK}  label="Besar/Kecil" />
              <RecommendationBadge stat={ekorGG} label="Ekor Ganjil/Genap" />
              <RecommendationBadge stat={ekorBK} label="Ekor Besar/Kecil" />
            </div>
          </div>

          {/* Stats bars */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-border bg-muted/10 p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                2D Depan
              </div>
              <DualBar stat={depGG} label="Ganjil vs Genap" />
              <DualBar stat={depBK} label="Besar vs Kecil" />
            </div>
            <div className="space-y-4 rounded-xl border border-border bg-muted/10 p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <TrendingDown className="h-3 w-3" />
                Digit Ekor (digit ke-4)
              </div>
              <DualBar stat={ekorGG} label="Ekor Ganjil vs Genap" />
              <DualBar stat={ekorBK} label="Ekor Besar (5-9) vs Kecil (0-4)" />
            </div>
          </div>

          {/* Streak */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Flame className="h-3 w-3 text-orange-400" />
              Streak 12 Draw Terakhir (terbaru → kiri)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...analysis.streak].reverse().map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-[9px] font-black text-white", s.color)}>
                    {s.label}
                  </div>
                  <div className="font-mono text-[8px] text-muted-foreground/60">{s.val.slice(0,2)}</div>
                </div>
              ))}
              {analysis.streak.length === 0 && (
                <span className="text-xs text-muted-foreground">Belum ada data</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {STREAK_LEGEND.map((l) => (
                <div key={l.label} className="flex items-center gap-1">
                  <div className={cn("h-3.5 w-5 rounded text-[8px] font-black text-white flex items-center justify-center", l.color)}>{l.label}</div>
                  <span className="text-[9px] text-muted-foreground">{l.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrendChart({ analyses }: { analyses: SlotAnalysis[] }) {
  // Combine all slot histories into a chronological list
  // Actually we just want the last 30 days of data, 
  // Let's just pick one slot or sum of outcomes.
  // Wait, for a simple trend chart, we can show the frequency of "Besar" vs "Kecil" over the last 10 days across all slots,
  // or simply the total sum of the 4D values (or 2D values) over the last 30 draws for Slot 00:01 as an example.
  // Better yet, let's plot the 2D value (0-99) of the last 30 draws for the active slot.
  const [activeSlot, setActiveSlot] = useState<DrawTime>("0001");
  
  const slotAnalysis = analyses.find(a => a.slot === activeSlot);
  if (!slotAnalysis) return null;

  const data = [...slotAnalysis.streak].reverse().map((s, i) => ({
    name: `D-${slotAnalysis.streak.length - i}`,
    value: parseInt(s.val.slice(-2), 10) || 0, // 2D belakang
  }));

  return (
    <div className="rounded-3xl border border-border/50 bg-gradient-to-b from-card to-background p-6 space-y-5 shadow-sm backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <LineChartIcon className="h-5 w-5 text-primary" />
          Tren Nilai 2D Belakang
        </div>
        <select 
          className="bg-muted/40 border border-border/50 rounded-xl text-xs px-3 py-1.5 outline-none font-medium text-foreground hover:bg-muted/60 transition-colors"
          value={activeSlot}
          onChange={(e) => setActiveSlot(e.target.value as DrawTime)}
        >
          {DRAW_TIMES.map(t => <option key={t} value={t}>Draw {DRAW_LABELS[t]}</option>)}
        </select>
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} domain={[0, 99]} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ color: '#00dcff' }}
            />
            <Line type="monotone" dataKey="value" stroke="#00dcff" strokeWidth={2} dot={{ r: 3, fill: '#00dcff' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center text-[10px] text-muted-foreground">Menampilkan 12 draw terakhir untuk sesi yang dipilih</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalisaHarianPage() {
  const { data: months, isLoading } = useGetTotoMonths();
  const { data: latest } = useGetTotoLatest();

  const analyses = useMemo(() => {
    if (!months) return [];
    return DRAW_TIMES.map((slot) => buildAnalysis(months, latest, slot));
  }, [months, latest]);

  // Overall today summary
  const todaySummary = useMemo(() => {
    if (!latest) return null;
    return DRAW_TIMES.map((slot) => {
      const val = latest[drawKey(slot)] ?? null;
      if (!val) return null;
      return {
        slot,
        val,
        ganjil: isGanjil(val),
        besar: isBesar(val),
        ekorGanjil: isGanjilEkor(val),
        ekorBesar: isBesarEkor(val),
      };
    }).filter(Boolean);
  }, [latest]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 pb-24 pt-6 md:pb-6">
      <PageSeo title="Analisa Harian" description="Analisa statistik per slot jam untuk strategi pasang 2D Toto Macau" />

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Analisa Harian Per Jam</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Statistik historis per slot draw — rekomendasi Ganjil/Genap/Besar/Kecil berdasarkan data nyata
        </p>
      </div>

      {/* Today summary bar */}
      {todaySummary && todaySummary.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-primary">Hasil Hari Ini</div>
          <div className="flex flex-wrap gap-2">
            {todaySummary.map((s) => s && (
              <div key={s.slot} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <span className="font-mono text-xs font-bold text-muted-foreground">{DRAW_LABELS[s.slot]}</span>
                <span className="font-mono text-sm font-black text-foreground">{s.val}</span>
                <div className="flex gap-1">
                  <span className={cn("rounded px-1 py-0.5 text-[8px] font-bold", s.ganjil ? "bg-amber-500/20 text-amber-300" : "bg-sky-500/20 text-sky-300")}>
                    {s.ganjil ? "G" : "A"}
                  </span>
                  <span className={cn("rounded px-1 py-0.5 text-[8px] font-bold", s.besar ? "bg-rose-500/20 text-rose-300" : "bg-green-500/20 text-green-300")}>
                    {s.besar ? "B" : "K"}
                  </span>
                  <span className={cn("rounded px-1 py-0.5 text-[8px] font-bold", s.ekorGanjil ? "bg-violet-500/20 text-violet-300" : "bg-teal-500/20 text-teal-300")}>
                    E{s.ekorGanjil ? "G" : "A"}
                  </span>
                  <span className={cn("rounded px-1 py-0.5 text-[8px] font-bold", s.ekorBesar ? "bg-orange-500/20 text-orange-300" : "bg-cyan-500/20 text-cyan-300")}>
                    E{s.ekorBesar ? "B" : "K"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[9px] text-muted-foreground/70">
            <span><strong className="text-amber-300">G</strong>=Ganjil <strong className="text-sky-300">A</strong>=Genap</span>
            <span><strong className="text-rose-300">B</strong>=Besar <strong className="text-green-300">K</strong>=Kecil</span>
            <span><strong className="text-violet-300">EG</strong>=Ekor Ganjil <strong className="text-teal-300">EA</strong>=Ekor Genap</span>
            <span><strong className="text-orange-300">EB</strong>=Ekor Besar <strong className="text-cyan-300">EK</strong>=Ekor Kecil</span>
          </div>
        </div>
      )}

      {/* Trend Chart */}
      {analyses.length > 0 && <TrendChart analyses={analyses} />}

      {/* Slot cards */}
      {isLoading ? (
        <div className="space-y-3">
          {DRAW_TIMES.map((t) => <Skeleton key={t} className="h-20 w-full rounded-2xl" />)}
        </div>
      ) : analyses.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Belum ada data. Refresh di halaman Home terlebih dahulu.
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map((a, i) => (
            <SlotCard key={a.slot} analysis={a} defaultOpen={i === 0} />
          ))}
        </div>
      )}

      {/* Guide */}
      <div className="rounded-3xl border border-border/50 bg-muted/20 p-6 text-xs text-muted-foreground space-y-3 shadow-sm backdrop-blur-xl">
        <p className="font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Cara membaca Analisa Harian:
        </p>
        <ul className="list-disc list-inside space-y-1.5 ml-1">
          <li><strong className="text-foreground">30 Draw Terakhir</strong> = pola terkini (lebih relevan untuk pasang hari ini).</li>
          <li><strong className="text-foreground">Semua Data</strong> = pola jangka panjang dari semua historis.</li>
          <li><strong className="text-foreground">Rekomendasi</strong> ditentukan dari % terbanyak di periode yang dipilih.</li>
          <li><strong className="text-foreground">Kekuatan</strong>: &ge;15% selisih = Kuat, 8–15% = Sedang, &lt;8% = Lemah.</li>
          <li><strong className="text-foreground">Streak</strong> menunjukkan 12 draw terakhir tiap slot — perhatikan pola berulang.</li>
          <li>Analisa ini <em>berbasis statistik historis</em>, bukan jaminan kemenangan.</li>
        </ul>
      </div>
    </div>
  );
}
