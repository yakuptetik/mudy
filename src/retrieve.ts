import type { Chunk, Dataset, Program } from './data.ts';

const TR_FOLD: Record<string, string> = {
  ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g',
  ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c',
};

export function fold(s: string): string {
  return s.replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => TR_FOLD[c] ?? c).toLowerCase();
}

const STOPWORDS = new Set([
  'bir', 've', 'ile', 'icin', 'gibi', 'daha', 'cok', 'ne', 'nedir', 'mi', 'mu', 'mi',
  'bu', 'su', 'o', 'da', 'de', 'ki', 'ama', 'veya', 'ya', 'her', 'en', 'kadar',
  'nasil', 'kac', 'var', 'yok', 'olan', 'olur', 'oluyor', 'mudanya', 'universitesi',
  'universite', 'the', 'a', 'an', 'of', 'to', 'is', 'are', 'do', 'does', 'i', 'you',
  'in', 'on', 'at', 'for', 'and', 'or', 'what', 'how', 'can', 'my', 'me', 'it',
]);

/** Kiril / Arapca sorulari Ingilizce program adina baglayan kokler. */
const DIL_KOPRUSU: Array<[RegExp, string]> = [
  [/компьютерн/i, 'computer'],
  [/инженер/i, 'engineering'],
  [/психолог/i, 'psychology'],
  [/сестрин|медсестр/i, 'nursing'],
  [/бизнес/i, 'business'],
  [/экономик/i, 'economics'],
  [/финанс/i, 'finance'],
  [/дизайн/i, 'design'],
  [/гастроном/i, 'gastronomy'],
  [/анестез/i, 'anesthesia'],
  [/физиотерап/i, 'physiotherapy'],
  [/эквивалент|признан/i, 'denklik diploma'],
  [/диплом/i, 'diploma'],
  [/هندسة/i, 'engineering'],
  [/حاسوب|كمبيوتر/i, 'computer'],
  [/نفس/i, 'psychology'],
];

/** Apostrof varyantlarini (o‘ o' oʻ) duz latin'e indirger. */
function normalizeScript(s: string): string {
  return s
    .replace(/[\u2018\u2019\u02BB\u02BC\uA78Cʻʼ`´]/g, "'")
    .replace(/['']+/g, "'");
}

export function tokenize(s: string): string[] {
  const base = fold(normalizeScript(s))
    .replace(/[^a-z0-9\u0400-\u04ff\u0600-\u06ff]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));

  const extra: string[] = [];
  for (const [re, en] of DIL_KOPRUSU) {
    if (re.test(s)) extra.push(...en.split(' '));
  }
  return extra.length ? [...base, ...extra] : base;
}

export interface DilBilgisi {
  kod: 'tr' | 'en' | 'ru' | 'uz' | 'diger';
  etiket: string;
  /** Turkce disindaki her dil: aday uluslararasi ogrenci kabul edilir */
  yabanci: boolean;
}

/**
 * Sorunun dilini kestirir.
 * Oncelik: yazim sistemi (Kiril/Arap) > ozbek/turkmen ipuclari > EN vs TR skor.
 * Tek bir Turkce harf (ornegin "why ı am") Ingilizceyi ezmemeli.
 */
export function detectLanguage(question: string): DilBilgisi {
  if (/[\u0400-\u04FF]/.test(question)) {
    return { kod: 'ru', etiket: 'Rusça', yabanci: true };
  }
  if (/[\u0600-\u06FF]/.test(question)) {
    return { kod: 'diger', etiket: 'Arapça', yabanci: true };
  }

  const raw = normalizeScript(question);
  const q = fold(raw);

  // Ozbekce Latin: qaysi, bo'lim, mavjud, qancha, nima... (Turkcede "q" neredeyse yok)
  const uzHits = (q.match(/\b(qaysi|qancha|qanday|nima|mavjud|bolim|bo'?lim|universitet|talaba|narx|o'?qish)\b/g) ?? []).length
    + (/[ʻʼ']/.test(raw) && /\b(o|g)['ʻʼ]/.test(raw) ? 1 : 0)
    + (/\bq[aeiouy]/.test(q) ? 1 : 0);

  if (uzHits >= 2) {
    return { kod: 'uz', etiket: 'Özbekçe', yabanci: true };
  }

  const trHits = (q.match(/\b(ne|nasil|kac|nerede|mi|mu|icin|var|bolum|ucret|kayit|ogrenci|misiniz|nedir|neden|tercih|hangi|neler)\b/g) ?? []).length;
  const enHits = (q.match(/\b(what|why|how|where|much|when|the|is|are|can|fee|tuition|price|program|department|student|apply|dorm|choose|university|diploma|because|should|study|which|available)\b/g) ?? []).length;
  const trHarf = (question.match(/[ıİşŞğĞçÇöÖüÜ]/g) ?? []).length;

  if (enHits >= 2 && enHits >= trHits && trHarf <= 2) {
    return { kod: 'en', etiket: 'İngilizce', yabanci: true };
  }
  if (trHarf >= 2 || trHits > enHits) {
    return { kod: 'tr', etiket: 'Türkçe', yabanci: false };
  }
  if (enHits > 0) return { kod: 'en', etiket: 'İngilizce', yabanci: true };
  if (uzHits > 0) return { kod: 'uz', etiket: 'Özbekçe', yabanci: true };
  return { kod: 'tr', etiket: 'Türkçe', yabanci: false };
}

export interface Intents {
  ucret: boolean;
  liste: boolean;
  konum: boolean;
  uluslararasi: boolean;
}

export function detectIntents(question: string): Intents {
  const q = fold(normalizeScript(question));
  return {
    ucret: /(ucret|fiyat|kac para|kaca|ne kadar|odeme|taksit|burs|indirim|tuition|fee|price|cost|payment|scholarship|сколько|стоим|цена|обучение|qancha|narx)/.test(q),
    // "hangi bolumler", "qaysi bo'limlar", "какие факультеты", "what departments"
    liste: /(hangi bolum|bolumler|bolum listesi|neler var|programlar|program listesi|what (departments|programs)|list of|which (departments|programs)|qaysi (bo'?lim|fakultet)|bo'?limlar|mavjud|какие (факультет|программ|специальност)|какие отделени|список (программ|факультет))/.test(q),
    konum: /(nerede|nerde|adres|konum|ulasim|nasil gid|nasil gel|harita|yol|otobus|servis|kampus nerede|where|address|location|direction|how to get|map|campus|qayerda|где|как добраться)/.test(q),
    uluslararasi: /(uluslararasi|yabanci|yurt disi|international|foreign|usd|dolar|visa|vize|oturma izni|residence|xorijiy|иностранн)/.test(q),
  };
}

/** Programin eslestirmede kullanilacak ad varyantlari: Turkce + resmi Ingilizce adlar */
function nameVariants(program: Program): string[] {
  return [program.ad_sade, ...(program.ingilizce_adlar ?? [])];
}

function tokenMatches(qTokens: string[], nameToken: string): boolean {
  return qTokens.some(
    (qt) =>
      qt === nameToken ||
      (qt.length >= 3 && nameToken.startsWith(qt)) ||
      (nameToken.length >= 3 && qt.startsWith(nameToken)),
  );
}

interface ProgramIndex {
  programlar: Program[];
  /** token -> kac programin adinda geciyor (ayirt edicilik olcusu) */
  df: Map<string, number>;
}

let programIndexCache: ProgramIndex | null = null;

function programIndex(programlar: Program[]): ProgramIndex {
  if (programIndexCache && programIndexCache.programlar === programlar) return programIndexCache;

  const df = new Map<string, number>();
  for (const p of programlar) {
    const tokens = new Set(nameVariants(p).flatMap(tokenize));
    for (const t of tokens) df.set(t, (df.get(t) ?? 0) + 1);
  }
  programIndexCache = { programlar, df };
  return programIndexCache;
}

/**
 * Ad varyantlari icinde en iyi eslesme oranini dondurur.
 *
 * Sadece orana bakmak yetmiyor: "Gastronomi" sorusu "Gastronomi ve Mutfak
 * Sanatlari" adinin 1/3'unu tutuyor ve esigin altinda kaliyordu. Bu yuzden
 * token'in ayirt ediciligi de hesaba katiliyor - "gastronomi" tek bir programda
 * geciyorsa tek basina yeterli sinyaldir.
 */
function programScore(qTokens: string[], program: Program, df: Map<string, number>): number {
  let best = 0;

  for (const variant of nameVariants(program)) {
    const nameTokens = tokenize(variant);
    if (nameTokens.length === 0) continue;

    const matched = nameTokens.filter((nt) => tokenMatches(qTokens, nt));
    if (matched.length === 0) continue;

    const ratio = matched.length / nameTokens.length;
    const ayirtEdici = matched.some((t) => (df.get(t) ?? 99) <= 2);
    const skor = ratio + (ayirtEdici ? 0.6 : 0);

    if (skor > best) best = skor;
  }
  return best;
}

export function matchPrograms(question: string, dataset: Dataset, limit = 6): Program[] {
  const qTokens = tokenize(question);
  if (qTokens.length === 0) return [];

  const { df } = programIndex(dataset.programlar);
  const ingilizceIster = /\b(ingilizce|english)\b/.test(fold(question));

  const scored = dataset.programlar
    .map((p) => ({ p, score: programScore(qTokens, p, df) }))
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
      // dil tercihi belirtilmediyse Turkce programi one al
      const aEn = a.p.egitim_dili === 'İngilizce';
      const bEn = b.p.egitim_dili === 'İngilizce';
      if (aEn !== bEn) return ingilizceIster ? (aEn ? -1 : 1) : aEn ? 1 : -1;
      return a.p.ad.localeCompare(b.p.ad, 'tr');
    });

  return scored.slice(0, limit).map((x) => x.p);
}

interface ChunkIndex {
  chunk: Chunk;
  /** token -> alan agirligi (baslik/ornek soru = 3, govde = 1) */
  weights: Map<string, number>;
}

let indexCache: { chunks: Chunk[]; index: ChunkIndex[]; idf: Map<string, number> } | null = null;

function buildIndex(chunks: Chunk[]) {
  if (indexCache && indexCache.chunks === chunks) return indexCache;

  const index: ChunkIndex[] = chunks.map((chunk) => {
    const weights = new Map<string, number>();
    const add = (text: string, weight: number) => {
      for (const t of tokenize(text)) {
        weights.set(t, Math.max(weights.get(t) ?? 0, weight));
      }
    };
    add(chunk.baslik, 3);
    add(chunk.ornek_sorular.join(' '), 3);
    add(chunk.kategori_etiket, 2);
    add(chunk.icerik, 1);
    return { chunk, weights };
  });

  const df = new Map<string, number>();
  for (const entry of index) {
    for (const t of entry.weights.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = index.length || 1;
  const idf = new Map<string, number>();
  for (const [t, count] of df) idf.set(t, Math.log(1 + n / count));

  indexCache = { chunks, index, idf };
  return indexCache;
}

export function searchContent(question: string, dataset: Dataset, limit = 4): Chunk[] {
  const qTokens = [...new Set(tokenize(question))];
  if (qTokens.length === 0) return [];

  const { index, idf } = buildIndex(dataset.parcalar);

  const scored = index
    .map(({ chunk, weights }) => {
      let score = 0;
      for (const t of qTokens) {
        const w = weights.get(t);
        if (w) score += w * (idf.get(t) ?? 1);
      }
      return { chunk, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  // en iyi sonucun cok altinda kalan parcalari alma; alakasiz baglam cevabi bozuyor
  const esik = scored[0].score * 0.35;
  return scored.filter((x) => x.score >= esik).slice(0, limit).map((x) => x.chunk);
}

export interface Attachment {
  tur: 'link' | 'pdf' | 'harita' | 'gorsel' | 'telefon' | 'eposta';
  etiket: string;
  deger: string;
}

export interface Retrieval {
  dil: DilBilgisi;
  intents: Intents;
  programlar: Program[];
  parcalar: Chunk[];
  kampusDahil: boolean;
  ekler: Attachment[];
  bosSonuc: boolean;
}

function etiketle(dil: DilBilgisi, tr: string, en: string, ru: string, uz?: string): string {
  if (dil.kod === 'ru') return ru;
  if (dil.kod === 'uz') return uz ?? en;
  if (dil.kod === 'en' || dil.yabanci) return en;
  return tr;
}

export function retrieve(question: string, dataset: Dataset): Retrieval {
  const dil = detectLanguage(question);
  const intents = detectIntents(question);
  if (dil.yabanci) intents.uluslararasi = true;
  const programlar = matchPrograms(question, dataset);
  let parcalar = searchContent(question, dataset);
  const kampusDahil = intents.konum;

  const q = fold(question);
  if (/(neden .*mudanya|why (i |ı )?am choose|why choose|why study|prefer mudanya|почему)/.test(q) || (/\bwhy\b/.test(q) && /\b(choose|university|mudanya)\b/.test(q))) {
    const kurumsal = dataset.parcalar.filter((p) => /icerik-(71|5|94|3)$/.test(p.id) || p.kategori === 'kurumsal');
    const seen = new Set(parcalar.map((p) => p.id));
    parcalar = [...parcalar, ...kurumsal.filter((p) => !seen.has(p.id))].slice(0, 6);
  }

  const ekler: Attachment[] = [];
  const push = (a: Attachment) => {
    if (ekler.length < 8 && !ekler.some((e) => e.deger === a.deger)) ekler.push(a);
  };

  if (kampusDahil && dataset.kampus.konum) {
    push({
      tur: 'harita',
      etiket: etiketle(
        dil,
        'Kampüs konumu (Google Maps)',
        'Campus location (Google Maps)',
        'Расположение кампуса (Google Maps)',
        'Kampus joylashuvi (Google Maps)',
      ),
      deger: dataset.kampus.konum.google_maps_link,
    });
    for (const rota of dataset.kampus.ulasim.harita_rotalari.slice(0, 2)) {
      push({ tur: 'harita', etiket: rota.etiket, deger: rota.url });
    }
    for (const g of dataset.kampus.gorseller.slice(0, 2)) {
      push({
        tur: 'gorsel',
        etiket: etiketle(dil, 'Kampüs', 'Campus', 'Кампус', 'Kampus'),
        deger: g,
      });
    }
  }

  // Sadece en iyi eslesen parcalarin belgeleri
  for (const parca of parcalar.slice(0, 2)) {
    for (const b of parca.belgeler.slice(0, 2)) {
      push({ tur: b.tur === 'pdf' ? 'pdf' : 'link', etiket: b.metin || parca.baslik, deger: b.url });
    }
    for (const h of parca.harita_linkleri.slice(0, 1)) {
      push({ tur: 'harita', etiket: parca.baslik, deger: h });
    }
    if (!kampusDahil) {
      for (const g of parca.gorseller.slice(0, 1)) {
        push({ tur: 'gorsel', etiket: parca.baslik, deger: g });
      }
    }
  }

  for (const p of programlar.slice(0, 3)) {
    if (!p.sayfa_url) continue;
    const enAd = p.ingilizce_adlar?.[0] ?? p.ad;
    push({
      tur: 'link',
      etiket: etiketle(
        dil,
        `${p.ad} bölüm sayfası`,
        `${enAd} program page`,
        `Страница программы «${enAd}»`,
        `${enAd} dasturi sahifasi`,
      ),
      deger: p.sayfa_url,
    });
  }

  return {
    dil,
    intents,
    programlar,
    parcalar,
    kampusDahil,
    ekler,
    bosSonuc: programlar.length === 0 && parcalar.length === 0 && !kampusDahil && !intents.liste,
  };
}
