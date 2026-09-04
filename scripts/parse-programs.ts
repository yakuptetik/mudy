import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ORIGIN, cachePath } from './lib/http.ts';
import { extractPage } from './lib/extract.ts';
import { slugify } from './lib/slug.ts';

/**
 * programs.json'u bolum tanitim metinleriyle zenginlestirir.
 *
 * Bolum sayfalarinda gercek aciklama, sitenin her sayfasinda tekrar eden
 * tanitim bloklarinin (istatistikler, "Hayallerinizi Birlikte...") arasina
 * gomulu. Boilerplate'i elle listelemek yerine frekansla ayikliyoruz:
 * sayfalarin cogunda gecen satir bilgi tasimiyor.
 */

const BOILERPLATE_ORANI = 0.25;

interface Program {
  slug: string;
  ad: string;
  ad_sade: string;
  fakulte: string;
  seviye: string;
  egitim_dili: string;
  sayfa_url: string | null;
  aciklama?: string | null;
  detay_url?: string | null;
  [k: string]: unknown;
}

async function readCached(url: string): Promise<string | null> {
  try {
    return await readFile(cachePath(url), 'utf8');
  } catch {
    return null;
  }
}

/** /fakulte/<slug>-<id>/icerik/<n> sayfalarini bolum slug'ina gore indeksler */
async function detailPagesBySlug(): Promise<Map<string, string[]>> {
  const raw = await readFile(join(process.cwd(), 'data', 'urls.json'), 'utf8');
  const parsed = JSON.parse(raw) as { gruplar: Record<string, string[]> };
  const all = Object.values(parsed.gruplar).flat();

  const map = new Map<string, string[]>();
  for (const url of all) {
    const m = /^\/fakulte\/(.+?)-\d{6}\/icerik\/\d+$/.exec(new URL(url).pathname);
    if (!m) continue;
    const key = slugify(m[1].replace(/-ingilizce$/, ''));
    const lang = m[1].endsWith('-ingilizce') ? 'en' : 'tr';
    const composite = `${key}|${lang}`;
    if (!map.has(composite)) map.set(composite, []);
    map.get(composite)!.push(url);
  }
  return map;
}

function contentLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 30 && !l.startsWith('###'));
}

async function main() {
  const dataPath = join(process.cwd(), 'data', 'programs.json');
  const dataset = JSON.parse(await readFile(dataPath, 'utf8')) as {
    akademik_yil: string;
    cekilme_tarihi: string;
    programlar: Program[];
  };

  const detailMap = await detailPagesBySlug();

  // 1. asama: aday sayfalari oku, satirlari topla
  const perProgram = new Map<string, { url: string; lines: string[] }>();
  const lineCount = new Map<string, number>();

  for (const p of dataset.programlar) {
    const key = p.slug.replace('--', '|');
    const candidates = detailMap.get(key) ?? [];
    const urls = [...candidates, p.sayfa_url].filter(Boolean) as string[];

    for (const url of urls) {
      const html = await readCached(url);
      if (!html) continue;
      const page = extractPage(url, html);
      if (!page) continue;
      const lines = contentLines(page.metin);
      if (lines.length === 0) continue;

      // ayni programa ait ilk isleyen sayfayi kullan
      if (!perProgram.has(p.slug)) perProgram.set(p.slug, { url, lines });
      for (const l of new Set(lines)) lineCount.set(l, (lineCount.get(l) ?? 0) + 1);
      break;
    }
  }

  // 2. asama: cok tekrar eden satirlar boilerplate
  const esik = Math.max(2, Math.floor(perProgram.size * BOILERPLATE_ORANI));
  const boilerplate = new Set(
    [...lineCount.entries()].filter(([, n]) => n >= esik).map(([l]) => l),
  );

  let zenginlesen = 0;
  for (const p of dataset.programlar) {
    const found = perProgram.get(p.slug);
    if (!found) {
      p.aciklama = null;
      p.detay_url = null;
      continue;
    }
    const özgün = found.lines.filter((l) => !boilerplate.has(l));
    const aciklama = özgün.join('\n\n').trim();
    p.aciklama = aciklama || null;
    p.detay_url = found.url;
    if (aciklama) zenginlesen++;
  }

  await writeFile(dataPath, JSON.stringify(dataset, null, 2), 'utf8');

  console.log(`bolum detay sayfasi indeksi: ${detailMap.size} slug`);
  console.log(`boilerplate esigi: ${esik}/${perProgram.size} sayfa -> ${boilerplate.size} satir atildi`);
  console.log(`aciklama eklenen: ${zenginlesen}/${dataset.programlar.length} program\n`);

  const eksik = dataset.programlar.filter((p) => !p.aciklama);
  if (eksik.length) {
    console.log(`aciklamasi olmayan (${eksik.length}):`);
    eksik.forEach((p) => console.log(`  - ${p.ad}`));
  }

  const örnek = dataset.programlar.find((p) => p.aciklama);
  if (örnek) {
    console.log(`\n--- ornek: ${örnek.ad} ---`);
    console.log(String(örnek.aciklama).slice(0, 700));
  }
}

main();
