# 3D Futbol Taktik Tahtası

Tarayıcıda çalışan, 3D saha üzerinde oyuncuları sürükleyerek dizebildiğiniz, formasyonları
tek tıkla değiştirebildiğiniz ve ok, bölge ve notlarla direktif verebildiğiniz bir taktik tahtası.
Adım adım hücum organizasyonları kurup oynatabilir, taktikleri kaydedip JSON/PNG olarak
paylaşabilirsiniz.

Harici model, doku veya font yoktur; saha, oyuncular, top ve tüm dokular kodla üretilir.

## Kurulum

Gereksinim: Node.js 20.19+ (veya 22.12+).

```bash
npm install
npm run dev        # geliştirme sunucusu → http://localhost:5173
```

| Script              | Açıklama                                  |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Vite geliştirme sunucusu                  |
| `npm run build`     | Tip kontrolü + üretim derlemesi (`dist/`) |
| `npm run preview`   | Derlenmiş sürümü yerelde sunar            |
| `npm run typecheck` | `tsc --noEmit`                            |
| `npm run lint`      | ESLint + Prettier kontrolü                |
| `npm run test`      | Vitest birim testleri (saf mantık)        |

Telefonda denemek için: `npx vite --host` ve aynı ağdaki cihazdan bilgisayarın IP adresine bağlanın.

## Kullanım

### Kamera

- **Sol sürükle** (boş alanda) döndürür, **sağ sürükle** kaydırır, **tekerlek** yakınlaştırır.
  Dokunmatikte tek parmak döndürür, iki parmak yakınlaştırır/kaydırır.
- Sağ alttaki düğmeler veya `1`–`5`: Taktik (tepeden), Yayın, Kale arkası (ev / deplasman), 3/4.
- `R` 360° otomatik dönüşü açar/kapatır.
- **Oyuncu gözünden:** seçim aracıyla bir oyuncuya çift tıklayın; `Esc` ile önceki açıya dönün.

### Oyuncular ve formasyonlar

- Oyuncuları ve topu sürükleyin (fare, dokunmatik, kalem). Oyuncuya basılıyken kamera asla dönmez.
- `Shift` + tık seçime ekler, `Shift` + boş alanda sürükle kutu seçimi yapar; seçili grup birlikte taşınır.
- `G` 1 m ızgaraya yapışmayı açar. Bırakılan oyuncu, başkasına 0,8 m'den yakınsa hafifçe itilir.
- Sol panel: aktif takım, takım adı ve renkleri, rakibi göster/soluk/gizle, formasyon kartları,
  **Hücum / Savunma** evresi (her evrenin dizilimi ayrı düzenlenir), oyuncu listesi
  (çift tıkla isim/numara düzenleme) ve **özel formasyon** kaydetme.
- Formasyon değişiminde oyuncular kimliklerini korur; rol > hat > mesafe önceliğiyle yeni yerlerine koşar.
- Oyuncu figürleri kodla üretilir (forma, şort, tozluk takım renklerinden); yer değiştirirken koşu
  hareketiyle gittikleri yöne döner, durunca hücum yönüne (veya koşu okuna) bakarlar.

### Direktif araçları

| Araç       | Kısayol | Kullanım                                                                   |
| ---------- | ------- | -------------------------------------------------------------------------- |
| Seç / Taşı | `V`     | Oyuncu, top ve çizim seçer; seçili okun tutamacıyla eğri ayarlanır         |
| Koşu oku   | `A`     | Oyuncudan sürükleyin (düz, sarı)                                           |
| Pas oku    | `P`     | Kesikli, beyaz; bir oyuncunun üzerine bırakılırsa ona yapışır ve onu izler |
| Top sürme  | `D`     | Dalgalı, turuncu ok                                                        |
| Bölge      | `Z`     | Zeminde dikdörtgen/elips (renk ve şekil sol panelde)                       |
| Not        | `N`     | Zemine veya oyuncuya kısa not; notu düzenlemek için çift tıklayın          |
| Silgi      | `E`     | Tıklanan oku, bölgeyi veya notu siler                                      |

- Sürüklerken `Alt` basılıysa ok eğri (Bézier) olur.
- Oyuncuya bağlı oklar ve notlar oyuncu taşınınca onu takip eder; oyuncular kendi koşu okları yönüne döner.
- Seçili oyunculara sol panelden **talimat rozetleri** verilir (Bindirme yap, Önde pres…).

### Senaryo modu

1. Tahtayı kurun, `K` (veya araç çubuğundaki kare düğmesi) ile **kare ekleyin**.
2. Oyuncuları, topu ve okları değiştirip yeni kareler ekleyin.
3. Alttaki zaman çizelgesinden **Oynat** (`Boşluk`). Hız 0,5× / 1× / 2×; kare başına geçiş süresi ayarlanabilir.
   Kartlar sürüklenerek (veya `Alt` + `←/→`) sıralanır.

Top, sahibinin pas oku varsa ok boyunca koşan alıcıya gider, yoksa topu tutan oyuncuyla birlikte taşınır.

### Kaydetme ve paylaşma

- Her şey otomatik olarak tarayıcıya kaydedilir; sayfa yenilenince kaldığınız yerden devam edersiniz.
- `Ctrl+S` taktik kütüphanesini açar: kaydet, yükle, çoğalt, sil.
- **JSON olarak indir / JSON dosyası yükle** ile taktikleri başka tarayıcı veya kişilerle paylaşın
  (dosyalar sürüm bilgisi taşır ve yüklenirken doğrulanır).
- **PNG ekran görüntüsü**: mevcut kamera açısından, etiketlerle birlikte 2× çözünürlük.
- Yükleme ve içe aktarma dahil tüm düzenlemeler `Ctrl+Z` ile geri alınabilir.

## Klavye kısayolları

| Kısayol                     | İşlev                                                  |
| --------------------------- | ------------------------------------------------------ |
| `V` `A` `P` `D` `Z` `N` `E` | Araçlar (seç, koşu, pas, top sürme, bölge, not, silgi) |
| `Alt` (sürüklerken)         | Eğri ok                                                |
| `Delete` / `Backspace`      | Seçili çizimi sil                                      |
| `1` – `5`                   | Hazır kamera açıları                                   |
| `R`                         | 360° otomatik dönüş                                    |
| `F`                         | Tam ekran                                              |
| Oyuncuya çift tık           | Oyuncu gözünden bak (`Esc` ile çık)                    |
| `Ctrl+Z`                    | Geri al                                                |
| `Ctrl+Shift+Z` / `Ctrl+Y`   | İleri al                                               |
| `G`                         | Izgaraya yapış                                         |
| `L`                         | Etiketleri göster/gizle                                |
| `T`                         | Aktif takımı değiştir                                  |
| `Ctrl+A`                    | Aktif takımın tamamını seç                             |
| `Esc`                       | Seçimi temizle / işlemi iptal et                       |
| `K`                         | Senaryoya kare ekle                                    |
| `Boşluk`                    | Senaryoyu oynat / duraklat                             |
| `Ctrl+S`                    | Taktik kütüphanesi                                     |
| `?`                         | Kısayol yardımı                                        |

macOS'ta `Ctrl` yerine `Cmd` kullanılabilir.

## Mimari

```
src/
  app/          App (modülleri bağlar), Controller (kullanıcı niyetleri → komutlar),
                ScenarioPlayer/Actions, LibraryActions, Autosave
  core/         koordinat dönüşümleri, tween, event bus
  scene/        three.js: saha, oyuncular, top, çizimler, kamera, ekran görüntüsü
  interaction/  pointer yönlendirme, araçlar, sürükleme, seçim, kısayollar
  state/        store, şema (tek kaynak), komutlar/undo, doğrulama, kalıcılık
  logic/        saf mantık: slot eşleştirme, evreler, ok geometrisi, senaryo interpolasyonu
  data/         formasyonlar, talimatlar
  ui/           DOM arayüzü (panel, araç çubuğu, zaman çizelgesi, pencereler)
  i18n/tr.ts    tüm arayüz metinleri
tests/          Vitest testleri
```

- Durum tek bir store'dadır; sahne durumu okuyup yansıtır, kullanıcı eylemleri store'a
  **komut** olarak gider (undo/redo bu sayede çalışır).
- Sahne kodu arayüz DOM'una, arayüz kodu three.js nesnelerine dokunmaz.
- Kalıcı verinin biçimi `src/state/schema.ts` içinde (`TacticDocument`, `SCHEMA_VERSION`).

## Lisans notu

Tüm görseller kodla üretilir; üçüncü taraf model, doku veya font kullanılmaz.
Gerçek kulüp, oyuncu isimleri veya logolar içermez.
