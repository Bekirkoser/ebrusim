# Ebrusim Android — ilk sürüm

Android uygulaması `android/` klasöründedir. İnternet bağlantısı olmadan çalışır;
ebrusim.art sitesini açmaz. Paket kimliği `art.ebrusim.app`, sürüm `1.0.0` (1).
Android 8.0+ ve OpenGL ES 3 destekli cihazlar hedeflenir; target/compile SDK 36.

## Telefonunda denemek

GitHub'daki **Actions → Android build → son başarılı çalıştırma → Artifacts →
ebrusim-android** dosyasını indir. ZIP içindeki `app-debug.apk` telefona yüklenebilir.
Bu bir test sürümüdür. `app-release.aab` imzasızdır; doğrudan telefona kurulmaz ve
imzalanmadan Google Play'e gönderilmez.

Alternatif olarak Windows veya Mac'te Android Studio ile:

1. Node.js 18+ ve Android Studio kur. SDK Manager'dan Android SDK Platform 36 kur.
2. Projeyi klonla, `codex/android-app` dalına geç.
3. Terminalde proje kökünde `npm test` çalıştır. Npm bağımlılığı kurulması gerekmez.
4. Android Studio'dan **android** klasörünü aç, Gradle eşitlemesini bekle.
5. USB hata ayıklaması açık Android telefonu bağla ve Run düğmesine bas.

Komut satırından:

```sh
npm test
cd android
./gradlew assembleDebug
```

Windows'ta son komut: `gradlew.bat assembleDebug`.
APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
Gradle her derlemede güncel web dosyalarını otomatik paketler.

## Google Play için imzalı AAB

1. Android Studio: **Build → Generate Signed App Bundle / APK → Android App Bundle**.
2. İlk yayımsa bir upload keystore oluştur, güvenli bir yerde yedekle.
3. `release` seç ve imzalı AAB üret.
4. Play Console'da yeni uygulama oluştur; önce **Internal testing** kanalına yükle.
5. Mağaza metinleri için `store/LISTING.md`, gizlilik için `mobile/privacy.html`
   dosyalarını kullan. Gizlilik sayfasını erişilebilir bir HTTPS adresinde yayımla.
6. Gerçek cihazda ekran görüntüleri al, Play Console'un istediği mağaza görsellerini ekle.
7. İçerik derecelendirmesi, veri güvenliği, uygulama erişimi, reklam ve hedef kitle
   formlarını mevcut sürümün davranışına göre doldur. Play Console hesabına özel
   test/doğrulama gerekliliklerini tamamla.

Komut satırıyla imzalama istersen `android/keystore.properties.example` dosyasını
`android/keystore.properties` olarak kopyalayıp yalnızca kendi bilgisayarında doldur.
Keystore dosya yolu `android/` klasörüne göre çözülür. Sonra:

```sh
cd android
./gradlew bundleRelease
```

AAB: `android/app/build/outputs/bundle/release/app-release.aab`.
Keystore ve parolalar `.gitignore` kapsamındadır; Git'e ekleme. İmzalı paket
üretmek için gerçek anahtarını bu sohbette paylaşman gerekmez.

## Bu sürümde neler var?

- Kısa dokunma boya ekler; parmak/kalem sürüklemesi mevcut boyayı iter.
- Türkçe/İngilizce yönergeler; renk paleti, özel renk ve akış ayarları.
- Telefon/tablet ve yatay/dikey ekran; sistem çubukları, ekran çentiği ve klavye sınırları.
- Çalışmalarım: uygulama yeniden açıldığında kalan yerel görüntü galerisi.
- PNG paylaşımı ve Android dosya seçicisinden cihaza kayıt; geniş depolama izni istemez.
- Destekleyen WebView sürümlerinde sessiz video; 45 saniyeye ve en çok 1280×720
  sınır kutusuna kadar. Dikey ekranlarda 720 piksel yüksekliği aşmaz. Video önizlemesinden
  paylaşılır/kaydedilir; yerel görüntü galerisine eklenmez.
- Arka planda simülasyon durur; bellek baskısında grafik motoru yeniden açılabilir.
- Reklam, hesap, analitik, kamera ve mikrofon yok. Manifest internet izni de istemez.

Galeri **görüntü** saklar; yeniden düzenlenebilir akış projesi saklamaz. Tuval canlı
bellektedir; uygulama kapanırsa/Android işlemi sonlandırırsa kaydedilmemiş çalışma
kaybolabilir. Çıkmadan önce Kaydet'e bas. Uygulamayı kaldırmak kayıtları siler;
önemli çalışmalarını ayrıca cihaza dışa aktar. El takibi bu Android sürümüne dahil değildir.

## Yayından önce cihaz kontrolü

- Küçük telefon, büyük telefon ve tablette; dikey ve yatay görünüm.
- Parmağın/kalemin kısa dokunması, sürükleme, çoklu dokunma ve kesilen hareket.
- Renk seçimi, palette yatay kaydırma, ayarlar, panelleri gizleme/gösterme.
- Kaydet → Çalışmalarım → uygulamayı kapat/aç → görüntünün kaldığını doğrula.
- PNG paylaşımı ve cihaza kaydetme; dosya seçicisinde iptal ve dolu disk davranışı.
- Video başlat/durdur, 45 saniye sınırı, desteklenmeyen cihaz, uygulamayı arka plana al.
- Geri tuşu/jesti, klavye, koyu sistem çubukları ve ekran çentiği.
- Uçak modunda ilk açılıştan itibaren boyama, galeri ve yerel dışa aktarım.
- Release build için imza, sürüm kodu, gerçek cihaz performansı ve Play pre-launch report.

## Doğrulama kapsamı

`npm test`: cihaz/yönerge, dokunma, web analitiği regresyonu, Android köprüsü ve
çevrimdışı paket bütünlüğü. GitHub Actions: Gradle ile debug APK, release AAB ve
Android Lint. Fiziksel Android donanımı bu çalışma ortamında mevcut değildir;
bu testler gerçek cihazda GPU, paylaşım ve dosya seçici denemesinin yerini tutmaz.

Google Play SDK şartları: https://support.google.com/googleplay/android-developer/answer/11926878
Android Gradle Plugin: https://developer.android.com/build/releases/agp-8-13-0-release-notes
