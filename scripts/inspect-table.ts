import * as cheerio from 'cheerio';
import { readFile } from 'node:fs/promises';
import { ORIGIN, cachePath } from './lib/http.ts';
import { tableToGrid } from './lib/table.ts';

/** Gelistirme yardimcisi: bir sayfanin tablolarini grid olarak dokumez. */
const path = process.argv[2] ?? '/icerik/645';
const html = await readFile(cachePath(`${ORIGIN}${path}`), 'utf8');
const $ = cheerio.load(html);

$('table').each((i, table) => {
  const grid = tableToGrid($, table);
  console.log(`\n=== tablo ${i}: ${grid.length} satir x ${grid[0]?.length ?? 0} kolon ===`);
  grid.forEach((row, r) => {
    console.log(String(r).padStart(3) + ' | ' + row.join(' | '));
  });
});
