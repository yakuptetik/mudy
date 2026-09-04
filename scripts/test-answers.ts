import { loadDataset } from '../src/data.ts';
import { retrieve } from '../src/retrieve.ts';
import { buildContext, systemPrompt } from '../src/prompt.ts';
import { complete, type Message } from '../src/mistral.ts';

/**
 * Uctan uca dogruluk testi.
 *
 * Sadece "cevap geldi mi" degil, "dogru sayiyi mi verdi" ve daha onemlisi
 * "bilmedigi seyi uydurdu mu" kontrol edilir. Halusinasyon tuzaklari
 * (Tip Fakultesi, yurt ucreti) kasitli olarak eklendi.
 *
 * Kullanim:
 *   npm run test:retrieval   -> LLM cagirmadan sadece eslestirmeyi test eder (hizli, ucretsiz)
 *   npm run test             -> tam test, gercek cevaplari uretir
 */

interface Senaryo {
  soru: string;
  amac: string;
  /** Cevapta mutlaka gecmesi gereken ifadeler */
  icerir?: string[];
  /** Cevapta KESINLIKLE gecmemesi gerekenler (halusinasyon kontrolu) */
  icermez?: RegExp[];
  /** Beklenen yanit dili */
  dil?: 'tr' | 'en' | 'ru';
  /** Eslestirmenin bulmasi gereken program adlari */
  beklenenProgram?: string[];
  /** Eslestirmenin bulmasi gereken icerik parcasi basligi (kismi) */
  beklenenParca?: string;
  /** Cevabin "bilgim yok" demesi gerekiyor mu */
  bilgiYok?: boolean;
}

const SENARYOLAR: Senaryo[] = [
  {
    soru: 'Psikoloji bölümü ücreti ne kadar?',
    amac: 'Kullanicinin duzelttigi sayi - tam ve %50 burslu birlikte',
    icerir: ['1.224.000', '612.000'],
    // lisans sorusuna yuksek lisans tutarlari sizmamali
    icermez: [/289\.360/, /144\.680/],
    dil: 'tr',
    beklenenProgram: ['Psikoloji'],
  },
  {
    soru: 'Psikoloji yüksek lisans ücreti ne kadar?',
    amac: 'Lisansustu tablosu - lisans tutarlariyla karistirmamali',
    icerir: ['289.360'],
    icermez: [/1\.224\.000/],
    dil: 'tr',
    beklenenParca: 'Yüksek Lisans',
  },
  {
    soru: 'Otopark ücreti ne kadar?',
    amac: 'Yanlis etiketlenen /icerik/92 sayfasinin duzeltildigini dogrular',
    dil: 'tr',
    beklenenParca: 'Ücretler',
  },
  {
    soru: 'Bilgisayar mühendisliği burslu fiyatı nedir?',
    amac: '%50 burslu kolonunun dogru okunmasi',
    icerir: ['612.000'],
    dil: 'tr',
    beklenenProgram: ['Bilgisayar Mühendisliği'],
  },
  {
    soru: 'Anestezi programı kaç para?',
    amac: 'Meslek Yuksekokulu onlisans ucreti',
    icerir: ['683.000', '341.500'],
    dil: 'tr',
    beklenenProgram: ['Anestezi'],
  },
  {
    soru: 'Hemşirelik ücreti ne kadar?',
    amac: 'Saglik Bilimleri Fakultesi ucreti',
    icerir: ['1.028.000'],
    dil: 'tr',
    beklenenProgram: ['Hemşirelik'],
  },
  {
    soru: 'How much is the tuition fee for international students in Computer Engineering?',
    amac: 'Ingilizce soru + USD ucreti + dil tespiti',
    icerir: ['4', '6'],
    dil: 'en',
    beklenenProgram: ['Bilgisayar Mühendisliği'],
  },
  {
    soru: 'Сколько стоит обучение по специальности «компьютерная инженерия»?',
    amac: 'Rusca soru: USD uluslararasi ucret, Turkce Kaynak etiketi yok',
    icerir: ['Источник'],
    icermez: [/1\.224\.000/, /Kaynak:/],
    dil: 'ru',
    beklenenProgram: ['Bilgisayar Mühendisliği'],
  },
  {
    soru: 'Kampüs nerede, İstanbul’dan nasıl gelebilirim?',
    amac: 'Konum niyeti - adres ve ulasim bilgisi',
    icerir: ['Çağrışan'],
    dil: 'tr',
    beklenenParca: 'Ulaşım',
  },
  {
    soru: 'Kayıt için hangi belgeler gerekli?',
    amac: 'Icerik aramasinin dogru sayfayi bulmasi',
    dil: 'tr',
    beklenenParca: 'Belgeler',
  },
  {
    soru: 'Hangi bölümler var?',
    amac: 'Liste niyeti - tum programlarin baglama girmesi',
    icerir: ['Hemşirelik', 'Mühendislik'],
    dil: 'tr',
  },
  // --- halusinasyon tuzaklari ---
  {
    soru: 'Tıp Fakültesi ücreti ne kadar?',
    amac: 'TUZAK: universitede Tip Fakultesi YOK, fiyat uydurmamali',
    icermez: [/\d{1,3}\.\d{3}\.\d{3}/, /\d{3}\.\d{3}\s*(TL|₺)/],
    bilgiYok: true,
    dil: 'tr',
  },
  {
    soru: 'Yurt ücretleri ne kadar?',
    amac: 'TUZAK: sitede yurt ucreti yok, tahmin uretmemeli',
    icermez: [/yurt ücreti\s*:?\s*\d/i, /\d{1,3}\.\d{3}\s*(TL|₺)\s*(aylık|yıllık)/i],
    bilgiYok: true,
    dil: 'tr',
  },
  {
    soru: 'Gastronomi bölümünün uluslararası öğrenci ücreti kaç dolar?',
    amac: 'TUZAK: bu program USD listesinde YOK, uydurmamali',
    icermez: [/\b\d{4}\s*(USD|dolar|\$)/i],
    bilgiYok: true,
    dil: 'tr',
  },
];

function normalize(s: string): string {
  return s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
}

const BILGI_YOK_KALIPLARI =
  /(bilgi (elimde|bulunmuyor|yok|mevcut değil)|elimde yok|bulunmuyor|yer almıyor|paylaşılmıyor|yayınlanmıyor|iletişime geç|bilgi@mudanya|224 20 22|no information|not available|don't have|do not have)/i;

async function main() {
  const sadeceEslestirme = process.argv.includes('--retrieval');
  const dataset = await loadDataset();

  console.log(
    `veri: ${dataset.programlar.length} program, ${dataset.parcalar.length} parca, ` +
      `${dataset.akademik_yil}, cekim ${dataset.cekilme_tarihi}`,
  );
  console.log(`mod : ${sadeceEslestirme ? 'sadece eslestirme (LLM yok)' : 'tam uctan uca'}\n`);

  let gecti = 0;
  const basarisiz: string[] = [];

  for (const [i, s] of SENARYOLAR.entries()) {
    // ucretsiz katmanda saniyede ~1 istek siniri var; senaryolar arasi nefes payi
    if (!sadeceEslestirme && i > 0) await new Promise((r) => setTimeout(r, 4000));

    const bulgu = retrieve(s.soru, dataset);
    const hatalar: string[] = [];

    console.log(`${'─'.repeat(70)}`);
    console.log(`${i + 1}. ${s.soru}`);
    console.log(`   amac: ${s.amac}`);
    console.log(
      `   eslesme: ${bulgu.programlar.length} program [${bulgu.programlar.map((p) => p.ad).join(', ') || '-'}]` +
        ` | ${bulgu.parcalar.length} parca [${bulgu.parcalar.map((p) => p.baslik).join(', ') || '-'}]`,
    );
    const aktifNiyetler = Object.entries(bulgu.intents)
      .filter(([, v]) => v)
      .map(([k]) => k);
    console.log(
      `   niyet: [${aktifNiyetler.join(', ') || '-'}] | kampus: ${bulgu.kampusDahil ? 'evet' : 'hayir'}` +
        ` | dil: ${bulgu.dil.kod} | ek: ${bulgu.ekler.length}`,
    );

    // --- eslestirme kontrolleri ---
    for (const beklenen of s.beklenenProgram ?? []) {
      if (!bulgu.programlar.some((p) => p.ad.includes(beklenen))) {
        hatalar.push(`program eslesmedi: "${beklenen}"`);
      }
    }
    if (s.beklenenParca && !bulgu.parcalar.some((p) => p.baslik.includes(s.beklenenParca!))) {
      hatalar.push(`icerik parcasi eslesmedi: "${s.beklenenParca}"`);
    }
    if (s.dil && bulgu.dil.kod !== s.dil) {
      hatalar.push(`dil tespiti yanlis: beklenen ${s.dil}, bulunan ${bulgu.dil.kod}`);
    }

    if (sadeceEslestirme) {
      if (hatalar.length === 0) { gecti++; console.log('   SONUC: gecti'); }
      else { basarisiz.push(s.soru); hatalar.forEach((h) => console.log(`   HATA: ${h}`)); }
      continue;
    }

    // --- gercek cevap ---
    const baglam = buildContext(bulgu, dataset);
    const messages: Message[] = [
      { role: 'system', content: systemPrompt(dataset, bulgu) },
      {
        role: 'user',
        content: baglam
          ? `BAĞLAM:\n${baglam}\n\n---\nSORU: ${s.soru}`
          : `BAĞLAM: (bu konuda veri bulunamadı)\n\n---\nSORU: ${s.soru}`,
      },
    ];

    let cevap: string;
    try {
      cevap = normalize(await complete(messages));
    } catch (err) {
      basarisiz.push(s.soru);
      console.log(`   HATA: LLM cagrisi basarisiz - ${(err as Error).message}`);
      continue;
    }

    console.log(`   cevap: ${cevap.replace(/\n/g, ' ').slice(0, 400)}${cevap.length > 400 ? '…' : ''}`);

    for (const parca of s.icerir ?? []) {
      if (!cevap.includes(parca)) hatalar.push(`cevapta eksik: "${parca}"`);
    }
    for (const kalip of s.icermez ?? []) {
      const m = kalip.exec(cevap);
      if (m) hatalar.push(`UYDURMA RISKI: "${m[0]}" (${kalip}) cevapta olmamaliydi`);
    }
    if (s.bilgiYok && !BILGI_YOK_KALIPLARI.test(cevap)) {
      hatalar.push('bilgi olmadigini soylemeliydi ama soylemedi');
    }

    if (hatalar.length === 0) { gecti++; console.log('   SONUC: gecti'); }
    else { basarisiz.push(s.soru); hatalar.forEach((h) => console.log(`   HATA: ${h}`)); }
  }

  console.log(`${'═'.repeat(70)}`);
  console.log(`${gecti}/${SENARYOLAR.length} senaryo gecti`);
  if (basarisiz.length) {
    console.log('\nbasarisiz:');
    basarisiz.forEach((b) => console.log(`  x ${b}`));
    process.exit(1);
  }
  console.log('tum senaryolar gecti.');
}

main();
