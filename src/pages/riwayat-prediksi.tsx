import { useState, useMemo } from "react";
import { useGetPredictions, useDeletePrediction } from "@workspace/api-client-react";
import { PageSeo } from "@/components/page-seo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  History, Trash2, CheckCircle2, XCircle, Minus,
  TrendingUp, BarChart3, Target, Award, AlertCircle, Download
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pred {
  id: number;
  session: string;
  forDate: string;
  predicted4d: string;
  confidence: number;
  signal: string;
  asP: number;
  kopP: number;
  kepalaP: number;
  ekorP: number;
  bbfs: string;
  createdAt: string;
  actual4d: string | null;
  asCorrect: boolean | null;
  kopCorrect: boolean | null;
  kepalaCorrect: boolean | null;
  ekorCorrect: boolean | null;
  digitScore: number | null;
}

// ─── BBFS Parser ─────────────────────────────────────────────────────────────

function parseBbfs(bbfsStr: string): string[][] {
  try {
    const parsed = JSON.parse(bbfsStr);
    if (Array.isArray(parsed) && parsed.every(Array.isArray)) {
      return parsed.map((arr) => arr.map(String));
    }
  } catch (e) {
    // Ignore JSON error and parse as comma separated list of digits
  }

  // Fallback parsing of comma-separated string (e.g. legacy saves)
  const parts = bbfsStr ? bbfsStr.split(",").map((s) => s.trim()) : [];
  if (parts.length >= 16) {
    return [
      parts.slice(0, 4),
      parts.slice(4, 8),
      parts.slice(8, 12),
      parts.slice(12, 16)
    ];
  }
  
  // If it's a shorter legacy 5-digit array or whatever:
  const chunkLength = Math.max(1, Math.floor(parts.length / 4));
  return [
    parts.slice(0, Math.max(1, chunkLength)),
    parts.slice(chunkLength, Math.max(2, chunkLength * 2)),
    parts.slice(chunkLength * 2, Math.max(3, chunkLength * 3)),
    parts.slice(chunkLength * 3)
  ];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAW_LABELS: Record<string, string> = {
  "0001": "00:01", "1300": "13:00", "1600": "16:00",
  "1900": "19:00", "2200": "22:00", "2300": "23:00",
};

const SESSION_COLORS: Record<string, string> = {
  "0001": "bg-slate-500/20 text-slate-300",
  "1300": "bg-amber-500/20 text-amber-300",
  "1600": "bg-orange-500/20 text-orange-300",
  "1900": "bg-violet-500/20 text-violet-300",
  "2200": "bg-sky-500/20 text-sky-300",
  "2300": "bg-rose-500/20 text-rose-300",
};

const POS_LABELS = ["As", "Kop", "Kep", "Ekor"];
const POS_KEYS: Array<"asCorrect" | "kopCorrect" | "kepalaCorrect" | "ekorCorrect"> = [
  "asCorrect", "kopCorrect", "kepalaCorrect", "ekorCorrect",
];
const POS_PRED_KEYS: Array<"asP" | "kopP" | "kepalaP" | "ekorP"> = [
  "asP", "kopP", "kepalaP", "ekorP",
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function DigitCell({ predicted, actual, correct }: { predicted: string | number; actual: string | null; correct: boolean | null; key?: any }) {
  if (actual === null) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-mono text-base font-black text-foreground">{predicted}</span>
        <span className="text-[8px] text-muted-foreground/40">—</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("font-mono text-base font-black", correct ? "text-green-400" : "text-red-400")}>{predicted}</span>
      <span className="font-mono text-xs text-muted-foreground">{actual}</span>
    </div>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-muted-foreground/40">Menunggu</span>;
  const color = score === 4 ? "text-green-400 bg-green-500/15 border-green-500/30"
              : score === 3 ? "text-teal-400 bg-teal-500/15 border-teal-500/30"
              : score === 2 ? "text-amber-400 bg-amber-500/15 border-amber-500/30"
              : score === 1 ? "text-orange-400 bg-orange-500/15 border-orange-500/30"
              : "text-red-400 bg-red-500/15 border-red-500/30";
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 font-mono text-xs font-black", color)}>
      {score === 4 && <Award className="h-3 w-3" />}
      {score}/4
    </span>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-card to-background p-5 text-center shadow-sm backdrop-blur-xl">
      <div className={cn("text-2xl sm:text-3xl font-black font-mono tracking-tight", color ?? "text-foreground")}>{value}</div>
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-2">{label}</div>
      {sub && <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RiwayatPrediksiPage() {
  const { data, isLoading, refetch } = useGetPredictions();
  const deleteMut = useDeletePrediction();
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [deleting, setDeleting] = useState<number | null>(null);

  const preds = (data ?? []) as Pred[];

  const filtered = useMemo(() =>
    sessionFilter === "all" ? preds : preds.filter((p) => p.session === sessionFilter),
    [preds, sessionFilter]
  );

  // ── Stats ──
  const resolved = preds.filter((p) => p.actual4d !== null);
  const totalResolved = resolved.length;
  const perfectHits = resolved.filter((p) => p.digitScore === 4).length;
  const anyHit = resolved.filter((p) => (p.digitScore ?? 0) >= 1).length;
  const avgScore = totalResolved > 0
    ? (resolved.reduce((a, p) => a + (p.digitScore ?? 0), 0) / totalResolved).toFixed(2)
    : "—";

  // Per-position accuracy
  const posAcc = POS_KEYS.map((key) => {
    const eligible = resolved.filter((p) => p[key] !== null);
    const correct = eligible.filter((p) => p[key] === true).length;
    return { eligible: eligible.length, correct, pct: eligible.length > 0 ? Math.round((correct / eligible.length) * 100) : 0 };
  });

  // Sessions used
  const sessions = [...new Set(preds.map((p) => p.session))].sort();

  // Chart data
  const chartData = useMemo(() => {
    return resolved.slice(-30).map((p, i) => ({
      name: `P-${i + 1}`,
      score: p.digitScore || 0,
      session: p.session,
    }));
  }, [resolved]);

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await deleteMut.mutateAsync(id);
      refetch();
    } finally {
      setDeleting(null);
    }
  }

  function handleExportCsv() {
    if (preds.length === 0) return;
    const headers = [
      "ID", "Sesi", "Tanggal", "Tgl Dibuat", 
      "Prediksi 4D", "Actual 4D", "Confidence", "Signal AI", 
      "As P", "Kop P", "Kep P", "Ekor P",
      "As Tepat", "Kop Tepat", "Kep Tepat", "Ekor Tepat", "Skor Total", "BBFS"
    ];
    
    const rows = preds.map(p => [
      p.id,
      DRAW_LABELS[p.session] || p.session,
      p.forDate,
      new Date(p.createdAt).toLocaleString(),
      p.predicted4d,
      p.actual4d || "-",
      `${Math.round(p.confidence * 100)}%`,
      p.signal,
      `${Math.round(p.asP * 100)}%`,
      `${Math.round(p.kopP * 100)}%`,
      `${Math.round(p.kepalaP * 100)}%`,
      `${Math.round(p.ekorP * 100)}%`,
      p.asCorrect === null ? "-" : p.asCorrect ? "Ya" : "Tidak",
      p.kopCorrect === null ? "-" : p.kopCorrect ? "Ya" : "Tidak",
      p.kepalaCorrect === null ? "-" : p.kepalaCorrect ? "Ya" : "Tidak",
      p.ekorCorrect === null ? "-" : p.ekorCorrect ? "Ya" : "Tidak",
      p.digitScore === null ? "-" : p.digitScore,
      `"${p.bbfs.replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `riwayat-prediksi-ai-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 pb-24 pt-6 md:pb-6">
      <PageSeo title="Riwayat Prediksi" description="Riwayat prediksi AI vs hasil aktual Toto Macau" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground font-mono">Riwayat Prediksi</h1>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">{preds.length} TOTAL</span>
        </div>
        <button 
          onClick={handleExportCsv}
          disabled={preds.length === 0}
          className="flex items-center gap-2 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Ekspor CSV
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : preds.length === 0 ? (
        <div className="rounded-3xl border border-border/50 bg-card/60 p-12 text-center shadow-sm backdrop-blur-xl">
          <History className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <div className="text-sm font-bold text-muted-foreground">Belum ada prediksi tersimpan</div>
          <div className="text-xs text-muted-foreground/60 mt-1">
            Buka halaman <strong className="text-foreground">Prediksi AI</strong>, klik tombol <strong className="text-foreground">Simpan Prediksi</strong>, dan hasil akan dicatat di sini.
          </div>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Tersimpan" value={preds.length} sub={`${totalResolved} sudah ada hasil`} />
            <StatCard label="Avg Digit Benar" value={avgScore} sub="dari maks 4" color="text-primary" />
            <StatCard
              label="Tepat Semua 4D"
              value={perfectHits}
              sub={totalResolved > 0 ? `${Math.round((perfectHits / totalResolved) * 100)}% hit rate` : "—"}
              color="text-green-400"
            />
            <StatCard
              label="Min 1 Digit Benar"
              value={anyHit}
              sub={totalResolved > 0 ? `${Math.round((anyHit / totalResolved) * 100)}% dari ${totalResolved}` : "—"}
              color="text-amber-400"
            />
          </div>

          {/* Per-position accuracy */}
          {totalResolved > 0 && (
            <div className="rounded-3xl border border-border/50 bg-gradient-to-b from-card to-background p-6 space-y-4 shadow-sm backdrop-blur-xl">
              <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Target className="h-4 w-4 text-primary" />
                Akurasi Per Posisi
              </div>
              <div className="grid grid-cols-4 gap-3">
                {posAcc.map((p, i) => (
                  <div key={i} className="text-center rounded-lg border border-border bg-muted/10 p-3">
                    <div className="text-[10px] text-muted-foreground font-bold uppercase">{POS_LABELS[i]}</div>
                    <div className={cn("text-2xl font-black font-mono mt-1",
                      p.pct >= 70 ? "text-green-400" : p.pct >= 50 ? "text-amber-400" : p.pct >= 30 ? "text-orange-400" : "text-red-400"
                    )}>{p.pct}%</div>
                    <div className="text-[9px] text-muted-foreground">{p.correct}/{p.eligible}</div>
                    <div className="mt-1.5 h-1 rounded-full bg-muted/20 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", p.pct >= 70 ? "bg-green-500" : p.pct >= 50 ? "bg-amber-500" : p.pct >= 30 ? "bg-orange-500" : "bg-red-500")}
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Win Rate Trend Chart */}
          {totalResolved > 0 && chartData.length > 0 && (
            <div className="rounded-3xl border border-border/50 bg-gradient-to-b from-card to-background p-6 space-y-4 shadow-sm backdrop-blur-xl">
              <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <TrendingUp className="h-5 w-5 text-primary" />
                Tren Akurasi AI (30 Prediksi Terakhir)
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00dcff" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#00dcff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#00dcff' }}
                    />
                    <Area type="monotone" dataKey="score" stroke="#00dcff" fillOpacity={1} fill="url(#colorScore)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Filter by session */}
          {sessions.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-bold uppercase">Filter Sesi:</span>
              <button
                onClick={() => setSessionFilter("all")}
                className={cn("rounded-lg border px-2.5 py-1 text-xs font-bold transition-all",
                  sessionFilter === "all" ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                )}
              >
                Semua ({preds.length})
              </button>
              {sessions.map((s) => (
                <button
                  key={s}
                  onClick={() => setSessionFilter(s)}
                  className={cn("rounded-lg border px-2.5 py-1 text-xs font-bold transition-all",
                    sessionFilter === s ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {DRAW_LABELS[s] ?? s} ({preds.filter(p => p.session === s).length})
                </button>
              ))}
            </div>
          )}

          {/* Table — desktop */}
          <div className="hidden md:block rounded-3xl border border-border/50 bg-card/60 shadow-sm overflow-hidden backdrop-blur-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tanggal Prediksi</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sesi</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tgl. Draw</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prediksi / Aktual</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">BBFS 4D Posisi</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Skor</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conf.</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Signal</th>
                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((p) => {
                  const actualDigits = p.actual4d ? p.actual4d.split("") : null;
                  return (
                    <tr key={p.id} className={cn("transition-colors hover:bg-muted/10", p.digitScore === 4 && "bg-green-500/5")}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] font-bold", SESSION_COLORS[p.session] ?? "bg-muted/20 text-muted-foreground")}>
                          {DRAW_LABELS[p.session] ?? p.session}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-foreground">{p.forDate}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {Array.from({ length: 4 }).map((_, i) => {
                            const predChar = p.predicted4d?.[i] ?? "-";
                            return (
                              <DigitCell
                                key={i}
                                predicted={predChar}
                                actual={actualDigits ? actualDigits[i] ?? null : null}
                                correct={p[POS_KEYS[i]!]}
                              />
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex justify-center gap-1.5">
                          {parseBbfs(p.bbfs).map((digits, i) => (
                            <div key={i} className="text-center rounded bg-muted/10 border border-border/20 px-1 py-0.5">
                              <div className="text-[7px] text-muted-foreground uppercase font-semibold scale-90 mb-0.5">{POS_LABELS[i]}</div>
                              <div className="flex gap-0.5">
                                {digits.map((d, j) => {
                                  const actualDigit = actualDigits?.[i];
                                  const isMatched = actualDigit !== undefined && String(d) === String(actualDigit);
                                  return (
                                    <span key={j} className={cn(
                                      "flex h-4 w-3.5 items-center justify-center rounded-[2px] font-mono text-[9px] font-black border",
                                      isMatched ? "bg-green-500/20 text-green-300 border-green-500/40" : "bg-muted/35 text-muted-foreground/80 border-border/30"
                                    )}>
                                      {d}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ScoreBadge score={p.digitScore} />
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-xs font-bold">
                        <span className={p.confidence >= 60 ? "text-green-400" : "text-muted-foreground"}>
                          {p.confidence}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {p.signal === "yes" || p.signal === "STRONG_BUY" || p.signal === "STRONG" || p.signal === "strong"
                          ? <CheckCircle2 className="inline h-4 w-4 text-green-400" />
                          : <XCircle className="inline h-4 w-4 text-red-400/50" />
                        }
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deleting === p.id}
                          className="rounded-lg p-1.5 text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards — mobile */}
          <div className="space-y-2 md:hidden">
            {filtered.map((p) => {
              const actualDigits = p.actual4d ? p.actual4d.split("") : null;
              return (
                <div key={p.id} className={cn("rounded-3xl border bg-gradient-to-b from-card to-background p-5 space-y-4 shadow-sm backdrop-blur-xl", p.digitScore === 4 ? "border-green-500/30" : "border-border/50")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] font-bold", SESSION_COLORS[p.session] ?? "bg-muted/20 text-muted-foreground")}>
                        {DRAW_LABELS[p.session] ?? p.session}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{p.forDate}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                      className="rounded-lg p-1.5 text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase mb-1">Prediksi / Aktual</div>
                      <div className="flex gap-3">
                        {Array.from({ length: 4 }).map((_, i) => {
                          const predChar = p.predicted4d?.[i] ?? "-";
                          return (
                            <div key={i} className="text-center">
                              <div className="text-[8px] text-muted-foreground mb-0.5">{POS_LABELS[i]}</div>
                              <DigitCell
                                predicted={predChar}
                                actual={actualDigits ? actualDigits[i] ?? null : null}
                                correct={p[POS_KEYS[i]!]}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <ScoreBadge score={p.digitScore} />
                      <div className="flex items-center justify-end gap-1">
                        <span className={cn("font-mono text-xs font-bold", p.confidence >= 60 ? "text-green-400" : "text-muted-foreground")}>{p.confidence}%</span>
                        {p.signal === "yes" || p.signal === "STRONG_BUY" || p.signal === "STRONG" || p.signal === "strong"
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                          : <XCircle className="h-3.5 w-3.5 text-red-400/50" />
                        }
                      </div>
                    </div>
                  </div>
                  
                  {/* BBFS per position section */}
                  <div className="border-t border-border/25 pt-3">
                    <div className="text-[9px] text-muted-foreground uppercase mb-1.5 font-bold tracking-wider">BBFS 4 Digit per Posisi</div>
                    <div className="flex gap-2 flex-wrap">
                      {parseBbfs(p.bbfs).map((digits, i) => (
                        <div key={i} className="text-center rounded bg-muted/15 border border-border/10 px-1.5 py-1">
                          <div className="text-[8px] text-muted-foreground uppercase font-bold mb-1">{POS_LABELS[i]}</div>
                          <div className="flex gap-0.5">
                            {digits.map((d, j) => {
                              const actualDigit = actualDigits?.[i];
                              const isMatched = actualDigit !== undefined && String(d) === String(actualDigit);
                              return (
                                <span key={j} className={cn(
                                  "flex h-5 w-4.5 items-center justify-center rounded font-mono text-xs font-black border",
                                  isMatched ? "bg-green-500/25 text-green-300 border-green-500/40" : "bg-muted/30 text-muted-foreground/80 border-border/25"
                                )}>
                                  {d}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {p.actual4d === null && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-amber-500/20 bg-amber-500/5 px-2 py-1.5">
                      <AlertCircle className="h-3 w-3 text-amber-400/60 shrink-0" />
                      <span className="text-[9px] text-amber-300/60">Hasil aktual belum tersedia — otomatis terisi saat data draw masuk.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Accuracy guide */}
          <div className="rounded-xl border border-border bg-card/50 p-4 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground/80 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              Cara membaca Riwayat Prediksi:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Digit <strong className="text-green-400">hijau</strong> = prediksi benar, <strong className="text-red-400">merah</strong> = salah. Angka kecil di bawah = nilai aktual.</li>
              <li>Skor <strong className="text-foreground">4/4</strong> = semua 4 digit tepat (jackpot 4D!). Skor 3/4 atau 2/4 tetap berguna untuk 3D/2D.</li>
              <li>Kolom <strong className="text-foreground">Aktual</strong> terisi otomatis saat data draw masuk dari server (refresh setelah waktu draw).</li>
              <li>Confidence <strong className="text-green-400">≥ 60%</strong> = prediksi dengan signal kuat dari 42 engine.</li>
              <li><strong className="text-foreground">Hapus</strong> prediksi lama yang tidak relevan untuk menjaga riwayat tetap bersih.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
