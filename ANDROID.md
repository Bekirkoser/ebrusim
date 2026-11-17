# Ebrusim Android — ilk sürüm

Android uygulaması `android/` klasöründedir. İnternet bağlantısı olmadan çalışır;
ebrusim.art sitesini açmaz. Paket kimliği `art.ebrusim.app`, sürüm `1.3.2` (6).
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
- Telefonlarda iki yöne de dönebilen yatay ekran; sistem çubukları, ekran çentiği ve klavye sınırları.
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

- Küçük telefon, büyük telefon ve tablette yatay görünüm; telefonu iki yöne çevir.
- Üst araç çubuğu, sol sürgüler, renk düğmesi ve açılan ayar panelleri.
- Video önizlemesinde solda video, sağda paylaş/kaydet; kısa ekranda taşma olmaması.
- Parmağın/kalemin kısa dokunması, sürükleme, çoklu dokunma ve kesilen hareket.
- Renk seçimi, renk panelini kaydırma, ayarlar, panelleri gizleme/gösterme.
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

## 1.1.0 yatay test sürümü

Debug APK, `art.ebrusim.app.landscape` kimliği ve **Ebrusim Yatay** adıyla ayrı kurulur. Eski test uygulaması ve galerisi silinmez. Önceki çalışmalar eski uygulamada kalır; yeni test uygulamasına otomatik taşınmaz. Release AAB asıl `art.ebrusim.app` kimliğini kullanır.

Arayüz değişiklikleri `android-ui/` klasöründedir; iPhone projesi ve ortak mobil arayüz dosyaları değiştirilmez.

## 1.2.0 çizim stüdyosu arayüzü

Procreate'in resmi koyu arayüzü referans alınarak Android sunumu yenilendi:
- Düz, tam genişlikte antrasit üst araç çubuğu; solda Galeri ve dışa aktarma.
- Koyu gri çalışma zemini içinde beyaz, kenarları net bir tuval.
- Solda damla boyutu ve etki alanı için dikey sürgüler; ortada suyu duraklat.
- Sağ üstteki renk dairesi renk panelini açar. Renk paleti tuvali sürekli kaplamaz.
- Damla ve akış simgeleri kendi ayar panellerini açar.
- Sağ üstteki dört köşe simgesi arayüzü gizler; gizliyken sol üstteki simge geri açar.
- Dil, kullanım yönergeleri ve kağıt rengi İşlemler (anahtar) menüsündedir.

Debug uygulaması **Ebrusim Studio** (`art.ebrusim.app.studio`) olarak ayrı kurulur;
önceki test uygulamaları ve galerileri yerinde kalır. Çalışmalar otomatik taşınmaz.
Üretim paket kimliği `art.ebrusim.app` olarak korunur. iPhone dosyaları değiştirilmez.

Görsel referans: https://help.procreate.com/procreate/handbook/interface-gestures/interface
Referansın illüstrasyonu veya ürün simgeleri uygulamaya eklenmemiştir.

## 1.3.0 arayüz yenilemesi

- İnternetsiz çalışan Inter değişken yazı tipi; lisansı `android-ui/fonts/` içinde.
- Daha rahat dokunulan araçlar, güncellenmiş simgeler, sade seçim vurguları.
- Değer ve doluluk gösteren ince sürgüler; eşit aralıklı renk hücreleri, seçili renk kodu.
- Yuvarlatılmış ayar panelleri, galeri ve dışa aktarma pencereleri.

Debug APK **Ebrusim Preview** (`art.ebrusim.app.preview`) adıyla ayrı kurulur. Önceki uygulamaları kaldırmak gerekmez; eski çalışmalar o uygulamalarda kalır, otomatik taşınmaz. CI debug imzasını Actions önbelleğinde saklar; önbellek korunduğu sürece sonraki Preview paketleri aynı uygulamayı güncelleyebilir. Üretim için ayrı, kalıcı release imzası gerekir.

iPhone ve ortak mobil dosyalar bu yenilemede değiştirilmemiştir.

## 1.3.1 yerleşim düzeltmeleri

Üst çubukta kullanıcının logosu ve küçük `ebrusim.art` yazısı yer alır; küçük telefonlarda da görünür. Hızlı sürgüler yalnızca kendi sabit sayısal değerlerini gösterir, tuvali örten geçici değer balonu kaldırıldı. Arayüz gizlenince tuval tüm kullanılabilir uygulama alanını kaplar; geri açınca normal yerleşime döner. İlk imza önbelleği yolu CI ortamında oluşmadığı için 1.3.0 ile güncelleme imzası eşleşmez. Bu sürüm `art.ebrusim.app.preview131` / **Ebrusim 1.3.1** olarak ayrı kurulur; önceki uygulama ve çalışmaları silinmez. Yeni CI akışı açıkça belirtilen test anahtarını oluşturur ve önbelleğe alır; yerel Android Studio normal debug anahtarını kullanır.

## 1.3.2 tam alan tuval

Tuval arayüz açıkken de bütün uygulama alanını kaplar. Üst çubuk %64, sol kontrol zemini %72 opaklıkla tuval üzerinde durur; simgeler ve metinler opak kalır. Sitedeki göz SVG'si ve görünür/gizli çizgi davranışı değiştirilmeden kullanılır. Göz bütün araçları gizler; sağ altta kalan göz onları geri açar. Gizle/göster tuval ölçüsünü değiştirmez. Paket kimliği `.preview131` ve CI test imzası aynı kalır; uygulama adı **Ebrusim Preview** olur.
