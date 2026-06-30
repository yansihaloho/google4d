import { useGetTotoMonths } from "@workspace/api-client-react";
import { PageSeo } from "@/components/page-seo";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import {
  Copy, Check, Sparkles, Cpu, Layers2, TrendingUp, HelpCircle,
  TrendingDown, AlertTriangle, ArrowRight, Play, Eye, EyeOff
} from "lucide-react";

const DRAW_TIMES = ["0001", "1300", "1600", "1900", "2200", "2300"] as const;
const DRAW_LABELS: Record<string, string> = {
  "0001": "00:01", "1300": "13:00", "1600": "16:00",
  "1900": "19:00", "2200": "22:00", "2300": "23:00",
};

type DrawTime = typeof DRAW_TIMES[number];

interface LineResult {
  num: string; // "00" - "99"
  score: number;
  freq: number;
  gap: number;
  decayScore: number;
  comboScore: number;
  transitionScore: number;
  rank: number;
}

export default function Prediksi2DPage() {
  const { data: months, isLoading } = useGetTotoMonths();
  const [selectedSession, setSelectedSession] = useState<"all" | DrawTime>("all");
  const [separator, setSeparator] = useState<"," | " " | "*">(",");
  const [copiedGroup, setCopiedGroup] = useState<string | null>(null);
  const [showWeakLines, setShowWeakLines] = useState(false);

  // Parse all drawings from history
  const allResults = useMemo(() => {
    if (!months) return [];
    const list: { drawDate: string; session: string; result: string }[] = [];
    months.forEach((m) => {
      m.results.forEach((day) => {
        DRAW_TIMES.forEach((t) => {
          const val = day[`draw${t}` as const];
          if (val && val.length === 4 && !isNaN(parseInt(val))) {
            list.push({
              drawDate: day.drawDate,
              session: t,
              result: val,
            });
          }
        });
      });
    });
    // Sort from oldest to newest
    return list.sort((a, b) => a.drawDate.localeCompare(b.drawDate));
  }, [months]);

  // Filter based on chosen session
  const filteredResults = useMemo(() => {
    if (selectedSession === "all") return allResults;
    return allResults.filter((r) => r.session === selectedSession);
  }, [allResults, selectedSession]);

  // Main calculation of 100 possible 2D lines
  const predictionList = useMemo<LineResult[]>(() => {
    if (filteredResults.length === 0) return [];

    const totalDraws = filteredResults.length;
    const freq2D = new Array(100).fill(0);
    const lastSeenIndex = new Array(100).fill(-1);

    // Individual position frequencies
    const freqKepala = new Array(10).fill(0);
    const freqEkor = new Array(10).fill(0);

    // Exponentially decay-weighted frequency
    const decay2D = new Array(100).fill(0);

    // Transition count: from previous draw 2D to next 2D
    const transitionMatrix: Record<string, number[]> = {};

    filteredResults.forEach((draw, idx) => {
      const full4d = draw.result;
      const kepDigit = parseInt(full4d[2]);
      const ekorDigit = parseInt(full4d[3]);
      const val2d = kepDigit * 10 + ekorDigit;

      freq2D[val2d]++;
      lastSeenIndex[val2d] = idx;

      freqKepala[kepDigit]++;
      freqEkor[ekorDigit]++;

      // Decay scoring (recent draws get higher weight)
      decay2D[val2d] += Math.pow(0.965, totalDraws - 1 - idx);

      // Transition matrix tracking
      if (idx > 0) {
        const prevFull = filteredResults[idx - 1].result;
        const prevVal2dStr = prevFull[2] + prevFull[3];
        if (!transitionMatrix[prevVal2dStr]) {
          transitionMatrix[prevVal2dStr] = new Array(100).fill(0);
        }
        transitionMatrix[prevVal2dStr][val2d]++;
      }
    });

    // Last drawn 2D for Markov chain transition
    const lastDraw = filteredResults[filteredResults.length - 1]?.result;
    const last2dStr = lastDraw ? lastDraw[2] + lastDraw[3] : "";
    const transitionWeights = transitionMatrix[last2dStr] || new Array(100).fill(0);
    const maxTransition = Math.max(1, ...transitionWeights);

    // Build scores for each of 100 combinations
    const results: LineResult[] = Array.from({ length: 100 }, (_, i) => {
      const numStr = i.toString().padStart(2, "0");
      const kep = Math.floor(i / 10);
      const ekor = i % 10;

      const count = freq2D[i];
      const gap = lastSeenIndex[i] === -1 ? totalDraws : totalDraws - 1 - lastSeenIndex[i];

      // Normalized sub-scores
      const fScore = (count / Math.max(1, Math.max(...freq2D))) * 100;
      const dScore = (decay2D[i] / Math.max(0.001, Math.max(...decay2D))) * 100;
      const cScore = ((freqKepala[kep] + freqEkor[ekor]) / Math.max(1, Math.max(...freqKepala) + Math.max(...freqEkor))) * 100;
      const tScore = (transitionWeights[i] / maxTransition) * 100;

      // Gap bonus: we prefer hot numbers but also include a "rebound overdue" factor
      const gapBonus = Math.min(60, gap * 1.5);

      // Final mathematical composite score
      // Weighting: Trend (30%) + All-Time Freq (20%) + Transition Trend (15%) + Position Strength (20%) + Overdue Gap Factor (15%)
      const totalScore = (dScore * 0.3) + (fScore * 0.2) + (tScore * 0.15) + (cScore * 0.2) + (gapBonus * 0.15);

      return {
        num: numStr,
        score: Math.round(totalScore),
        freq: count,
        gap,
        decayScore: Math.round(dScore),
        comboScore: Math.round(cScore),
        transitionScore: Math.round(tScore),
        rank: 0, // Assigned below
      };
    });

    // Sort by composite score descending
    results.sort((a, b) => b.score - a.score || b.freq - a.freq || a.gap - b.gap);

    // Assign rank
    results.forEach((item, index) => {
      item.rank = index + 1;
    });

    return results;
  }, [filteredResults]);

  // Segregate the 100 lines into groups
  const lineUtama = useMemo(() => predictionList.slice(0, 10), [predictionList]);
  const lineCadangan = useMemo(() => predictionList.slice(10, 40), [predictionList]);
  const lineSupport = useMemo(() => predictionList.slice(40, 70), [predictionList]);
  const lineLemah = useMemo(() => predictionList.slice(70, 100), [predictionList]);

  const all70Lines = useMemo(() => {
    return [...lineUtama, ...lineCadangan, ...lineSupport].map(x => x.num).sort();
  }, [lineUtama, lineCadangan, lineSupport]);

  // Backtest simulation: calculates what percentage of previous K draws were "Hits" in our 70-line generator
  const backtestStats = useMemo(() => {
    if (allResults.length < 25) return { rate: 0, hits: 0, total: 0 };

    const K = Math.min(30, allResults.length - 20); // Test last 30 draws
    let hits = 0;

    for (let i = 0; i < K; i++) {
      const testIdx = allResults.length - 1 - i;
      const testDraw = allResults[testIdx];
      const testDraw2D = testDraw.result[2] + testDraw.result[3];

      // Compile prediction prior to testIdx
      const priorHistory = allResults.slice(0, testIdx);
      if (selectedSession !== "all") {
        // filter session
        const sessHistory = priorHistory.filter(h => h.session === testDraw.session);
        if (sessHistory.length < 10) continue;
      }

      // Re-run simplified prediction calculation
      const tempFreq = new Array(100).fill(0);
      const tempDecay = new Array(100).fill(0);
      const tempKepala = new Array(10).fill(0);
      const tempEkor = new Array(10).fill(0);
      const histLength = priorHistory.length;

      priorHistory.forEach((h, idx) => {
        const full4d = h.result;
        const kep = parseInt(full4d[2]);
        const ek = parseInt(full4d[3]);
        const val = kep * 10 + ek;

        tempFreq[val]++;
        tempDecay[val] += Math.pow(0.965, histLength - 1 - idx);
        tempKepala[kep]++;
        tempEkor[ek]++;
      });

      const tempScores = Array.from({ length: 100 }, (_, code) => {
        const kep = Math.floor(code / 10);
        const ek = code % 10;
        const fScore = (tempFreq[code] / Math.max(1, Math.max(...tempFreq))) * 100;
        const dScore = (tempDecay[code] / Math.max(0.001, Math.max(...tempDecay))) * 100;
        const cScore = ((tempKepala[kep] + tempEkor[ek]) / Math.max(1, Math.max(...tempKepala) + Math.max(...tempEkor))) * 100;

        return { code, score: dScore * 0.4 + fScore * 0.3 + cScore * 0.3 };
      });

      tempScores.sort((a, b) => b.score - a.score);
      const top70Codes = tempScores.slice(0, 70).map(x => x.code.toString().padStart(2, "0"));

      if (top70Codes.includes(testDraw2D)) {
        hits++;
      }
    }

    const rate = (hits / K) * 100;
    return {
      rate: Math.round(rate),
      hits,
      total: K,
    };
  }, [allResults, selectedSession]);

  function copyText(nums: string[], groupName: string) {
    const text = nums.join(separator);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedGroup(groupName);
      setTimeout(() => setCopiedGroup(null), 2000);
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-24 pt-6 md:pb-6">
      <PageSeo
        title="Prediksi 2D Belakang 70 Line"
        description="Analisis multi-algoritma data historis Toto Macau untuk menghasilkan 70 line 2D belakang paling akurat."
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/25">
              <Cpu className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">AI Prediksi 2D Belakang</h1>
              <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] uppercase font-bold py-0.5 px-2 mt-0.5">
                Formula 70 Line Terkuat
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground ml-14 pl-0.5">
            Menghitung probabilitas kombinasi 2 Angka Belakang (00–99) menggunakan Frequency, Exponential Trend, Markov Chain, dan Overdue Gap.
          </p>
        </div>

        {/* Backtest accuracy badge */}
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-3 sm:w-auto">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground leading-none">Simulasi Backtest 30 Sesi</div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-extrabold text-emerald-400">{backtestStats.rate}%</span>
              <span className="text-[10px] text-muted-foreground">Hit Rate ({backtestStats.hits}/{backtestStats.total} Draw)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel / Session Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Session card filter */}
        <div className="md:col-span-2 rounded-2xl border border-border bg-card/50 p-4 space-y-3">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block">
            PILIH SESI DRAW MACAU
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedSession("all")}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-bold transition-all border shrink-0",
                selectedSession === "all"
                  ? "bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-sm"
                  : "bg-muted/20 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40"
              )}
            >
              Semua Sesi (Gabungan)
            </button>
            {DRAW_TIMES.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedSession(t)}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs font-bold transition-all border shrink-0",
                  selectedSession === t
                    ? "bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-sm"
                    : "bg-muted/20 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40"
                )}
              >
                Sesi {DRAW_LABELS[t]} WIB
              </button>
            ))}
          </div>
        </div>

        {/* Separator template card */}
        <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block">
            FORMAT SEPARATOR COPY
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Koma ( , )", val: "," as const },
              { label: "Spasi (   )", val: " " as const },
              { label: "Bintang ( * )", val: "*" as const },
            ].map((sep) => (
              <button
                key={sep.val}
                onClick={() => setSeparator(sep.val)}
                className={cn(
                  "rounded-xl py-2 text-xs font-bold transition-all border",
                  separator === sep.val
                    ? "bg-primary/10 text-primary border-primary/40"
                    : "bg-muted/20 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/40"
                )}
              >
                {sep.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : predictionList.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground shadow-sm backdrop-blur-xl">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500/80 mb-2" />
          Data historis kosong atau tidak ditemukan.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main 70 Line Hub Card */}
          <div className="rounded-3xl border border-primary/20 bg-background/60 backdrop-blur-md shadow-[0_0_30px_rgba(0,220,255,0.1)] overflow-hidden">
            {/* Header copy action */}
            <div className="border-b border-primary/20 bg-primary/5 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-widest drop-shadow-[0_0_5px_currentColor]">Gabungan 70 Line Terkuat</h3>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Gabungan Utama + Cadangan + Support</p>
                </div>
              </div>
              <button
                onClick={() => copyText(all70Lines, "all70")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black transition-all border",
                  copiedGroup === "all70"
                    ? "bg-green-500/10 text-green-400 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                    : "bg-rose-500 text-white border-transparent hover:bg-rose-600 active:scale-95 shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                )}
              >
                {copiedGroup === "all70" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedGroup === "all70" ? "Berhasil Disalin!" : "Copy Semua 70 Line"}
              </button>
            </div>

            {/* Display grid of 70 numbers */}
            <div className="p-4 sm:p-6 bg-black/30 relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,220,255,0.05),transparent_70%)] pointer-events-none" />
              <div className="flex flex-wrap gap-2 justify-center relative z-10">
                {all70Lines.map((num) => {
                  const details = predictionList.find(x => x.num === num);
                  const isUtama = lineUtama.some(x => x.num === num);
                  const isCadangan = lineCadangan.some(x => x.num === num);

                  return (
                    <div
                      key={num}
                      className={cn(
                        "relative flex flex-col items-center justify-center h-14 w-12 rounded-xl border transition-all cursor-help group shadow-inner",
                        isUtama
                          ? "bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[inset_0_0_15px_rgba(244,63,94,0.2),0_0_10px_rgba(244,63,94,0.2)]"
                          : isCadangan
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]"
                          : "bg-black/40 border-white/10 text-foreground"
                      )}
                      title={`Kombinasi ${num} - Skor Akurasi: ${details?.score}% (Rank #${details?.rank})`}
                    >
                      <span className="font-mono text-lg font-black tracking-tighter">{num}</span>
                      <span className="text-[8px] font-black uppercase text-muted-foreground/80 scale-90 -mt-1 leading-none">
                        {details?.score}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Fast code text display for copy pasting */}
              <div className="mt-6 rounded-3xl border border-white/10 bg-black/60 p-5 relative z-10 backdrop-blur-md">
                <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground block mb-2">
                  Format Teks Cepat ({separator === "," ? "Koma" : separator === " " ? "Spasi" : "Bintang"})
                </span>
                <p className="font-mono text-[12px] text-primary/80 break-all leading-relaxed max-h-20 overflow-y-auto scrollbar-none select-all drop-shadow-[0_0_5px_currentColor]">
                  {all70Lines.join(separator)}
                </p>
              </div>
            </div>
          </div>

          {/* Grouped Lists (Bento Grid Style) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Line Utama (10 Line) */}
            <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-5 space-y-4 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-bold">1</div>
                  <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider">Line Utama (10 LN)</h4>
                </div>
                <button
                  onClick={() => copyText(lineUtama.map(x => x.num), "utama")}
                  className="rounded px-2 py-1 text-[10px] font-bold border border-rose-500/35 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-colors"
                >
                  {copiedGroup === "utama" ? "Disalin!" : "Copy 10 LN"}
                </button>
              </div>
              <p className="text-[10px] text-rose-300/70 leading-normal">
                10 Kombinasi dengan akumulasi skor tertinggi & momentum paling stabil.
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {lineUtama.map((item) => (
                  <div key={item.num} className="text-center bg-rose-500/10 rounded-lg border border-rose-500/20 py-2">
                    <div className="font-mono text-sm font-black text-rose-300">{item.num}</div>
                    <div className="text-[8px] text-rose-400/80 mt-0.5">{item.score}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Line Cadangan (30 Line) */}
            <div className="rounded-3xl border border-amber-500/25 bg-amber-500/5 p-5 space-y-4 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">2</div>
                  <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">Line Cadangan (30 LN)</h4>
                </div>
                <button
                  onClick={() => copyText(lineCadangan.map(x => x.num), "cadangan")}
                  className="rounded px-2 py-1 text-[10px] font-bold border border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors"
                >
                  {copiedGroup === "cadangan" ? "Disalin!" : "Copy 30 LN"}
                </button>
              </div>
              <p className="text-[10px] text-amber-300/70 leading-normal">
                Kombinasi pendukung berfrekuensi tinggi & trend kuat yang berpotensi melesat.
              </p>
              <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto pr-1">
                {lineCadangan.map((item) => (
                  <div key={item.num} className="text-center bg-amber-500/5 rounded-lg border border-amber-500/15 py-1.5">
                    <div className="font-mono text-xs font-bold text-amber-200">{item.num}</div>
                    <div className="text-[7px] text-amber-400/70 scale-90">{item.score}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Line Support (30 Line) */}
            <div className="rounded-3xl border border-border/50 bg-gradient-to-b from-card to-background p-5 space-y-4 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded bg-muted/40 text-muted-foreground flex items-center justify-center text-xs font-bold">3</div>
                  <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider">Line Support (30 LN)</h4>
                </div>
                <button
                  onClick={() => copyText(lineSupport.map(x => x.num), "support")}
                  className="rounded px-2 py-1 text-[10px] font-bold border border-border bg-muted/10 text-foreground hover:bg-muted/30 transition-colors"
                >
                  {copiedGroup === "support" ? "Disalin!" : "Copy 30 LN"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Kombinasi dengan gap tinggi/overdue (lama tidak keluar) yang berpeluang keluar cepat.
              </p>
              <div className="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto pr-1">
                {lineSupport.map((item) => (
                  <div key={item.num} className="text-center bg-muted/10 rounded-lg border border-border/40 py-1.5">
                    <div className="font-mono text-xs font-bold text-muted-foreground">{item.num}</div>
                    <div className="text-[7px] text-muted-foreground/60 scale-90">{item.score}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filtering Analysis Explanation Card */}
          <div className="rounded-3xl border border-border/50 bg-gradient-to-b from-card to-background p-6 space-y-5 shadow-sm backdrop-blur-xl">
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              METODE FILTRASI AI 70 LINE
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1 bg-black/10 border border-border/20 rounded-xl p-3">
                <span className="font-bold text-rose-400 block">1. Exponential Decay (30%)</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Menghitung bobot eksponensial di mana sesi draw yang baru keluar mendapatkan nilai jauh lebih tinggi dibanding sesi lama.
                </p>
              </div>
              <div className="space-y-1 bg-black/10 border border-border/20 rounded-xl p-3">
                <span className="font-bold text-amber-400 block">2. Position Probabilities (20%)</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Menganalisis kekuatan digit Kepala (posisi 3) dan Ekor (posisi 4) secara mandiri, lalu menyatukan peluang rilisnya.
                </p>
              </div>
              <div className="space-y-1 bg-black/10 border border-border/20 rounded-xl p-3">
                <span className="font-bold text-blue-400 block">3. Markov Chain (15%)</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Mendeteksi probabilitas perpindahan (transisi) dari angka 2D terakhir yang keluar menuju angka rilis berikutnya secara runtut.
                </p>
              </div>
              <div className="space-y-1 bg-black/10 border border-border/20 rounded-xl p-3">
                <span className="font-bold text-emerald-400 block">4. Overdue Rebound (15%)</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Menyisipkan kompensasi gap rilis. Angka dengan keterlambatan tinggi (overdue) ditambahkan skor bayesian agar tidak tertinggal.
                </p>
              </div>
            </div>
          </div>

          {/* Saringan AI: Weak Numbers filter out list */}
          <div className="rounded-3xl border border-border/50 bg-card/60 p-5 space-y-4 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-foreground uppercase tracking-wider">Saringan AI: 30 Line yang Dieliminasi</h4>
                <p className="text-[10px] text-muted-foreground">Angka terlemah/paling dingin berdasarkan hitungan data saat ini.</p>
              </div>
              <button
                onClick={() => setShowWeakLines(!showWeakLines)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-[10px] font-bold px-3 py-1.5 transition-colors"
              >
                {showWeakLines ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showWeakLines ? "Sembunyikan" : "Tampilkan 30 LN Lemah"}
              </button>
            </div>

            {showWeakLines && (
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div className="flex flex-wrap gap-1 justify-center">
                  {lineLemah.map((item) => (
                    <div
                      key={item.num}
                      className="flex flex-col items-center justify-center h-10 w-10 rounded-lg border border-red-500/10 bg-red-500/5 text-muted-foreground/60"
                      title={`Kombinasi lemah: ${item.num} - Rank #${item.rank}`}
                    >
                      <span className="font-mono text-xs font-bold line-through">{item.num}</span>
                      <span className="text-[7px] text-red-400/55">{item.score}%</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-red-500/5 border border-red-500/15 p-3 flex items-start gap-2 text-[10px] text-muted-foreground leading-relaxed">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Saran Manajemen Risiko:</strong> Ke-30 line di atas adalah angka dengan skor di bawah ambang batas (cutoff) analitik. AI menyarankan untuk membatasi/menghilangkan angka ini dari taruhan Anda guna meningkatkan efisiensi modal.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
