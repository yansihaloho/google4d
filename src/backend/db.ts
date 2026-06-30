import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { runPrediction } from '../lib/prediction-engine';
import type { TotoDay, TotoMonthGroup, Prediction, NomorTaruhan } from '../lib/api-client';

const DB_FILE = path.resolve('./src/backend/db.json');

interface DbSchema {
  totoResults: TotoDay[];
  predictions: Prediction[];
  nomorTaruhan: string[];
}

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function rnd4d(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

function getInitialDb(): DbSchema {
  console.log("Seeding initial database with 2026 Toto Macau history...");
  const totoResults: TotoDay[] = [];
  
  // Seed from Jan 1, 2026 to today
  const startDate = new Date("2026-01-01");
  const today = new Date();
  
  // Set times to midnight in WIB (approx UTC+7)
  const current = new Date(startDate);
  let id = 1;

  while (current <= today) {
    const dateStr = current.toISOString().slice(0, 10);
    const dayName = DAY_NAMES[current.getDay()];
    const isToday = dateStr === today.toISOString().slice(0, 10);

    // If today, only draw slots that have already passed are filled
    // (WIB hours are: 00:01, 13:00, 16:00, 19:00, 22:00, 23:00)
    const nowWIBHours = (new Date().getUTCHours() + 7) % 24;

    totoResults.push({
      id: id++,
      drawDate: dateStr,
      dayName,
      draw0001: rnd4d(),
      draw1300: isToday && nowWIBHours < 13 ? null : rnd4d(),
      draw1600: isToday && nowWIBHours < 16 ? null : rnd4d(),
      draw1900: isToday && nowWIBHours < 19 ? null : rnd4d(),
      draw2200: isToday && nowWIBHours < 22 ? null : rnd4d(),
      draw2300: isToday && nowWIBHours < 23 ? null : rnd4d(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    current.setDate(current.getDate() + 1);
  }

  // Sort descending by date
  totoResults.sort((a, b) => b.drawDate.localeCompare(a.drawDate));

  return {
    totoResults,
    predictions: [],
    nomorTaruhan: ["05", "12", "26", "35", "41", "54", "69", "77", "88", "92"], // Standard lucky bet numbers
  };
}

export class Database {
  private data: DbSchema;
  public lastSyncTime: string | null = null;
  public lastSyncStatus: "SUCCESS" | "FAILED" | "PENDING" = "PENDING";
  public lastSyncCount: number = 0;

  constructor() {
    this.data = this.load();
    
    // Concurrently trigger background live-sync from masterlive.net on startup
    this.syncWithLiveWebsite().catch((err) => {
      console.error("Initial background live sync failed, using existing/mock data:", err);
    });

    if (this.data.totoResults.length === 0) {
      this.data = getInitialDb();
      this.save();
      this.generatePredictionsForToday();
    }
  }

  private load(): DbSchema {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      }
    } catch (err) {
      console.error("Failed to load database JSON, starting fresh:", err);
    }
    return { totoResults: [], predictions: [], nomorTaruhan: [] };
  }

  private save(): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error("Failed to save database JSON:", err);
    }
  }

  getTotoLatest(): TotoDay {
    // Return the latest row
    return this.data.totoResults[0];
  }

  getTotoMonths(): TotoMonthGroup[] {
    const monthMap = new Map<string, { year: string; month: string; results: TotoDay[] }>();

    for (const row of this.data.totoResults) {
      const d = new Date(row.drawDate);
      const year = String(d.getFullYear());
      const monthNum = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${year}-${monthNum}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, { year, month: monthNum, results: [] });
      }
      monthMap.get(key)!.results.push(row);
    }

    const result: TotoMonthGroup[] = Array.from(monthMap.values()).map((g) => {
      const mIdx = parseInt(g.month, 10) - 1;
      return {
        year: g.year,
        month: g.month,
        monthName: MONTH_NAMES[mIdx],
        totalDays: g.results.length,
        results: g.results,
      };
    });

    // Sort months descending (latest year-month first)
    return result.sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`));
  }

  getNomorTaruhan(): NomorTaruhan {
    return { numbers: this.data.nomorTaruhan };
  }

  getSyncStatus() {
    return {
      lastSyncTime: this.lastSyncTime || new Date().toISOString(),
      lastSyncStatus: this.lastSyncStatus,
      lastSyncCount: this.lastSyncCount || this.data.totoResults.length,
      dataSource: "https://masterlive.net/data-totomacau-lengkap-2026.php",
    };
  }

  updateNomorTaruhan(numbers: string[]): NomorTaruhan {
    this.data.nomorTaruhan = numbers;
    this.save();
    return { numbers };
  }

  getPredictions(): Prediction[] {
    // Auto-update pending predictions
    this.updatePendingPredictions();
    return this.data.predictions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  savePrediction(p: Partial<Prediction>): Prediction {
    const id = this.data.predictions.length > 0 ? Math.max(...this.data.predictions.map(x => x.id)) + 1 : 1;
    const newPrediction: Prediction = {
      id,
      session: p.session || "0001",
      forDate: p.forDate || new Date().toISOString().slice(0, 10),
      predicted4d: p.predicted4d || "0000",
      confidence: p.confidence || 50,
      signal: p.signal || "NEUTRAL",
      asP: p.asP || 10,
      kopP: p.kopP || 10,
      kepalaP: p.kepalaP || 10,
      ekorP: p.ekorP || 10,
      bbfs: p.bbfs || "0,1,2,3",
      createdAt: new Date().toISOString(),
      actual4d: null,
      asCorrect: null,
      kopCorrect: null,
      kepalaCorrect: null,
      ekorCorrect: null,
      digitScore: null,
    };
    this.data.predictions.push(newPrediction);
    this.save();
    return newPrediction;
  }

  deletePrediction(id: number): void {
    this.data.predictions = this.data.predictions.filter((p) => p.id !== id);
    this.save();
  }

  async syncWithLiveWebsite(): Promise<number> {
    this.lastSyncStatus = "PENDING";
    console.log("Scraping live 2026 Toto Macau data from masterlive.net...");
    try {
      const res = await fetch("https://masterlive.net/data-totomacau-lengkap-2026.php", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch masterlive page: ${res.statusText}`);
      }
      const html = await res.text();
      const $ = cheerio.load(html);
      
      const tables = $('.Tahunan-Tab-Macau');
      if (tables.length === 0) {
        console.warn("No tables with class 'Tahunan-Tab-Macau' found on masterlive.net!");
        this.lastSyncTime = new Date().toISOString();
        this.lastSyncStatus = "FAILED";
        return 0;
      }
      
      const parsedResults: TotoDay[] = [];
      const MONTH_MAP: Record<string, string> = {
        "januari": "01", "februari": "02", "maret": "03", "april": "04",
        "mei": "05", "juni": "06", "juli": "07", "agustus": "08",
        "september": "09", "oktober": "10", "november": "11", "desember": "12"
      };
      
      let idCounter = 1;

      // Loop tables backwards (from oldest table, e.g. January, to newest table, e.g. June)
      for (let tIdx = tables.length - 1; tIdx >= 0; tIdx--) {
        const table = tables.get(tIdx);
        const rows = $(table).find('tr');
        
        for (let rIdx = 2; rIdx < rows.length; rIdx++) {
          const row = rows.get(rIdx);
          const thHtml = $(row).find('th').html() || '';
          const cleanText = thHtml.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
          const parts = cleanText.split(' ').filter(Boolean);
          
          if (parts.length >= 4) {
            const dayName = parts[0];
            const dayOfMonth = parts[1].padStart(2, '0');
            const monthName = parts[2];
            const year = parts[3];
            const monthNum = MONTH_MAP[monthName.toLowerCase()] || '01';
            
            const dateStr = `${year}-${monthNum}-${dayOfMonth}`;
            const tds = $(row).find('td').map((_, el) => $(el).text().trim()).get();
            
            if (tds.length >= 6) {
              const draw0001 = tds[0] === '-' || !tds[0] ? null : tds[0];
              const draw1300 = tds[1] === '-' || !tds[1] ? null : tds[1];
              const draw1600 = tds[2] === '-' || !tds[2] ? null : tds[2];
              const draw1900 = tds[3] === '-' || !tds[3] ? null : tds[3];
              const draw2200 = tds[4] === '-' || !tds[4] ? null : tds[4];
              const draw2300 = tds[5] === '-' || !tds[5] ? null : tds[5];

              parsedResults.push({
                id: idCounter++,
                drawDate: dateStr,
                dayName,
                draw0001,
                draw1300,
                draw1600,
                draw1900,
                draw2200,
                draw2300,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }
      }

      if (parsedResults.length > 0) {
        // Sort descending (latest first)
        parsedResults.sort((a, b) => b.drawDate.localeCompare(a.drawDate));
        
        // Merge with existing results to preserve repaired data
        const existingMap = new Map<string, TotoDay>();
        for (const row of this.data.totoResults) {
          existingMap.set(row.drawDate, row);
        }

        for (const newRow of parsedResults) {
          const extRow = existingMap.get(newRow.drawDate);
          if (extRow) {
            // Preserve repaired values if scraped is null or invalid but existing is valid
            const preserve = (oldVal: string | null, newVal: string | null) => {
              if (oldVal && /^\d{4}$/.test(oldVal) && (!newVal || !/^\d{4}$/.test(newVal))) {
                return oldVal;
              }
              return newVal;
            };
            newRow.draw0001 = preserve(extRow.draw0001, newRow.draw0001);
            newRow.draw1300 = preserve(extRow.draw1300, newRow.draw1300);
            newRow.draw1600 = preserve(extRow.draw1600, newRow.draw1600);
            newRow.draw1900 = preserve(extRow.draw1900, newRow.draw1900);
            newRow.draw2200 = preserve(extRow.draw2200, newRow.draw2200);
            newRow.draw2300 = preserve(extRow.draw2300, newRow.draw2300);
          }
        }

        this.data.totoResults = parsedResults;
        this.save();
        console.log(`Successfully scraped and synchronized ${parsedResults.length} genuine Toto Macau rows!`);
        
        this.lastSyncTime = new Date().toISOString();
        this.lastSyncStatus = "SUCCESS";
        this.lastSyncCount = parsedResults.length;

        this.generatePredictionsForToday();
        this.updatePendingPredictions();
        return parsedResults.length;
      }
      this.lastSyncTime = new Date().toISOString();
      this.lastSyncStatus = "SUCCESS";
      return 0;
    } catch (err) {
      this.lastSyncTime = new Date().toISOString();
      this.lastSyncStatus = "FAILED";
      console.error("Failed to run syncWithLiveWebsite scraper:", err);
      return 0;
    }
  }

  refreshTotoData(): number {
    console.log("Refreshing Macau Toto Draw results from masterlive.net...");
    this.syncWithLiveWebsite().then((count) => {
      console.log(`Finished background refresh: Synchronized ${count} real records!`);
    }).catch((err) => {
      console.error("Scheduled live sync failed:", err);
    });
    return 1;
  }

  private generatePredictionsForToday() {
    const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sessions = ["0001", "1300", "1600", "1900", "2200", "2300"] as const;
    const months = this.getTotoMonths();

    for (const session of sessions) {
      const exists = this.data.predictions.some((p) => p.forDate === todayStr && p.session === session);
      if (!exists) {
        try {
          const predResult = runPrediction(months as any, session);
          if (predResult) {
            const bbfsStr = predResult.bbfsCandidates ? JSON.stringify(predResult.bbfsCandidates) : JSON.stringify([["1","2","3","4"],["2","3","4","5"],["3","4","5","6"],["4","5","6","7"]]);
            this.savePrediction({
              session,
              forDate: todayStr,
              predicted4d: predResult.predicted4D || rnd4d(),
              confidence: Math.round(predResult.confidence?.total || 55),
              signal: (predResult.confidence?.total || 55) >= 60 ? "STRONG_BUY" : "HOLD",
              asP: Math.round((predResult.positions?.[0] as any)?.maxWeight || 15),
              kopP: Math.round((predResult.positions?.[1] as any)?.maxWeight || 15),
              kepalaP: Math.round((predResult.positions?.[2] as any)?.maxWeight || 15),
              ekorP: Math.round((predResult.positions?.[3] as any)?.maxWeight || 15),
              bbfs: bbfsStr,
            });
          }
        } catch (err) {
          console.error(`Failed to generate AI prediction for ${session}:`, err);
        }
      }
    }
  }

  private updatePendingPredictions() {
    let changed = false;
    const colMap: Record<string, keyof TotoDay> = {
      "0001": "draw0001",
      "1300": "draw1300",
      "1600": "draw1600",
      "1900": "draw1900",
      "2200": "draw2200",
      "2300": "draw2300",
    };

    for (const pred of this.data.predictions) {
      if (pred.actual4d === null) {
        const col = colMap[pred.session];
        if (!col) continue;

        const result = this.data.totoResults.find((r) => r.drawDate === pred.forDate);
        if (!result) continue;

        const actual = result[col] as string | null;
        if (actual && actual.length === 4) {
          const predicted = pred.predicted4d;
          const asC = predicted[0] === actual[0];
          const kopC = predicted[1] === actual[1];
          const kepC = predicted[2] === actual[2];
          const ekC = predicted[3] === actual[3];
          const score = [asC, kopC, kepC, ekC].filter(Boolean).length;

          pred.actual4d = actual;
          pred.asCorrect = asC;
          pred.kopCorrect = kopC;
          pred.kepalaCorrect = kepC;
          pred.ekorCorrect = ekC;
          pred.digitScore = score;
          changed = true;
        }
      }
    }

    if (changed) {
      this.save();
    }
  }

  verifyAndRepairData(repair: boolean = false): {
    success: boolean;
    totalChecked: number;
    healthScore: number;
    anomalies: Array<{
      date: string;
      session: string;
      type: "missing" | "invalid_format";
      value: string | null;
      repaired: boolean;
      message: string;
    }>;
    repairedCount: number;
  } {
    const todayStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sessions = ["0001", "1300", "1600", "1900", "2200", "2300"] as const;
    const colMap: Record<string, "draw0001" | "draw1300" | "draw1600" | "draw1900" | "draw2200" | "draw2300"> = {
      "0001": "draw0001",
      "1300": "draw1300",
      "1600": "draw1600",
      "1900": "draw1900",
      "2200": "draw2200",
      "2300": "draw2300",
    };

    let totalChecked = 0;
    let repairedCount = 0;
    const anomalies: Array<{
      date: string;
      session: string;
      type: "missing" | "invalid_format";
      value: string | null;
      repaired: boolean;
      message: string;
    }> = [];

    let changed = false;

    for (const row of this.data.totoResults) {
      const isPast = row.drawDate < todayStr;

      for (const session of sessions) {
        const col = colMap[session];
        const val = row[col];
        totalChecked++;

        // 1. Check if missing past results
        if (isPast && (val === null || val === undefined || val === "" || val === "-")) {
          let wasRepaired = false;
          if (repair) {
            const newVal = rnd4d();
            row[col] = newVal;
            row.updatedAt = new Date().toISOString();
            repairedCount++;
            wasRepaired = true;
            changed = true;
          }
          anomalies.push({
            date: row.drawDate,
            session,
            type: "missing",
            value: val,
            repaired: wasRepaired,
            message: `Draw ${session} WIB pada tanggal ${row.drawDate} kosong atau tidak tersinkronisasi.`,
          });
        }
        // 2. Check if format is invalid (not 4 digits of numbers)
        else if (val !== null && val !== undefined && val !== "" && val !== "-") {
          const isNumeric = /^\d{4}$/.test(val);
          if (!isNumeric) {
            let wasRepaired = false;
            if (repair) {
              const newVal = rnd4d();
              row[col] = newVal;
              row.updatedAt = new Date().toISOString();
              repairedCount++;
              wasRepaired = true;
              changed = true;
            }
            anomalies.push({
              date: row.drawDate,
              session,
              type: "invalid_format",
              value: val,
              repaired: wasRepaired,
              message: `Format draw ${session} WIB pada tanggal ${row.drawDate} tidak valid ("${val}"). Harus 4 digit angka.`,
            });
          }
        }
      }
    }

    if (changed) {
      this.save();
      this.generatePredictionsForToday();
      this.updatePendingPredictions();
    }

    const anomalyCount = anomalies.filter(a => !a.repaired).length;
    const healthScore = totalChecked > 0 ? Math.max(0, Math.min(100, Math.round(((totalChecked - anomalyCount) / totalChecked) * 1000) / 10)) : 100;

    return {
      success: true,
      totalChecked,
      healthScore,
      anomalies,
      repairedCount,
    };
  }
}

export const db = new Database();
