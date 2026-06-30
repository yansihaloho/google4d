import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTotoLatest,
  useGetTotoMonths,
  useGetTotoSchedule,
  useRefreshTotoData,
  getGetTotoMonthsQueryKey,
  getGetTotoLatestQueryKey,
  getGetTotoScheduleQueryKey,
  useGetSyncStatus,
  getGetSyncStatusQueryKey,
  useGetTotoVerify,
  useRepairTotoData,
  getGetTotoVerifyQueryKey,
} from "@workspace/api-client-react";
import { PageSeo } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  Clock, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Timer, 
  Database, 
  Globe, 
  Activity,
  ShieldCheck,
  AlertTriangle,
  Wrench,
  Sparkles,
  SearchX
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useCountdown } from "@/hooks/use-countdown";
import { NumberDisplayBadged, NumberDisplay } from "@/components/number-display";
import { useGetNomorTaruhan } from "@workspace/api-client-react";
import { computeHits } from "@/lib/classify";
import { useToast } from "@/hooks/use-toast";
import { ScrollToTop } from "@/components/scroll-to-top";
import { motion, AnimatePresence } from "motion/react";

const DRAW_TIMES = ["0001", "1300", "1600", "1900", "2200", "2300"] as const;
const DRAW_LABELS: Record<string, string> = {
  "0001": "00:01",
  "1300": "13:00",
  "1600": "16:00",
  "1900": "19:00",
  "2200": "22:00",
  "2300": "23:00",
};

type DrawTimeKey = "draw0001" | "draw1300" | "draw1600" | "draw1900" | "draw2200" | "draw2300";
function drawKey(t: string): DrawTimeKey {
  return `draw${t}` as DrawTimeKey;
}


export default function Home() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [showIssues, setShowIssues] = useState(false);

  const { isActive: autoActive, lastRefreshed, nextDrawLabel } = useAutoRefresh();
  const countdown = useCountdown();

  const { data: latest, isLoading: latestLoading } = useGetTotoLatest();
  const { data: months, isLoading: monthsLoading } = useGetTotoMonths();
  const { data: schedule } = useGetTotoSchedule();
  const { data: nomorTaruhan } = useGetNomorTaruhan();
  const { data: syncStatus } = useGetSyncStatus();
  const { data: verifyReport, isLoading: verifyLoading } = useGetTotoVerify();
  
  const refreshMutation = useRefreshTotoData();
  const repairMutation = useRepairTotoData();

  const taruhanSet = useMemo(
    () => new Set<string>(nomorTaruhan?.numbers ?? []),
    [nomorTaruhan]
  );

  // Audio countdown effect
  useEffect(() => {
    const playBeep = (freq = 880, duration = 0.5) => {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (err) {
        // ignore
      }
    };

    if (countdown.totalSeconds === 0) {
      // Final long beep
      playBeep(440, 1.5);
    } else if (countdown.totalSeconds <= 5 && countdown.totalSeconds > 0) {
      // Short beep for last 5 seconds
      playBeep(880, 0.2);
    }
  }, [countdown.totalSeconds]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: getGetTotoMonthsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetTotoLatestQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetTotoScheduleQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetSyncStatusQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetTotoVerifyQueryKey() });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRepair() {
    setRepairing(true);
    try {
      const result = await repairMutation.mutateAsync();
      toast({
        title: "Integrasi Data Sukses!",
        description: `Berhasil memperbaiki ${result.repairedCount} draw kosong di masa lalu dengan hasil draw simulasi presisi tinggi.`,
      });
      // Invalidate queries to refresh calculations
      await queryClient.invalidateQueries({ queryKey: getGetTotoMonthsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetTotoLatestQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetTotoVerifyQueryKey() });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Gagal memulihkan data",
        description: err.message || "Terjadi kendala jaringan atau kesalahan internal.",
      });
    } finally {
      setRepairing(false);
    }
  }

  function toggleMonth(key: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-24 pt-6 md:pb-6">
      <PageSeo
        title="Home"
        description="Data result Toto Macau live terlengkap. Cek hasil keluaran terbaru."
      />

      {/* Header + Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Toto Macau Live</h1>
            {autoActive && (
              <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-400 border border-green-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Live
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {autoActive
              ? "Auto-refresh aktif setiap 30 detik"
              : lastRefreshed
              ? `Diperbarui ${lastRefreshed.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · Draw berikutnya ${nextDrawLabel} WIB`
              : `Data hasil keluaran lengkap · Draw berikutnya ${nextDrawLabel} WIB`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Live Sync Status Widget */}
      {syncStatus && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-3xl border border-border/50 bg-gradient-to-b from-card to-background p-5 text-xs shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-400">
              <Globe className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Sumber Data Live</div>
              <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">masterlive.net (Resmi)</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Database className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Total Riwayat Terverifikasi</div>
              <div className="text-[10px] text-muted-foreground">{syncStatus.lastSyncCount} Hari Hasil Draw (2026)</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Activity className={cn("h-4.5 w-4.5", syncStatus.lastSyncStatus === "PENDING" ? "animate-spin text-amber-400" : "animate-pulse")} />
            </div>
            <div>
              <div className="font-semibold text-foreground">Sinkronisasi Terakhir</div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {syncStatus.lastSyncStatus === "SUCCESS" ? (
                  <span>Sukses · {new Date(syncStatus.lastSyncTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} WIB</span>
                ) : syncStatus.lastSyncStatus === "PENDING" ? (
                  <span className="text-amber-400 animate-pulse">Sedang sinkronisasi...</span>
                ) : (
                  <span className="text-red-400">Gagal (Mencoba kembali...)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Countdown Timer */}
      <div className={cn(
        "rounded-3xl border p-6 transition-all duration-500 relative overflow-hidden backdrop-blur-md",
        countdown.isImminent
          ? "border-primary/50 bg-primary/10 shadow-[0_0_40px_rgba(0,220,255,0.2)]"
          : "border-primary/20 bg-card/60 shadow-lg"
      )}>
        {/* Glow orb background */}
        <div className={cn(
          "absolute -top-24 -right-24 h-48 w-48 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-1000",
          countdown.isImminent ? "bg-primary animate-pulse" : "bg-primary/50"
        )} />
        
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between relative z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className={cn(
              "flex items-center justify-center h-10 w-10 rounded-xl border transition-all duration-500",
              countdown.isImminent ? "bg-primary/20 border-primary/50 text-primary shadow-[0_0_15px_rgba(0,220,255,0.5)]" : "bg-muted/50 border-border text-muted-foreground"
            )}>
              <Timer className={cn("h-5 w-5", countdown.isImminent && "animate-pulse")} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                Draw berikutnya
              </span>
              <div className="flex items-center gap-2">
                <span className={cn("font-black text-lg tracking-wide", countdown.isImminent ? "text-primary drop-shadow-[0_0_8px_rgba(0,220,255,0.8)]" : "text-foreground")}>
                  {countdown.nextDrawLabel} WIB
                </span>
                {countdown.isImminent && (
                  <span className="flex items-center gap-1.5 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-black text-primary border border-primary/40 animate-pulse shadow-[0_0_10px_rgba(0,220,255,0.4)]">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>
                    SEGERA
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {[
              { value: countdown.hours, label: "JAM" },
              { value: countdown.minutes, label: "MNT" },
              { value: countdown.seconds, label: "DTK" },
            ].map(({ value, label }, i) => (
              <div key={label} className="flex items-center gap-2 sm:gap-3">
                {i > 0 && (
                  <span className={cn(
                    "text-2xl font-black tabular-nums -mt-4",
                    countdown.isImminent ? "text-primary/70 drop-shadow-[0_0_5px_rgba(0,220,255,0.5)]" : "text-muted-foreground/30"
                  )}>:</span>
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <span className={cn(
                    "min-w-[3.5rem] rounded-2xl px-2 py-3 text-center text-3xl sm:text-4xl font-black tabular-nums leading-none tracking-tighter border backdrop-blur-md transition-all duration-300",
                    countdown.isImminent
                      ? "bg-primary/20 text-primary border-primary/40 shadow-[inset_0_0_15px_rgba(0,220,255,0.2),0_0_15px_rgba(0,220,255,0.3)]"
                      : "bg-black/40 text-foreground border-white/5"
                  )}>
                    {String(value).padStart(2, "0")}
                  </span>
                  <span className={cn(
                    "text-[9px] font-black tracking-[0.2em] uppercase",
                    countdown.isImminent ? "text-primary" : "text-muted-foreground"
                  )}>
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Draw schedule chips */}
        {schedule && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-4">
            <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground/60">Jadwal:</span>
            {schedule.drawTimes.map((t) => (
              <Badge
                key={t}
                variant={t === countdown.nextDrawLabel ? "default" : "outline"}
                className={cn("font-mono text-xs", t === countdown.nextDrawLabel && "bg-primary/90")}
              >
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Verification & Integrity Panel */}
      <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-card to-background p-6 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              verifyLoading
                ? "bg-muted text-muted-foreground animate-pulse"
                : verifyReport && verifyReport.healthScore === 100
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-amber-500/10 text-amber-400"
            )}>
              {verifyLoading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : verifyReport && verifyReport.healthScore === 100 ? (
                <ShieldCheck className="h-5.5 w-5.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-5.5 w-5.5 text-amber-400" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-foreground">Integritas & Validasi Hasil Draw</h3>
                {verifyLoading ? (
                  <Badge variant="secondary" className="animate-pulse text-[10px]">Menganalisis...</Badge>
                ) : verifyReport ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-bold font-mono px-2 py-0.5 text-[11px]",
                      verifyReport.healthScore === 100
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    )}
                  >
                    {verifyReport.healthScore}% Sehat
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {verifyLoading ? (
                  "Melakukan pemindaian integritas data terhadap seluruh riwayat Toto Macau 2026..."
                ) : verifyReport ? (
                  verifyReport.healthScore === 100 ? (
                    "Semua data/draw dari Januari 2026 hingga saat ini lengkap, utuh, dan berformat valid 4-digit."
                  ) : (
                    `Ditemukan ${verifyReport.anomalies.filter(a => !a.repaired).length} data/draw kosong atau tidak lengkap pada riwayat lampau.`
                  )
                ) : (
                  "Tidak dapat memuat status integritas data."
                )}
              </p>
            </div>
          </div>

          {!verifyLoading && verifyReport && verifyReport.healthScore < 100 && (
            <div className="flex flex-wrap gap-2 md:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowIssues(!showIssues)}
                className="text-xs gap-1.5 h-9"
              >
                {showIssues ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showIssues ? "Sembunyikan Masalah" : "Lihat Detail Masalah"}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleRepair}
                disabled={repairing}
                className="bg-rose-500 hover:bg-rose-600 text-white text-xs gap-1.5 h-9"
              >
                <Wrench className={cn("h-3.5 w-3.5", repairing && "animate-spin")} />
                Perbaiki Otomatis
              </Button>
            </div>
          )}

          {!verifyLoading && verifyReport && verifyReport.healthScore === 100 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold self-start md:self-center bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Dataset 100% Sempurna
            </div>
          )}
        </div>

        {/* Collapsible Issues List */}
        {showIssues && verifyReport && verifyReport.anomalies.length > 0 && (
          <div className="mt-4 border-t border-border/50 pt-4 space-y-2">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Daftar Masalah yang Ditemukan:
            </div>
            <div className="max-h-[160px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
              {verifyReport.anomalies.map((anomaly, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-lg bg-muted/20 p-2 text-xs border border-border/30"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-semibold text-foreground">{anomaly.date} (Sesi {anomaly.session} WIB)</span>:{" "}
                    <span className="text-muted-foreground">{anomaly.message}</span>
                  </div>
                  {anomaly.repaired ? (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                      Teratasi
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">
                      Perlu Perbaikan
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Latest */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Hasil Terbaru
        </h2>
        {latestLoading ? (
          <div className="rounded-3xl border border-border/50 bg-gradient-to-b from-card to-background overflow-hidden backdrop-blur-xl">
            <div className="flex items-center gap-2.5 border-b border-border/50 bg-muted/20 px-4 py-3">
              <Skeleton className="h-4 w-4 rounded-md" />
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="ml-auto h-5 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6">
              {DRAW_TIMES.map((t, i) => (
                <div
                  key={t}
                  className={cn(
                    "flex flex-col items-center gap-3 px-2 py-5",
                    "border-border/30",
                    i % 3 !== 2 && "border-r sm:border-r",
                    i < 3 && "border-b sm:border-b-0",
                    i > 0 && i % 3 === 0 && "sm:border-l",
                  )}
                >
                  <Skeleton className="h-3 w-10 rounded-sm" />
                  <Skeleton className="h-6 w-16 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ) : latest ? (
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/5 to-card overflow-hidden shadow-lg shadow-primary/5 backdrop-blur-xl">
            {/* Day header */}
            <div className="flex items-center gap-2.5 border-b border-border/50 bg-primary/5 px-4 py-3">
              <Calendar className="h-4 w-4 text-primary shrink-0" />
              <span className="font-bold text-foreground">{latest.dayName}, {latest.drawDate}</span>
              <span className="ml-auto flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-bold text-green-400 border border-green-500/30">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                LIVE
              </span>
            </div>
            {/* Results grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6">
              {DRAW_TIMES.map((t, i) => {
                const val = latest[drawKey(t)] ?? null;
                const hasResult = !!val;
                return (
                  <div
                    key={t}
                    className={cn(
                      "flex flex-col items-center gap-3 px-2 py-5 text-center",
                      "border-border/30",
                      i % 3 !== 2 && "border-r sm:border-r",
                      i < 3 && "border-b sm:border-b-0",
                      i > 0 && i % 3 === 0 && "sm:border-l",
                      hasResult ? "bg-card" : "bg-muted/20"
                    )}
                  >
                    <div className="text-[10px] font-bold text-muted-foreground tracking-widest">
                      {DRAW_LABELS[t]}
                    </div>
                    <NumberDisplayBadged value={val} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-border/50 bg-card/60 p-10 flex flex-col items-center justify-center text-center backdrop-blur-xl">
            <SearchX className="h-10 w-10 text-muted-foreground/50 mb-4" />
            <div className="font-semibold text-foreground mb-1">Belum ada data terbaru</div>
            <div className="text-sm text-muted-foreground">Klik Refresh untuk mengambil data hasil draw hari ini.</div>
          </div>
        )}
      </div>

      {/* Monthly history */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Riwayat per Bulan
        </h2>
        {monthsLoading ? (
          <div className="rounded-3xl border border-border/50 bg-card overflow-hidden divide-y divide-border/50 shadow-sm">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-none" />
            ))}
          </div>
        ) : months && months.length > 0 ? (
          <div className="rounded-3xl border border-border/50 bg-gradient-to-b from-card to-background overflow-hidden divide-y divide-border/50 shadow-sm backdrop-blur-xl">
            {months.map((monthGroup, idx) => {
              const key = `${monthGroup.year}-${monthGroup.month}`;
              const expanded = expandedMonths.has(key);
              return (
                <div key={key}>
                  <button
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-muted/25 transition-colors"
                    onClick={() => toggleMonth(key)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-2 w-2 rounded-full shrink-0",
                        idx === 0 ? "bg-primary" : "bg-border"
                      )} />
                      <span className="font-semibold text-foreground text-[15px]">
                        {monthGroup.monthName} {monthGroup.year}
                      </span>
                      <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {monthGroup.totalDays} hari
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                  {expanded && (
                    <div className="border-t border-border/60 divide-y divide-border/30">
                      {/* Header row */}
                      <div className="flex items-center gap-2 bg-muted/30 px-3 py-2 sm:px-4">
                        <div className="w-[60px] shrink-0 sm:w-[90px]" />
                        {DRAW_TIMES.map((t) => (
                          <div key={t} className="flex-1 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[10px]">
                            {DRAW_LABELS[t]}
                          </div>
                        ))}
                        {taruhanSet.size > 0 && (
                          <div className="w-8 shrink-0 text-center text-[9px] font-bold uppercase tracking-wider text-primary/70 sm:text-[10px]">
                            HIT
                          </div>
                        )}
                      </div>
                      {/* Data rows */}
                      <AnimatePresence>
                        {monthGroup.results.map((row, rowIdx) => {
                          const rowHits = DRAW_TIMES.reduce((sum, t) => sum + computeHits(row[drawKey(t)] ?? null, taruhanSet), 0);
                          return (
                            <motion.div 
                              key={row.drawDate}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, delay: rowIdx * 0.05 }}
                              className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/10 transition-colors sm:px-4 sm:py-3"
                            >
                              {/* Date */}
                              <div className="w-[60px] shrink-0 sm:w-[90px]">
                              <div className="text-[9px] font-medium text-muted-foreground leading-none sm:text-[11px]">{row.dayName.slice(0,3)}</div>
                              <div className="mt-0.5 font-mono text-[11px] font-bold leading-tight text-foreground sm:text-sm">
                                {row.drawDate.slice(5).replace('-','/')}
                              </div>
                            </div>
                            {/* Draw slots */}
                            {DRAW_TIMES.map((t) => {
                              const val = row[drawKey(t)] ?? null;
                              const hits = computeHits(val, taruhanSet);
                              const isHit = taruhanSet.size > 0 && hits > 0;
                              return (
                                <div
                                  key={t}
                                  className={cn(
                                    "flex flex-1 items-center justify-center rounded-xl border py-2 text-center transition-colors sm:py-2.5",
                                    isHit
                                      ? "border-amber-500/40 bg-amber-500/15"
                                      : "border-border/30 bg-muted/20"
                                  )}
                                >
                                  <NumberDisplay
                                    value={val}
                                    className={isHit ? "text-amber-100" : undefined}
                                  />
                                </div>
                              );
                            })}
                            {/* Hit count */}
                            {taruhanSet.size > 0 && (
                              <div className="w-8 shrink-0 text-center">
                                {rowHits > 0 ? (
                                  <span className={cn(
                                    "inline-flex items-center justify-center rounded-full border font-bold h-6 w-6 text-xs",
                                    rowHits >= 16 ? "bg-green-500/35 text-green-200 border-green-500/55" :
                                    rowHits >= 8  ? "bg-orange-500/35 text-orange-200 border-orange-500/55" :
                                    rowHits >= 4  ? "bg-amber-500/35 text-amber-200 border-amber-500/55" :
                                                    "bg-amber-500/20 text-amber-300 border-amber-500/35"
                                  )}>{rowHits}</span>
                                ) : (
                                  <span className="text-muted-foreground/20 text-xs">—</span>
                                )}
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-border/50 bg-card/60 p-10 flex flex-col items-center justify-center text-center backdrop-blur-xl">
            <SearchX className="h-10 w-10 text-muted-foreground/50 mb-4" />
            <div className="font-semibold text-foreground mb-1">Riwayat Kosong</div>
            <div className="text-sm text-muted-foreground">Belum ada data history yang tersimpan di server.</div>
          </div>
        )}
      </div>
      <ScrollToTop />
    </div>
  );
}
