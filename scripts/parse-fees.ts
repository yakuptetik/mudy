import * as cheerio from 'cheerio';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ORIGIN, cachePath } from './lib/http.ts';
import { tableToGrid, parseMoney, parseInteger, cleanCellText } from './lib/table.ts';
import { parseProgramName, slugify } from './lib/slug.ts';

const TL_URL = `${ORIGIN}/icerik/645`;
const USD_URL = `${ORIGIN}/icerik/73`;

async function loadGrid(url: string, tableIndex = 0): Promise<string[][]> {
  const html = await readFile(cachePath(url), 'utf8');
  const $ = cheerio.load(html);
  const tables = $('table').toArray();
  if (!tables[tableIndex]) throw new Error(`${url} icinde tablo ${tableIndex} yok`);
  return tableToGrid($, tables[tableIndex]);
}

interface TlRow {
  key: string;
  raw: string;
  base: string;
  language: 'tr' | 'en';
  faculty: string;
  full: number;
  half: number;
}

interface UsdRow {
  key: string;
  raw: string;
  faculty: string;
  quota: number | null;
  early: number;
  standard: number;
}

/** icerik/645: FAKULTE | BOLUM | UCRETLI | %50 BURSLU */
async function parseTl(): Promise<{ rows: TlRow[]; year: string }> {
  const grid = await loadGrid(TL_URL);
  const year = /(\d{4}-\d{4})/.exec(grid[0]?.[0] ?? '')?.[1];
  if (!year) throw new Error('icerik/645 basliginda akademik yil bulunamadi');

  const header = grid.findIndex((r) => /FAK[ÜU]LTE/i.test(r[0] ?? ''));
  if (header < 0) throw new Error('icerik/645 tablo basligi bulunamadi');

  const rows: TlRow[] = [];
  for (const row of grid.slice(header + 1)) {
    const [faculty, program, fullRaw, halfRaw] = row;
    const full = parseMoney(fullRaw ?? '');
    const half = parseMoney(halfRaw ?? '');
    if (!program || full === null || half === null) continue;

    const name = parseProgramName(program);
    rows.push({
      key: name.key,
      raw: name.raw,
      base: name.base,
      language: name.language,
      faculty: cleanCellText(faculty ?? '').replace(/([a-zçğıöşü])([A-ZÇĞİÖŞÜ])/g, '$1 $2'),
      full,
      half,
    });
  }
  return { rows, year };
}

/** icerik/73: BIRIM | BOLUM | KONTENJAN | ERKEN KAYIT USD | SONRASI USD */
async function parseUsd(): Promise<UsdRow[]> {
  const grid = await loadGrid(USD_URL);
  const header = grid.findIndex((r) => /Birim/i.test(r[0] ?? ''));
  if (header < 0) throw new Error('icerik/73 tablo basligi bulunamadi');

  const rows: UsdRow[] = [];
  for (const row of grid.slice(header + 1)) {
    const [faculty, program, quotaRaw, earlyRaw, standardRaw] = row;
    const early = parseInteger(earlyRaw ?? '');
    const standard = parseInteger(standardRaw ?? '');
    if (!program || early === null || standard === null) continue;

    const name = parseProgramName(program);
    rows.push({
      key: name.key,
      raw: name.raw,
      faculty: cleanCellText(faculty ?? '').replace(/([a-zçğıöşü])([A-ZÇĞİÖŞÜ])/g, '$1 $2'),
      quota: parseInteger(quotaRaw ?? ''),
      early,
      standard,
    });
  }
  return rows;
}

/** Sitemap'ten gelen bolum sayfasi URL'lerini program anahtarina bagla */
async function programPageUrls(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let urls: string[] = [];
  try {
    const raw = await readFile(join(process.cwd(), 'data', 'urls.json'), 'utf8');
    const parsed = JSON.parse(raw) as { gruplar?: Record<string, string[]> };
    urls = parsed.gruplar?.bolum ?? [];
  } catch {
    return map;
  }

  for (const url of urls) {
    const path = new URL(url).pathname;
    const match = /\/bolum\/(.+?)-(\d{6})$/.exec(path);
    if (!match) continue;
    let slug = match[1];
    const isEnglish = slug.endsWith('-ingilizce');
    if (isEnglish) slug = slug.replace(/-ingilizce$/, '');
    const key = `${slugify(slug)}|${isEnglish ? 'en' : 'tr'}`;
    if (!map.has(key)) map.set(key, url);
  }
  return map;
}

async function main() {
  const { rows: tl, year } = await parseTl();
  const usd = await parseUsd();
  const pages = await programPageUrls();

  const usdByKey = new Map(usd.map((r) => [r.key, r]));
  const tlKeys = new Set(tl.map((r) => r.key));

  const programs = tl.map((row) => {
    const intl = usdByKey.get(row.key);
    return {
      slug: row.key.replace('|', '--'),
      ad: row.raw,
      ad_sade: row.base,
      fakulte: row.faculty,
      seviye: /Meslek Y[üu]ksekokulu/i.test(row.faculty) ? 'onlisans' : 'lisans',
      egitim_dili: row.language === 'en' ? 'İngilizce' : 'Türkçe',
      akademik_yil: year,
      ucret_try: {
        tam: row.full,
        burslu_50: row.half,
        not: 'Peşin ödeme için geçerlidir.',
        kaynak: TL_URL,
      },
      ucret_usd_uluslararasi: intl
        ? {
            erken_kayit: intl.early,
            standart: intl.standard,
            kontenjan: intl.quota,
            kaynak: USD_URL,
          }
        : null,
      sayfa_url: pages.get(row.key) ?? null,
    };
  });

  const unmatchedUsd = usd.filter((r) => !tlKeys.has(r.key));
  const missingPage = programs.filter((p) => !p.sayfa_url).map((p) => p.ad);
  const missingUsd = programs.filter((p) => !p.ucret_usd_uluslararasi).map((p) => p.ad);

  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await writeFile(
    join(process.cwd(), 'data', 'programs.json'),
    JSON.stringify(
      { akademik_yil: year, cekilme_tarihi: new Date().toISOString().slice(0, 10), programlar: programs },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`TL tablosu:  ${tl.length} program`);
  console.log(`USD tablosu: ${usd.length} satir`);
  console.log(`birlesmis:   ${programs.length} program -> data/programs.json`);
  console.log(`\nTL'de olup USD listesinde olmayan (${missingUsd.length}):`);
  missingUsd.forEach((n) => console.log(`  - ${n}`));
  console.log(`\nUSD'de olup TL listesinde olmayan (${unmatchedUsd.length}):`);
  unmatchedUsd.forEach((r) => console.log(`  - ${r.raw} (${r.faculty})`));
  console.log(`\nBolum sayfasi eslesmeyen (${missingPage.length}):`);
  missingPage.forEach((n) => console.log(`  - ${n}`));
}

main();
