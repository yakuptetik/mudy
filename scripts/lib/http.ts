import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const ORIGIN = 'https://mudanya.edu.tr';
const CACHE_DIR = join(process.cwd(), 'data', 'raw');
const USER_AGENT =
  'MudanyaChatbotBot/1.0 (+iletisim: bilgi@mudanya.edu.tr) veri-toplama';

/** robots.txt disallow listesi */
const DISALLOWED = [
  '/iletisim-gonder',
  '/birim-feed',
  '/fakulte-feed',
  '/application/',
  '/system/',
  '/assets/admin/',
];

export function isAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.origin !== ORIGIN) return false;
    return !DISALLOWED.some((p) => u.pathname.startsWith(p));
  } catch {
    return false;
  }
}

export function cachePath(url: string): string {
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 16);
  return join(CACHE_DIR, `${hash}.html`);
}

let lastRequestAt = 0;
const MIN_GAP_MS = 400;

async function throttle() {
  const wait = lastRequestAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

export interface FetchResult {
  url: string;
  html: string;
  status: number;
  fromCache: boolean;
}

export async function fetchPage(
  url: string,
  { force = false }: { force?: boolean } = {},
): Promise<FetchResult | null> {
  if (!isAllowed(url)) return null;
  const file = cachePath(url);

  if (!force) {
    try {
      const html = await readFile(file, 'utf8');
      return { url, html, status: 200, fromCache: true };
    } catch {
      // önbellekte yok, indir
    }
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    await throttle();
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 404) return { url, html: '', status: 404, fromCache: false };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, html, 'utf8');
      return { url, html, status: res.status, fromCache: false };
    } catch (err) {
      if (attempt === 3) {
        console.error(`  ! ${url} -> ${(err as Error).message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  return null;
}
