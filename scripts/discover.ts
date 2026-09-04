import * as cheerio from 'cheerio';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ORIGIN, fetchPage, isAllowed } from './lib/http.ts';

/**
 * Sitemap + link takibi ile chatbot icin anlamli sayfalari kesfeder.
 * /icerik/N sayfalari sitemap'te yok, sadece menu linklerinden bulunabiliyor.
 */

const SEEDS = [
  `${ORIGIN}/`,
  `${ORIGIN}/aday-ogrenci`,
  `${ORIGIN}/iletisim`,
  `${ORIGIN}/icerik/645`,
  `${ORIGIN}/icerik/73`,
  `${ORIGIN}/icerik/kurumsal`,
  `${ORIGIN}/fakulte`,
];

/** Chatbot icin degersiz sayfalar: personel listeleri, arsiv duyurular, feed'ler */
function isNoise(pathname: string): boolean {
  return (
    pathname.startsWith('/kurum-kadro/') ||
    pathname.startsWith('/akademik-kadro') ||
    pathname.endsWith('/duyurular') ||
    pathname.endsWith('/haberler') ||
    pathname === '/duyurular' ||
    pathname === '/haberler' ||
    pathname.startsWith('/ogretim-elemani')
  );
}

function normalize(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.origin !== ORIGIN) return null;
    u.hash = '';
    // dil parametresi disinda query'leri koru (haber/duyuru slug'lari query kullaniyor)
    return u.toString().replace(/\/$/, '') || ORIGIN;
  } catch {
    return null;
  }
}

async function sitemapUrls(): Promise<string[]> {
  const out: string[] = [];
  const index = await fetchPage(`${ORIGIN}/sitemap.xml`);
  if (!index) return out;
  const maps = [...index.html.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  for (const map of maps.filter((m) => m.includes('sitemap-tr'))) {
    const res = await fetchPage(map);
    if (!res) continue;
    out.push(...[...res.html.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]));
  }
  return out;
}

async function main() {
  const seen = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [];

  const push = (url: string, depth: number) => {
    const n = normalize(url, ORIGIN);
    if (!n || seen.has(n) || !isAllowed(n)) return;
    if (isNoise(new URL(n).pathname)) return;
    seen.add(n);
    queue.push({ url: n, depth });
  };

  for (const s of SEEDS) push(s, 0);
  for (const u of await sitemapUrls()) push(u, 1);

  console.log(`baslangic kuyrugu: ${queue.length} URL`);

  const MAX_DEPTH = 2;
  let processed = 0;

  while (queue.length) {
    const { url, depth } = queue.shift()!;
    const res = await fetchPage(url);
    processed++;
    if (processed % 25 === 0) {
      console.log(`  ${processed} islendi, kuyrukta ${queue.length}`);
    }
    if (!res || res.status !== 200 || depth >= MAX_DEPTH) continue;

    const $ = cheerio.load(res.html);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) push(href, depth + 1);
    });
  }

  const urls = [...seen].sort();
  const byGroup = (u: string) => {
    const p = new URL(u).pathname;
    if (p.startsWith('/icerik/')) return 'icerik';
    if (p.includes('/bolum/')) return 'bolum';
    if (p.startsWith('/fakulte/')) return 'fakulte';
    if (p.startsWith('/birim/')) return 'birim';
    if (u.includes('duyuru-detay')) return 'duyuru';
    if (u.includes('haber-detay')) return 'haber';
    return 'sayfa';
  };

  const groups: Record<string, string[]> = {};
  for (const u of urls) (groups[byGroup(u)] ??= []).push(u);

  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await writeFile(
    join(process.cwd(), 'data', 'urls.json'),
    JSON.stringify({ taranan: urls.length, gruplar: groups }, null, 2),
    'utf8',
  );

  console.log(`\ntoplam ${urls.length} URL kesfedildi:`);
  for (const [g, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(list.length).padStart(4)}  ${g}`);
  }
}

main();
