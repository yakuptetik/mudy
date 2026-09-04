import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { ORIGIN } from './http.ts';
import { tableToGrid, cleanCellText } from './table.ts';

export interface PageLink {
  metin: string;
  url: string;
  tur: 'pdf' | 'harita' | 'form' | 'dis' | 'ic';
}

export interface PageImage {
  url: string;
  alt: string;
}

export interface PageContact {
  telefonlar: string[];
  epostalar: string[];
}

export interface ExtractedPage {
  url: string;
  baslik: string;
  dil: 'tr' | 'en';
  metin: string;
  tablolar: string[][][];
  linkler: PageLink[];
  gorseller: PageImage[];
  iletisim: PageContact;
}

/** Her sayfada tekrar eden gezinme bloklari; icerik sinyalini bogar. */
const STRIP = [
  'script', 'style', 'noscript', 'nav', 'header', 'footer', 'svg',
  'form', 'iframe', 'button', 'select', 'input', 'textarea',
  '.submenu-panel', '[aria-hidden="true"]',
];

const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'aside', 'main', 'figure', 'figcaption',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote',
  'address', 'dl', 'dt', 'dd', 'hr',
]);

function absolute(href: string): string | null {
  try {
    return new URL(href, ORIGIN).toString();
  } catch {
    return null;
  }
}

function linkType(url: string, text: string): PageLink['tur'] {
  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf') || /\.(docx?|xlsx?)$/.test(lower)) return 'pdf';
  if (/google\.[a-z.]+\/maps|maps\.app\.goo\.gl|yandex\.[a-z.]+\/maps/.test(lower)) return 'harita';
  if (/basvuru|application|form|kayit|ois\.mudanya/.test(lower + text.toLowerCase())) return 'form';
  return new URL(url).origin === ORIGIN ? 'ic' : 'dis';
}

/** Bir linkin URL'sinin metne gomulmesi anlamli mi? Ic gezinme linkleri gurultu. */
function shouldInlineUrl(url: string, tur: PageLink['tur']): boolean {
  return tur === 'pdf' || tur === 'form' || tur === 'harita' || tur === 'dis';
}

/**
 * HTML'i chatbot baglamina uygun sade markdown'a cevirir.
 * Kritik nokta: satir ici <a>/<strong>/<span> metinleri KORUNUR.
 * Sitede telefon, PDF adi ve basvuru linki gibi bilgilerin tamami
 * <a> etiketi icinde yasiyor; bunlari atmak sayfayi bosaltiyor.
 */
function serialize($: CheerioAPI, node: AnyNode): string {
  if (node.type === 'text') return node.data ?? '';
  if (node.type !== 'tag') return '';

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === 'table') return ''; // tablolar grid olarak ayri isleniyor
  if (tag === 'br') return '\n';

  const inner = $(el)
    .contents()
    .toArray()
    .map((c) => serialize($, c))
    .join('');

  if (tag === 'a') {
    const text = inner.replace(/\s+/g, ' ').trim();
    const href = el.attribs?.href;
    if (!href) return text;
    if (href.startsWith('tel:')) return text || href.replace('tel:', '');
    if (href.startsWith('mailto:')) return text || href.replace('mailto:', '');
    const abs = absolute(href);
    if (!abs || !text) return text;
    return shouldInlineUrl(abs, linkType(abs, text)) ? `[${text}](${abs})` : text;
  }

  if (/^h[1-6]$/.test(tag)) {
    const text = inner.replace(/\s+/g, ' ').trim();
    return text ? `\n\n### ${text}\n` : '';
  }

  if (tag === 'li') {
    const text = inner.replace(/\s+/g, ' ').trim();
    return text ? `\n- ${text}` : '';
  }

  if (BLOCK_TAGS.has(tag)) return `\n${inner}\n`;

  return inner; // span, strong, em, b, i, small, sup ... satir ici kalir
}

function tidy(raw: string): string {
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));

  // ardisik ayni satirlari at (menu tekrarlari)
  const out: string[] = [];
  for (const l of lines) {
    if (l !== '' && out[out.length - 1] === l) continue;
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function extractPage(url: string, html: string): ExtractedPage | null {
  const $ = cheerio.load(html);
  const path = new URL(url).pathname;
  const dil: 'tr' | 'en' = /^\/(en|content|faculty|contact)(\/|$)/.test(path) ? 'en' : 'tr';

  const main = $('main').first();
  const scope = main.length ? main : $('body');

  const baslik = (scope.find('h1').first().text().trim() || $('title').text().trim())
    .replace(/\s*\|\s*Mudanya (Üniversitesi|University)\s*$/i, '')
    .trim();

  // iletisim bilgilerini silinmeden once topla (form icinde de olabilir)
  const telefonlar = new Set<string>();
  const epostalar = new Set<string>();
  scope.find('a[href^="tel:"]').each((_, a) => {
    const v = cleanCellText($(a).text()) || ($(a).attr('href') ?? '').replace('tel:', '');
    if (v) telefonlar.add(v);
  });
  scope.find('a[href^="mailto:"]').each((_, a) => {
    const v = ($(a).attr('href') ?? '').replace('mailto:', '').trim();
    if (v) epostalar.add(v);
  });

  scope.find(STRIP.join(',')).remove();

  const proseNode = scope.find('.prose').first();
  const rootEl = (proseNode.length ? proseNode : scope).get(0);
  if (!rootEl) return null;

  // breadcrumb'i at
  scope.find('.mb-4.flex.items-center.gap-2').remove();

  const metin = tidy(serialize($, rootEl as Element));

  const tablolar = scope
    .find('table')
    .toArray()
    .map((t) => tableToGrid($, t))
    .filter((g) => g.length > 1);

  const seenLinks = new Set<string>();
  const linkler: PageLink[] = [];
  for (const a of scope.find('a[href]').toArray()) {
    const href = $(a).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    const abs = absolute(href);
    if (!abs || seenLinks.has(abs)) continue;
    seenLinks.add(abs);
    const metinLink = cleanCellText($(a).text()) || cleanCellText($(a).attr('title') ?? '');
    linkler.push({ metin: metinLink, url: abs, tur: linkType(abs, metinLink) });
  }

  const seenImg = new Set<string>();
  const gorseller: PageImage[] = [];
  for (const img of scope.find('img').toArray()) {
    const src = $(img).attr('src') ?? $(img).attr('data-src');
    if (!src || src.startsWith('data:')) continue;
    const abs = absolute(src);
    if (!abs || seenImg.has(abs)) continue;
    if (/logo|icon|favicon|placeholder|avatar/i.test(abs)) continue;
    seenImg.add(abs);
    gorseller.push({ url: abs, alt: cleanCellText($(img).attr('alt') ?? '') });
  }

  if (!metin && tablolar.length === 0) return null;

  return {
    url,
    baslik,
    dil,
    metin,
    tablolar,
    linkler,
    gorseller,
    iletisim: { telefonlar: [...telefonlar], epostalar: [...epostalar] },
  };
}

/** Grid'i markdown tablosuna cevirir (LLM baglaminda tablo boyle daha dogru okunuyor). */
export function gridToMarkdown(grid: string[][]): string {
  if (grid.length === 0) return '';
  const [head, ...body] = grid;
  const line = (cells: string[]) => `| ${cells.map((c) => c || ' ').join(' | ')} |`;
  return [line(head), `| ${head.map(() => '---').join(' | ')} |`, ...body.map(line)].join('\n');
}
