import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { getDataset, healthPayload, prepareChat, type ChatRequest } from './chat.ts';

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_DIR = join(process.cwd(), 'public');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const dataset = await getDataset();
console.log(
  `veri yuklendi: ${dataset.programlar.length} program, ${dataset.parcalar.length} icerik parcasi, ` +
    `${dataset.manuel_eksikler.length} eksik konu (${dataset.akademik_yil})`,
);

function cors(res: ServerResponse) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
}

async function serveStatic(path: string, res: ServerResponse): Promise<boolean> {
  const rel = path === '/' ? 'index.html' : normalize(path).replace(/^(\.\.[/\\])+/, '').replace(/^\//, '');
  try {
    const file = await readFile(join(PUBLIC_DIR, rel));
    res.writeHead(200, { 'content-type': MIME[extname(rel)] ?? 'application/octet-stream' });
    res.end(file);
    return true;
  } catch {
    return false;
  }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function handleChat(req: IncomingMessage, res: ServerResponse) {
  let body: ChatRequest;
  try {
    body = (await readBody(req)) as ChatRequest;
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ hata: 'gecersiz JSON' }));
    return;
  }

  const soru = (body.soru ?? '').trim();
  if (!soru) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ hata: 'soru bos' }));
    return;
  }

  const baslangic = Date.now();
  const { meta, bulgu, stream } = prepareChat(soru, dataset, body.gecmis);

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('meta', meta);

  let yanit = '';
  try {
    for await (const parca of stream()) {
      yanit += parca;
      send('delta', { metin: parca });
    }
    send('done', { sure_ms: Date.now() - baslangic, karakter: yanit.length });
  } catch (err) {
    console.error('chat hatasi:', (err as Error).message);
    send('hata', { mesaj: 'Yanıt üretilemedi. Lütfen tekrar deneyin.' });
  }

  if (bulgu.bosSonuc) {
    console.log(`[CEVAPSIZ] "${soru}" -> hicbir baglam eslesmedi`);
  }

  res.end();
}

const server = createServer(async (req, res) => {
  cors(res);
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(healthPayload(dataset)));
    return;
  }

  if (url.pathname === '/api/chat' && req.method === 'POST') {
    await handleChat(req, res);
    return;
  }

  if (req.method === 'GET' && (await serveStatic(url.pathname, res))) return;

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('bulunamadi');
});

server.listen(PORT, () => {
  console.log(`\n  demo:   http://localhost:${PORT}`);
  console.log(`  widget: http://localhost:${PORT}/widget.js`);
  console.log(`  saglik: http://localhost:${PORT}/api/health\n`);
});
