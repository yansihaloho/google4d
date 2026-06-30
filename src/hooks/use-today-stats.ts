import { useMemo } from "react";
import { useGetTotoMonths } from "@workspace/api-client-react";
import { isGanjil, isGenap, isBesar, isKecil, isKecilEkor, isBesarEkor, isGenapEkor, isGanjilEkor } from "@/lib/classify";

const DRAW_KEYS = ["draw0001", "draw1300", "draw1600", "draw1900", "draw2200", "draw2300"] as const;
type DrawKey = typeof DRAW_KEYS[number];

function todayWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

export interface TodayStats {
  ganjil: number;
  genap: number;
  besar: number;
  kecil: number;
  kecilEkor: number;
  besarEkor: number;
  genapEkor: number;
  ganjilEkor: number;
  total: number;
  slots: Array<{
    key: DrawKey;
    value: string | null;
    ganjil: boolean | null;
    genap: boolean | null;
    besar: boolean | null;
    kecil: boolean | null;
    kecilEkor: boolean | null;
    besarEkor: boolean | null;
    genapEkor: boolean | null;
    ganjilEkor: boolean | null;
  }>;
  dateStr: string;
}

export function useTodayStats(): TodayStats | null {
  const { data: months } = useGetTotoMonths();

  return useMemo(() => {
    if (!months || months.length === 0) return null;
    const today = todayWIB();
    let todayRow: (typeof months)[0]["results"][0] | undefined;
    for (const group of months) {
      const found = group.results.find((r) => r.drawDate === today);
      if (found) { todayRow = found; break; }
    }
    if (!todayRow) return null;

    const slots = DRAW_KEYS.map((key) => {
      const value = (todayRow as unknown as Record<string, string | null>)[key] ?? null;
      return {
        key,
        value,
        ganjil: isGanjil(value),
        genap: isGenap(value),
        besar: isBesar(value),
        kecil: isKecil(value),
        kecilEkor: isKecilEkor(value),
        besarEkor: isBesarEkor(value),
        genapEkor: isGenapEkor(value),
        ganjilEkor: isGanjilEkor(value),
      };
    });

    const filledSlots = slots.filter((s) => s.value !== null);
    return {
      ganjil: filledSlots.filter((s) => s.ganjil).length,
      genap: filledSlots.filter((s) => s.genap).length,
      besar: filledSlots.filter((s) => s.besar).length,
      kecil: filledSlots.filter((s) => s.kecil).length,
      kecilEkor: filledSlots.filter((s) => s.kecilEkor).length,
      besarEkor: filledSlots.filter((s) => s.besarEkor).length,
      genapEkor: filledSlots.filter((s) => s.genapEkor).length,
      ganjilEkor: filledSlots.filter((s) => s.ganjilEkor).length,
      total: filledSlots.length,
      slots,
      dateStr: today,
    };
  }, [months]);
}
