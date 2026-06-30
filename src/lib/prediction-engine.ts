/**
 * Smart Prediction AI — 42-engine multi-algorithm predictor
 * Each of the 4 digit positions (As, Kop, Kepala, Ekor) is analysed independently.
 *
 * Engine categories:
 *  A. Frequency (5)     — all-time, short-term, ultra-short, weighted, seasonal
 *  B. Momentum (5)      — acceleration, short/medium/long trends, linear regression
 *  C. Markov Chain (5)  — 1st, 2nd, 3rd order, cross-position, cyclic
 *  D. Bayesian (4)      — fast/normal/slow decay + combined
 *  E. Gap & Cycle (5)   — overdue, hot, periodic, avg-gap, gap variance
 *  F. Statistics (5)    — entropy, chi-square, z-score, poisson, concentration
 *  G. Pattern (5)       — period-3, period-4, sum-targeting, mirror, pair
 *  H. Hot/Cold (4)      — hot, cold, warm, contrarian
 *  I. Ensemble (4)      — weighted vote, boosted, neural-style, meta-learner
 */

export type DrawTime = "0001" | "1300" | "1600" | "1900" | "2200" | "2300";
export type DrawTimeKey = `draw${DrawTime}`;
export function drawKey(t: string): DrawTimeKey { return `draw${t}` as DrawTimeKey; }

export interface EngineResult {
  name: string;
  category: string;
  digit: number;
  score: number;           // 0–100 confidence
  weight: number;          // engine reliability weight
}

export interface PositionAnalysis {
  position: number;
  label: string;
  predicted: number;
  engines: EngineResult[];
  engineAgreement: number;
  frequency: number;
  momentum: number;
  transition: number;
  bayesian: number;
  gapScore: number;
  entropy: number;
  digitSupport: number;
  digitFreqMap: number[];
  voteMap: number[];
  weightedVoteMap: number[];
}

export interface ConfidenceBreakdown {
  engineAgreement: number;
  entropy: number;
  concentration: number;
  dataQuality: number;
  backtestScore: number;
  stabilityScore: number;
  varianceScore: number;
  crossValidation: number;
  total: number;
}

export interface PredictionResult {
  session: DrawTime;
  totalData: number;
  predicted4D: string;
  signal: boolean;
  positions: PositionAnalysis[];
  confidence: ConfidenceBreakdown;
  anomaly: string | null;
  generatedAt: string;
  activeEngines: number;
  totalEngines: number;
  bbfsCandidates: string[][];
  engineCategories: string[];
}

// ─── Low-level helpers ────────────────────────────────────────────────────────

function digitAt(val: string, pos: number): number | null {
  if (!val || val.length < 4) return null;
  const d = parseInt(val[pos]);
  return isNaN(d) ? null : d;
}

function digitFreqArr(history: string[], pos: number): number[] {
  const counts = new Array(10).fill(0);
  for (const v of history) {
    const d = digitAt(v, pos);
    if (d !== null) counts[d]++;
  }
  return counts;
}

function argmax(arr: number[]): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

function normalizedEntropy(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 1;
  let h = 0;
  for (const c of counts) {
    if (c > 0) { const p = c / total; h -= p * Math.log2(p); }
  }
  return h / Math.log2(10);
}

function totalCount(arr: number[]): number { return arr.reduce((a, b) => a + b, 0); }

function makeEngine(name: string, category: string, digit: number, score: number, weight = 1.0): EngineResult {
  return { name, category, digit, score: Math.round(Math.min(100, Math.max(0, score))), weight };
}

// ─── A. FREQUENCY engines ─────────────────────────────────────────────────────

function engFreqAllTime(history: string[], pos: number): EngineResult {
  const c = digitFreqArr(history, pos);
  const d = argmax(c);
  const t = Math.max(1, totalCount(c));
  return makeEngine("Frequency (All-time)", "A.Frequency", d, (c[d] / t) * 100, 1.2);
}

function engFreqRecent20(history: string[], pos: number): EngineResult {
  const c = digitFreqArr(history.slice(-20), pos);
  const d = argmax(c);
  const t = Math.max(1, totalCount(c));
  return makeEngine("Frequency (Last 20)", "A.Frequency", d, (c[d] / t) * 100, 1.3);
}

function engFreqRecent10(history: string[], pos: number): EngineResult {
  const c = digitFreqArr(history.slice(-10), pos);
  const d = argmax(c);
  const t = Math.max(1, totalCount(c));
  return makeEngine("Frequency (Last 10)", "A.Frequency", d, (c[d] / t) * 100, 1.1);
}

function engFreqWeighted(history: string[], pos: number, decay = 0.93): EngineResult {
  const weights = new Array(10).fill(0);
  for (let i = 0; i < history.length; i++) {
    const d = digitAt(history[i], pos);
    if (d !== null) weights[d] += Math.pow(decay, history.length - 1 - i);
  }
  const d = argmax(weights);
  const t = weights.reduce((a, b) => a + b, 0);
  return makeEngine("Frequency (Weighted)", "A.Frequency", d, t > 0 ? (weights[d] / t) * 100 : 10, 1.4);
}

function engFreqSeasonal(history: string[], pos: number, windowSize = 7): EngineResult {
  // Considers same relative position modulo windowSize (like weekday pattern)
  const n = history.length;
  const phase = n % windowSize;
  const seasonal: string[] = [];
  for (let i = phase; i < history.length; i += windowSize) seasonal.push(history[i]);
  if (seasonal.length < 3) return engFreqAllTime(history, pos);
  const c = digitFreqArr(seasonal, pos);
  const d = argmax(c);
  const t = Math.max(1, totalCount(c));
  return makeEngine("Frequency (Seasonal)", "A.Frequency", d, (c[d] / t) * 100, 1.0);
}

// ─── B. MOMENTUM engines ──────────────────────────────────────────────────────

function engMomentum(history: string[], pos: number, recentN = 15): EngineResult {
  const all = digitFreqArr(history, pos);
  const rec = digitFreqArr(history.slice(-recentN), pos);
  const tAll = Math.max(1, totalCount(all));
  const tRec = Math.max(1, totalCount(rec));
  let bestDelta = -Infinity, bestD = 0;
  for (let d = 0; d < 10; d++) {
    const delta = rec[d] / tRec - all[d] / tAll;
    if (delta > bestDelta) { bestDelta = delta; bestD = d; }
  }
  return makeEngine("Momentum (15)", "B.Momentum", bestD, 50 + bestDelta * 300, 1.3);
}

function engMomentumShort(history: string[], pos: number): EngineResult {
  const rec = digitFreqArr(history.slice(-7), pos);
  const mid = digitFreqArr(history.slice(-20, -7), pos);
  const tR = Math.max(1, totalCount(rec));
  const tM = Math.max(1, totalCount(mid));
  let bestDelta = -Infinity, bestD = 0;
  for (let d = 0; d < 10; d++) {
    const delta = rec[d] / tR - mid[d] / tM;
    if (delta > bestDelta) { bestDelta = delta; bestD = d; }
  }
  return makeEngine("Momentum (Short 7)", "B.Momentum", bestD, 50 + bestDelta * 400, 1.1);
}

function engAcceleration(history: string[], pos: number): EngineResult {
  if (history.length < 30) return engMomentum(history, pos);
  const recArr = digitFreqArr(history.slice(-10), pos);
  const midArr = digitFreqArr(history.slice(-20, -10), pos);
  const oldArr = digitFreqArr(history.slice(-30, -20), pos);
  const tR = Math.max(1, totalCount(recArr));
  const tM = Math.max(1, totalCount(midArr));
  const tO = Math.max(1, totalCount(oldArr));
  let bestAcc = -Infinity, bestD = 0;
  for (let d = 0; d < 10; d++) {
    const m1 = recArr[d] / tR - midArr[d] / tM;
    const m0 = midArr[d] / tM - oldArr[d] / tO;
    const acc = m1 - m0;
    if (acc > bestAcc) { bestAcc = acc; bestD = d; }
  }
  return makeEngine("Acceleration", "B.Momentum", bestD, 50 + bestAcc * 500, 1.1);
}

function engLinearTrend(history: string[], pos: number): EngineResult {
  if (history.length < 10) return engFreqAllTime(history, pos);
  // For each digit, fit linear trend of rolling 5-window counts
  const slopes = new Array(10).fill(0);
  const windowSize = 5;
  const nWindows = Math.floor(history.length / windowSize);
  if (nWindows < 2) return engFreqAllTime(history, pos);
  const windowCounts: number[][] = [];
  for (let w = 0; w < nWindows; w++) {
    const slice = history.slice(w * windowSize, (w + 1) * windowSize);
    windowCounts.push(digitFreqArr(slice, pos));
  }
  for (let d = 0; d < 10; d++) {
    const ys = windowCounts.map((wc) => wc[d]);
    const n = ys.length;
    const xMean = (n - 1) / 2;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (i - xMean) * (ys[i] - yMean); den += (i - xMean) ** 2; }
    slopes[d] = den > 0 ? num / den : 0;
  }
  const d = argmax(slopes);
  return makeEngine("Linear Trend", "B.Momentum", d, 50 + slopes[d] * 100, 1.2);
}

function engVolatility(history: string[], pos: number): EngineResult {
  // Digit with lowest volatility (most stable) wins
  if (history.length < 20) return engFreqAllTime(history, pos);
  const windowSize = 10;
  const nWindows = Math.floor(history.length / windowSize);
  const freqs: number[][] = Array.from({ length: 10 }, () => []);
  for (let w = 0; w < nWindows; w++) {
    const slice = history.slice(w * windowSize, (w + 1) * windowSize);
    const c = digitFreqArr(slice, pos);
    const t = Math.max(1, totalCount(c));
    for (let d = 0; d < 10; d++) freqs[d].push(c[d] / t);
  }
  const variance = freqs.map((arr) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((a, x) => a + (x - mean) ** 2, 0) / arr.length;
  });
  const allCount = digitFreqArr(history, pos);
  const t = Math.max(1, totalCount(allCount));
  // Combine high frequency + low volatility
  const scores = allCount.map((c, d) => (c / t) * 100 - variance[d] * 200);
  const d = argmax(scores);
  return makeEngine("Volatility (Stable)", "B.Momentum", d, 50 + scores[d], 1.0);
}

// ─── C. MARKOV CHAIN engines ──────────────────────────────────────────────────

function buildTransMatrix(history: string[], pos: number): number[][] {
  const trans: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(0));
  for (let i = 1; i < history.length; i++) {
    const from = digitAt(history[i - 1], pos);
    const to = digitAt(history[i], pos);
    if (from !== null && to !== null) trans[from][to]++;
  }
  return trans;
}

function engMarkov1(history: string[], pos: number): EngineResult {
  const trans = buildTransMatrix(history, pos);
  const last = digitAt(history[history.length - 1], pos);
  if (last === null) return engFreqAllTime(history, pos);
  const row = trans[last];
  const t = Math.max(1, totalCount(row));
  const d = argmax(row);
  return makeEngine("Markov 1st Order", "C.Markov", d, (row[d] / t) * 100, 1.5);
}

function engMarkov2(history: string[], pos: number): EngineResult {
  if (history.length < 3) return engMarkov1(history, pos);
  // 2nd order: from (prev2, prev1) predict next
  const trans: Record<string, number[]> = {};
  for (let i = 2; i < history.length; i++) {
    const p2 = digitAt(history[i - 2], pos);
    const p1 = digitAt(history[i - 1], pos);
    const curr = digitAt(history[i], pos);
    if (p2 === null || p1 === null || curr === null) continue;
    const key = `${p2}_${p1}`;
    if (!trans[key]) trans[key] = new Array(10).fill(0);
    trans[key][curr]++;
  }
  const last2 = digitAt(history[history.length - 2], pos);
  const last1 = digitAt(history[history.length - 1], pos);
  if (last2 === null || last1 === null) return engMarkov1(history, pos);
  const row = trans[`${last2}_${last1}`];
  if (!row) return engMarkov1(history, pos);
  const t = Math.max(1, totalCount(row));
  const d = argmax(row);
  return makeEngine("Markov 2nd Order", "C.Markov", d, (row[d] / t) * 100, 1.6);
}

function engMarkov3(history: string[], pos: number): EngineResult {
  if (history.length < 4) return engMarkov1(history, pos);
  const trans: Record<string, number[]> = {};
  for (let i = 3; i < history.length; i++) {
    const p3 = digitAt(history[i - 3], pos);
    const p2 = digitAt(history[i - 2], pos);
    const p1 = digitAt(history[i - 1], pos);
    const curr = digitAt(history[i], pos);
    if (p3 === null || p2 === null || p1 === null || curr === null) continue;
    const key = `${p3}_${p2}_${p1}`;
    if (!trans[key]) trans[key] = new Array(10).fill(0);
    trans[key][curr]++;
  }
  const d3 = digitAt(history[history.length - 3], pos);
  const d2 = digitAt(history[history.length - 2], pos);
  const d1 = digitAt(history[history.length - 1], pos);
  if (d3 === null || d2 === null || d1 === null) return engMarkov1(history, pos);
  const row = trans[`${d3}_${d2}_${d1}`];
  if (!row) return engMarkov2(history, pos);
  const t = Math.max(1, totalCount(row));
  const d = argmax(row);
  return makeEngine("Markov 3rd Order", "C.Markov", d, (row[d] / t) * 100, 1.5);
}

function engCrossPositionMarkov(histories: string[][], srcPos: number, tgtPos: number): EngineResult {
  const trans: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(0));
  const histSrc = histories[srcPos];
  const histTgt = histories[tgtPos];
  const len = Math.min(histSrc.length, histTgt.length);
  for (let i = 0; i < len; i++) {
    const from = histSrc[i] !== undefined ? parseInt(histSrc[i] ?? "?") : NaN;
    const to = histTgt[i] !== undefined ? parseInt(histTgt[i] ?? "?") : NaN;
    if (!isNaN(from) && !isNaN(to)) trans[from][to]++;
  }
  const lastSrc = histSrc[histSrc.length - 1];
  const from = lastSrc !== undefined ? parseInt(lastSrc ?? "?") : NaN;
  if (isNaN(from)) return engFreqAllTime(histories[tgtPos].map(d => d + "000"), 0);
  const row = trans[from];
  const t = Math.max(1, totalCount(row));
  const d = argmax(row);
  return makeEngine(`Cross-Pos Markov (${srcPos}→${tgtPos})`, "C.Markov", d, (row[d] / t) * 100, 1.2);
}

function engCyclicMarkov(history: string[], pos: number, cycleLen = 6): EngineResult {
  // Same position in cycle predicts next
  const n = history.length;
  const phase = n % cycleLen;
  const samePhase: Array<{ val: string; next: string }> = [];
  for (let i = phase; i < history.length - cycleLen; i += cycleLen) {
    if (history[i] && history[i + cycleLen]) {
      samePhase.push({ val: history[i], next: history[i + cycleLen] });
    }
  }
  if (samePhase.length < 3) return engMarkov1(history, pos);
  const trans: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(0));
  for (const { val, next } of samePhase) {
    const from = digitAt(val, pos);
    const to = digitAt(next, pos);
    if (from !== null && to !== null) trans[from][to]++;
  }
  const lastPhaseVal = history[history.length - 1 - ((history.length - 1 - phase + cycleLen) % cycleLen)];
  const from2 = digitAt(lastPhaseVal ?? "", pos);
  if (from2 === null) return engMarkov1(history, pos);
  const row = trans[from2];
  const t = Math.max(1, totalCount(row));
  if (t === 0) return engMarkov1(history, pos);
  const d = argmax(row);
  return makeEngine("Cyclic Markov", "C.Markov", d, (row[d] / t) * 100, 1.3);
}

// ─── D. BAYESIAN engines ──────────────────────────────────────────────────────

function engBayesian(history: string[], pos: number, decay: number, label: string, weight: number): EngineResult {
  const w = new Array(10).fill(1); // uniform prior
  for (let i = 0; i < history.length; i++) {
    const d = digitAt(history[i], pos);
    if (d !== null) w[d] += Math.pow(decay, history.length - 1 - i);
  }
  const t = w.reduce((a, b) => a + b, 0);
  const d = argmax(w);
  return makeEngine(label, "D.Bayesian", d, (w[d] / t) * 100, weight);
}

function engBayesianFast(history: string[], pos: number): EngineResult {
  return engBayesian(history, pos, 0.80, "Bayesian (Fast 0.80)", 1.2);
}
function engBayesianNormal(history: string[], pos: number): EngineResult {
  return engBayesian(history, pos, 0.93, "Bayesian (Normal 0.93)", 1.4);
}
function engBayesianSlow(history: string[], pos: number): EngineResult {
  return engBayesian(history, pos, 0.98, "Bayesian (Slow 0.98)", 1.1);
}
function engBayesianCombined(history: string[], pos: number): EngineResult {
  const fast = engBayesianFast(history, pos);
  const norm = engBayesianNormal(history, pos);
  const slow = engBayesianSlow(history, pos);
  const votes = new Array(10).fill(0);
  [fast, norm, slow].forEach((e) => { votes[e.digit] += e.score; });
  const d = argmax(votes);
  return makeEngine("Bayesian (Combined)", "D.Bayesian", d, votes[d] / 3, 1.5);
}

// ─── E. GAP & CYCLE engines ───────────────────────────────────────────────────

function engGapOverdue(history: string[], pos: number): EngineResult {
  const lastSeen = new Array(10).fill(-1);
  for (let i = 0; i < history.length; i++) {
    const d = digitAt(history[i], pos);
    if (d !== null) lastSeen[d] = i;
  }
  const n = history.length;
  const gaps = lastSeen.map((idx) => (idx === -1 ? n * 2 : n - 1 - idx));
  const d = argmax(gaps);
  const score = Math.min(100, (gaps[d] / 15) * 60);
  return makeEngine("Gap (Overdue)", "E.Gap", d, score, 1.1);
}

function engGapHot(history: string[], pos: number): EngineResult {
  const lastSeen = new Array(10).fill(-1);
  for (let i = 0; i < history.length; i++) {
    const d = digitAt(history[i], pos);
    if (d !== null) lastSeen[d] = i;
  }
  const n = history.length;
  const recency = lastSeen.map((idx) => (idx === -1 ? 0 : idx + 1));
  const d = argmax(recency);
  const score = (recency[d] / n) * 100;
  return makeEngine("Gap (Hot/Recent)", "E.Gap", d, score, 1.0);
}

function engGapAverage(history: string[], pos: number): EngineResult {
  // Digit whose average gap is closest to being expired (current gap >= avg gap)
  const gaps: number[][] = Array.from({ length: 10 }, () => []);
  let lastIdx = new Array(10).fill(-1);
  for (let i = 0; i < history.length; i++) {
    const d = digitAt(history[i], pos);
    if (d !== null) {
      if (lastIdx[d] !== -1) gaps[d].push(i - lastIdx[d]);
      lastIdx[d] = i;
    }
  }
  const n = history.length;
  const scores = new Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    if (gaps[d].length === 0) { scores[d] = 50; continue; }
    const avgGap = gaps[d].reduce((a, b) => a + b, 0) / gaps[d].length;
    const currentGap = lastIdx[d] === -1 ? n : n - 1 - lastIdx[d];
    scores[d] = Math.min(100, (currentGap / avgGap) * 50);
  }
  const d = argmax(scores);
  return makeEngine("Gap (Avg Expired)", "E.Gap", d, scores[d], 1.2);
}

function engGapPeriodic(history: string[], pos: number): EngineResult {
  if (history.length < 20) return engGapOverdue(history, pos);
  const gaps: number[][] = Array.from({ length: 10 }, () => []);
  const lastIdx = new Array(10).fill(-1);
  for (let i = 0; i < history.length; i++) {
    const d = digitAt(history[i], pos);
    if (d !== null) {
      if (lastIdx[d] !== -1) gaps[d].push(i - lastIdx[d]);
      lastIdx[d] = i;
    }
  }
  // Digit with lowest gap variance = most periodic
  const stdDevs = gaps.map((g) => {
    if (g.length < 2) return 999;
    const mean = g.reduce((a, b) => a + b, 0) / g.length;
    const variance = g.reduce((a, x) => a + (x - mean) ** 2, 0) / g.length;
    return Math.sqrt(variance);
  });
  // Also check if it's due (current gap >= expected)
  const n = history.length;
  const scores = new Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    if (gaps[d].length < 2) { scores[d] = 0; continue; }
    const mean = gaps[d].reduce((a, b) => a + b, 0) / gaps[d].length;
    const currentGap = lastIdx[d] === -1 ? n : n - 1 - lastIdx[d];
    const dueness = currentGap / mean; // >=1 means overdue
    scores[d] = (1 / (1 + stdDevs[d])) * 50 + Math.min(1, dueness) * 50;
  }
  const d = argmax(scores);
  return makeEngine("Gap (Periodic)", "E.Gap", d, scores[d], 1.3);
}

function engGapVariance(history: string[], pos: number): EngineResult {
  const allCounts = digitFreqArr(history, pos);
  const t = Math.max(1, totalCount(allCounts));
  const expected = t / 10;
  const deviations = allCounts.map((c) => Math.abs(c - expected));
  const d = argmax(deviations);
  const score = Math.min(100, (deviations[d] / expected) * 50 + 25);
  return makeEngine("Gap (Variance)", "E.Gap", d, score, 0.9);
}

// ─── F. STATISTICAL engines ───────────────────────────────────────────────────

function engEntropy(history: string[], pos: number): EngineResult {
  const c = digitFreqArr(history.slice(-30), pos);
  const d = argmax(c);
  const ent = normalizedEntropy(c);
  const score = (1 - ent) * 100;
  return makeEngine("Entropy", "F.Stats", d, score, 1.0);
}

function engChiSquare(history: string[], pos: number): EngineResult {
  const c = digitFreqArr(history, pos);
  const t = Math.max(1, totalCount(c));
  const expected = t / 10;
  // Digit with highest positive chi-square residual
  const residuals = c.map((obs) => (obs - expected) / Math.sqrt(expected));
  const d = argmax(residuals);
  const score = Math.min(100, Math.abs(residuals[d]) * 15 + 30);
  return makeEngine("Chi-Square", "F.Stats", d, score, 1.1);
}

function engZScore(history: string[], pos: number): EngineResult {
  const windows: number[][] = [];
  const wSize = 10;
  for (let i = 0; i + wSize <= history.length; i += wSize) {
    windows.push(digitFreqArr(history.slice(i, i + wSize), pos));
  }
  if (windows.length < 2) return engFreqAllTime(history, pos);
  const means = new Array(10).fill(0);
  const stds = new Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    const vals = windows.map((w) => w[d]);
    means[d] = vals.reduce((a, b) => a + b, 0) / vals.length;
    stds[d] = Math.sqrt(vals.reduce((a, x) => a + (x - means[d]) ** 2, 0) / vals.length);
  }
  const recentC = digitFreqArr(history.slice(-wSize), pos);
  const zScores = recentC.map((c, d) =>
    stds[d] > 0 ? (c - means[d]) / stds[d] : 0
  );
  const d = argmax(zScores);
  return makeEngine("Z-Score", "F.Stats", d, 50 + zScores[d] * 15, 1.2);
}

function engPoisson(history: string[], pos: number): EngineResult {
  const c = digitFreqArr(history, pos);
  const t = Math.max(1, totalCount(c));
  // Lambda = expected count per draw
  const lambda = 1 / 10;
  const recent10 = digitFreqArr(history.slice(-10), pos);
  // Expected in 10 draws = 1. Find digit most above expected.
  const scores = recent10.map((obs) => {
    const expected = lambda * 10;
    return (obs - expected) / Math.max(0.1, Math.sqrt(expected));
  });
  // Combine with overall frequency
  const combined = scores.map((s, d) => s * 0.4 + (c[d] / t) * 60);
  const d = argmax(combined);
  return makeEngine("Poisson", "F.Stats", d, combined[d] + 30, 1.0);
}

function engConcentration(history: string[], pos: number): EngineResult {
  const c = digitFreqArr(history.slice(-20), pos);
  const t = Math.max(1, totalCount(c));
  const d = argmax(c);
  const topPct = c[d] / t;
  // How concentrated is this vs uniform (0.1)?
  const concentration = Math.min(100, (topPct - 0.1) / 0.1 * 50 + 50);
  return makeEngine("Concentration", "F.Stats", d, concentration, 1.1);
}

// ─── G. PATTERN engines ───────────────────────────────────────────────────────

function engPattern(history: string[], pos: number, period: number): EngineResult {
  if (history.length < period * 2 + 1) return engFreqAllTime(history, pos);
  const last = history.slice(-period);
  const votes = new Array(10).fill(0);
  // Look back and find periods that match last period
  for (let i = period; i < history.length - period; i++) {
    const window = history.slice(i - period, i);
    let matches = 0;
    for (let j = 0; j < period; j++) {
      if (digitAt(window[j], pos) === digitAt(last[j], pos)) matches++;
    }
    if (matches >= Math.ceil(period * 0.6)) {
      const nextD = digitAt(history[i], pos);
      if (nextD !== null) votes[nextD]++;
    }
  }
  const d = argmax(votes);
  const t = totalCount(votes);
  const score = t > 0 ? (votes[d] / t) * 100 : 10;
  return makeEngine(`Pattern (Period ${period})`, "G.Pattern", d, score, t > 2 ? 1.3 : 0.8);
}

function engSumTargeting(history: string[], pos: number): EngineResult {
  if (history.length < 5) return engFreqAllTime(history, pos);
  const sums = history.filter((v) => v.length === 4).map((v) =>
    v.split("").reduce((a, c) => a + parseInt(c), 0)
  );
  const avgSum = sums.reduce((a, b) => a + b, 0) / sums.length;
  const lastVal = history[history.length - 1];
  if (!lastVal || lastVal.length < 4) return engFreqAllTime(history, pos);
  const otherDigitsSum = lastVal.split("").reduce((a, c, i) => i === pos ? a : a + parseInt(c), 0);
  const target = Math.max(0, Math.min(9, Math.round(avgSum - otherDigitsSum)));
  return makeEngine("Sum Targeting", "G.Pattern", target, 50, 0.9);
}

function engMirrorPattern(history: string[], pos: number): EngineResult {
  // Digits that alternate (e.g., 3, 7, 3, 7) — predict the alternating one
  if (history.length < 4) return engFreqAllTime(history, pos);
  const recent = history.slice(-6).map((v) => digitAt(v, pos));
  if (recent.some((d) => d === null)) return engFreqAllTime(history, pos);
  const votes = new Array(10).fill(0);
  // Check for alternation between last two unique digits
  const uniq = [...new Set(recent.filter((d) => d !== null))];
  if (uniq.length === 2) {
    const lastD = recent[recent.length - 1];
    const other = uniq.find((d) => d !== lastD);
    if (other !== null && other !== undefined) {
      votes[other] += 3;
    }
  }
  // Also add frequency vote
  const c = digitFreqArr(history, pos);
  const best = argmax(c);
  votes[best] += 1;
  const d = argmax(votes);
  return makeEngine("Mirror Pattern", "G.Pattern", d, votes[d] > 2 ? 70 : 40, 0.9);
}

function engPairPattern(history: string[], pos: number): EngineResult {
  // Find most common (prev_digit, next_digit) pair that follows current last digit
  if (history.length < 5) return engFreqAllTime(history, pos);
  const pairCounts: Record<string, number> = {};
  for (let i = 1; i < history.length; i++) {
    const from = digitAt(history[i - 1], pos);
    const to = digitAt(history[i], pos);
    if (from !== null && to !== null) {
      const key = `${from}_${to}`;
      pairCounts[key] = (pairCounts[key] ?? 0) + 1;
    }
  }
  const lastD = digitAt(history[history.length - 1], pos);
  if (lastD === null) return engFreqAllTime(history, pos);
  const votes = new Array(10).fill(0);
  for (let to = 0; to < 10; to++) {
    votes[to] = pairCounts[`${lastD}_${to}`] ?? 0;
  }
  const d = argmax(votes);
  const t = totalCount(votes);
  return makeEngine("Pair Pattern", "G.Pattern", d, t > 0 ? (votes[d] / t) * 100 : 10, 1.2);
}

// ─── H. HOT / COLD engines ────────────────────────────────────────────────────

function engHot(history: string[], pos: number): EngineResult {
  const hot = digitFreqArr(history.slice(-8), pos);
  const d = argmax(hot);
  const t = Math.max(1, totalCount(hot));
  return makeEngine("Hot (Last 8)", "H.HotCold", d, (hot[d] / t) * 100, 1.1);
}

function engCold(history: string[], pos: number): EngineResult {
  // Most under-represented recently vs historically
  const allC = digitFreqArr(history, pos);
  const recC = digitFreqArr(history.slice(-20), pos);
  const tAll = Math.max(1, totalCount(allC));
  const tRec = Math.max(1, totalCount(recC));
  let best = -Infinity, bestD = 0;
  for (let d = 0; d < 10; d++) {
    const diff = allC[d] / tAll - recC[d] / tRec;
    if (diff > best) { best = diff; bestD = d; }
  }
  return makeEngine("Cold (Reverting)", "H.HotCold", bestD, 40 + best * 200, 1.0);
}

function engWarm(history: string[], pos: number): EngineResult {
  // Consistently appearing, not too hot, not too cold
  const allC = digitFreqArr(history, pos);
  const recC20 = digitFreqArr(history.slice(-20), pos);
  const recC10 = digitFreqArr(history.slice(-10), pos);
  const tAll = Math.max(1, totalCount(allC));
  const tRec20 = Math.max(1, totalCount(recC20));
  const tRec10 = Math.max(1, totalCount(recC10));
  const scores = allC.map((_, d) => {
    const allPct = allC[d] / tAll;
    const rec20Pct = recC20[d] / tRec20;
    const rec10Pct = recC10[d] / tRec10;
    // Warm = consistent across all windows
    return (allPct + rec20Pct + rec10Pct) / 3 * 100 - Math.abs(rec10Pct - allPct) * 50;
  });
  const d = argmax(scores);
  return makeEngine("Warm (Consistent)", "H.HotCold", d, scores[d] + 30, 1.2);
}

function engContrarian(history: string[], pos: number): EngineResult {
  // Predict the OPPOSITE of what's been hot (mean-reversion)
  const recC = digitFreqArr(history.slice(-10), pos);
  const allC = digitFreqArr(history, pos);
  const tRec = Math.max(1, totalCount(recC));
  const tAll = Math.max(1, totalCount(allC));
  // Most overvalued recently vs long-term
  let mostOvervalued = -Infinity, ovD = 0;
  for (let d = 0; d < 10; d++) {
    const overshoot = recC[d] / tRec - allC[d] / tAll;
    if (overshoot > mostOvervalued) { mostOvervalued = overshoot; ovD = d; }
  }
  // But we want the second-most frequent overall (not the overvalued one)
  const sorted = [...allC.entries()].sort((a, b) => b[1] - a[1]);
  const target = sorted.find(([d]) => d !== ovD)?.[0] ?? sorted[1][0];
  return makeEngine("Contrarian", "H.HotCold", target, 35 + mostOvervalued * 150, 0.8);
}

// ─── I. ENSEMBLE engines ──────────────────────────────────────────────────────

function engWeightedVote(history: string[], pos: number, baseEngines: EngineResult[]): EngineResult {
  const weighted = new Array(10).fill(0);
  for (const e of baseEngines) {
    weighted[e.digit] += e.score * e.weight;
  }
  const d = argmax(weighted);
  const t = weighted.reduce((a, b) => a + b, 0);
  return makeEngine("Weighted Vote", "I.Ensemble", d, t > 0 ? (weighted[d] / t) * 100 : 10, 2.0);
}

function engBoosted(history: string[], pos: number, baseEngines: EngineResult[]): EngineResult {
  // Boost engines that recently predicted correctly
  const recC = digitFreqArr(history.slice(-5), pos);
  const lastD = digitAt(history[history.length - 1], pos);
  const weighted = new Array(10).fill(0);
  for (const e of baseEngines) {
    // Boost if engine's predicted digit actually appeared recently
    const boost = recC[e.digit] > 0 ? 1.5 : 0.7;
    weighted[e.digit] += e.score * e.weight * boost;
  }
  const d = argmax(weighted);
  const t = weighted.reduce((a, b) => a + b, 0);
  return makeEngine("Boosted Ensemble", "I.Ensemble", d, t > 0 ? (weighted[d] / t) * 100 : 10, 2.0);
}

function engNeuralStyle(history: string[], pos: number, baseEngines: EngineResult[]): EngineResult {
  // Neural-style: sigmoid activation on vote count
  const votes = new Array(10).fill(0);
  for (const e of baseEngines) votes[e.digit]++;
  const maxV = Math.max(...votes);
  // Softmax-like
  const exp = votes.map((v) => Math.exp(v - maxV));
  const expSum = exp.reduce((a, b) => a + b, 0);
  const probs = exp.map((e) => e / expSum);
  const d = argmax(probs);
  return makeEngine("Neural-Style Ensemble", "I.Ensemble", d, probs[d] * 100, 2.0);
}

function engMetaLearner(history: string[], pos: number, baseEngines: EngineResult[]): EngineResult {
  // Meta-learner: weight engines by how often they agree with majority
  const voteMap = new Array(10).fill(0);
  for (const e of baseEngines) voteMap[e.digit]++;
  const majority = argmax(voteMap);
  // Engines that agree with majority get higher weight
  const refined = new Array(10).fill(0);
  for (const e of baseEngines) {
    const agreeBoost = e.digit === majority ? 1.8 : 0.6;
    refined[e.digit] += e.score * e.weight * agreeBoost;
  }
  const d = argmax(refined);
  const t = refined.reduce((a, b) => a + b, 0);
  return makeEngine("Meta-Learner", "I.Ensemble", d, t > 0 ? (refined[d] / t) * 100 : 10, 2.5);
}

// ─── Backtest ────────────────────────────────────────────────────────────────

function backtestScore(history: string[], pos: number, windowSize = 25): number {
  if (history.length < windowSize + 5) return 40;
  let correct = 0;
  const trials = Math.min(20, history.length - windowSize);
  for (let t = 0; t < trials; t++) {
    const slice = history.slice(t, t + windowSize);
    const actual = digitAt(history[t + windowSize], pos);
    if (actual === null) continue;
    const res = engBayesianNormal(slice, pos);
    if (res.digit === actual) correct++;
  }
  return Math.round((correct / Math.max(1, trials)) * 100);
}

// ─── Main analyser ────────────────────────────────────────────────────────────

const POSITION_LABELS = ["As", "Kop", "Kepala", "Ekor"];

function analysePosition(
  history: string[],
  pos: number,
  allPositionHistories: string[][]
): PositionAnalysis {
  // ---- Run all 38 base engines ----
  const baseEngines: EngineResult[] = [
    // A. Frequency (5)
    engFreqAllTime(history, pos),
    engFreqRecent20(history, pos),
    engFreqRecent10(history, pos),
    engFreqWeighted(history, pos),
    engFreqSeasonal(history, pos),
    // B. Momentum (5)
    engMomentum(history, pos),
    engMomentumShort(history, pos),
    engAcceleration(history, pos),
    engLinearTrend(history, pos),
    engVolatility(history, pos),
    // C. Markov (5)
    engMarkov1(history, pos),
    engMarkov2(history, pos),
    engMarkov3(history, pos),
    engCrossPositionMarkov(allPositionHistories, (pos + 1) % 4, pos),
    engCyclicMarkov(history, pos),
    // D. Bayesian (4)
    engBayesianFast(history, pos),
    engBayesianNormal(history, pos),
    engBayesianSlow(history, pos),
    engBayesianCombined(history, pos),
    // E. Gap (5)
    engGapOverdue(history, pos),
    engGapHot(history, pos),
    engGapAverage(history, pos),
    engGapPeriodic(history, pos),
    engGapVariance(history, pos),
    // F. Statistics (5)
    engEntropy(history, pos),
    engChiSquare(history, pos),
    engZScore(history, pos),
    engPoisson(history, pos),
    engConcentration(history, pos),
    // G. Pattern (5)
    engPattern(history, pos, 3),
    engPattern(history, pos, 5),
    engSumTargeting(history, pos),
    engMirrorPattern(history, pos),
    engPairPattern(history, pos),
    // H. Hot/Cold (4)
    engHot(history, pos),
    engCold(history, pos),
    engWarm(history, pos),
    engContrarian(history, pos),
  ];

  // ---- Run 4 ensemble engines ----
  const ensembleEngines: EngineResult[] = [
    engWeightedVote(history, pos, baseEngines),
    engBoosted(history, pos, baseEngines),
    engNeuralStyle(history, pos, baseEngines),
    engMetaLearner(history, pos, baseEngines),
  ];

  const allEngines = [...baseEngines, ...ensembleEngines];

  // ---- Weighted vote map ----
  const voteMap = new Array(10).fill(0);
  const weightedVoteMap = new Array(10).fill(0);
  for (const e of allEngines) {
    voteMap[e.digit]++;
    weightedVoteMap[e.digit] += e.score * e.weight;
  }

  const predicted = argmax(weightedVoteMap);
  const totalEngines = allEngines.length;
  const engineAgreement = Math.round((voteMap[predicted] / totalEngines) * 100);

  // ---- Per-position stats ----
  const allCounts = digitFreqArr(history, pos);
  const totalDraws = Math.max(1, totalCount(allCounts));
  const recentCounts = digitFreqArr(history.slice(-15), pos);
  const recTotal = Math.max(1, totalCount(recentCounts));

  const frequency = Math.round((allCounts[predicted] / totalDraws) * 100);
  const momentum = Math.round((recentCounts[predicted] / recTotal - allCounts[predicted] / totalDraws) * 100);

  const transResult = engMarkov1(history, pos);
  const transition = transResult.score;
  const bayResult = engBayesianNormal(history, pos);
  const bayesian = bayResult.score;
  const gapResult = engGapAverage(history, pos);
  const gapScore = gapResult.digit === predicted ? gapResult.score : 0;
  const ent = normalizedEntropy(allCounts);
  const entropy = Math.round((1 - ent) * 100);

  return {
    position: pos,
    label: POSITION_LABELS[pos],
    predicted,
    engines: allEngines,
    engineAgreement,
    frequency,
    momentum,
    transition,
    bayesian,
    gapScore,
    entropy,
    digitSupport: voteMap[predicted],
    digitFreqMap: allCounts,
    voteMap,
    weightedVoteMap,
  };
}

function computeConfidence(positions: PositionAnalysis[], history: string[]): ConfidenceBreakdown {
  const avgEngineAgr = positions.reduce((a, p) => a + p.engineAgreement, 0) / 4;

  const avgEnt = [0, 1, 2, 3].reduce((sum, pos) => {
    return sum + normalizedEntropy(digitFreqArr(history, pos));
  }, 0) / 4;
  const entropy = Math.round((1 - avgEnt) * 100);

  const concentration = Math.round(positions.reduce((a, p) => a + p.frequency, 0) / 4);
  const dataQuality = Math.min(100, Math.round((history.length / 60) * 100));

  const bt = [0, 1, 2, 3].map((pos) => backtestScore(history, pos));
  const backtestScore_ = Math.round(bt.reduce((a, b) => a + b, 0) / 4);

  // Stability: top digit consistent across 3 windows
  let stab = 0;
  if (history.length >= 60) {
    for (let pos = 0; pos < 4; pos++) {
      const w1 = argmax(digitFreqArr(history.slice(-60, -40), pos));
      const w2 = argmax(digitFreqArr(history.slice(-40, -20), pos));
      const w3 = argmax(digitFreqArr(history.slice(-20), pos));
      if (w1 === w2 || w2 === w3 || w1 === w3) stab++;
    }
  }
  const stabilityScore = Math.round((stab / 4) * 100);

  // Variance: concentration of variance across positions
  const varScores = [0, 1, 2, 3].map((pos) => {
    const counts = digitFreqArr(history, pos);
    const t = Math.max(1, totalCount(counts));
    const probs = counts.map((c) => c / t);
    const variance = probs.reduce((a, p) => a + (p - 0.1) ** 2, 0) / 10;
    return Math.min(100, Math.round(variance * 9000));
  });
  const varianceScore = Math.round(varScores.reduce((a, b) => a + b, 0) / 4);

  // Cross-validation: agreement between ensemble engines across positions
  const ensembleAgreement = positions.map((p) => {
    const ensembleEngines = p.engines.filter((e) => e.category === "I.Ensemble");
    if (ensembleEngines.length === 0) return 0;
    const mostVoted = argmax(ensembleEngines.reduce((acc, e) => {
      acc[e.digit]++;
      return acc;
    }, new Array(10).fill(0)));
    const agreeCount = ensembleEngines.filter((e) => e.digit === mostVoted).length;
    return (agreeCount / ensembleEngines.length) * 100;
  });
  const crossValidation = Math.round(ensembleAgreement.reduce((a, b) => a + b, 0) / 4);

  const total = Math.round(
    avgEngineAgr    * 0.25 +
    entropy         * 0.10 +
    concentration   * 0.10 +
    dataQuality     * 0.10 +
    backtestScore_  * 0.15 +
    stabilityScore  * 0.10 +
    varianceScore   * 0.05 +
    crossValidation * 0.15
  );

  return {
    engineAgreement: Math.round(avgEngineAgr),
    entropy,
    concentration,
    dataQuality,
    backtestScore: backtestScore_,
    stabilityScore,
    varianceScore,
    crossValidation,
    total: Math.min(100, Math.max(0, total)),
  };
}

function detectAnomaly(history: string[]): string | null {
  const anomalies: string[] = [];
  for (let pos = 0; pos < 4; pos++) {
    const last100 = history.slice(-100);
    const counts = digitFreqArr(last100, pos);
    const maxCount = Math.max(...counts);
    const maxDigit = argmax(counts);
    const posLabel = POSITION_LABELS[pos];
    if (maxCount > 22) anomalies.push(`${posLabel}: digit ${maxDigit} muncul ${maxCount}× dalam 100 draw terakhir`);
    // Check for missing digit
    const missing = counts.findIndex((c) => c === 0);
    if (missing >= 0 && last100.length >= 50) anomalies.push(`${posLabel}: digit ${missing} belum muncul dalam 100 draw terakhir`);
  }
  return anomalies.length > 0 ? anomalies.join(" | ") : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function runPrediction(
  months: Array<{ results: Array<Record<string, string | null>> }>,
  session: DrawTime
): PredictionResult {
  const key = drawKey(session);
  const sortedResults = months
    .flatMap((m) => m.results)
    .sort((a, b) => String(a.drawDate ?? "").localeCompare(String(b.drawDate ?? "")));

  const history: string[] = sortedResults
    .map((r) => r[key] ?? "")
    .filter((v) => v.length === 4);

  const TOTAL_ENGINES = 42;

  if (history.length === 0) {
    return {
      session, totalData: 0, predicted4D: "????", signal: false,
      positions: [],
      confidence: {
        engineAgreement: 0, entropy: 0, concentration: 0, dataQuality: 0,
        backtestScore: 0, stabilityScore: 0, varianceScore: 0, crossValidation: 0, total: 0,
      },
      anomaly: null, generatedAt: new Date().toISOString(),
      activeEngines: 0, totalEngines: TOTAL_ENGINES, bbfsCandidates: [[], [], [], []],
      engineCategories: [],
    };
  }

  // Build per-position string history for cross-position Markov
  const allPositionHistories = [0, 1, 2, 3].map((pos) =>
    history.map((v) => v[pos] ?? "")
  );

  const positions = [0, 1, 2, 3].map((pos) =>
    analysePosition(history, pos, allPositionHistories)
  );

  const confidence = computeConfidence(positions, history);
  const anomaly = detectAnomaly(history);

  const predicted4D = positions.map((p) => p.predicted).join("");
  const signal = confidence.total >= 60;

  // Top 4 digits per position for BBFS
  const bbfsCandidates = positions.map((p) => {
    return [...p.weightedVoteMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([d]) => String(d));
  });

  const engineCategories = ["A.Frequency (5)", "B.Momentum (5)", "C.Markov (5)", "D.Bayesian (4)", "E.Gap (5)", "F.Stats (5)", "G.Pattern (5)", "H.HotCold (4)", "I.Ensemble (4)"];

  return {
    session,
    totalData: history.length,
    predicted4D,
    signal,
    positions,
    confidence,
    anomaly,
    generatedAt: new Date().toISOString(),
    activeEngines: TOTAL_ENGINES,
    totalEngines: TOTAL_ENGINES,
    bbfsCandidates,
    engineCategories,
  };
}
