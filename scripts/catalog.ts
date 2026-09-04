/**
 * Chatbot'un cevaplamasi gereken konularin kurate edilmis sayfa listesi.
 * Sitede 2200+ URL var ama bir ogrencinin sordugu sorularin tamami
 * asagidaki sayfalarda geciyor. Kurate liste, gurultulu tam-site
 * indekslemesinden daha dogru cevap veriyor.
 */
export interface CatalogEntry {
  path: string;
  kategori: Kategori;
  /** Bu sayfanin cevapladigi ornek sorular; niyet eslestirmeyi guclendirir */
  sorular: string[];
}

export type Kategori =
  | 'ucret_burs'
  | 'basvuru_kayit'
  | 'uluslararasi'
  | 'akademik_takvim'
  | 'kampus_yasam'
  | 'konum_ulasim'
  | 'egitim_modeli'
  | 'ogrenci_hizmet'
  | 'kurumsal'
  | 'mevzuat'
  | 'iletisim';

export const CATALOG: CatalogEntry[] = [
  // --- ucret ve burs ---
  {
    path: '/icerik/645',
    kategori: 'ucret_burs',
    sorular: ['bölüm ücretleri ne kadar', 'burslu fiyat', '%50 burs indirimi', 'öğrenim ücreti'],
  },
  {
    // Basligi sadece "Ucretler" ama icerigi otopark ve dolap ucretleri;
    // ogrenim ucreti sanip 'ucret_burs' etiketlemek ucret sorularina
    // otopark PDF'i dondurmeye yol aciyordu.
    path: '/icerik/92',
    kategori: 'ogrenci_hizmet',
    sorular: ['otopark ücreti', 'araç park etme', 'dolap ücreti', 'şifreli dolap', 'parking fee'],
  },
  {
    // Lisansustu ucret tablosu. Dikkat: kaynak sayfa akademik yil BELIRTMIYOR,
    // ayrica tabloda "261,827,86₺" seklinde yazim hatasi var.
    path: '/fakulte/lisansustu-egitim-enstitusu-556860/icerik/195',
    kategori: 'ucret_burs',
    sorular: [
      'lisansüstü ücret',
      'yüksek lisans ücreti',
      'tezli tezsiz fiyat',
      'yüksek lisans kontenjanı',
      'master tuition fee',
    ],
  },

  // --- basvuru ve kayit ---
  {
    path: '/icerik/565',
    kategori: 'basvuru_kayit',
    sorular: ['nasıl başvurabilirim', 'başvuru adımları', 'kayıt nasıl yapılır'],
  },
  {
    path: '/icerik/77',
    kategori: 'basvuru_kayit',
    sorular: ['başvuru kriterleri', 'başvuru şartları', 'hangi sınav puanı gerekli'],
  },
  {
    path: '/icerik/79',
    kategori: 'basvuru_kayit',
    sorular: ['kayıt için gerekli belgeler', 'hangi evraklar lazım', 'kayıt evrakları', 'denklik belgesi', 'diploma denkliği', 'equivalence diploma'],
  },
  {
    path: '/icerik/65',
    kategori: 'akademik_takvim',
    sorular: ['akademik takvim', 'dersler ne zaman başlıyor', 'sınav tarihleri'],
  },

  // --- uluslararasi ogrenci ---
  {
    path: '/icerik/73',
    kategori: 'uluslararasi',
    sorular: ['international student fees', 'uluslararası öğrenci ücreti', 'kontenjan', 'tuition fee usd'],
  },
  {
    path: '/icerik/66',
    kategori: 'uluslararasi',
    sorular: ['yabancı uyruklu başvuru', 'foreign student application'],
  },
  {
    path: '/icerik/82',
    kategori: 'uluslararasi',
    sorular: ['kabul kriterleri', 'admission criteria', 'hangi diploma kabul ediliyor', 'diploma recognition', 'признание диплома'],
  },
  {
    path: '/icerik/74',
    kategori: 'uluslararasi',
    sorular: ['türkiyeye giriş', 'vize', 'oturma izni', 'visa residence permit'],
  },
  {
    path: '/icerik/654',
    kategori: 'uluslararasi',
    sorular: ['erasmus öğrenci hareketliliği', 'değişim programı', 'student mobility'],
  },

  // --- konum ve ulasim ---
  {
    path: '/icerik/62',
    kategori: 'konum_ulasim',
    sorular: ['kampüs nerede', 'nasıl gidilir', 'otobüs', 'ulaşım', 'adres', 'how to get there'],
  },
  {
    path: '/icerik/24',
    kategori: 'konum_ulasim',
    sorular: ['kampüs planı', 'kampüs haritası', 'hangi bina nerede'],
  },
  {
    path: '/iletisim',
    kategori: 'iletisim',
    sorular: ['iletişim', 'telefon numarası', 'e-posta', 'adres', 'contact'],
  },

  // --- kampus yasami ---
  {
    path: '/icerik/16',
    kategori: 'kampus_yasam',
    sorular: ['yurt var mı', 'konaklama', 'yurt ücreti', 'dormitory'],
  },
  {
    path: '/icerik/15',
    kategori: 'kampus_yasam',
    sorular: ['yemekhane', 'yiyecek içecek', 'kafeterya', 'yemek ücreti'],
  },
  {
    path: '/icerik/194',
    kategori: 'kampus_yasam',
    sorular: ['kampüste yaşam', 'öğrenci kulüpleri', 'sosyal imkanlar'],
  },
  {
    path: '/icerik/25',
    kategori: 'kampus_yasam',
    sorular: ['bursada yaşam', 'şehir hakkında', 'life in bursa'],
  },
  {
    path: '/icerik/20',
    kategori: 'kampus_yasam',
    sorular: ['sağlık hizmeti', 'revir', 'doktor'],
  },
  {
    path: '/icerik/21',
    kategori: 'kampus_yasam',
    sorular: ['güvenlik', 'kampüs güvenliği'],
  },
  {
    path: '/icerik/23',
    kategori: 'kampus_yasam',
    sorular: ['engelsiz yaşam', 'engelli öğrenci', 'erişilebilirlik'],
  },
  {
    path: '/icerik/191',
    kategori: 'kampus_yasam',
    sorular: ['eğitim alanları', 'sınıflar', 'derslikler'],
  },
  {
    path: '/icerik/29',
    kategori: 'kampus_yasam',
    sorular: ['laboratuvarlar', 'labs'],
  },

  // --- egitim modeli ---
  {
    path: '/icerik/611',
    kategori: 'egitim_modeli',
    sorular: ['3+1 eğitim modeli', 'önlisans işyeri eğitimi'],
  },
  {
    path: '/icerik/612',
    kategori: 'egitim_modeli',
    sorular: ['7+1 eğitim modeli', 'lisans sektör dönemi'],
  },
  {
    path: '/icerik/648',
    kategori: 'egitim_modeli',
    sorular: ['işletmede mesleki eğitim', 'iş yerinde eğitim'],
  },
  {
    path: '/icerik/649',
    kategori: 'egitim_modeli',
    sorular: ['staj', 'zorunlu staj', 'internship'],
  },

  // --- ogrenci hizmetleri ---
  {
    path: '/icerik/110',
    kategori: 'ogrenci_hizmet',
    sorular: ['öğrenci işleri', 'transkript', 'öğrenci belgesi'],
  },
  {
    path: '/icerik/107',
    kategori: 'ogrenci_hizmet',
    sorular: ['sağlık kültür spor', 'sportif faaliyetler', 'kulüp başvurusu'],
  },
  {
    path: '/icerik/546',
    kategori: 'ogrenci_hizmet',
    sorular: ['özel gereksinimli öğrenci', 'destek hizmetleri'],
  },
  {
    path: '/icerik/658',
    kategori: 'ogrenci_hizmet',
    sorular: ['doküman ve formlar', 'dilekçe', 'form indirme'],
  },
  {
    path: '/icerik/657',
    kategori: 'ogrenci_hizmet',
    sorular: ['sık sorulan sorular', 'sss', 'faq'],
  },

  // --- kurumsal ---
  {
    path: '/icerik/71',
    kategori: 'kurumsal',
    sorular: ['hakkımızda', 'üniversite hakkında', 'kaç öğrenci var', 'neden mudanya', 'why choose mudanya', 'why study here'],
  },
  {
    path: '/icerik/5',
    kategori: 'kurumsal',
    sorular: ['misyon vizyon'],
  },
  {
    path: '/icerik/94',
    kategori: 'kurumsal',
    sorular: ['tarihçe', 'ne zaman kuruldu'],
  },
  {
    path: '/icerik/3',
    kategori: 'kurumsal',
    sorular: ['kurucu vakıf', 'vakıf üniversitesi mi'],
  },
  {
    path: '/icerik/kurulus-oykusu',
    kategori: 'kurumsal',
    sorular: ['kuruluş öyküsü'],
  },

  // --- mevzuat ---
  {
    path: '/icerik/81',
    kategori: 'mevzuat',
    sorular: ['yönetmelik', 'yönerge', 'burs yönergesi', 'yatay geçiş yönergesi'],
  },
];

export const KATEGORI_ETIKET: Record<Kategori, string> = {
  ucret_burs: 'Ücret ve Burs',
  basvuru_kayit: 'Başvuru ve Kayıt',
  uluslararasi: 'Uluslararası Öğrenci',
  akademik_takvim: 'Akademik Takvim',
  kampus_yasam: 'Kampüs Yaşamı',
  konum_ulasim: 'Konum ve Ulaşım',
  egitim_modeli: 'Eğitim Modeli',
  ogrenci_hizmet: 'Öğrenci Hizmetleri',
  kurumsal: 'Kurumsal',
  mevzuat: 'Mevzuat',
  iletisim: 'İletişim',
};
