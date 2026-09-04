import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ORIGIN, cachePath, fetchPage } from './lib/http.ts';
import { extractPage, gridToMarkdown, type PageLink } from './lib/extract.ts';
import { CATALOG, KATEGORI_ETIKET, type Kategori } from './catalog.ts';

interface Chunk {
  id: string;
  baslik: string;
  kategori: Kategori;
  kategori_etiket: string;
  ornek_sorular: string[];
  icerik: string;
  kaynak_url: string;
  belgeler: PageLink[];
  gorseller: string[];
  harita_linkleri: string[];
  telefonlar: string[];
  epostalar: string[];
  guncellenme: string;
}

const today = new Date().toISOString().slice(0, 10);

async function loadHtml(path: string): Promise<string | null> {
  const url = `${ORIGIN}${path}`;
  try {
    return await readFile(cachePath(url), 'utf8');
  } catch {
    const res = await fetchPage(url);
    return res?.status === 200 ? res.html : null;
  }
}

async function main() {
  const chunks: Chunk[] = [];
  const eksik: string[] = [];

  for (const entry of CATALOG) {
    const html = await loadHtml(entry.path);
    if (!html) {
      eksik.push(`${entry.path} (indirilemedi)`);
      continue;
    }

    const page = extractPage(`${ORIGIN}${entry.path}`, html);
    if (!page) {
      eksik.push(`${entry.path} (icerik bos)`);
      continue;
    }

    // Tablolari markdown olarak metnin sonuna ekle; LLM baglami tabloyu boyle daha iyi okuyor
    const tableBlocks = page.tablolar.map((g) => gridToMarkdown(g)).filter(Boolean);
    const icerik = [page.metin, ...tableBlocks].filter(Boolean).join('\n\n').trim();

    if (icerik.length < 40) {
      eksik.push(`${entry.path} (${icerik.length} karakter - cok kisa)`);
      continue;
    }

    chunks.push({
      id: entry.path.replace(/^\//, '').replace(/\//g, '-'),
      baslik: page.baslik,
      kategori: entry.kategori,
      kategori_etiket: KATEGORI_ETIKET[entry.kategori],
      ornek_sorular: entry.sorular,
      icerik,
      kaynak_url: page.url,
      belgeler: page.linkler.filter((l) => l.tur === 'pdf' || l.tur === 'form'),
      gorseller: page.gorseller.map((g) => g.url),
      harita_linkleri: page.linkler.filter((l) => l.tur === 'harita').map((l) => l.url),
      telefonlar: page.iletisim.telefonlar,
      epostalar: page.iletisim.epostalar,
      guncellenme: today,
    });
  }

  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await writeFile(
    join(process.cwd(), 'data', 'content.json'),
    JSON.stringify({ cekilme_tarihi: today, parcalar: chunks }, null, 2),
    'utf8',
  );

  const byCat = new Map<string, number>();
  for (const c of chunks) byCat.set(c.kategori, (byCat.get(c.kategori) ?? 0) + 1);

  console.log(`${chunks.length}/${CATALOG.length} sayfa islendi -> data/content.json\n`);
  console.log('kategori dagilimi:');
  for (const [k, v] of [...byCat].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(2)}  ${k}`);
  }
  const totalChars = chunks.reduce((s, c) => s + c.icerik.length, 0);
  console.log(`\ntoplam icerik: ${totalChars.toLocaleString('tr-TR')} karakter`);
  console.log(`pdf/form linki: ${chunks.reduce((s, c) => s + c.belgeler.length, 0)}`);
  console.log(`gorsel: ${chunks.reduce((s, c) => s + c.gorseller.length, 0)}`);

  if (eksik.length) {
    console.log(`\nislenemeyen (${eksik.length}):`);
    eksik.forEach((e) => console.log(`  - ${e}`));
  }

  console.log('\n--- en kisa 5 parca (elle kontrol edilmeli) ---');
  [...chunks]
    .sort((a, b) => a.icerik.length - b.icerik.length)
    .slice(0, 5)
    .forEach((c) => console.log(`  ${String(c.icerik.length).padStart(5)}  ${c.id.padEnd(14)} ${c.baslik}`));
}

main();
