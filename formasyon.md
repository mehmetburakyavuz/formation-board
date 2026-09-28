# 3D Futbol Taktik Tahtası — Proje Şartnamesi

> Bu dosya Claude Code için yazılmış teknik şartnamedir. Projenin tek doğru kaynağı budur.
> Bir kararı burada bulamazsan en makul varsayımı yap, kodda veya commit mesajında kısaca belirt ve devam et.
> Bu dosyayla çelişen bir şey yapman gerekirse önce bana sor.

---

## 0. Claude Code için çalışma kuralları

1. **Milestone sırasıyla ilerle** (Bölüm 11). Bir milestone'un kabul kriterleri sağlanmadan sonrakine geçme.
2. Her milestone sonunda:
   - `npm run typecheck` ve `npm run lint` hatasız geçmeli.
   - `npm run build` başarılı olmalı.
   - Git commit at: `feat(m<N>): <kısa açıklama>`.
   - Bana 3–5 maddelik kısa bir özet ver: ne yapıldı, nasıl test ederim, bilinen eksikler.
3. Bölüm 2'deki bağımlılıklar dışında **yeni npm paketi eklemeden önce sor**.
4. **Dış asset (model, texture, font dosyası) indirme.** Her şey kodla üretilecek (geometri, canvas texture). Lisans sorunu istemiyorum.
5. Kod ve değişken isimleri **İngilizce**, arayüz metinleri **Türkçe** olacak. Tüm UI metinleri tek bir `src/i18n/tr.ts` dosyasında dursun.
6. `any` kullanma. TypeScript `strict: true`.
7. Büyük dosyalardan kaçın: bir dosya ~300 satırı geçiyorsa böl.
8. Her şeyi bir seferde yazmaya çalışma; çalışan küçük adımlarla ilerle ve tarayıcıda denenebilir tut.

---

## 1. Vizyon

Tarayıcıda çalışan, 3D bir futbol sahası üzerinde oyuncuları **fareyle/parmakla sürükleyerek** dizebildiğim, formasyonları tek tıkla değiştirebildiğim ve oyuncularıma **ok, bölge ve talimat** çizerek direktif verebildiğim bir taktik tahtası. Kendimi soyunma odasında tahtanın başındaki teknik direktör gibi hissetmeliyim.

Temel his:
- Kamera serbestçe **360° dönebilmeli**, yakınlaşıp uzaklaşabilmeli, hazır açılar arasında **yumuşak geçişle** gidebilmeli.
- Oyuncu sürüklemek **anında ve kaygan** hissettirmeli; hiçbir zaman kamera ile sürükleme birbirine karışmamalı.
- Formasyon değişimleri **animasyonlu** olmalı (oyuncular yeni pozisyonlarına koşar gibi kaysın).
- Görsel stil: temiz, modern, “yayın grafiği” kalitesinde; gerçekçi çim + stilize oyuncu figürleri. Karikatür değil, ucuz da değil.

---

## 2. Teknoloji yığını

| Alan | Seçim |
|---|---|
| Build | Vite |
| Dil | TypeScript (strict) |
| 3D | three.js (npm'deki güncel kararlı sürüm) + `three/examples/jsm` içindeki `OrbitControls` |
| UI | Framework yok — sade HTML + CSS (CSS değişkenleri), DOM overlay |
| Animasyon/tween | Kendi küçük tween yardımcımız (`src/core/tween.ts`, easing fonksiyonlarıyla). Paket yok. |
| Metin etiketleri | `CSS2DRenderer` (three/examples/jsm) — oyuncu isim/numara etiketleri için |
| Lint/format | ESLint + Prettier |
| Test | Vitest (sadece saf mantık için: formasyon dönüşümleri, koordinat eşlemesi, undo/redo) |

`package.json` scriptleri: `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`), `lint`, `test`.

---

## 3. Koordinat sistemi ve ölçüler

- **1 birim = 1 metre.** Y ekseni yukarı.
- Saha merkezi dünya orijininde `(0, 0, 0)`.
- Saha uzunluğu **X ekseni** boyunca (105 m, `x ∈ [-52.5, 52.5]`), genişliği **Z ekseni** boyunca (68 m, `z ∈ [-34, 34]`).
- **Ev sahibi takım +X yönüne hücum eder.** Deplasman takımı −X yönüne.

### 3.1 Saha çizgileri (FIFA ölçüleri)

| Öğe | Ölçü |
|---|---|
| Saha | 105 × 68 m |
| Çizgi kalınlığı | 0.12 m |
| Orta yuvarlak yarıçapı | 9.15 m |
| Ceza sahası | Kale çizgisinden 16.5 m derin, 40.32 m geniş |
| Kale alanı | 5.5 m derin, 18.32 m geniş |
| Penaltı noktası | Kale çizgisinden 11 m |
| Ceza yayı | Penaltı noktası merkezli, r = 9.15 m, sadece ceza sahası dışında kalan kısım |
| Korner yayları | r = 1 m |
| Kale | 7.32 m iç genişlik, 2.44 m yükseklik, direk kalınlığı 0.12 m, ağ derinliği ~2 m |

Çizgiler zemin üzerinde z-fighting olmaması için `y = 0.01` yüksekliğinde, `polygonOffset` kullanan ince düz geometriler olarak çizilsin (Line primitive değil — kalınlık tutarlı olsun).

### 3.2 Normalize formasyon koordinatları

Formasyonlar takımdan bağımsız, normalize koordinatlarla tanımlanır:

- `nx ∈ [0, 1]`: 0 = kendi kale çizgisi, 1 = rakip kale çizgisi
- `ny ∈ [0, 1]`: hücum yönüne bakarken 0 = sol taç çizgisi, 1 = sağ taç çizgisi

Dünyaya eşleme (`src/core/coords.ts`):

```ts
// Ev sahibi (+X'e hücum). +X'e bakarken sol taraf -Z'dir.
home:  worldX = (nx - 0.5) * 105;  worldZ = (ny - 0.5) * 68
// Deplasman: noktasal yansıma
away:  worldX = (0.5 - nx) * 105;  worldZ = (0.5 - ny) * 68
```

Ters dönüşüm (`worldToNormalized`) de yazılsın ve Vitest ile gidiş-dönüş testi olsun.

---

## 4. Sahne ve görsel tasarım

### 4.1 Zemin
- Saha + çevresinde ~6 m pay (çim alanı saha dışına da taşar).
- Çim: `CanvasTexture` ile üretilen **biçme şeritleri** (açık/koyu yeşil, saha uzunluğu boyunca ~12 şerit) + hafif gürültü. `MeshStandardMaterial`, `roughness` yüksek.
- Sahanın dışında koyu bir zemin/“stadyum tabanı” düzlemi, ufka doğru kararan arka plan (gradient `scene.background` veya büyük küre).

### 4.2 Işık
- `HemisphereLight` (gökyüzü/zemin) + bir adet `DirectionalLight` (gölge açık, gölge kamerası sahayı tam kapsayacak şekilde ayarlı, `shadow.mapSize` 2048).
- Oyuncular gölge düşürsün; saha gölge alsın.
- Tone mapping: `ACESFilmicToneMapping`, `outputColorSpace = SRGBColorSpace`.

### 4.3 Kaleler
Direkler ve üst direk silindirlerden; ağ yarı saydam, ince çizgili (wireframe benzeri basit bir mesh yeterli).

### 4.4 Oyuncu figürü (`src/scene/PlayerMesh.ts`)
Harici model yok. Stilize ama şık bir figür:
- Gövde: `CapsuleGeometry` (yükseklik ~1.8 m), takım rengi.
- Baş: küçük küre, ten rengi nötr.
- Zemin halkası: oyuncunun altında ince bir disk/halka (takım rengi, seçiliyken parlak + hafif nabız animasyonu).
- Forma numarası: gövdenin önünde ve arkasında `CanvasTexture` ile çizilmiş numara.
- `CSS2DRenderer` ile başın üstünde **isim + numara** etiketi (ayarlardan gizlenebilir).
- Kaleci farklı renk formada.
- Hover: hafif büyüme (scale 1.05) + imleç `grab`. Sürüklerken: `grabbing`, figür 0.3 m yukarı kalkar, altında gölge/halka yerde kalır.
- Oyuncu figürü her zaman **hücum yönüne** baksın; ok çizilmişse ok yönüne dönebilir (opsiyonel, M8).

### 4.5 Top
Beyaz küre (r = 0.11 m, görünürlük için 1.5× büyütülebilir ayarı), sürüklenebilir. Siyah beşgen deseni canvas texture ile.

---

## 5. Kamera

- `PerspectiveCamera` (fov 45) + `OrbitControls`:
  - `enableDamping = true`
  - `maxPolarAngle` ≈ 85° (sahanın altına girilemesin)
  - `minDistance` 8, `maxDistance` 160
  - Pan açık, pan hedefi saha sınırları + pay içinde clamp edilsin.
- **Hazır açılar** (UI butonları + klavye kısayolları), hepsi ~0.8 sn easeInOutCubic geçişle hem kamera pozisyonu hem `controls.target` tween'lenerek:
  1. `1` — **Taktik (tepeden)**: tam yukarıdan, tüm saha görünür.
  2. `2` — **Yayın açısı**: tribünden, yan çizginin ortasından ~35° eğimle.
  3. `3` — **Kale arkası (ev sahibi)**: kendi kalemizin arkasından hücum yönüne bakış.
  4. `4` — **Kale arkası (deplasman)**.
  5. `5` — **3/4 perspektif**: köşeden, sinematik.
- **Otomatik 360° dönüş**: `R` tuşu veya buton ile aç/kapa (`controls.autoRotate`). Kullanıcı etkileşime geçince durmasın, sadece butonla kapansın.
- **Oyuncu gözünden** (opsiyonel, M8): seçili oyuncuya çift tık → kamera oyuncunun göz hizasına (1.7 m) geçip hücum yönüne bakar; `Esc` ile geri döner.
- Pencere yeniden boyutlanınca aspect ve renderer güncellensin; `devicePixelRatio` en fazla 2 ile sınırlansın.

---

## 6. Etkileşim

### 6.1 Sürükle-bırak (`src/interaction/DragController.ts`)
- **Pointer Events** kullan (mouse + touch + kalem tek API). `setPointerCapture` ile.
- `Raycaster` ile oyuncu/top seçimi; sürükleme sırasında pozisyon, `y = 0` zemin düzlemiyle (`THREE.Plane`) kesişimden hesaplanır.
- Sürükleme başladığı anda `controls.enabled = false`, bitince `true`. Boş alana tıklama kamerayı döndürür — **oyuncuya basılı tutma asla kamerayı döndürmemeli.**
- Sürüklenen noktada, oyuncunun tutulduğu yerle merkezi arasındaki ofset korunsun (oyuncu imlecin altına zıplamasın).
- Pozisyonlar saha sınırı + 3 m pay içinde clamp edilsin.
- **Snap** (ayarlardan aç/kapa, `G` tuşu): 1 m ızgaraya yapışma. Snap açıkken zeminde hafif ızgara çizgileri görünsün.
- **Çakışma önleme**: bırakıldığında başka bir oyuncuyla 0.8 m'den yakınsa hafifçe itilsin (basit çözüm yeterli).
- Sürükleme sırasında yerde, oyuncunun **başlangıç noktasından yeni noktasına** soluk bir kesikli çizgi ve mesafe etiketi (örn. "12.4 m") görünsün.

### 6.2 Seçim
- Tek tık: seç. `Shift` + tık: seçime ekle/çıkar.
- `Shift` + boş alanda sürükle: **kutu seçimi** (ekran uzayında dikdörtgen; bu sırada kamera dönmez).
- Birden fazla oyuncu seçiliyken sürükleme hepsini birlikte taşır (grup, göreli konumlarını korur).
- `Esc`: seçimi temizle. `Ctrl/Cmd + A`: aktif takımın tamamını seç.

### 6.3 Undo/Redo
- Komut deseni (`src/state/history.ts`). En az 100 adım.
- `Ctrl/Cmd + Z` geri, `Ctrl/Cmd + Shift + Z` veya `Ctrl/Cmd + Y` ileri.
- Bir sürükleme (bırakılana kadar) tek bir adım sayılır. Formasyon değişimi tek adım.

### 6.4 Mobil / dokunmatik
- Tek parmak oyuncu üzerinde: sürükle. Tek parmak boşlukta: kamerayı döndür. İki parmak: zoom/pan (OrbitControls varsayılanı).
- UI paneli dar ekranda alttan açılan çekmeceye dönüşsün (< 768 px).

---

## 7. Formasyonlar

### 7.1 Veri modeli (`src/data/formations.ts`)

```ts
type Role =
  | 'GK' | 'LB' | 'LCB' | 'CB' | 'RCB' | 'RB' | 'LWB' | 'RWB'
  | 'CDM' | 'LDM' | 'RDM' | 'LCM' | 'CM' | 'RCM' | 'LM' | 'RM'
  | 'LAM' | 'CAM' | 'RAM' | 'LW' | 'RW' | 'LS' | 'ST' | 'RS';

interface FormationSlot { role: Role; nx: number; ny: number; }
interface Formation { id: string; name: string; slots: FormationSlot[]; } // her zaman 11 slot, ilki GK
```

### 7.2 Hazır formasyonlar (başlangıç değerleri — normalize koordinat `(nx, ny)`)

GK her formasyonda `(0.05, 0.50)`.

**4-4-2**: LB (0.25, 0.12), LCB (0.22, 0.37), RCB (0.22, 0.63), RB (0.25, 0.88), LM (0.45, 0.12), LCM (0.42, 0.38), RCM (0.42, 0.62), RM (0.45, 0.88), LS (0.62, 0.40), RS (0.62, 0.60)

**4-3-3**: LB (0.25, 0.12), LCB (0.22, 0.37), RCB (0.22, 0.63), RB (0.25, 0.88), CDM (0.36, 0.50), LCM (0.45, 0.32), RCM (0.45, 0.68), LW (0.65, 0.13), ST (0.68, 0.50), RW (0.65, 0.87)

**4-2-3-1**: LB (0.25, 0.12), LCB (0.22, 0.37), RCB (0.22, 0.63), RB (0.25, 0.88), LDM (0.38, 0.40), RDM (0.38, 0.60), LAM (0.55, 0.15), CAM (0.55, 0.50), RAM (0.55, 0.85), ST (0.68, 0.50)

**4-1-4-1**: LB (0.25, 0.12), LCB (0.22, 0.37), RCB (0.22, 0.63), RB (0.25, 0.88), CDM (0.33, 0.50), LM (0.47, 0.12), LCM (0.47, 0.38), RCM (0.47, 0.62), RM (0.47, 0.88), ST (0.66, 0.50)

**3-5-2**: LCB (0.22, 0.28), CB (0.20, 0.50), RCB (0.22, 0.72), LWB (0.42, 0.08), LCM (0.44, 0.32), CM (0.38, 0.50), RCM (0.44, 0.68), RWB (0.42, 0.92), LS (0.64, 0.40), RS (0.64, 0.60)

**3-4-3**: LCB (0.22, 0.28), CB (0.20, 0.50), RCB (0.22, 0.72), LWB (0.42, 0.10), LCM (0.42, 0.38), RCM (0.42, 0.62), RWB (0.42, 0.90), LW (0.64, 0.18), ST (0.68, 0.50), RW (0.64, 0.82)

**5-3-2**: LWB (0.28, 0.08), LCB (0.22, 0.30), CB (0.20, 0.50), RCB (0.22, 0.70), RWB (0.28, 0.92), LCM (0.42, 0.30), CM (0.40, 0.50), RCM (0.42, 0.70), LS (0.60, 0.40), RS (0.60, 0.60)

### 7.3 Formasyon değiştirme
- UI'dan formasyon seçilince oyuncular yeni slotlara **~0.9 sn easeInOutCubic** ile kayar; her oyuncuya 0–120 ms rastgele gecikme ekle (daha doğal görünür).
- **Oyuncu–slot eşleşmesi**: oyuncular kimliklerini korur. Eşleşme önce rol benzerliğine (aynı rol > aynı hat: savunma/orta saha/hücum > en yakın mesafe) göre yapılsın; basit bir greedy eşleştirme yeterli. Bu fonksiyon saf olsun ve Vitest ile test edilsin.
- Kullanıcı oyuncuları elle oynattıktan sonra **“Özel formasyon olarak kaydet”** diyebilsin (isim verir, listeye eklenir, localStorage'a yazılır).

### 7.4 Oyun evreleri (Topa sahipken / Top rakipteyken)
Gerçekçi direktifler için her kadro iki ayrı dizilim tutar:
- **Hücum evresi** ve **Savunma evresi**. UI'da bir anahtar ile geçiş yapılır, oyuncular animasyonla iki dizilim arasında kayar.
- Varsayılan savunma dizilimi, hücum diziliminden otomatik türetilsin: `nx` değerleri ~0.8 ile sıkıştırılıp geri çekilsin, `ny` değerleri merkeze doğru ~0.9 ile daraltılsın (kompakt blok). Kullanıcı sonra her evreyi ayrı ayrı elle düzenleyebilir.

---

## 8. Takımlar ve kadro

- İki takım: **Ev sahibi** ve **Deplasman**. Her biri 11 oyuncu.
- Takım başına ayarlar: isim, forma rengi, numara rengi, kaleci forma rengi, formasyon.
- Oyuncu başına: isim, numara, rol, **talimat etiketleri** (bkz. 9.3).
- Rakip takım **gizlenebilir** (sadece kendi takımıma odaklanmak için) veya **soluk** gösterilebilir.
- **Aktif takım**: sürükleme ve seçim sadece aktif takımda (ve topta) çalışsın; diğer takım kilitli. `T` tuşu aktif takımı değiştirir.
- Oyuncu listesi panelde görünsün; isim/numara çift tıkla düzenlenebilsin. Listede bir oyuncuya tıklamak sahnede onu seçer.

---

## 9. Direktif araçları (teknik direktör modu)

Araç çubuğu (üst veya sol), her aracın klavye kısayolu olsun:

| Araç | Kısayol | Davranış |
|---|---|---|
| Seç/Taşı | `V` | Varsayılan araç. |
| Koşu oku | `A` | Oyuncudan başlayıp sürüklenen noktaya **düz, sürekli** ok. |
| Pas oku | `P` | **Kesikli** ok; bir oyuncudan başka bir oyuncuya veya noktaya. Hedef oyuncu üzerindeyse ok o oyuncuya yapışır ve oyuncu hareket edince ok da güncellenir. |
| Top sürme | `D` | **Zikzak/dalgalı** ok. |
| Bölge | `Z` | Zeminde sürükleyerek yarı saydam dikdörtgen/elips bölge (örn. pres alanı, boşluk). Renk seçilebilir. |
| Metin notu | `N` | Zemine veya oyuncuya iliştirilen kısa not (CSS2D etiketi). |
| Silgi | `E` | Tıklanan oku/bölgeyi/notu siler. |

Ok detayları:
- Oklar zeminde, `y = 0.02`'de, düz şerit geometrisi (tube değil) + üçgen uç.
- **Eğri ok**: sürüklerken `Alt` basılıysa kuadratik Bezier eğrisine dönüşür (kontrol noktası sonradan bir tutamaçla ayarlanabilir).
- Ok renkleri: koşu = sarı, pas = beyaz, top sürme = turuncu. Ayarlardan değiştirilebilir.
- Oyuncuya bağlı oklar oyuncu taşınınca başlangıç noktasıyla birlikte hareket eder.
- Tüm çizimler undo/redo'ya dahil.

### 9.3 Oyuncu talimat etiketleri
Seçili oyuncuya panelden hızlı talimat verilebilsin (çoklu seçilebilir, oyuncunun etiketinin altında küçük rozetler olarak görünür):
`Bindirme yap`, `İçe kat`, `Önde pres`, `Geride kal`, `Adam adama`, `Derinlemesine koşu`, `Kanadı genişlet`, `Topu iste`, `Serbest rol`.
Liste `src/data/instructions.ts` içinde, kolayca genişletilebilir olsun.

---

## 10. Senaryo / animasyon modu (adım adım oyun kurgusu)

Bir hücum organizasyonunu anlatabilmek için:
- **Kareler (keyframes)**: “Kare ekle” butonu mevcut tüm oyuncu + top pozisyonlarını ve çizimleri kaydeder.
- Alt kısımda bir zaman çizelgesi: kareler küçük kartlar olarak; tıklayınca o kareye animasyonla gidilir, sürükleyerek sıraları değiştirilir, silinebilir.
- **Oynat**: kareler arasında sırayla animasyon (her geçiş varsayılan 1.2 sn, kare başına ayarlanabilir). Duraklat / başa dön. Oynatma hızı 0.5×, 1×, 2×.
- Oynatma sırasında top pas okları boyunca hareket etsin (top bir oyuncuya iliştirilmişse onunla birlikte gitsin).

---

## 11. Kaydetme, paylaşma, dışa aktarma

- **Otomatik kayıt**: tüm durum 1 sn debounce ile `localStorage`'a. Sayfa yenilenince kaldığı yerden devam.
- **Taktik kütüphanesi**: birden fazla isimli taktik kaydet/yükle/sil/çoğalt.
- **JSON dışa/içe aktarma**: dosya olarak indir / dosya seçerek yükle. Şemada `version` alanı olsun; yüklerken doğrulansın, hatalı dosyada kullanıcıya Türkçe hata mesajı.
- **PNG ekran görüntüsü**: mevcut kamera açısından yüksek çözünürlüklü (2×) görüntü indir. Etiketler de görünsün (CSS2D katmanını canvas'a çizmen gerekecek — etiketleri ekran görüntüsü sırasında canvas'a render eden bir yol bul).
- Durum şeması tek bir yerde tanımlı olsun (`src/state/schema.ts`).

---

## 12. Arayüz düzeni

- Tam ekran 3D canvas.
- **Sol panel** (daraltılabilir): takım seçimi, formasyon seçici (küçük mini-saha önizlemeli kartlar), evre anahtarı (Hücum/Savunma), oyuncu listesi, talimat rozetleri.
- **Üst araç çubuğu**: direktif araçları, undo/redo, snap, etiket göster/gizle.
- **Sağ alt**: kamera açı butonları + 360° dönüş + tam ekran.
- **Alt**: senaryo zaman çizelgesi (M6'dan itibaren; kare yoksa gizli).
- **Kısayol yardımı**: `?` tuşu ile açılan modal.
- Stil: koyu tema, yarı saydam “cam” paneller (`backdrop-filter: blur`), yumuşak köşeler, tek vurgu rengi. Tipografi sistem font yığını. Tüm renkler CSS değişkeni.
- Erişilebilirlik: tüm butonların `aria-label`'ı, görünür focus halkası, klavyeyle panel kullanılabilir.

---

## 13. Dosya yapısı

```
src/
  main.ts                  # giriş noktası, uygulamayı kurar
  app/App.ts               # modülleri birbirine bağlar
  core/
    coords.ts              # normalize <-> dünya dönüşümleri
    tween.ts               # tween + easing
    events.ts              # basit tipli event bus
  scene/
    SceneManager.ts        # renderer, sahne, ışık, render döngüsü
    Pitch.ts               # zemin, çizgiler, kaleler
    PlayerMesh.ts
    Ball.ts
    DrawingLayer.ts        # oklar, bölgeler, notlar
    CameraRig.ts           # OrbitControls + hazır açılar + geçişler
  interaction/
    DragController.ts
    SelectionController.ts
    ToolController.ts      # aktif araca göre pointer olaylarını yönlendirir
    shortcuts.ts
  state/
    store.ts               # tek merkezi durum + abonelik
    schema.ts
    history.ts             # undo/redo
    persistence.ts         # localStorage, JSON import/export
  data/
    formations.ts
    instructions.ts
  logic/
    assignSlots.ts         # oyuncu-slot eşleştirme
    phases.ts              # savunma evresi türetme
  ui/
    Sidebar.ts, Toolbar.ts, CameraControls.ts, Timeline.ts, HelpModal.ts
    styles.css
  i18n/tr.ts
tests/
  coords.test.ts, assignSlots.test.ts, history.test.ts, phases.test.ts
```

**Mimari kural**: Durum tek kaynaktan (`store`) yönetilir. Sahne nesneleri durumu **okur ve yansıtır**; kullanıcı eylemleri store'a komut olarak gider (undo/redo bu sayede çalışır). Sahne kodu doğrudan DOM UI'a, UI kodu doğrudan three.js nesnelerine dokunmaz.

---

## 14. Performans ve kalite

- 60 FPS hedefi (orta seviye dizüstü, entegre GPU).
- Geometri ve materyaller oyuncular arasında paylaşılsın (numara texture'ları hariç).
- Raycast sadece etkileşimli nesnelere (oyuncular, top, çizimler) yapılsın.
- Pencere arka plandayken render döngüsü `requestAnimationFrame` sayesinde zaten durur; ek iş yok.
- Konsolda hata/uyarı olmamalı.
- Nesne kaldırılırken `geometry.dispose()` / `material.dispose()` / `texture.dispose()` çağrılsın.

---

## 15. Milestone'lar ve kabul kriterleri

### M1 — İskelet, saha, kamera
- Vite + TS + ESLint + Prettier + Vitest kurulu, scriptler çalışıyor.
- Ölçülere uygun saha, çizgiler, kaleler, çim şeritleri, ışık ve gölge.
- OrbitControls sınırlarıyla çalışıyor; 5 hazır açı butonu ve `1–5` kısayolları yumuşak geçişle çalışıyor; `R` ile 360° dönüş.
- `coords.ts` + testleri.
- ✅ Kabul: Sahayı her açıdan döndürebiliyorum, sahanın altına giremiyorum, çizgiler titremiyor.

### M2 — Oyuncular ve sürükle-bırak
- 22 oyuncu + top, varsayılan olarak iki takım 4-4-2.
- Sürükle-bırak (mouse + touch), ofset korunumu, sınır clamp, sürükleme sırasında kamera kilidi, mesafe göstergesi.
- Hover/seçim görselleri, çoklu seçim, kutu seçimi, grup sürükleme.
- Snap + ızgara, çakışma önleme.
- ✅ Kabul: Bir oyuncuyu tutup bıraktığımda kamera asla dönmüyor; telefonda da parmakla sürükleyebiliyorum.

### M3 — Store, undo/redo, formasyonlar
- Merkezi store + history, tüm eylemler komut olarak.
- 7 hazır formasyon, animasyonlu geçiş, akıllı slot eşleştirme (+ testler).
- Hücum/Savunma evreleri ve geçiş animasyonu (+ `phases` testleri).
- Özel formasyon kaydetme.
- ✅ Kabul: 4-4-2'den 3-5-2'ye geçince oyuncular mantıklı pozisyonlara kayıyor; Ctrl+Z geri alıyor.

### M4 — Arayüz
- Sol panel, üst araç çubuğu, kamera kontrolleri, kısayol modalı, mobil çekmece.
- Takım ayarları (renk, isim), oyuncu listesi ve düzenleme, aktif takım, rakibi gizle/soluklaştır.
- ✅ Kabul: Fare kullanmadan sadece klavyeyle formasyon değiştirip kamera açısı değiştirebiliyorum.

### M5 — Direktif araçları
- Koşu/pas/top sürme okları, eğri oklar, oyuncuya bağlı oklar, bölgeler, notlar, silgi.
- Oyuncu talimat rozetleri.
- ✅ Kabul: Bir bek için bindirme koşusu, bir orta saha için pas oku çizip pres bölgesi işaretleyebiliyorum; oyuncuyu taşıyınca oklar takip ediyor.

### M6 — Senaryo modu
- Kareler, zaman çizelgesi, oynatma/duraklatma/hız, topun pas boyunca hareketi.
- ✅ Kabul: 4 karelik bir hücum organizasyonu kurup baştan sona oynatabiliyorum.

### M7 — Kaydetme ve dışa aktarma
- Otomatik kayıt, taktik kütüphanesi, JSON içe/dışa aktarma (doğrulamalı), PNG ekran görüntüsü (etiketlerle).
- ✅ Kabul: Sayfayı yenileyince her şey yerinde; dışa aktardığım JSON'u başka tarayıcıda açınca aynı taktik geliyor.

### M8 — Cila
- Oyuncu gözünden kamera, oyuncuların ok yönüne dönmesi, küçük mikro-animasyonlar (seçim nabzı, bırakınca hafif zıplama).
- Performans turu, dispose kontrolü, konsol temizliği.
- README.md: kurulum, kullanım, kısayollar tablosu.
- ✅ Kabul: Uygulama “bitmiş ürün” hissi veriyor; 60 FPS.

---

## 16. Kapsam dışı (şimdilik yapma)

- Backend, kullanıcı hesabı, çoklu kullanıcı / canlı paylaşım.
- Gerçekçi insan modelleri, iskelet animasyonu (koşma animasyonu vb.).
- Yapay zekâ ile otomatik taktik önerisi.
- Gerçek kulüp/oyuncu isimleri, logolar veya lisanslı formalar.
