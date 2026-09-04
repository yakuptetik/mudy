import * as cheerio from 'cheerio';
import { writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ORIGIN, fetchPage } from './lib/http.ts';
import { parseProgramName } from './lib/slug.ts';

/**
 * Programlarin resmi Ingilizce adlarini uretir.
 *
 * Sitenin Ingilizce surumu icerik olarak cevrilmemis: /faculty/.../department/
 * URL'leri Turkce govde donduruyor. Ancak URL slug'lari resmi Ingilizce adi,
 * sayfa <title>'i ise Turkce adi tasiyor. Ikisini eslestirerek guvenilir bir
 * alias tablosu cikariyoruz - elle ceviri yapmiyoruz.
 */

function englishNameFromSlug(slug: string): string {
  const KUCUK = new Set(['and', 'of', 'in', 'for', 'the', 'to']);
  return slug
    .split('-')
    .map((w, i) => (i > 0 && KUCUK.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

async function main() {
  const index = await fetchPage(`${ORIGIN}/sitemap-en.xml`, { force: true });
  if (!index) throw new Error('sitemap-en.xml alinamadi');

  const urls = [...index.html.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  const deptUrls = urls.filter((u) => /\/department\/[^/]+-\d{6}$/.test(new URL(u).pathname));

  console.log(`Ingilizce bolum sayfasi: ${deptUrls.length}`);

  const programsFile = JSON.parse(
    await readFile(join(process.cwd(), 'data', 'programs.json'), 'utf8'),
  ) as { programlar: Array<{ slug: string; ad: string; ad_sade: string }> };

  // Turkce ad -> program slug indeksi.
  // parseProgramName kullaniliyor: "Grafik Tasarım" / "Grafik Tasarımı" gibi
  // yazim farklarini ayni anahtara indiren alias tablosu orada.
  const byName = new Map<string, string>();
  for (const p of programsFile.programlar) {
    byName.set(parseProgramName(p.ad).key, p.slug);
  }

  const aliases: Record<string, string[]> = {};
  const eslesmeyen: string[] = [];

  for (const url of deptUrls) {
    const res = await fetchPage(url);
    if (!res || res.status !== 200) continue;

    const $ = cheerio.load(res.html);
    const trBaslik = $('title')
      .text()
      .replace(/\s*\|\s*Mudanya (Üniversitesi|University)\s*$/i, '')
      .trim();
    if (!trBaslik) continue;

    const slugMatch = /\/department\/(.+?)-\d{6}$/.exec(new URL(url).pathname);
    if (!slugMatch) continue;

    let enSlug = slugMatch[1];
    const isEnglishProgram = /-english$|^english-/.test(enSlug) || /\(İngilizce\)/i.test(trBaslik);
    enSlug = enSlug.replace(/-english$/, '');

    const enAd = englishNameFromSlug(enSlug);
    const parsed = parseProgramName(trBaslik);
    const programSlug = byName.get(parsed.key);

    if (!programSlug) {
      eslesmeyen.push(`${trBaslik} (${enAd})`);
      continue;
    }

    (aliases[programSlug] ??= []).push(enAd);

    // Ingilizce ogretim veren varyant da ayni Ingilizce adi kullanir
    if (!isEnglishProgram) {
      const enVariant = byName.get(parsed.key.replace(/\|tr$/, '|en'));
      if (enVariant) (aliases[enVariant] ??= []).push(enAd);
    }
  }

  // tekrarlari temizle
  for (const k of Object.keys(aliases)) {
    aliases[k] = [...new Set(aliases[k])];
  }

  await writeFile(
    join(process.cwd(), 'data', 'aliases.json'),
    JSON.stringify(
      {
        aciklama:
          'Programlarin resmi Ingilizce adlari. sitemap-en.xml icindeki /department/<en-slug> yollari ile sayfa <title>\'indaki Turkce ad eslestirilerek uretildi.',
        kaynak: `${ORIGIN}/sitemap-en.xml`,
        cekilme_tarihi: new Date().toISOString().slice(0, 10),
        program_ingilizce_adlari: aliases,
      },
      null,
      2,
    ),
    'utf8',
  );

  const kapsanan = Object.keys(aliases).length;
  console.log(`alias uretilen program: ${kapsanan}/${programsFile.programlar.length}`);
  console.log('\nornekler:');
  Object.entries(aliases).slice(0, 12).forEach(([slug, adlar]) => {
    const p = programsFile.programlar.find((x) => x.slug === slug);
    console.log(`  ${(p?.ad ?? slug).padEnd(42)} -> ${adlar.join(' | ')}`);
  });

  const eksik = programsFile.programlar.filter((p) => !aliases[p.slug]);
  if (eksik.length) {
    console.log(`\nIngilizce adi bulunamayan (${eksik.length}):`);
    eksik.forEach((p) => console.log(`  - ${p.ad}`));
  }
  if (eslesmeyen.length) {
    console.log(`\nTurkce programa baglanamayan Ingilizce sayfa (${eslesmeyen.length}):`);
    eslesmeyen.forEach((e) => console.log(`  ~ ${e}`));
  }
}

main();
