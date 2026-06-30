import { useState, useMemo } from "react";
import { useGetTotoMonths } from "@workspace/api-client-react";
import { PageSeo } from "@/components/page-seo";
import { cn } from "@/lib/utils";
import { Palette, Eraser } from "lucide-react";
import { ScrollToTop } from "@/components/scroll-to-top";

const DRAW_TIMES = ["0001", "1300", "1600", "1900", "2200", "2300"] as const;

const COLORS = [
  "bg-transparent", // Eraser
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-orange-500",
  "bg-cyan-500",
];

export default function PaitoPage() {
  const { data: months, isLoading } = useGetTotoMonths();
  const [activeColor, setActiveColor] = useState<string>("bg-red-500");
  
  // Store cell colors: { "rowIdx-colIdx": "bg-color" }
  const [cellColors, setCellColors] = useState<Record<string, string>>({});
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Flatten the latest N rows from history for the Paito
  const rows = useMemo(() => {
    if (!months) return [];
    return months.flatMap(m => m.results).sort((a,b) => b.drawDate.localeCompare(a.drawDate)).slice(0, 100);
  }, [months]);

  const handleCellAction = (rowIdx: number, colIdx: number) => {
    const key = `${rowIdx}-${colIdx}`;
    setCellColors(prev => {
      const next = { ...prev };
      if (activeColor === "bg-transparent") {
        delete next[key];
      } else {
        next[key] = activeColor;
      }
      return next;
    });
  };

  const handleMouseEnter = (rowIdx: number, colIdx: number) => {
    if (isMouseDown) {
      handleCellAction(rowIdx, colIdx);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-24 pt-6 md:pb-6">
      <PageSeo title="Paito Warna" description="Paito Warna Interaktif Toto Macau" />

      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground font-mono">Paito Warna</h1>
      </div>

      {/* Color Palette */}
      <div className="rounded-3xl border border-border/50 bg-gradient-to-r from-card to-background p-5 shadow-sm backdrop-blur-xl">
        <div className="text-sm font-semibold mb-3">Pilih Warna:</div>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c, i) => (
            <button
              key={i}
              onClick={() => setActiveColor(c)}
              className={cn(
                "h-8 w-8 rounded-full border-2 flex items-center justify-center transition-transform",
                c === "bg-transparent" ? "border-dashed border-muted-foreground bg-muted/20" : c,
                activeColor === c ? "scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background border-transparent" : "border-transparent"
              )}
            >
              {c === "bg-transparent" && <Eraser className="h-4 w-4 text-muted-foreground" />}
            </button>
          ))}
          <button 
            onClick={() => setCellColors({})}
            className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 text-muted-foreground transition-colors"
          >
            Reset Semua
          </button>
        </div>
      </div>

      {/* Paito Table */}
      <div 
        className="rounded-3xl border border-border/50 bg-card/60 overflow-hidden shadow-sm backdrop-blur-xl"
        onMouseDown={() => setIsMouseDown(true)}
        onMouseUp={() => setIsMouseDown(false)}
        onMouseLeave={() => setIsMouseDown(false)}
      >
        <div className="overflow-x-auto select-none">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-muted/20 text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground border-b border-border/50">
                <th className="p-2 sm:p-3 border-r border-border/50 w-24 sm:w-32 font-semibold">Tanggal</th>
                {DRAW_TIMES.map(t => (
                  <th key={t} className="p-2 sm:p-3 border-r border-border/50 font-semibold w-16 sm:w-20 last:border-0">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">Memuat data...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">Belum ada data history</td>
                </tr>
              ) : (
                rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-border/30 hover:bg-muted/5 transition-colors">
                    <td className="p-2 border-r border-border/30 text-[10px] sm:text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {row.drawDate}
                    </td>
                    {DRAW_TIMES.map((t, colIdx) => {
                      const val = (row as any)[`draw${t}`];
                      const key = `${rowIdx}-${colIdx}`;
                      const cellColor = cellColors[key];
                      
                      return (
                        <td 
                          key={colIdx} 
                          className={cn(
                            "p-0 border-r border-border/30 last:border-0 cursor-pointer transition-colors duration-200",
                            cellColor && cellColor !== "bg-transparent" ? cellColor : ""
                          )}
                          onMouseDown={() => handleCellAction(rowIdx, colIdx)}
                          onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                        >
                          <div className={cn(
                            "flex items-center justify-center h-8 sm:h-10 w-full font-mono text-xs sm:text-sm font-bold",
                            cellColor && cellColor !== "bg-transparent" ? "text-white" : "text-foreground"
                          )}>
                            {val && val !== "-" ? val : "----"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ScrollToTop />
    </div>
  );
}
