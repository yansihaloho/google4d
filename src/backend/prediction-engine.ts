/**
 * Server-side Prediction Engine — 42-engine multi-algorithm predictor
 * Pure TypeScript, no browser dependencies. Identical logic to the frontend engine.
 */

export type DrawTime = "0001" | "1300" | "1600" | "1900" | "2200" | "2300";
export type DrawTimeKey = `draw${DrawTime}`;
export function drawKey(t: string): DrawTimeKey { return `draw${t}` as DrawTimeKey; }

export interface PredictionResult {
  session: DrawTime;
  totalData: number;
  predicted4D: string;
  signal: boolean;
  confidence: number;
  asP: number;
  kopP: number;
  kepalaP: number;
  ekorP: number;
  bbfs: string; // JSON string of top-4 digits per position
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function digitAt(val: string, pos: number): number | null {
  if (!val || val.length < 4) return null;
  const d = parseInt(val[pos]!);
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
  for (let i = 1; i < arr.length; i++) if (arr[i]! > arr[best]!) best = i;
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

interface EngineResult { digit: number; score: number; weight: number; }

function eng(digit: number, score: number, weight = 1.0): EngineResult {
  return { digit, score: Math.min(100, Math.max(0, score)), weight };
}

// ─── A. FREQUENCY ─────────────────────────────────────────────────────────────

function eFreqAll(h: string[], p: number): EngineResult {
  const c = digitFreqArr(h, p); const d = argmax(c); const t = Math.max(1, totalCount(c));
  return eng(d, (c[d]! / t) * 100, 1.2);
}
function eFreq20(h: string[], p: number): EngineResult {
  const c = digitFreqArr(h.slice(-20), p); const d = argmax(c); const t = Math.max(1, totalCount(c));
  return eng(d, (c[d]! / t) * 100, 1.3);
}
function eFreq10(h: string[], p: number): EngineResult {
  const c = digitFreqArr(h.slice(-10), p); const d = argmax(c); const t = Math.max(1, totalCount(c));
  return eng(d, (c[d]! / t) * 100, 1.1);
}
function eFreqWeighted(h: string[], p: number, decay = 0.93): EngineResult {
  const w = new Array(10).fill(0);
  for (let i = 0; i < h.length; i++) {
    const d = digitAt(h[i]!, p);
    if (d !== null) w[d] += Math.pow(decay, h.length - 1 - i);
  }
  const d = argmax(w); const t = w.reduce((a: number, b: number) => a + b, 0);
  return eng(d, t > 0 ? (w[d]! / t) * 100 : 10, 1.4);
}
function eFreqSeasonal(h: string[], p: number): EngineResult {
  const phase = h.length % 7;
  const seasonal: string[] = [];
  for (let i = phase; i < h.length; i += 7) seasonal.push(h[i]!);
  if (seasonal.length < 3) return eFreqAll(h, p);
  const c = digitFreqArr(seasonal, p); const d = argmax(c); const t = Math.max(1, totalCount(c));
  return eng(d, (c[d]! / t) * 100, 1.0);
}

// ─── B. MOMENTUM ──────────────────────────────────────────────────────────────

function eMomentum(h: string[], p: number): EngineResult {
  const all = digitFreqArr(h, p); const rec = digitFreqArr(h.slice(-15), p);
  const tA = Math.max(1, totalCount(all)); const tR = Math.max(1, totalCount(rec));
  let best = -Infinity, bd = 0;
  for (let d = 0; d < 10; d++) { const delta = rec[d]!/tR - all[d]!/tA; if (delta > best) { best = delta; bd = d; } }
  return eng(bd, 50 + best * 300, 1.3);
}
function eMomShort(h: string[], p: number): EngineResult {
  const rec = digitFreqArr(h.slice(-7), p); const mid = digitFreqArr(h.slice(-20, -7), p);
  const tR = Math.max(1, totalCount(rec)); const tM = Math.max(1, totalCount(mid));
  let best = -Infinity, bd = 0;
  for (let d = 0; d < 10; d++) { const delta = rec[d]!/tR - mid[d]!/tM; if (delta > best) { best = delta; bd = d; } }
  return eng(bd, 50 + best * 400, 1.1);
}
function eAccel(h: string[], p: number): EngineResult {
  if (h.length < 30) return eMomentum(h, p);
  const r = digitFreqArr(h.slice(-10), p); const m = digitFreqArr(h.slice(-20, -10), p); const o = digitFreqArr(h.slice(-30, -20), p);
  const tR = Math.max(1, totalCount(r)); const tM = Math.max(1, totalCount(m)); const tO = Math.max(1, totalCount(o));
  let best = -Infinity, bd = 0;
  for (let d = 0; d < 10; d++) { const acc = (r[d]!/tR - m[d]!/tM) - (m[d]!/tM - o[d]!/tO); if (acc > best) { best = acc; bd = d; } }
  return eng(bd, 50 + best * 500, 1.1);
}
function eLinearTrend(h: string[], p: number): EngineResult {
  if (h.length < 10) return eFreqAll(h, p);
  const nW = Math.floor(h.length / 5); if (nW < 2) return eFreqAll(h, p);
  const wcs: number[][] = [];
  for (let w = 0; w < nW; w++) wcs.push(digitFreqArr(h.slice(w * 5, (w + 1) * 5), p));
  const slopes = new Array(10).fill(0);
  const xM = (nW - 1) / 2;
  for (let d = 0; d < 10; d++) {
    const ys = wcs.map(wc => wc[d]!); const yM = ys.reduce((a, b) => a + b, 0) / nW;
    let num = 0, den = 0;
    for (let i = 0; i < nW; i++) { num += (i - xM) * (ys[i]! - yM); den += (i - xM) ** 2; }
    slopes[d] = den > 0 ? num / den : 0;
  }
  return eng(argmax(slopes), 50 + slopes[argmax(slopes)]! * 100, 1.2);
}
function eVolatility(h: string[], p: number): EngineResult {
  if (h.length < 20) return eFreqAll(h, p);
  const nW = Math.floor(h.length / 10); const freqs: number[][] = Array.from({ length: 10 }, () => []);
  for (let w = 0; w < nW; w++) {
    const c = digitFreqArr(h.slice(w * 10, (w + 1) * 10), p); const t = Math.max(1, totalCount(c));
    for (let d = 0; d < 10; d++) freqs[d]!.push(c[d]! / t);
  }
  const variance = freqs.map(arr => { const m = arr.reduce((a, b) => a + b, 0) / arr.length; return arr.reduce((a, x) => a + (x - m) ** 2, 0) / arr.length; });
  const allC = digitFreqArr(h, p); const t = Math.max(1, totalCount(allC));
  const scores = allC.map((c, d) => (c / t) * 100 - variance[d]! * 200);
  const d = argmax(scores);
  return eng(d, 50 + scores[d]!, 1.0);
}

// ─── C. MARKOV ────────────────────────────────────────────────────────────────

function eMarkov1(h: string[], p: number): EngineResult {
  const trans: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(0));
  for (let i = 1; i < h.length; i++) { const f = digitAt(h[i-1]!, p); const t2 = digitAt(h[i]!, p); if (f !== null && t2 !== null) trans[f]![t2]++; }
  const last = digitAt(h[h.length - 1]!, p); if (last === null) return eFreqAll(h, p);
  const row = trans[last]!; const t = Math.max(1, totalCount(row)); const d = argmax(row);
  return eng(d, (row[d]! / t) * 100, 1.5);
}
function eMarkov2(h: string[], p: number): EngineResult {
  if (h.length < 3) return eMarkov1(h, p);
  const trans: Record<string, number[]> = {};
  for (let i = 2; i < h.length; i++) {
    const p2 = digitAt(h[i-2]!, p); const p1 = digitAt(h[i-1]!, p); const curr = digitAt(h[i]!, p);
    if (p2 === null || p1 === null || curr === null) continue;
    const key = `${p2}_${p1}`;
    if (!trans[key]) trans[key] = new Array(10).fill(0);
    trans[key]![curr]++;
  }
  const l2 = digitAt(h[h.length-2]!, p); const l1 = digitAt(h[h.length-1]!, p);
  if (l2 === null || l1 === null) return eMarkov1(h, p);
  const row = trans[`${l2}_${l1}`]; if (!row) return eMarkov1(h, p);
  const t = Math.max(1, totalCount(row)); const d = argmax(row);
  return eng(d, (row[d]! / t) * 100, 1.6);
}
function eMarkov3(h: string[], p: number): EngineResult {
  if (h.length < 4) return eMarkov1(h, p);
  const trans: Record<string, number[]> = {};
  for (let i = 3; i < h.length; i++) {
    const p3 = digitAt(h[i-3]!, p); const p2 = digitAt(h[i-2]!, p); const p1 = digitAt(h[i-1]!, p); const curr = digitAt(h[i]!, p);
    if (p3===null||p2===null||p1===null||curr===null) continue;
    const key = `${p3}_${p2}_${p1}`;
    if (!trans[key]) trans[key] = new Array(10).fill(0);
    trans[key]![curr]++;
  }
  const d3=digitAt(h[h.length-3]!,p); const d2=digitAt(h[h.length-2]!,p); const d1=digitAt(h[h.length-1]!,p);
  if (d3===null||d2===null||d1===null) return eMarkov1(h,p);
  const row = trans[`${d3}_${d2}_${d1}`]; if (!row) return eMarkov2(h, p);
  const t = Math.max(1, totalCount(row)); const d = argmax(row);
  return eng(d, (row[d]! / t) * 100, 1.5);
}
function eCrossMarkov(allH: string[][], srcP: number, tgtP: number): EngineResult {
  const trans: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(0));
  const hSrc = allH[srcP]!; const hTgt = allH[tgtP]!;
  const len = Math.min(hSrc.length, hTgt.length);
  for (let i = 0; i < len; i++) {
    const f = parseInt(hSrc[i]!); const t2 = parseInt(hTgt[i]!);
    if (!isNaN(f) && !isNaN(t2)) trans[f]![t2]++;
  }
  const lastSrc = hSrc[hSrc.length-1]; const from = lastSrc !== undefined ? parseInt(lastSrc) : NaN;
  if (isNaN(from)) return eFreqAll(allH[tgtP]!.map(d => d + "000"), 0);
  const row = trans[from]!; const t = Math.max(1, totalCount(row)); const d = argmax(row);
  return eng(d, (row[d]! / t) * 100, 1.2);
}
function eCyclicMarkov(h: string[], p: number): EngineResult {
  const n = h.length; const phase = n % 6;
  const pairs: Array<{ val: string; next: string }> = [];
  for (let i = phase; i < h.length - 6; i += 6) { if (h[i] && h[i+6]) pairs.push({ val: h[i]!, next: h[i+6]! }); }
  if (pairs.length < 3) return eMarkov1(h, p);
  const trans: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(0));
  for (const { val, next } of pairs) { const f = digitAt(val, p); const t2 = digitAt(next, p); if (f!==null&&t2!==null) trans[f]![t2]++; }
  const last = digitAt(h[h.length-1]!, p); if (last === null) return eMarkov1(h, p);
  const row = trans[last]!; const t = Math.max(1, totalCount(row)); if (t===0) return eMarkov1(h,p);
  const d = argmax(row);
  return eng(d, (row[d]! / t) * 100, 1.3);
}

// ─── D. BAYESIAN ──────────────────────────────────────────────────────────────

function eBayes(h: string[], p: number, decay: number, w: number): EngineResult {
  const weights = new Array(10).fill(1);
  for (let i = 0; i < h.length; i++) { const d = digitAt(h[i]!, p); if (d!==null) weights[d] += Math.pow(decay, h.length-1-i); }
  const t = weights.reduce((a: number, b: number) => a + b, 0); const d = argmax(weights);
  return eng(d, (weights[d]! / t) * 100, w);
}
function eBayesFast(h: string[], p: number) { return eBayes(h, p, 0.80, 1.2); }
function eBayesNorm(h: string[], p: number) { return eBayes(h, p, 0.93, 1.4); }
function eBayesSlow(h: string[], p: number) { return eBayes(h, p, 0.98, 1.1); }
function eBayesCombined(h: string[], p: number): EngineResult {
  const votes = new Array(10).fill(0);
  [eBayesFast(h,p), eBayesNorm(h,p), eBayesSlow(h,p)].forEach(e => { votes[e.digit] += e.score; });
  const d = argmax(votes); return eng(d, votes[d]! / 3, 1.5);
}

// ─── E. GAP ───────────────────────────────────────────────────────────────────

function eGapOverdue(h: string[], p: number): EngineResult {
  const lastSeen = new Array(10).fill(-1);
  for (let i = 0; i < h.length; i++) { const d = digitAt(h[i]!, p); if (d!==null) lastSeen[d]=i; }
  const n = h.length; const gaps = lastSeen.map((idx: number) => idx===-1 ? n*2 : n-1-idx);
  const d = argmax(gaps); return eng(d, Math.min(100, (gaps[d]!/15)*60), 1.1);
}
function eGapHot(h: string[], p: number): EngineResult {
  const lastSeen = new Array(10).fill(-1);
  for (let i = 0; i < h.length; i++) { const d = digitAt(h[i]!, p); if (d!==null) lastSeen[d]=i; }
  const n = h.length; const recency = lastSeen.map((idx: number) => idx===-1 ? 0 : idx+1);
  const d = argmax(recency); return eng(d, (recency[d]!/n)*100, 1.0);
}
function eGapAvg(h: string[], p: number): EngineResult {
  const gaps: number[][] = Array.from({ length: 10 }, () => []);
  const lastIdx = new Array(10).fill(-1);
  for (let i = 0; i < h.length; i++) { const d = digitAt(h[i]!, p); if (d!==null) { if (lastIdx[d]!==-1) gaps[d]!.push(i-lastIdx[d]!); lastIdx[d]=i; } }
  const n = h.length; const scores = new Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    if (!gaps[d]!.length) { scores[d]=50; continue; }
    const avg = gaps[d]!.reduce((a,b)=>a+b,0)/gaps[d]!.length;
    const cur = lastIdx[d]===-1 ? n : n-1-lastIdx[d];
    scores[d] = Math.min(100, (cur/avg)*50);
  }
  const d = argmax(scores); return eng(d, scores[d]!, 1.2);
}
function eGapPeriodic(h: string[], p: number): EngineResult {
  if (h.length < 20) return eGapOverdue(h, p);
  const gaps: number[][] = Array.from({ length: 10 }, () => []);
  const lastIdx = new Array(10).fill(-1);
  for (let i = 0; i < h.length; i++) { const d = digitAt(h[i]!, p); if (d!==null) { if (lastIdx[d]!==-1) gaps[d]!.push(i-lastIdx[d]!); lastIdx[d]=i; } }
  const stdDevs = gaps.map(g => { if (g.length<2) return 999; const m=g.reduce((a,b)=>a+b,0)/g.length; return Math.sqrt(g.reduce((a,x)=>a+(x-m)**2,0)/g.length); });
  const n = h.length; const scores = new Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    if (!gaps[d]!.length) continue;
    const m = gaps[d]!.reduce((a,b)=>a+b,0)/gaps[d]!.length;
    const cur = lastIdx[d]===-1 ? n : n-1-lastIdx[d];
    scores[d] = (1/(1+stdDevs[d]!))*50 + Math.min(1, cur/m)*50;
  }
  const d = argmax(scores); return eng(d, scores[d]!, 1.3);
}
function eGapVariance(h: string[], p: number): EngineResult {
  const c = digitFreqArr(h, p); const t = Math.max(1, totalCount(c)); const exp = t/10;
  const dev = c.map(x => Math.abs(x-exp)); const d = argmax(dev);
  return eng(d, Math.min(100, (dev[d]!/exp)*50+25), 0.9);
}

// ─── F. STATISTICS ────────────────────────────────────────────────────────────

function eEntropy(h: string[], p: number): EngineResult {
  const c = digitFreqArr(h.slice(-30), p); const d = argmax(c);
  return eng(d, (1-normalizedEntropy(c))*100, 1.0);
}
function eChiSq(h: string[], p: number): EngineResult {
  const c = digitFreqArr(h, p); const t = Math.max(1,totalCount(c)); const exp = t/10;
  const res = c.map(obs => (obs-exp)/Math.sqrt(exp)); const d = argmax(res);
  return eng(d, Math.min(100, Math.abs(res[d]!)*15+30), 1.1);
}
function eZScore(h: string[], p: number): EngineResult {
  const ws: number[][] = []; const wS = 10;
  for (let i = 0; i+wS <= h.length; i+=wS) ws.push(digitFreqArr(h.slice(i,i+wS),p));
  if (ws.length < 2) return eFreqAll(h, p);
  const means = new Array(10).fill(0); const stds = new Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    const vals = ws.map(w=>w[d]!); means[d]=vals.reduce((a,b)=>a+b,0)/vals.length;
    stds[d]=Math.sqrt(vals.reduce((a,x)=>a+(x-means[d])**2,0)/vals.length);
  }
  const rc = digitFreqArr(h.slice(-wS), p);
  const z = rc.map((c,d) => stds[d]>0 ? (c-means[d])/stds[d] : 0);
  const d = argmax(z); return eng(d, 50+z[d]!*15, 1.2);
}
function ePoisson(h: string[], p: number): EngineResult {
  const c = digitFreqArr(h, p); const t = Math.max(1,totalCount(c));
  const r10 = digitFreqArr(h.slice(-10), p);
  const s = r10.map((obs,d) => ((obs-1)/Math.max(0.1,1))*0.4+(c[d]!/t)*60);
  const d = argmax(s); return eng(d, s[d]!+30, 1.0);
}
function eConcentration(h: string[], p: number): EngineResult {
  const c = digitFreqArr(h.slice(-30), p); const t = Math.max(1,totalCount(c));
  const d = argmax(c); const topPct = c[d]!/t;
  return eng(d, Math.min(100, (topPct-0.1)/0.1*50+50), 1.1);
}

// ─── G. PATTERN ───────────────────────────────────────────────────────────────

function ePattern(h: string[], p: number, period: number): EngineResult {
  if (h.length < period*2+1) return eFreqAll(h, p);
  const last = h.slice(-period); const votes = new Array(10).fill(0);
  for (let i = period; i < h.length-period; i++) {
    const win = h.slice(i-period, i); let matches = 0;
    for (let j = 0; j < period; j++) { if (digitAt(win[j]!,p)===digitAt(last[j]!,p)) matches++; }
    if (matches >= Math.ceil(period*0.6)) { const nd = digitAt(h[i]!,p); if (nd!==null) votes[nd]++; }
  }
  const d = argmax(votes); const t = totalCount(votes);
  return eng(d, t>0 ? (votes[d]!/t)*100 : 10, t>2 ? 1.3 : 0.8);
}
function eSumTarget(h: string[], p: number): EngineResult {
  if (h.length < 5) return eFreqAll(h, p);
  const sums = h.filter(v=>v.length===4).map(v=>v.split("").reduce((a,c)=>a+parseInt(c),0));
  const avg = sums.reduce((a,b)=>a+b,0)/sums.length;
  const last = h[h.length-1]!; if (!last||last.length<4) return eFreqAll(h,p);
  const other = last.split("").reduce((a,c,i)=>i===p?a:a+parseInt(c),0);
  const target = Math.max(0, Math.min(9, Math.round(avg-other)));
  return eng(target, 50, 0.9);
}
function eMirror(h: string[], p: number): EngineResult {
  if (h.length < 4) return eFreqAll(h, p);
  const rec = h.slice(-6).map(v=>digitAt(v,p)); if (rec.some(d=>d===null)) return eFreqAll(h,p);
  const votes = new Array(10).fill(0);
  const uniq = [...new Set(rec.filter(d=>d!==null))];
  if (uniq.length===2) { const lastD=rec[rec.length-1]; const other=uniq.find(d=>d!==lastD); if (other!=null) votes[other]+=3; }
  const c = digitFreqArr(h, p); votes[argmax(c)]+=1;
  const d = argmax(votes); return eng(d, votes[d]!>2?70:40, 0.9);
}
function ePair(h: string[], p: number): EngineResult {
  if (h.length < 5) return eFreqAll(h, p);
  const pairs: Record<string,number> = {};
  for (let i = 1; i < h.length; i++) { const f=digitAt(h[i-1]!,p); const t2=digitAt(h[i]!,p); if (f!==null&&t2!==null) pairs[`${f}_${t2}`]=(pairs[`${f}_${t2}`]??0)+1; }
  const last = digitAt(h[h.length-1]!, p); if (last===null) return eFreqAll(h,p);
  const votes = new Array(10).fill(0);
  for (let t2 = 0; t2 < 10; t2++) votes[t2]=pairs[`${last}_${t2}`]??0;
  const d = argmax(votes); const t = totalCount(votes);
  return eng(d, t>0?(votes[d]!/t)*100:10, 1.2);
}

// ─── H. HOT/COLD ──────────────────────────────────────────────────────────────

function eHot(h: string[], p: number): EngineResult {
  const c = digitFreqArr(h.slice(-8), p); const d = argmax(c); const t = Math.max(1,totalCount(c));
  return eng(d, (c[d]!/t)*100, 1.1);
}
function eCold(h: string[], p: number): EngineResult {
  const ac = digitFreqArr(h, p); const rc = digitFreqArr(h.slice(-20), p);
  const tA = Math.max(1,totalCount(ac)); const tR = Math.max(1,totalCount(rc));
  let best=-Infinity, bd=0;
  for (let d=0;d<10;d++) { const diff=ac[d]!/tA-rc[d]!/tR; if (diff>best){best=diff;bd=d;} }
  return eng(bd, 40+best*200, 1.0);
}
function eWarm(h: string[], p: number): EngineResult {
  const ac=digitFreqArr(h,p); const r20=digitFreqArr(h.slice(-20),p); const r10=digitFreqArr(h.slice(-10),p);
  const tA=Math.max(1,totalCount(ac)); const t20=Math.max(1,totalCount(r20)); const t10=Math.max(1,totalCount(r10));
  const s = ac.map((_,d)=>(ac[d]!/tA+r20[d]!/t20+r10[d]!/t10)/3*100-Math.abs(r10[d]!/t10-ac[d]!/tA)*50);
  const d=argmax(s); return eng(d,s[d]!+30,1.2);
}
function eContrarian(h: string[], p: number): EngineResult {
  const rc=digitFreqArr(h.slice(-10),p); const ac=digitFreqArr(h,p);
  const tR=Math.max(1,totalCount(rc)); const tA=Math.max(1,totalCount(ac));
  let most=-Infinity, ovD=0;
  for (let d=0;d<10;d++) { const ov=rc[d]!/tR-ac[d]!/tA; if(ov>most){most=ov;ovD=d;} }
  const sorted=[...ac.entries()].sort((a,b)=>b[1]-a[1]);
  const target=sorted.find(([d])=>d!==ovD)?.[0]??sorted[1]![0]!;
  return eng(target, 35+most*150, 0.8);
}

// ─── I. ENSEMBLE ──────────────────────────────────────────────────────────────

function eWeightedVote(bases: EngineResult[]): EngineResult {
  const w=new Array(10).fill(0); for(const e of bases) w[e.digit]+=e.score*e.weight;
  const d=argmax(w); const t=w.reduce((a:number,b:number)=>a+b,0);
  return eng(d, t>0?(w[d]!/t)*100:10, 2.0);
}
function eBoosted(h: string[], p: number, bases: EngineResult[]): EngineResult {
  const rc=digitFreqArr(h.slice(-5),p); const w=new Array(10).fill(0);
  for(const e of bases) { const boost=rc[e.digit]!>0?1.5:0.7; w[e.digit]+=e.score*e.weight*boost; }
  const d=argmax(w); const t=w.reduce((a:number,b:number)=>a+b,0);
  return eng(d, t>0?(w[d]!/t)*100:10, 2.0);
}
function eNeural(bases: EngineResult[]): EngineResult {
  const votes=new Array(10).fill(0); for(const e of bases) votes[e.digit]++;
  const mx=Math.max(...votes); const ex=votes.map((v:number)=>Math.exp(v-mx));
  const exS=ex.reduce((a:number,b:number)=>a+b,0); const probs=ex.map((e:number)=>e/exS);
  const d=argmax(probs); return eng(d, probs[d]!*100, 2.0);
}
function eMeta(bases: EngineResult[]): EngineResult {
  const vm=new Array(10).fill(0); for(const e of bases) vm[e.digit]++;
  const maj=argmax(vm); const ref=new Array(10).fill(0);
  for(const e of bases) { const boost=e.digit===maj?1.8:0.6; ref[e.digit]+=e.score*e.weight*boost; }
  const d=argmax(ref); const t=ref.reduce((a:number,b:number)=>a+b,0);
  return eng(d, t>0?(ref[d]!/t)*100:10, 2.5);
}

// ─── Backtest ─────────────────────────────────────────────────────────────────

function backtest(h: string[], p: number): number {
  if (h.length < 30) return 40;
  let correct=0; const trials=Math.min(20, h.length-25);
  for (let t=0;t<trials;t++) {
    const slice=h.slice(t,t+25); const actual=digitAt(h[t+25]!,p);
    if (actual===null) continue;
    if (eBayesNorm(slice,p).digit===actual) correct++;
  }
  return Math.round((correct/Math.max(1,trials))*100);
}

// ─── Main analyser ────────────────────────────────────────────────────────────

function analysePos(h: string[], p: number, allH: string[][]): { predicted: number; score: number } {
  const bases: EngineResult[] = [
    eFreqAll(h,p), eFreq20(h,p), eFreq10(h,p), eFreqWeighted(h,p), eFreqSeasonal(h,p),
    eMomentum(h,p), eMomShort(h,p), eAccel(h,p), eLinearTrend(h,p), eVolatility(h,p),
    eMarkov1(h,p), eMarkov2(h,p), eMarkov3(h,p), eCrossMarkov(allH,(p+1)%4,p), eCyclicMarkov(h,p),
    eBayesFast(h,p), eBayesNorm(h,p), eBayesSlow(h,p), eBayesCombined(h,p),
    eGapOverdue(h,p), eGapHot(h,p), eGapAvg(h,p), eGapPeriodic(h,p), eGapVariance(h,p),
    eEntropy(h,p), eChiSq(h,p), eZScore(h,p), ePoisson(h,p), eConcentration(h,p),
    ePattern(h,p,3), ePattern(h,p,5), eSumTarget(h,p), eMirror(h,p), ePair(h,p),
    eHot(h,p), eCold(h,p), eWarm(h,p), eContrarian(h,p),
  ];
  const ensembles=[eWeightedVote(bases), eBoosted(h,p,bases), eNeural(bases), eMeta(bases)];
  const all=[...bases,...ensembles];
  const wvm=new Array(10).fill(0);
  for(const e of all) wvm[e.digit]+=e.score*e.weight;
  const predicted=argmax(wvm);
  const vm=new Array(10).fill(0); for(const e of all) vm[e.digit]++;
  const agreement=Math.round((vm[predicted]!/all.length)*100);
  return { predicted, score: agreement };
}

function computeConf(positions: Array<{predicted:number;score:number}>, history: string[]): number {
  const avgAgr = positions.reduce((a,p)=>a+p.score,0)/4;
  const avgEnt = [0,1,2,3].reduce((s,p)=>s+normalizedEntropy(digitFreqArr(history,p)),0)/4;
  const entropy = (1-avgEnt)*100;
  const allC = [0,1,2,3].map(p=>digitFreqArr(history,p));
  const concentration = allC.reduce((s,c)=>{const t=Math.max(1,totalCount(c));return s+c[argmax(c)]!/t*100;},0)/4;
  const dataQuality = Math.min(100,(history.length/60)*100);
  const bt = [0,1,2,3].map(p=>backtest(history,p));
  const backtestAvg = bt.reduce((a,b)=>a+b,0)/4;
  let stab=0;
  if (history.length >= 60) {
    for (let p=0;p<4;p++) {
      const w1=argmax(digitFreqArr(history.slice(-60,-40),p));
      const w2=argmax(digitFreqArr(history.slice(-40,-20),p));
      const w3=argmax(digitFreqArr(history.slice(-20),p));
      if (w1===w2||w2===w3||w1===w3) stab++;
    }
  }
  const stability=(stab/4)*100;
  const total=avgAgr*0.25+entropy*0.10+concentration*0.10+dataQuality*0.10+backtestAvg*0.15+stability*0.10+(avgAgr*0.15)+(avgAgr*0.05);
  return Math.min(100, Math.max(0, Math.round(total)));
}

export interface RunResult {
  predicted4D: string;
  signal: boolean;
  confidence: number;
  asP: number;
  kopP: number;
  kepalaP: number;
  ekorP: number;
  bbfs: string;
  totalData: number;
}

export function runPrediction(
  rows: Array<Record<string, string | null>>,
  session: DrawTime
): RunResult | null {
  const key = drawKey(session);
  const history = rows
    .sort((a, b) => String(a["drawDate"] ?? "").localeCompare(String(b["drawDate"] ?? "")))
    .map(r => r[key] ?? "")
    .filter(v => v.length === 4);

  if (history.length < 5) return null;

  const allH = [0,1,2,3].map(p => history.map(v => v[p] ?? ""));
  const positions = [0,1,2,3].map(p => analysePos(history, p, allH));
  const predicted4D = positions.map(p => p.predicted).join("");

  // Per-position confidence scores (use bayesian normal as representative score)
  const posScores = [0,1,2,3].map(p => {
    const r = eBayesNorm(history, p); return Math.round(r.score);
  });

  const confidence = computeConf(positions, history);
  const signal = confidence >= 60;

  // Top 4 digits per position for BBFS
  const bbfsCandidates = [0,1,2,3].map(p => {
    const wvm = new Array(10).fill(0);
    const bases: EngineResult[] = [
      eFreqAll(history,p), eFreq20(history,p), eMarkov1(history,p), eBayesNorm(history,p), eGapAvg(history,p)
    ];
    for(const e of bases) wvm[e.digit] += e.score * e.weight;
    return [...(wvm as number[]).entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([d])=>String(d));
  });

  return {
    predicted4D,
    signal,
    confidence,
    asP: posScores[0]!,
    kopP: posScores[1]!,
    kepalaP: posScores[2]!,
    ekorP: posScores[3]!,
    bbfs: JSON.stringify(bbfsCandidates),
    totalData: history.length,
  };
}
