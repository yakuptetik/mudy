import * as cheerio from 'cheerio';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ORIGIN, cachePath } from './lib/http.ts';
import { extractPage } from './lib/extract.ts';
import { cleanCellText } from './lib/table.ts';

/**
 * Konum sorulari icin yapisal kampus kaydi.
 * Chatbot "kampus nerede / nasil gelirim" sorusunda harita linki, koordinat
 * ve gorsel donebilmeli; bu bilgiler uc ayri sayfaya dagilmis durumda.
 */

const ILETISIM = `${ORIGIN}/iletisim`;
const ULASIM = `${ORIGIN}/icerik/62`;
const PLAN = `${ORIGIN}/icerik/24`;
const YASAM = `${ORIGIN}/icerik/194`;

async function html(url: string): Promise<string> {
  return readFile(cachePath(url), 'utf8');
}

/** Google Maps embed URL'sindeki !2d<boylam>!3d<enlem> desenini okur. */
function coordsFromEmbed(raw: string): { enlem: number; boylam: number; embed_url: string } | null {
  const src = /https:\/\/www\.google\.com\/maps\/embed\?pb=[^"'\\\s]+/.exec(raw)?.[0];
  if (!src) return null;
  const boylam = Number(/!2d(-?\d+\.\d+)/.exec(src)?.[1]);
  const enlem = Number(/!3d(-?\d+\.\d+)/.exec(src)?.[1]);
  if (!Number.isFinite(enlem) || !Number.isFinite(boylam)) return null;
  return { enlem, boylam, embed_url: src };
}

/** "Adres" / "Telefon" gibi etiketleri takip eden degeri esler. */
function labeledValues(metin: string): Record<string, string> {
  const lines = metin.split('\n').map((l) => l.trim()).filter(Boolean);
  const out: Record<string, string> = {};
  const labels = ['Adres', 'Telefon', 'WhatsApp', 'Mail', 'KEP Adresi:'];
  for (let i = 0; i < lines.length - 1; i++) {
    const label = lines[i].replace(/[:•]/g, '').trim();
    if (labels.some((l) => l.replace(/[:]/g, '') === label)) {
      const value = lines[i + 1];
      if (value && !labels.some((l) => l.replace(/[:]/g, '') === value.replace(/[:]/g, ''))) {
        out[label] = value;
      }
    }
  }
  return out;
}

async function main() {
  const iletisimRaw = await html(ILETISIM);
  const iletisim = extractPage(ILETISIM, iletisimRaw)!;
  const ulasim = extractPage(ULASIM, await html(ULASIM))!;
  const plan = extractPage(PLAN, await html(PLAN))!;
  const yasam = extractPage(YASAM, await html(YASAM))!;

  const alanlar = labeledValues(iletisim.metin);
  const konum = coordsFromEmbed(iletisimRaw);

  // Ulasim sayfasindaki ozel Google Maps rotalari (kara ve deniz yolu birlikte)
  const rotalar = ulasim.linkler
    .filter((l) => l.tur === 'harita')
    .map((l) => ({
      etiket: cleanCellText(l.metin).replace(/^[•\s]+/, ''),
      url: l.url,
    }));

  // otobus hatlari: BURULAS linki tasiyan kisa metinler
  const $ = cheerio.load(await html(ULASIM));
  const otobusler = [
    ...new Set(
      $('a[href*="burulas.com.tr/hizmetler/otobus"]')
        .toArray()
        .map((a) => cleanCellText($(a).text()))
        .filter((t) => t && t.length <= 8),
    ),
  ];

  // Sitedeki WhatsApp linki bozuk ("phone=++90(224)2242022"); numarayi E.164'e cevirip
  // kullanilabilir hale getiriyoruz, kaynak hali de saklaniyor.
  const kaynakWhatsapp =
    iletisim.linkler.find((l) => l.url.includes('api.whatsapp.com'))?.url ?? null;
  const telRakam = (iletisim.iletisim.telefonlar[0] ?? '').replace(/\D/g, '');
  const e164 = telRakam ? `90${telRakam.replace(/^90/, '').replace(/^0/, '')}` : null;

  const kayit = {
    cekilme_tarihi: new Date().toISOString().slice(0, 10),
    ad: 'Mudanya Üniversitesi',
    kampus: 'Çağrışan Kampüsü',
    adres: alanlar['Adres'] ?? null,
    telefon: iletisim.iletisim.telefonlar[0] ?? alanlar['Telefon'] ?? null,
    eposta: iletisim.iletisim.epostalar[0] ?? null,
    kep_adresi: alanlar['KEP Adresi'] ?? null,
    telefon_e164: e164 ? `+${e164}` : null,
    whatsapp_link: e164 ? `https://wa.me/${e164}` : null,
    whatsapp_link_kaynakta: kaynakWhatsapp,
    konum: konum
      ? {
          enlem: konum.enlem,
          boylam: konum.boylam,
          harita_embed: konum.embed_url,
          google_maps_link: `https://www.google.com/maps/search/?api=1&query=${konum.enlem},${konum.boylam}`,
          not: 'Koordinat, iletişim sayfasındaki gömülü Google Maps haritasından alındı.',
          kaynak: ILETISIM,
        }
      : null,
    ulasim: {
      harita_rotalari: rotalar,
      burulas_otobus_hatlari: otobusler,
      metin: ulasim.metin,
      kaynak: ULASIM,
    },
    kampus_tanitimi: { metin: plan.metin, kaynak: PLAN },
    gorseller: [...yasam.gorseller, ...plan.gorseller].slice(0, 12).map((g) => g.url),
    kaynaklar: [ILETISIM, ULASIM, PLAN, YASAM],
  };

  await writeFile(
    join(process.cwd(), 'data', 'campus.json'),
    JSON.stringify(kayit, null, 2),
    'utf8',
  );

  console.log('data/campus.json yazildi\n');
  console.log('adres      :', kayit.adres);
  console.log('telefon    :', kayit.telefon);
  console.log('eposta     :', kayit.eposta);
  console.log('kep        :', kayit.kep_adresi);
  console.log('whatsapp   :', kayit.whatsapp_link);
  console.log('koordinat  :', kayit.konum ? `${kayit.konum.enlem}, ${kayit.konum.boylam}` : 'YOK');
  console.log('maps linki :', kayit.konum?.google_maps_link ?? 'YOK');
  console.log('whatsapp*  :', kayit.whatsapp_link_kaynakta, '(sitedeki bozuk hali)');
  console.log('otobus     :', otobusler.join(', ') || 'YOK');
  console.log('gorsel     :', kayit.gorseller.length);
  console.log('\nharita rotalari:');
  rotalar.forEach((r) => console.log(`  - ${r.etiket}`));
}

main();
