const TR_MAP: Record<string, string> = {
  ı: 'i', İ: 'i', i: 'i',
  ş: 's', Ş: 's',
  ğ: 'g', Ğ: 'g',
  ü: 'u', Ü: 'u',
  ö: 'o', Ö: 'o',
  ç: 'c', Ç: 'c',
};

export function foldTurkish(s: string): string {
  return s.replace(/[ıİişŞğĞüÜöÖçÇ]/g, (c) => TR_MAP[c] ?? c);
}

/** Karsilastirma icin sadelestirilmis anahtar: "Ekonomi ve Finans" -> "ekonomi-finans" */
export function slugify(s: string): string {
  return foldTurkish(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .filter((w) => w && w !== 've')
    .join('-');
}

export interface ProgramName {
  /** Kaynakta yazildigi hali */
  raw: string;
  /** Dil etiketi cikarilmis ad */
  base: string;
  /** 'tr' | 'en' */
  language: 'tr' | 'en';
  /** Eslestirme anahtari: "bilgisayar-muhendisligi|en" */
  key: string;
}

/**
 * TL ve USD tablolarindaki ayni programin farkli yazimlarini ayni anahtara indirir.
 * Bilinen yazim farklari acikca listelenir; sessiz tahmin yapilmaz.
 */
const ALIASES: Record<string, string> = {
  'grafik-tasarim': 'grafik-tasarimi',
  'tele-saglik-sekreterligi': 'tele-saglik-teknikerligi',
  'imalat-yurutme-sistemleri': 'imalat-yurutme-sistemleri-operatorlugu',
  'elektrik-elektronik-muhendisligi': 'elektrik-elektronik-muhendisligi',
};

export function parseProgramName(raw: string): ProgramName {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const isEnglish = /\(\s*ingilizce\s*\)/i.test(foldTurkish(cleaned));
  const base = cleaned.replace(/\(\s*İngilizce\s*\)/gi, '').replace(/\s+/g, ' ').trim();
  const slug = slugify(base);
  return {
    raw: cleaned,
    base,
    language: isEnglish ? 'en' : 'tr',
    key: `${ALIASES[slug] ?? slug}|${isEnglish ? 'en' : 'tr'}`,
  };
}
