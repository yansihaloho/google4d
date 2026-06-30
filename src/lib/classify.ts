
const KECIL_2D = new Set([
  "00","01","02","03","04","10","11","12","13","19",
  "20","21","22","28","29","30","31","37","38","39",
  "40","46","47","48","49","55","56","57","58","64",
  "65","66","67","73","74","75","76","82","83","84",
  "85","91","92","93","94",
]);

const BESAR_2D = new Set([
  "05","06","07","08","09","14","15","16","17","18",
  "23","24","25","26","27","32","33","34","35","36",
  "41","42","43","44","45","50","51","52","53","54",
  "59","60","61","62","63","68","69","70","71","72",
  "77","78","79","80","81","86","87","88","89","90",
  "95","96","97","98","99",
]);

const GENAP_2D = new Set([
  "00","02","04","06","08","11","13","15","17","20",
  "22","24","26","29","31","33","35","38","40","42",
  "44","47","49","51","53","56","58","60","62","65",
  "67","69","71","74","76","78","80","83","85","87",
  "89","92","94","96","98",
]);

const GANJIL_2D = new Set([
  "01","03","05","07","09","10","12","14","16","18",
  "19","21","23","25","27","28","30","32","34","36",
  "37","39","41","43","45","46","48","50","52","54",
  "55","57","59","61","63","64","66","68","70","72",
  "73","75","77","79","81","82","84","86","88","90",
  "91","93","95","97","99",
]);

export function getFront2D(val: string | null): string | null {
  if (!val || val.length < 2) return null;
  return val.slice(0, 2);
}

export function isBesar(val: string | null): boolean | null {
  const f = getFront2D(val);
  if (!f) return null;
  return BESAR_2D.has(f);
}

export function isKecil(val: string | null): boolean | null {
  const f = getFront2D(val);
  if (!f) return null;
  return KECIL_2D.has(f);
}

export function isGanjil(val: string | null): boolean | null {
  const f = getFront2D(val);
  if (!f) return null;
  return GANJIL_2D.has(f);
}

export function isGenap(val: string | null): boolean | null {
  const f = getFront2D(val);
  if (!f) return null;
  return GENAP_2D.has(f);
}

export function isKecilEkor(val: string | null): boolean | null {
  if (!val || val.length < 4) return null;
  const ekor = parseInt(val[3]);
  if (isNaN(ekor)) return null;
  return ekor <= 4;
}

export function isBesarEkor(val: string | null): boolean | null {
  if (!val || val.length < 4) return null;
  const ekor = parseInt(val[3]);
  if (isNaN(ekor)) return null;
  return ekor >= 5;
}

export function isGenapEkor(val: string | null): boolean | null {
  if (!val || val.length < 4) return null;
  const ekor = parseInt(val[3]);
  if (isNaN(ekor)) return null;
  return ekor % 2 === 0;
}

export function isGanjilEkor(val: string | null): boolean | null {
  if (!val || val.length < 4) return null;
  const ekor = parseInt(val[3]);
  if (isNaN(ekor)) return null;
  return ekor % 2 !== 0;
}

export function classify(val: string | null): { ganjil: boolean; besar: boolean } | null {
  if (!val) return null;
  const besarResult = isBesar(val);
  const ganjilResult = isGanjil(val);
  if (besarResult === null || ganjilResult === null) return null;
  return { ganjil: ganjilResult, besar: besarResult };
}

/**
 * Count how many of the 4 circular 2D pairs (AB, BC, CD, DA) from a 4D result
 * appear in the user's nomor taruhan set.
 * Max = 4.
 */
export function computeHits(val4D: string | null, taruhanSet: Set<string>): number {
  if (!val4D || val4D.length < 4) return 0;
  const [a, b, c, d] = val4D.split("");
  const pairs = [`${a}${b}`, `${b}${c}`, `${c}${d}`, `${d}${a}`];
  return pairs.filter((p) => taruhanSet.has(p)).length;
}
