import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Home, TrendingUp, TrendingDown, BarChart2, BarChart,
  Brain, ChevronRight, X, Cpu, ClipboardList, Palette, ChevronDown,
} from "lucide-react";
import { useTodayStats } from "@/hooks/use-today-stats";

const MAIN_NAV_ITEMS = [
  { href: "/",         label: "Home",      desc: "Hasil & jadwal live",             icon: Home,        badge: "LIVE", badgeCls: "bg-emerald-500 text-white", iconBg: "bg-emerald-500/20 text-emerald-400", pulse: true,  statKey: null },
  { href: "/paito", label: "Paito Warna", desc: "Tabel history angka interaktif", icon: Palette, badge: "New", badgeCls: "bg-emerald-500 text-white", iconBg: "bg-emerald-500/20 text-emerald-400", statKey: null },
  { href: "/analisa-harian", label: "Analisa Harian", desc: "Tren pergerakan angka", icon: BarChart2, badge: "📊", badgeCls: "bg-purple-500 text-white", iconBg: "bg-purple-500/20 text-purple-400", statKey: null },
  { href: "/prediksi-ai",   label: "Smart AI",    desc: "Ensemble 7 engine AI",               icon: Brain,    badge: "AI", badgeCls: "bg-blue-500 text-white",   iconBg: "bg-blue-500/20 text-blue-400",    statKey: null },
  { href: "/prediksi-2d",   label: "Prediksi 2D", desc: "Formula 70 Line Belakang Terkuat",    icon: Cpu,      badge: "70L", badgeCls: "bg-rose-500 text-white",   iconBg: "bg-rose-500/20 text-rose-400",    statKey: null },
  { href: "/riwayat-prediksi", label: "Riwayat Prediksi", desc: "History prediksi tersimpan", icon: ClipboardList, badge: "📋", badgeCls: "bg-indigo-500 text-white", iconBg: "bg-indigo-500/20 text-indigo-400", statKey: null },
];

const STATS_NAV_ITEMS = [
  { href: "/ganjil",   label: "Ganjil",    desc: "Analisis angka ganjil",           icon: TrendingUp,  badge: null,   badgeCls: "bg-amber-500 text-white",   iconBg: "bg-amber-500/20 text-amber-400",                   statKey: "ganjil"  as const },
  { href: "/genap",    label: "Genap",     desc: "Analisis angka genap",            icon: TrendingDown, badge: null,  badgeCls: "bg-sky-500 text-white",     iconBg: "bg-sky-500/20 text-sky-400",                       statKey: "genap"   as const },
  { href: "/besar",    label: "Besar",     desc: "Analisis angka besar",            icon: BarChart2,   badge: null,   badgeCls: "bg-red-500 text-white",     iconBg: "bg-red-500/20 text-red-400",                       statKey: "besar"   as const },
  { href: "/kecil",      label: "Kecil",      desc: "Analisis angka kecil",           icon: BarChart,    badge: null,   badgeCls: "bg-green-500 text-white",   iconBg: "bg-green-500/20 text-green-400",                     statKey: "kecil"     as const },
  { href: "/kecil-ekor", label: "Kecil Ekor", desc: "Ekor digit 0–4 (50 nomor)",    icon: BarChart,    badge: null,   badgeCls: "bg-violet-500 text-white",  iconBg: "bg-violet-500/20 text-violet-400",                   statKey: "kecilEkor" as const },
  { href: "/besar-ekor",  label: "Besar Ekor",  desc: "Ekor digit 5–9 (50 nomor)",        icon: BarChart2,   badge: null, badgeCls: "bg-orange-500 text-white", iconBg: "bg-orange-500/20 text-orange-400", statKey: "besarEkor"  as const },
  { href: "/genap-ekor",  label: "Genap Ekor",  desc: "Ekor genap 0,2,4,6,8 — 2D belakang", icon: BarChart,  badge: null, badgeCls: "bg-teal-500 text-white",   iconBg: "bg-teal-500/20 text-teal-400",    statKey: "genapEkor"  as const },
  { href: "/ganjil-ekor", label: "Ganjil Ekor", desc: "Ekor ganjil 1,3,5,7,9 — 2D belakang", icon: BarChart, badge: null, badgeCls: "bg-rose-500 text-white",   iconBg: "bg-rose-500/20 text-rose-400",    statKey: "ganjilEkor" as const },
];

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const [location] = useLocation();
  const todayStats = useTodayStats();
  const [statsOpen, setStatsOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      // Auto-open stats if a stat page is active
      const isStatsActive = STATS_NAV_ITEMS.some(item => location === item.href);
      if (isStatsActive) setStatsOpen(true);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, location]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative animate-in slide-in-from-bottom duration-300 ease-out">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="rounded-t-3xl bg-card border-t border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/20 border border-primary/30 shrink-0">
              <span className="text-xl leading-none">🎰</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[15px] font-bold text-foreground leading-tight">Toto Macau</span>
              <span className="text-[11px] font-semibold tracking-widest text-primary/80 uppercase mt-0.5">
                Live Results
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-muted-foreground hover:bg-white/20 hover:text-foreground transition-all shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Menu Items */}
          <div className="px-3 py-4 space-y-1.5 max-h-[80vh] overflow-y-auto scrollbar-none pb-8">
            {/* First part of Main Nav */}
            <NavItem item={MAIN_NAV_ITEMS[0]} location={location} onClose={onClose} stats={todayStats} />
            <NavItem item={MAIN_NAV_ITEMS[1]} location={location} onClose={onClose} stats={todayStats} />

            {/* Stats Accordion */}
            <div className="rounded-2xl border border-white/5 bg-white/5 overflow-hidden transition-all duration-300">
              <button 
                onClick={() => setStatsOpen(!statsOpen)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 text-foreground font-semibold text-[14px]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 shrink-0 border border-white/10">
                    <BarChart2 className="h-5 w-5" />
                  </div>
                  Statistik 2D Belakang
                </div>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", statsOpen ? "rotate-180" : "rotate-0")} />
              </button>
              
              <div className={cn("grid transition-all duration-300 ease-in-out", statsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden">
                  <div className="p-2 space-y-1 bg-black/20">
                    {STATS_NAV_ITEMS.map((item) => (
                      <NavItem key={item.href} item={item} location={location} onClose={onClose} stats={todayStats} isSubItem />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Rest of Main Nav */}
            {MAIN_NAV_ITEMS.slice(2).map((item) => (
              <NavItem key={item.href} item={item} location={location} onClose={onClose} stats={todayStats} />
            ))}
          </div>

          {/* Safe area spacer */}
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </div>
      </div>
    </div>
  );
}

function NavItem({ item, location, onClose, stats, isSubItem = false }: { key?: React.Key, item: any, location: string, onClose: () => void, stats: any, isSubItem?: boolean }) {
  const Icon = item.icon;
  const isActive = location === item.href;
  
  return (
    <Link href={item.href} onClick={onClose}>
      <button
        className={cn(
          "w-full flex items-center gap-3.5 transition-all duration-150 text-left rounded-2xl",
          isSubItem ? "px-3 py-2.5" : "px-3 py-3",
          isActive
            ? "bg-primary/15 border border-primary/25"
            : "hover:bg-white/5 active:bg-white/10 border border-transparent"
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            "flex items-center justify-center rounded-xl shrink-0 border",
            isSubItem ? "h-8 w-8" : "h-10 w-10",
            isActive
              ? "bg-primary/25 text-primary border-primary/30"
              : cn(item.iconBg, "border-white/10")
          )}
        >
          <Icon className={cn(isSubItem ? "h-4 w-4" : "h-5 w-5")} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-semibold leading-tight",
                isSubItem ? "text-[13px]" : "text-[14px]",
                isActive ? "text-primary" : "text-foreground"
              )}
            >
              {item.label}
            </span>
            {item.badgeCls && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none",
                  item.badgeCls,
                  item.pulse && "animate-pulse"
                )}
              >
                {item.statKey && stats
                  ? `${stats[item.statKey]} kena`
                  : item.badge}
              </span>
            )}
          </div>
          {item.desc && !isSubItem && (
            <span className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5 block truncate">
              {item.desc}
            </span>
          )}
        </div>

        {/* Chevron */}
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isActive ? "text-primary" : "text-muted-foreground/40"
          )}
        />
      </button>
    </Link>
  );
}
