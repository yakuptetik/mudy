/** Anahtarin ve modelin calistigini dogrular. Anahtar env'den okunur, ekrana basilmaz. */
const key = process.env.MISTRAL_API_KEY;
const model = process.env.MISTRAL_MODEL ?? 'mistral-small-latest';

if (!key) {
  console.error('MISTRAL_API_KEY yok. .env.local dosyasini kontrol et.');
  process.exit(1);
}

const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
  method: 'POST',
  headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'Tek kelimeyle yanit ver: hazir' }],
    max_tokens: 20,
  }),
});

console.log(`model      : ${model}`);
console.log(`http durumu: ${res.status}`);

if (!res.ok) {
  console.error('hata govdesi:', (await res.text()).slice(0, 300));
  process.exit(1);
}

const body = (await res.json()) as {
  choices: Array<{ message: { content: string } }>;
  usage?: Record<string, number>;
};
console.log(`yanit      : ${body.choices[0]?.message.content.trim()}`);
console.log(`token      : ${JSON.stringify(body.usage)}`);
console.log('\nanahtar calisiyor.');
