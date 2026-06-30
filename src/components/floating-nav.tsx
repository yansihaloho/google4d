import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Home, TrendingUp, BarChart2, TrendingDown, Menu } from "lucide-react";
import { useTodayStats } from "@/hooks/use-today-stats";

const NAV_ITEMS = [
  { href: "/",            label: "Home",    icon: Home,        badge: "LIVE", badgeCls: "bg-emerald-500 text-white", pulse: true,  statKey: null },
  { href: "/ganjil",      label: "Ganjil",  icon: TrendingUp,  badge: null,   badgeCls: "bg-amber-500 text-white",               statKey: "ganjil"    as const },
  { href: "/besar",       label: "Besar",   icon: BarChart2,   badge: null,   badgeCls: "bg-red-500 text-white",                 statKey: "besar"     as const },
  { href: "/genap",       label: "Genap",   icon: TrendingDown,badge: null,   badgeCls: "bg-sky-500 text-white",                 statKey: "genap"     as const },
];

export function FloatingNav() {
  const [location] = useLocation();
  const todayStats = useTodayStats();

  const handleOpenMenu = () => {
    document.dispatchEvent(new CustomEvent("open-mobile-menu"));
  };

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
      <div className="rounded-3xl border border-primary/20 bg-background/60 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,220,255,0.1)] p-1">
        <div className="grid grid-cols-5 gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={cn(
                    "relative flex w-full flex-col items-center justify-center gap-1.5 px-1 py-2.5 transition-all duration-300 rounded-xl",
                    isActive ? "text-primary bg-primary/10 shadow-[inset_0_0_15px_rgba(0,220,255,0.1)]" : "text-muted-foreground hover:bg-white/5"
                  )}
                >
                  <span className="relative">
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-all duration-300",
                        isActive ? "text-primary scale-110 drop-shadow-[0_0_8px_rgba(0,220,255,0.8)]" : "text-muted-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "absolute -right-2.5 -top-2 inline-flex min-w-[1.2rem] items-center justify-center rounded-full px-1 py-0 text-[9px] font-black leading-none",
                        item.badgeCls,
                        item.pulse && "animate-pulse",
                        isActive && "shadow-[0_0_10px_currentColor]"
                      )}
                    >
                      {item.statKey && todayStats
                        ? todayStats[item.statKey]
                        : item.badge}
                    </span>
                  </span>

                  <span className={cn(
                    "text-[9px] font-black leading-none tracking-widest transition-colors whitespace-nowrap",
                    isActive ? "text-primary drop-shadow-[0_0_5px_rgba(0,220,255,0.5)]" : "text-muted-foreground/70"
                  )}>
                    {item.label}
                  </span>
                </button>
              </Link>
            );
          })}
          
          {/* Lainnya Button */}
          <button
            onClick={handleOpenMenu}
            className="relative flex w-full flex-col items-center justify-center gap-1.5 px-1 py-2.5 transition-all duration-300 rounded-xl text-muted-foreground hover:bg-white/5"
          >
            <span className="relative">
              <Menu className="h-5 w-5 transition-all duration-300" />
            </span>
            <span className="text-[9px] font-black leading-none tracking-widest transition-colors whitespace-nowrap text-muted-foreground/70">
              Lainnya
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
