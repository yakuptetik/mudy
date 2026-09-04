import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Yerel: src/../data ; Vercel: proje kokundeki data/ (includeFiles) */
const DATA_DIR = process.env.VERCEL
  ? join(process.cwd(), 'data')
  : join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

export interface Program {
  slug: string;
  ad: string;
  ad_sade: string;
  fakulte: string;
  seviye: 'lisans' | 'onlisans';
  egitim_dili: string;
  akademik_yil: string;
  ucret_try: { tam: number; burslu_50: number; not: string; kaynak: string };
  ucret_usd_uluslararasi: {
    erken_kayit: number;
    standart: number;
    kontenjan: number | null;
    kaynak: string;
  } | null;
  sayfa_url: string | null;
  aciklama: string | null;
  detay_url: string | null;
  /** sitemap-en.xml'den uretilen resmi Ingilizce ad(lar) */
  ingilizce_adlar?: string[];
}

export interface Belge {
  metin: string;
  url: string;
  tur: string;
}

export interface Chunk {
  id: string;
  baslik: string;
  kategori: string;
  kategori_etiket: string;
  ornek_sorular: string[];
  icerik: string;
  kaynak_url: string;
  belgeler: Belge[];
  gorseller: string[];
  harita_linkleri: string[];
  telefonlar: string[];
  epostalar: string[];
  /** Elle girilen kayitlar icin true; cevapta kaynak olarak site linki verilmez */
  manuel?: boolean;
}

export interface Campus {
  ad: string;
  kampus: string;
  adres: string;
  telefon: string;
  telefon_e164: string;
  eposta: string;
  whatsapp_link: string;
  konum: {
    enlem: number;
    boylam: number;
    harita_embed: string;
    google_maps_link: string;
    kaynak: string;
  } | null;
  ulasim: {
    harita_rotalari: Array<{ etiket: string; url: string }>;
    burulas_otobus_hatlari: string[];
    metin: string;
    kaynak: string;
  };
  kampus_tanitimi: { metin: string; kaynak: string };
  gorseller: string[];
}

export interface Dataset {
  akademik_yil: string;
  cekilme_tarihi: string;
  programlar: Program[];
  parcalar: Chunk[];
  kampus: Campus;
  manuel_eksikler: string[];
}

async function json<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(join(DATA_DIR, name), 'utf8')) as T;
}

interface OverridesFile {
  manuel_bilgiler: Array<{
    id: string;
    baslik: string;
    kategori: string;
    ornek_sorular: string[];
    icerik: string;
    aktif: boolean;
    /** Elle girilen bilgi bir site sayfasina dayaniyorsa kaynak olarak gosterilir */
    kaynak_url?: string;
    not?: string;
  }>;
}

let cached: Dataset | null = null;

export async function loadDataset(): Promise<Dataset> {
  if (cached) return cached;

  const programsFile = await json<{
    akademik_yil: string;
    cekilme_tarihi: string;
    programlar: Program[];
  }>('programs.json');
  const contentFile = await json<{ parcalar: Chunk[] }>('content.json');
  const kampus = await json<Campus>('campus.json');
  const overrides = await json<OverridesFile>('overrides.json');

  // Ingilizce adlar ayri bir dosyada; yoksa sistem Turkce adlarla calismaya devam eder
  let aliases: Record<string, string[]> = {};
  try {
    aliases = (await json<{ program_ingilizce_adlari: Record<string, string[]> }>('aliases.json'))
      .program_ingilizce_adlari;
  } catch {
    console.warn('aliases.json yok; Ingilizce program adlari eslesmeyecek.');
  }

  const programlar = programsFile.programlar.map((p) => ({
    ...p,
    ingilizce_adlar: aliases[p.slug] ?? [],
  }));

  // Elle girilen bilgileri, sadece doldurulmus ve aktif olanlari, parca havuzuna kat.
  const manuelParcalar: Chunk[] = overrides.manuel_bilgiler
    .filter((m) => m.aktif && m.icerik.trim().length > 0)
    .map((m) => ({
      id: `manuel-${m.id}`,
      baslik: m.baslik,
      kategori: m.kategori,
      kategori_etiket: 'Elle Girilen Bilgi',
      ornek_sorular: m.ornek_sorular,
      icerik: m.icerik.trim(),
      kaynak_url: m.kaynak_url ?? '',
      belgeler: [],
      gorseller: [],
      harita_linkleri: [],
      telefonlar: [],
      epostalar: [],
      manuel: true,
    }));

  // Doldurulmamis kayitlar: bot bu konularda bilgi olmadigini bilmeli
  const manuel_eksikler = overrides.manuel_bilgiler
    .filter((m) => !m.aktif || m.icerik.trim().length === 0)
    .map((m) => m.baslik);

  cached = {
    akademik_yil: programsFile.akademik_yil,
    cekilme_tarihi: programsFile.cekilme_tarihi,
    programlar,
    parcalar: [...contentFile.parcalar, ...manuelParcalar],
    kampus,
    manuel_eksikler,
  };
  return cached;
}
