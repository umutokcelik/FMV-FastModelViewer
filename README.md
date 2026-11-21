# FMV · Fast Model Viewer

3B modellerini tarayıcıda veya Electron penceresinde aç. Birden fazla model varsa model rafında önizlemeleri görür ve kartlara tıklayarak aralarında geçiş yaparsın. Model dosyaları ve dokular bilgisayarında kalır.

## Kurulum

Node.js 22.13 veya üzeri ve npm gerekir. Tarayıcıda 3B önizleme için WebGL 2 desteği gerekir.

Proje klasöründe çalıştır:

```sh
npm ci
npm run build
npm link
```

`npm link` etkin Node.js kurulumunun komut dizinine `fmv` bağlantısını ekler. Bu dizin `PATH` üzerindeyse PowerShell, Windows Terminal, Bash ve zsh aynı komutu çalıştırır. PowerShell komut dosyası politikası npm bağlantısını engellerse `fmv.cmd` kullanabilirsin.

### macOS Terminal

Node.js 22.13 veya üzeri ve Git kuruluysa Terminal’de çalıştır:

```sh
git clone https://github.com/umutokcelik/FMV-FastModelViewer.git
cd FMV-FastModelViewer
npm ci
npm run build
npm link
fmv
```

`fmv "$HOME/Models/ornek.glb"` ile doğrudan bir model açabilirsin. `npm link` bu klasöre bağlantı verdiği için kurulumdan sonra klasörü sakla. Bağlantı kurmadan çalıştırmak için proje klasöründe `node bin/fmv.mjs` kullan.

## Kullanım

```sh
fmv
fmv "./Models/model.glb"
fmv "./Models"
fmv --no-open "./Models/my scene.gltf"
fmv --help
```

`fmv` kullanılabilir bir port seçer ve varsayılan tarayıcıyı açar. `--no-open` tarayıcıyı açmadan adresi terminale yazar. Aynı anda birden fazla oturum çalışabilir. `Ctrl+C` yerel sunucuyu durdurur. Komutu sisteme bağlamadan denemek için `node bin/fmv.mjs "./Models"` çalıştırabilirsin.

- Görüntüleyicinin üzerine bir model bırakınca mevcut seçimin yerini alır. Birden fazla model içeren klasör bırakırsan yeni modeller birlikte açılır.
- Rafın üzerine bıraktığın modeller mevcut koleksiyona eklenir ve seçili model sahnede kalır. Bir veya sıfır model varken sürükleme sırasında rafın bırakma alanı görünür. İkinci model eklendiğinde raf her model için bir önizleme gösterir.
- Üst çubuğun sağındaki **Ayarlar** menüsünden karanlık modu açıp kapatabilir, bayraklarla arayüz dilini değiştirebilir ve rafı sola alabilirsin. İlk açılışta tema tarayıcı veya işletim sistemi tercihini izler. Dil tercihi Türkçeyse Türkçe, diğer durumlarda İngilizce seçilir. Manuel seçimler hatırlanır.
- **Arayüz Ölçeği** varsayılan olarak %100’dür. Ayarlardaki **−** ve **+** ile %70–%130 arasında onar puan değiştirilebilir. Uygulama içindeki Ctrl/Cmd ile `+` ve `-` yakınlaştırma kısayolları kapalıdır.
- Sağ üstte, ayarlar çarkının yanındaki **Dosya aç** ve **Klasör aç** ikonlarıyla yeni bir seçim başlatabilirsin. Harici doku, `.mtl` veya `.bin` kullanan modelleri kaynaklarıyla birlikte aç. Kaynaklar alt klasörlerdeyse klasörü seç veya sürükle. CLI’da bir modelin harici kaynaklarını açmak için klasör yolunu verebilirsin.
- Modeli sürükleyerek döndür, tekerlek veya iki parmakla yakınlaştır. Sahne ışığını kullanan bir modelde Alt + sürükle ile ana ışığı hareket ettir.
- Görünüm menüsü modelde bulunan materyal kanallarını, tel kafesi, normal vektörlerini ve UV kontrol desenini gösterir.

Desteklenen biçimler GLB, glTF 2.0, OBJ, FBX, STL, PLY, DAE, 3MF, 3DS, AMF, USD, USDA, USDC, USDZ, WRL, VRML, VOX, VTK, VTP, PCD ve XYZ’dir. Diğer biçimleri bu listeden birine dışa aktararak açabilirsin.

Meshopt sıkıştırması desteklenir. Draco veya KTX2 kullanan modelleri bu sıkıştırmaları kaldırarak yeniden dışa aktar. Animasyonlar oynatılmaz ve modelin uzak URL’lere verdiği kaynak referansları yüklenmez.

## Electron ve paketleme

```sh
npm run desktop
npm run package
npm run package:dir
```

| Komut | Çıktı |
| --- | --- |
| `npm run desktop` | Next.js derlemesini bir Electron penceresinde açar. |
| `npm run package` | Geçerli işletim sistemi için kurulabilir paketi `dist/<sürüm>/` altında üretir. |
| `npm run package:dir` | Kurulum dosyası oluşturmadan çalıştırılabilir bir paket klasörü üretir. |

| Platform | Paket |
| --- | --- |
| Windows | NSIS kurulum dosyası, ör. `dist/1.3.4/FMV Setup 1.3.4.exe` |
| macOS | DMG |
| Linux | AppImage |

Paketleri hedef işletim sisteminde üret. Windows’ta yerel kurulum dosyası imzasız üretilir. Paketlenmiş uygulama Next.js çıktısını ve Electron çalışma zamanını içerir.

## Geliştirme ve beş faz

```sh
npm run dev
npm test
```

`npm run dev`, arayüz geliştirmek için `http://127.0.0.1:3000` adresini kullanır. CLI’ı veya Electron’u son değişikliklerle denemek için üretim derlemesini yenile.

1. **Kaynak modül.** Three.js sahnesi, GLTFLoader, OrbitControls, materyal eşleme, inceleme modları ve ışık kontrolleri kaynak portfolyodan uyarlandı. `lib/viewer/engine.js` dışa aktardığı `createModelViewer(host, asset, callbacks)` ile React’ten bağımsızdır. `asset.path` modelin göreli yolu, `asset.resolve(relativePath)` ise dosya kaynağını çözer. Bileşen kaldırılırken `dispose()` çağrılır.
2. **Next.js arayüzü.** Dosya ve klasör seçme, iki sürükle-bırak bölgesi ve önizleme rafı App Router üzerinde çalışır. Tarayıcıda seçilen dosyalar doğrudan görüntüleyiciye verilir.
3. **CLI.** npm komut bağlantısını sağlar. Yerel sunucu işletim sisteminin atadığı portta `127.0.0.1` üzerinde açılır. Komut satırından seçilen dosyalar ve bunların yerel kaynakları o oturuma ait bir bağlantıyla okunur.
4. **Masaüstü.** Electron aynı statik Next.js çıktısını ve yerel sunucuyu kullanır. Uygulama kapanınca sunucu da durur.
5. **Doğrulama.** `npm test` materyal kanallarını, kamera ve ışık etkileşimlerini, oturum sınırlarını ve eşzamanlı sunucuları kontrol eder.

Kaynak görüntüleyici [umutokcelik/candurmaz-portfolio](https://github.com/umutokcelik/candurmaz-portfolio/tree/main/lib/viewer) reposundadır.
