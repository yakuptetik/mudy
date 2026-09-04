import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDataset, healthPayload, prepareChat, type ChatRequest } from '../src/chat.ts';

export const config = {
  maxDuration: 60,
};

function cors(res: VercelResponse) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ hata: 'yalnizca POST' });
    return;
  }

  const body = (req.body ?? {}) as ChatRequest;
  const soru = (body.soru ?? '').trim();
  if (!soru) {
    res.status(400).json({ hata: 'soru bos' });
    return;
  }

  const dataset = await getDataset();
  const baslangic = Date.now();
  const { meta, bulgu, stream } = prepareChat(soru, dataset, body.gecmis);

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
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
