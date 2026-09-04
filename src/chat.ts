import { loadDataset, type Dataset } from './data.ts';
import { retrieve } from './retrieve.ts';
import { buildContext, systemPrompt } from './prompt.ts';
import { stream, type Message } from './mistral.ts';

export interface ChatRequest {
  soru?: string;
  gecmis?: Array<{ rol: 'user' | 'assistant'; metin: string }>;
}

export interface ChatMeta {
  dil: string;
  ekler: ReturnType<typeof retrieve>['ekler'];
  kullanilan_kaynaklar: string[];
  eslesen_programlar: string[];
  eslesen_parcalar: string[];
}

let datasetPromise: Promise<Dataset> | null = null;

export function getDataset(): Promise<Dataset> {
  datasetPromise ??= loadDataset();
  return datasetPromise;
}

export function healthPayload(dataset: Dataset) {
  return {
    durum: 'ayakta',
    program: dataset.programlar.length,
    parca: dataset.parcalar.length,
    akademik_yil: dataset.akademik_yil,
    veri_tarihi: dataset.cekilme_tarihi,
  };
}

export function prepareChat(soru: string, dataset: Dataset, gecmis: ChatRequest['gecmis'] = []) {
  const bulgu = retrieve(soru, dataset);
  const baglam = buildContext(bulgu, dataset);

  const messages: Message[] = [
    { role: 'system', content: systemPrompt(dataset, bulgu) },
    ...(gecmis ?? []).slice(-6).map((m) => ({
      role: (m.rol === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.metin,
    })),
    {
      role: 'user',
      content: baglam
        ? `BAĞLAM:\n${baglam}\n\n---\nCEVAP DİLİ (zorunlu): ${bulgu.dil.etiket}. Cevaba "Mudy" yazarak başlama.\nSORU: ${soru}`
        : `BAĞLAM: (bu konuda veri bulunamadı)\n\n---\nCEVAP DİLİ (zorunlu): ${bulgu.dil.etiket}. Cevaba "Mudy" yazarak başlama.\nSORU: ${soru}`,
    },
  ];

  const meta: ChatMeta = {
    dil: bulgu.dil.kod,
    ekler: bulgu.ekler,
    kullanilan_kaynaklar: [
      ...new Set([
        ...bulgu.parcalar.filter((p) => p.kaynak_url).map((p) => p.kaynak_url),
        ...bulgu.programlar.map((p) => p.ucret_try.kaynak),
      ]),
    ],
    eslesen_programlar: bulgu.programlar.map((p) => p.ad),
    eslesen_parcalar: bulgu.parcalar.map((p) => p.baslik),
  };

  return { bulgu, messages, meta, stream: () => stream(messages) };
}
