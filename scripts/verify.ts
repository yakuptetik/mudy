import * as cheerio from 'cheerio';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ORIGIN, fetchPage } from './lib/http.ts';
import { tableToGrid, parseMoney, parseInteger } from './lib/table.ts';
import { parseProgramName } from './lib/slug.ts';

/**
 * Veri setindeki her sayiyi kaynak sayfadan CANLI yeniden cekip karsilastirir.
 * Amac: universite ucreti guncellediginde chatbot'un eski fiyati soylemesini
 * engellemek. Uyusmazlik varsa cikis kodu 1 doner (cron/CI icin).
 */

const TL_URL = `${ORIGIN}/icerik/645`;
const USD_URL = `${ORIGIN}/icerik/73`;

interface Program {
  ad: string;
  ucret_try: { tam: number; burslu_50: number };
  ucret_usd_uluslararasi: { erken_kayit: number; standart: number; kontenjan: number | null } | null;
  sayfa_url: string | null;
  akademik_yil?: string;
}

const sorunlar: string[] = [];
const uyarilar: string[] = [];

async function liveGrid(url: string): Promise<string[][]> {
  const res = await fetchPage(url, { force: true });
  if (!res || res.status !== 200) throw new Error(`${url} indirilemedi`);
  const $ = cheerio.load(res.html);
  const table = $('table').first();
  if (!table.length) throw new Error(`${url} icinde tablo yok`);
  return tableToGrid($, table.get(0)!);
}

async function main() {
  const dataset = JSON.parse(
    await readFile(join(process.cwd(), 'data', 'programs.json'), 'utf8'),
  ) as { akademik_yil: string; cekilme_tarihi: string; programlar: Program[] };

  console.log(`veri seti: ${dataset.programlar.length} program, ${dataset.akademik_yil}`);
  console.log(`cekilme tarihi: ${dataset.cekilme_tarihi}`);
  console.log('\nkaynak sayfalar yeniden indiriliyor...\n');

  // --- 1. TL ucretleri ---
  const tlGrid = await liveGrid(TL_URL);
  const canliYil = /(\d{4}-\d{4})/.exec(tlGrid[0]?.[0] ?? '')?.[1];
  if (canliYil !== dataset.akademik_yil) {
    sorunlar.push(
      `Akademik yil degismis: veri setinde ${dataset.akademik_yil}, sayfada ${canliYil}. Yeniden cekim gerekli.`,
    );
  }

  const tlCanli = new Map<string, { tam: number; yarim: number }>();
  for (const row of tlGrid) {
    const tam = parseMoney(row[2] ?? '');
    const yarim = parseMoney(row[3] ?? '');
    if (!row[1] || tam === null || yarim === null) continue;
    tlCanli.set(parseProgramName(row[1]).key, { tam, yarim });
  }

  // --- 2. USD ucretleri ---
  const usdGrid = await liveGrid(USD_URL);
  const usdCanli = new Map<string, { erken: number; standart: number; kontenjan: number | null }>();
  for (const row of usdGrid) {
    const erken = parseInteger(row[3] ?? '');
    const standart = parseInteger(row[4] ?? '');
    if (!row[1] || erken === null || standart === null) continue;
    usdCanli.set(parseProgramName(row[1]).key, {
      erken,
      standart,
      kontenjan: parseInteger(row[2] ?? ''),
    });
  }

  // --- 3. satir satir karsilastir ---
  let kontrolEdilen = 0;
  for (const p of dataset.programlar) {
    const key = parseProgramName(p.ad).key;

    const tl = tlCanli.get(key);
    if (!tl) {
      sorunlar.push(`${p.ad}: TL ucret tablosunda artik bulunamiyor`);
    } else {
      kontrolEdilen++;
      if (tl.tam !== p.ucret_try.tam) {
        sorunlar.push(
          `${p.ad}: tam ucret degismis (veri seti ${p.ucret_try.tam}, sayfa ${tl.tam})`,
        );
      }
      if (tl.yarim !== p.ucret_try.burslu_50) {
        sorunlar.push(
          `${p.ad}: %50 burslu ucret degismis (veri seti ${p.ucret_try.burslu_50}, sayfa ${tl.yarim})`,
        );
      }
      // tutarlilik: yarim ucret tam ucretin yarisi olmali
      if (tl.tam !== tl.yarim * 2) {
        uyarilar.push(
          `${p.ad}: kaynakta %50 burslu (${tl.yarim}) tam ucretin (${tl.tam}) tam yarisi degil`,
        );
      }
    }

    const usd = usdCanli.get(key);
    if (p.ucret_usd_uluslararasi && !usd) {
      sorunlar.push(`${p.ad}: USD tablosunda artik bulunamiyor`);
    } else if (p.ucret_usd_uluslararasi && usd) {
      if (usd.erken !== p.ucret_usd_uluslararasi.erken_kayit) {
        sorunlar.push(
          `${p.ad}: USD erken kayit degismis (${p.ucret_usd_uluslararasi.erken_kayit} -> ${usd.erken})`,
        );
      }
      if (usd.standart !== p.ucret_usd_uluslararasi.standart) {
        sorunlar.push(
          `${p.ad}: USD standart degismis (${p.ucret_usd_uluslararasi.standart} -> ${usd.standart})`,
        );
      }
      if (usd.kontenjan !== p.ucret_usd_uluslararasi.kontenjan) {
        uyarilar.push(
          `${p.ad}: kontenjan degismis (${p.ucret_usd_uluslararasi.kontenjan} -> ${usd.kontenjan})`,
        );
      }
    } else if (!p.ucret_usd_uluslararasi && usd) {
      uyarilar.push(`${p.ad}: USD tablosuna eklenmis (${usd.erken}/${usd.standart} USD)`);
    }

    if (!p.sayfa_url) uyarilar.push(`${p.ad}: bolum sayfasi URL'si yok`);
  }

  // --- 4. icerik parcalarinin kaynak URL'leri hala 200 mu ---
  const icerik = JSON.parse(
    await readFile(join(process.cwd(), 'data', 'content.json'), 'utf8'),
  ) as { parcalar: Array<{ id: string; kaynak_url: string }> };

  console.log(`${icerik.parcalar.length} icerik sayfasinin erisilebilirligi kontrol ediliyor...`);
  for (const parca of icerik.parcalar) {
    const res = await fetchPage(parca.kaynak_url, { force: true });
    if (!res || res.status !== 200) {
      sorunlar.push(`icerik "${parca.id}" kaynagi erisilemez: ${parca.kaynak_url}`);
    }
  }

  // --- rapor ---
  console.log(`\n${'='.repeat(56)}`);
  console.log(`karsilastirilan program: ${kontrolEdilen}/${dataset.programlar.length}`);
  console.log(`TL tablosu canli satir : ${tlCanli.size}`);
  console.log(`USD tablosu canli satir: ${usdCanli.size}`);

  if (uyarilar.length) {
    console.log(`\nUYARI (${uyarilar.length}):`);
    uyarilar.forEach((u) => console.log(`  ~ ${u}`));
  }

  if (sorunlar.length) {
    console.log(`\nSORUN (${sorunlar.length}) - veri seti guncel degil:`);
    sorunlar.forEach((s) => console.log(`  x ${s}`));
    console.log('\n"npm run scrape" ile yeniden cekilmeli.');
    process.exit(1);
  }

  console.log('\nTUM SAYILAR KAYNAKLA BIREBIR UYUSUYOR.');
}

main().catch((err) => {
  console.error('dogrulama basarisiz:', err.message);
  process.exit(1);
});
