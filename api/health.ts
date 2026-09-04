import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDataset, healthPayload } from '../src/chat.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('access-control-allow-origin', '*');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const dataset = await getDataset();
  res.status(200).json(healthPayload(dataset));
}
