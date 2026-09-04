const API_URL = 'https://api.mistral.ai/v1/chat/completions';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function apiKey(): string {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error('MISTRAL_API_KEY tanimli degil (.env.local)');
  return key;
}

function model(): string {
  return process.env.MISTRAL_MODEL ?? 'mistral-small-latest';
}

const YENIDEN_DENE = 5;

/**
 * Mistral'in ucretsiz katmani saniyede ~1 istege izin veriyor ve 429 donuyor.
 * Ust uste sorularda bu kacinilmaz, o yuzden artan bekleme ile tekrar deniyoruz.
 */
async function istek(body: unknown, timeoutMs: number): Promise<Response> {
  let sonHata = '';

  for (let deneme = 1; deneme <= YENIDEN_DENE; deneme++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey()}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.ok) return res;

    const gecici = res.status === 429 || res.status >= 500;
    sonHata = `${res.status}: ${(await res.text()).slice(0, 200)}`;
    if (!gecici || deneme === YENIDEN_DENE) break;

    const bekle = Math.min(1500 * 2 ** (deneme - 1), 15_000);
    await new Promise((r) => setTimeout(r, bekle));
  }

  throw new Error(`Mistral ${sonHata}`);
}

export async function complete(messages: Message[]): Promise<string> {
  const res = await istek(
    { model: model(), messages, temperature: 0.2, max_tokens: 700 },
    45_000,
  );
  const body = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return body.choices[0]?.message.content ?? '';
}

/** Yanit parcalarini geldigi gibi akitir; widget'ta yazi yazilarak gorunur. */
export async function* stream(messages: Message[]): AsyncGenerator<string> {
  const res = await istek(
    { model: model(), messages, temperature: 0.2, max_tokens: 700, stream: true },
    60_000,
  );
  if (!res.body) throw new Error('Mistral akis govdesi bos');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const parsed = JSON.parse(payload) as {
          choices: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // yarim JSON parcasi; bir sonraki turda tamamlanacak
      }
    }
  }
}
