import { useState, useMemo } from "react";
import { useGetTotoMonths, useSavePrediction, useGetPredictions } from "@workspace/api-client-react";
import { PageSeo } from "@/components/page-seo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { runPrediction } from "@/lib/prediction-engine";
import type { DrawTime, PositionAnalysis, PredictionResult } from "@/lib/prediction-engine";
import { Button } from "@/components/ui/button";
import {
  Cpu, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Zap, ChevronDown, ChevronUp,
  BarChart2, Save, ClipboardList, Clock, SearchX
} from "lucide-react";
import { Link } from "wouter";

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAW_TIMES: DrawTime[] = ["0001", "1300", "1600", "1900", "2200", "2300"];
const DRAW_LABELS: Record<string, string> = {
  "0001": "00:01", "1300": "13:00", "1600": "16:00",
  "1900": "19:00", "2200": "22:00", "2300": "23:00",
};

const CATEGORY_COLORS: Record<string, string> = {
  "A.Frequency": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "B.Momentum":  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "C.Markov":    "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "D.Bayesian":  "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "E.Gap":       "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "F.Stats":     "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "G.Pattern":   "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "H.HotCold":   "bg-red-500/20 text-red-300 border-red-500/30",
  "I.Ensemble":  "bg-green-500/20 text-green-300 border-green-500/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  "A.Frequency": "Frequency",
  "B.Momentum":  "Momentum",
  "C.Markov":    "Markov",
  "D.Bayesian":  "Bayesian",
  "E.Gap":       "Gap",
  "F.Stats":     "Statistik",
  "G.Pattern":   "Pattern",
  "H.HotCold":   "Hot/Cold",
  "I.Ensemble":  "Ensemble",
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/20">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function ScoreRow({ label, value, color, sublabel }: { label: string; value: number; color: string; sublabel?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-52 shrink-0">
        <div className="font-mono text-xs text-muted-foreground">{label}</div>
        {sublabel && <div className="text-[9px] text-muted-foreground/50">{sublabel}</div>}
      </div>
      <ScoreBar value={value} color={color} />
      <span className="w-12 shrink-0 text-right font-mono text-xs font-bold text-foreground">{value.toFixed(1)}%</span>
    </div>
  );
}

function MomentumIcon({ val }: { val: number }) {
  if (val > 3) return <TrendingUp className="inline h-3 w-3 text-green-400" />;
  if (val < -3) return <TrendingDown className="inline h-3 w-3 text-red-400" />;
  return <Minus className="inline h-3 w-3 text-muted-foreground" />;
}

function DigitFreqBar({ counts, predicted, weightedVoteMap }: {
  counts: number[];
  predicted: number;
  weightedVoteMap: number[];
}) {
  const maxC = Math.max(...counts, 1);
  const maxW = Math.max(...weightedVoteMap, 1);
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-px h-10">
        {counts.map((c, d) => (
          <div key={d} className="flex flex-col items-center flex-1 gap-px">
            <div
              className={cn("w-full rounded-sm transition-all", d === predicted ? "bg-primary" : "bg-muted/40")}
              style={{ height: `${Math.max(2, Math.round((c / maxC) * 36))}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-end gap-px h-5">
        {weightedVoteMap.map((w, d) => (
          <div key={d} className="flex flex-col items-center flex-1">
            <div
              className={cn("w-full rounded-sm", d === predicted ? "bg-amber-400/60" : "bg-muted/20")}
              style={{ height: `${Math.max(1, Math.round((w / maxW) * 18))}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <span className="font-mono text-[7px] text-muted-foreground/40">0</span>
        <span className="font-mono text-[7px] text-muted-foreground/40">4</span>
        <span className="font-mono text-[7px] text-muted-foreground/40">9</span>
      </div>
    </div>
  );
}

function CategoryBadge({ cat }: { cat: string }) {
  const cls = CATEGORY_COLORS[cat] ?? "bg-muted/20 text-muted-foreground border-border";
  return (
    <span className={cn("rounded border px-1.5 py-px text-[8px] font-bold uppercase tracking-wide", cls)}>
      {CATEGORY_LABELS[cat] ?? cat}
    </span>
  );
}

function PositionCard({ pos, bbfs }: { pos: PositionAnalysis; bbfs: string[]; key?: any }) {
  const [open, setOpen] = useState(false);
  const [catFilter, setCatFilter] = useState<string | null>(null);

  const ACCENT = [
    { text: "text-amber-400", bg: "bg-amber-500/15", bgGradient: "bg-gradient-to-b from-amber-500/5 to-background", bgHeader: "bg-amber-500/10", border: "border-amber-500/30", bar: "bg-amber-500" },
    { text: "text-sky-400",   bg: "bg-sky-500/15",   bgGradient: "bg-gradient-to-b from-sky-500/5 to-background",   bgHeader: "bg-sky-500/10", border: "border-sky-500/30",   bar: "bg-sky-500" },
    { text: "text-rose-400",  bg: "bg-rose-500/15",  bgGradient: "bg-gradient-to-b from-rose-500/5 to-background",  bgHeader: "bg-rose-500/10", border: "border-rose-500/30",  bar: "bg-rose-500" },
    { text: "text-green-400", bg: "bg-green-500/15", bgGradient: "bg-gradient-to-b from-green-500/5 to-background", bgHeader: "bg-green-500/10", border: "border-green-500/30", bar: "bg-green-500" },
  ][pos.position];

  const posLabel = pos.position === 0 ? "As (Rb)" : pos.position === 1 ? "Kop (At)" : pos.position === 2 ? "Kepala (Pl)" : "Ekor (St)";
  const totalEngines = pos.engines.length;
  const categories = [...new Set(pos.engines.map((e) => e.category))];
  const filteredEngines = catFilter ? pos.engines.filter((e) => e.category === catFilter) : pos.engines;

  return (
    <div className={cn("rounded-3xl border shadow-sm backdrop-blur-xl overflow-hidden flex flex-col transition-all", ACCENT.border, ACCENT.bgGradient)}>
      {/* Header */}
      <div className={cn("px-5 py-4 flex items-center justify-between flex-wrap gap-2", ACCENT.bgHeader)}>
        <div>
          <div className={cn("text-[10px] font-bold uppercase tracking-widest", ACCENT.text)}>{posLabel}</div>
          <div className={cn("text-5xl font-black font-mono leading-none mt-0.5", ACCENT.text)}>{pos.predicted}</div>
        </div>
        <div className="text-right space-y-0.5">
          <div className="text-[10px] text-muted-foreground">Engines mendukung</div>
          <div className={cn("text-xl font-black font-mono", ACCENT.text)}>{pos.digitSupport}<span className="text-sm text-muted-foreground">/{totalEngines}</span></div>
          <div className={cn("text-[10px] font-bold", pos.engineAgreement >= 60 ? "text-green-400" : pos.engineAgreement >= 40 ? "text-amber-400" : "text-muted-foreground")}>
            {pos.engineAgreement}% agreement
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-b border-border/40">
        <div className="flex justify-between"><span className="text-muted-foreground">Frequency</span><span className="font-mono font-bold">{pos.frequency}%</span></div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Momentum</span>
          <span className={cn("font-mono font-bold", pos.momentum > 0 ? "text-green-400" : pos.momentum < 0 ? "text-red-400" : "text-muted-foreground")}>
            {pos.momentum > 0 ? "+" : ""}{pos.momentum}% <MomentumIcon val={pos.momentum} />
          </span>
        </div>
        <div className="flex justify-between"><span className="text-muted-foreground">Transition</span><span className="font-mono font-bold">{pos.transition}%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Bayesian</span><span className="font-mono font-bold">{pos.bayesian}%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Gap Score</span><span className="font-mono font-bold">{pos.gapScore}%</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Entropy</span><span className="font-mono font-bold">{pos.entropy}%</span></div>
      </div>

      {/* BBFS + freq chart */}
      <div className="px-4 py-3 border-b border-border/40 space-y-2">
        <div>
          <div className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wider">BBFS Top 4 Kandidat</div>
          <div className="flex gap-1">
            {bbfs.map((d, i) => (
              <div key={i} className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg font-mono text-base font-black border",
                i === 0 ? cn(ACCENT.bg, ACCENT.text, ACCENT.border) :
                i === 1 ? "bg-muted/30 text-foreground border-border" :
                "bg-muted/15 text-muted-foreground border-border/50"
              )}>
                {d}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-muted-foreground mb-1">
            <span className="text-foreground/50">■</span> Frekuensi &nbsp;
            <span className="text-amber-400/60">■</span> Bobot Engine
          </div>
          <DigitFreqBar counts={pos.digitFreqMap} predicted={pos.predicted} weightedVoteMap={pos.weightedVoteMap} />
        </div>
      </div>

      {/* Engine detail toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between px-4 py-2.5 text-[10px] text-muted-foreground hover:bg-muted/10 transition-colors"
      >
        <span className="font-semibold">Detail {totalEngines} engines per kategori</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="border-t border-border/40 px-3 pb-3 pt-2 space-y-2">
          {/* Category filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setCatFilter(null)}
              className={cn("rounded border px-1.5 py-px text-[8px] font-bold", !catFilter ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground")}
            >
              Semua
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat === catFilter ? null : cat)}
                className={cn(
                  "rounded border px-1.5 py-px text-[8px] font-bold transition-all",
                  catFilter === cat
                    ? CATEGORY_COLORS[cat]
                    : "border-border text-muted-foreground hover:border-foreground/30"
                )}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>
          {/* Engine list */}
          <div className="space-y-0.5">
            {filteredEngines.map((e, idx) => (
              <div key={idx} className={cn(
                "flex items-center gap-1.5 rounded px-1.5 py-1",
                e.digit === pos.predicted ? "bg-muted/20" : ""
              )}>
                <CategoryBadge cat={e.category} />
                <span className="flex-1 truncate text-[9px] text-muted-foreground">{e.name}</span>
                <span className={cn("font-mono text-sm font-black w-4 text-center shrink-0", e.digit === pos.predicted ? ACCENT.text : "text-muted-foreground/40")}>
                  {e.digit}
                </span>
                <div className="w-16 shrink-0 h-1 rounded-full bg-muted/20 overflow-hidden">
                  <div className={cn("h-full rounded-full", e.digit === pos.predicted ? ACCENT.bar : "bg-muted/40")} style={{ width: `${e.score}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right font-mono text-[9px] text-muted-foreground/60">{e.score}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PrediksiAIPage() {
  const { data: months, isLoading, refetch, isFetching } = useGetTotoMonths();
  const [session, setSession] = useState<DrawTime>("1300");
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();
  const saveMutation = useSavePrediction();
  const { data: savedPredictions, refetch: refetchSaved } = useGetPredictions();
  const [saving, setSaving] = useState(false);

  const result = useMemo<PredictionResult | null>(() => {
    if (!months) return null;
    return runPrediction(months as any, session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, session, refreshKey]);

  const isAlreadySaved = useMemo(() => {
    if (!savedPredictions || !result) return false;
    const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return savedPredictions.some(p => p.forDate === todayStr && p.session === session && p.predicted4d === result.predicted4D);
  }, [savedPredictions, result, session]);

  async function handleSavePrediction() {
    if (!result) return;
    setSaving(true);
    try {
      const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const bbfsStr = result.bbfsCandidates ? JSON.stringify(result.bbfsCandidates) : JSON.stringify([["1","2","3","4"],["2","3","4","5"],["3","4","5","6"],["4","5","6","7"]]);
      
      await saveMutation.mutateAsync({
        session,
        forDate: todayStr,
        predicted4d: result.predicted4D,
        confidence: Math.round(result.confidence.total),
        signal: result.signal ? "yes" : "no",
        asP: Math.round((result.positions?.[0] as any)?.maxWeight || 15),
        kopP: Math.round((result.positions?.[1] as any)?.maxWeight || 15),
        kepalaP: Math.round((result.positions?.[2] as any)?.maxWeight || 15),
        ekorP: Math.round((result.positions?.[3] as any)?.maxWeight || 15),
        bbfs: bbfsStr,
      });
      
      toast({
        title: "Prediksi Tersimpan!",
        description: `Prediksi 4D (${result.predicted4D}) untuk Sesi ${DRAW_LABELS[session]} WIB berhasil dicatat ke riwayat.`,
      });
      refetchSaved();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan prediksi",
        description: err.message || "Terjadi kesalahan internal.",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleRefresh() {
    refetch();
    setRefreshKey((k) => k + 1);
  }

  const conf = result?.confidence;
  const totalConf = conf?.total ?? 0;
  const confColor = totalConf >= 70 ? "text-green-400" : totalConf >= 60 ? "text-amber-400" : "text-red-400";
  const confBarColor = totalConf >= 70 ? "bg-green-500" : totalConf >= 60 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 pb-24 pt-6 md:pb-6">
      <PageSeo title="Prediksi AI" description="Smart Prediction AI 42 engine untuk 4D Toto Macau" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Cpu className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground font-mono">Smart Prediction AI</h1>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-black text-primary">42 ENGINES</span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">SELF-LEARNING</span>
            <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400">MULTI-ALGO</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            9 kategori · Frequency · Momentum · Markov · Bayesian · Gap · Stats · Pattern · Hot/Cold · Ensemble
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Engine category legend */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
          <span key={cat} className={cn("rounded border px-2 py-0.5 text-[9px] font-bold", CATEGORY_COLORS[cat])}>
            {label}
          </span>
        ))}
        <span className="rounded border border-border px-2 py-0.5 text-[9px] text-muted-foreground">= 42 total engine</span>
      </div>

      {/* Session selector */}
      <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-card to-background p-5 shadow-sm backdrop-blur-xl">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5"/> PILIH SESI DRAW:</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {DRAW_TIMES.map((t) => (
            <button
              key={t}
              onClick={() => setSession(t)}
              className={cn(
                "rounded-lg border py-2.5 font-mono text-sm font-bold transition-all",
                session === t
                  ? "border-primary bg-primary/15 text-primary shadow-sm shadow-primary/20"
                  : "border-border bg-muted/10 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {DRAW_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
          </div>
        </div>
      ) : !result || result.totalData === 0 ? (
        <div className="rounded-3xl border border-border/50 bg-card/60 p-10 flex flex-col items-center justify-center text-center backdrop-blur-xl">
          <SearchX className="h-10 w-10 text-muted-foreground/50 mb-4" />
          <div className="font-semibold text-foreground mb-1">Belum ada data untuk sesi ini</div>
          <div className="text-sm text-muted-foreground">Coba sesi lain atau refresh di halaman Home.</div>
        </div>
      ) : (
        <>
          {/* Signal box */}
          <div className={cn(
            "rounded-3xl border p-6 space-y-5 relative overflow-hidden backdrop-blur-md shadow-lg",
            result.signal ? "border-green-500/40 bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.15)]" : "border-red-500/40 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.15)]"
          )}>
            {/* Glow orb */}
            <div className={cn(
              "absolute -top-32 -left-32 h-64 w-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-1000",
              result.signal ? "bg-green-500" : "bg-red-500"
            )} />

            {/* Top row */}
            <div className="flex items-start justify-between gap-4 flex-wrap relative z-10">
              <div className="flex items-center gap-3">
                {result.signal
                  ? <CheckCircle2 className="h-10 w-10 text-green-400 shrink-0 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                  : <XCircle className="h-10 w-10 text-red-400 shrink-0 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                }
                <div>
                  <div className={cn("text-3xl font-black font-mono tracking-tight drop-shadow-[0_0_5px_currentColor]", result.signal ? "text-green-400" : "text-red-400")}>
                    {result.signal ? "✓ SIGNAL TERDETEKSI" : "✗ NO SIGNAL"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 max-w-lg font-medium">
                    {result.signal
                      ? `Confidence ${totalConf}% ≥ threshold 60%. Prediksi dapat dijadikan referensi.`
                      : `Confidence ${totalConf}% < threshold 60%. Pola belum cukup kuat — gunakan BBFS sebagai referensi tambahan.`
                    }
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-1">Confidence</div>
                  <div className={cn("text-5xl font-black font-mono drop-shadow-[0_0_10px_currentColor]", confColor)}>{totalConf}%</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase mb-1">Engines</div>
                  <div className="font-mono text-3xl font-black text-foreground drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{result.activeEngines}</div>
                  <div className="text-[9px] text-muted-foreground font-bold uppercase">aktif</div>
                </div>
              </div>
            </div>

            {/* Predicted 4D + BBFS */}
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between border-t border-white/10 pt-5 relative z-10">
              <div className="flex flex-wrap gap-8 items-start">
                <div>
                  <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-widest font-bold">Prediksi 4D Terkuat</div>
                  <div className="flex gap-2">
                    {["As","Kop","Kep","Ekor"].map((lbl, i) => (
                      <div key={i} className="text-center">
                        <div className="text-[9px] font-black tracking-widest text-muted-foreground mb-1">{lbl}</div>
                        <div className={cn(
                          "flex h-14 w-12 items-center justify-center rounded-xl border font-mono font-black text-3xl transition-all shadow-inner",
                          result.signal
                            ? "border-green-500/50 bg-green-500/20 text-green-300 shadow-[inset_0_0_15px_rgba(34,197,94,0.2)]"
                            : "border-white/10 bg-black/40 text-muted-foreground"
                        )}>
                          {result.predicted4D[i]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-widest font-bold">BBFS 4 Digit per Posisi</div>
                  <div className="flex gap-4 flex-wrap">
                    {result.bbfsCandidates.map((digits, i) => (
                      <div key={i} className="text-center">
                        <div className="text-[9px] font-black tracking-widest text-muted-foreground mb-1">{["As","Kop","Kep","Ekor"][i]}</div>
                        <div className="flex gap-1 p-1 rounded-xl bg-black/40 border border-white/5">
                          {digits.map((d, j) => (
                            <span key={j} className={cn(
                              "flex h-8 w-7 items-center justify-center rounded-lg font-mono text-sm font-black border transition-all",
                              j === 0 ? "bg-primary/20 text-primary border-primary/40 shadow-[0_0_8px_rgba(0,220,255,0.3)]" :
                              j === 1 ? "bg-white/10 text-foreground border-white/20" :
                              "bg-transparent text-muted-foreground border-transparent"
                            )}>
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="w-full sm:w-auto shrink-0 mt-3 sm:mt-0">
                {isAlreadySaved ? (
                  <Link href="/riwayat-prediksi">
                    <Button
                      variant="outline"
                      className="border-green-500/50 bg-green-500/10 hover:bg-green-500/20 text-green-400 font-black text-xs gap-2 h-11 w-full sm:w-auto rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.15)]"
                    >
                      <ClipboardList className="h-4 w-4" />
                      Lihat di Riwayat
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={handleSavePrediction}
                    disabled={saving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs gap-2 h-11 w-full sm:w-auto shadow-[0_0_20px_rgba(0,220,255,0.4)] rounded-xl"
                  >
                    <Save className={cn("h-4 w-4", saving && "animate-spin")} />
                    {saving ? "Menyimpan..." : "Simpan Prediksi"}
                  </Button>
                )}
              </div>
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-muted-foreground border-t border-border/30 pt-3">
              <span>Data: <strong className="text-foreground">{result.totalData} draw</strong></span>
              <span>Sesi: <strong className="text-foreground">{DRAW_LABELS[result.session]}</strong></span>
              <span>Active: <strong className="text-foreground">{result.activeEngines}/{result.totalEngines} engines</strong></span>
              <span>Integrity: <strong className="text-green-400">VALID</strong></span>
              <span>Generated: <strong className="text-foreground">{new Date(result.generatedAt).toLocaleString("id-ID")}</strong></span>
            </div>
          </div>

          {/* Anomaly */}
          {result.anomaly && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-amber-400">Anomaly Detection Report</div>
                <div className="text-xs text-amber-300/80 mt-0.5">{result.anomaly}</div>
              </div>
            </div>
          )}

          {/* Confidence Breakdown */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Zap className="h-4 w-4 text-primary" />
              Confidence Breakdown (8 faktor)
            </div>
            <ScoreRow label="Engine Agreement"         value={conf!.engineAgreement}  color="bg-blue-500"    sublabel="Seberapa banyak engine setuju" />
            <ScoreRow label="Entropy (Predictability)" value={conf!.entropy}           color="bg-violet-500"  sublabel="Keterprediksan distribusi digit" />
            <ScoreRow label="Concentration"            value={conf!.concentration}     color="bg-amber-500"   sublabel="Dominasi digit terpilih" />
            <ScoreRow label="Data Quality"             value={conf!.dataQuality}       color="bg-green-500"   sublabel="Kelengkapan data historis" />
            <ScoreRow label="Backtest Score"           value={conf!.backtestScore}     color="bg-teal-500"    sublabel="Akurasi prediksi pada data lampau" />
            <ScoreRow label="Stability Score"          value={conf!.stabilityScore}    color="bg-rose-500"    sublabel="Konsistensi pola antar periode" />
            <ScoreRow label="Variance Score"           value={conf!.varianceScore}     color="bg-orange-500"  sublabel="Penyimpangan dari distribusi uniform" />
            <ScoreRow label="Cross-Validation"         value={conf!.crossValidation}   color="bg-cyan-500"    sublabel="Kesetujuan antar ensemble engine" />
            <div className="border-t border-border/60 pt-3">
              <div className="flex items-center gap-3">
                <div className="w-52 shrink-0 font-mono text-xs font-black text-foreground">TOTAL CONFIDENCE</div>
                <div className="relative flex-1 h-3 overflow-hidden rounded-full bg-muted/20">
                  <div className={cn("h-full rounded-full transition-all", confBarColor)} style={{ width: `${totalConf}%` }} />
                  <div className="absolute left-[60%] top-0 h-full w-0.5 bg-white/40" />
                </div>
                <span className={cn("w-12 shrink-0 text-right font-mono text-base font-black", confColor)}>{totalConf}%</span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Garis putih = threshold 60%. Di atas = ✓ SIGNAL, di bawah = ✗ NO SIGNAL.
              </p>
            </div>
          </div>

          {/* Per-digit analysis */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <BarChart2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Explainable AI — Analisis Per Digit (42 engine × 4 posisi)</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {result.positions.map((pos, i) => (
                <PositionCard key={pos.position} pos={pos} bbfs={result.bbfsCandidates[i]} />
              ))}
            </div>
          </div>

          {/* Engine categories summary */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="text-xs font-bold text-foreground">Ringkasan 9 Kategori Engine</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { cat: "A.Frequency", count: 5, desc: "Frekuensi all-time, recent, weighted, seasonal" },
                { cat: "B.Momentum",  count: 5, desc: "Akselarasi, linear trend, volatilitas, short/long" },
                { cat: "C.Markov",    count: 5, desc: "Rantai Markov orde 1/2/3, cross-posisi, siklik" },
                { cat: "D.Bayesian",  count: 4, desc: "Prior Bayesian cepat/normal/lambat + kombinasi" },
                { cat: "E.Gap",       count: 5, desc: "Overdue, hot, rata-rata, periodik, variansi gap" },
                { cat: "F.Stats",     count: 5, desc: "Entropi, chi-square, z-score, Poisson, konsentrasi" },
                { cat: "G.Pattern",   count: 5, desc: "Pola period-3/5, sum targeting, mirror, pair" },
                { cat: "H.HotCold",   count: 4, desc: "Hot, Cold, Warm, Contrarian (mean-reversion)" },
                { cat: "I.Ensemble",  count: 4, desc: "Weighted vote, Boosted, Neural-style, Meta-learner" },
              ].map(({ cat, count, desc }) => (
                <div key={cat} className="flex items-start gap-2 rounded-lg border border-border bg-muted/10 p-2.5">
                  <CategoryBadge cat={cat} />
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold text-foreground">{count} engine</div>
                    <div className="text-[9px] text-muted-foreground leading-tight truncate">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Guide */}
          <div className="rounded-xl border border-border bg-card/50 p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground/80 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Cara membaca Prediksi AI 42 Engine:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-green-400">SIGNAL</strong> = confidence ≥ 60%, prediksi cukup kuat dijadikan referensi.</li>
              <li><strong className="text-red-400">NO SIGNAL</strong> = confidence &lt; 60%, gunakan BBFS sebagai referensi tambahan saja.</li>
              <li><strong className="text-foreground">BBFS 4 digit</strong> per posisi = kombinasikan untuk membuat BBFS taruhan (contoh: 3×3×3×3 = 81 kombinasi).</li>
              <li>Klik <strong className="text-foreground">Detail 42 engines</strong> di tiap kartu untuk melihat per-engine dengan filter kategori.</li>
              <li>Ensemble engines (hijau) adalah meta-predictor yang menggabungkan semua engine lain — bobotnya lebih tinggi.</li>
              <li>Prediksi berbasis <em>statistik historis</em>. Semakin banyak data, semakin baik akurasi engine.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
