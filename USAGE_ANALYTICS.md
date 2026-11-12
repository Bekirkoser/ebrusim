# Kullanım istatistiklerini sorgulama

12 Kasım 2026'dan sonraki kullanım ölçümü arka planda çalışır. Sitede ziyaretçilere
istatistik paneli veya rapor bağlantısı gösterilmez. Raporlar, site sahibinin bağlı
Sites hesabı üzerinden okunur; herkese açık bir rapor API'si bulunmaz.

## Sahibinin rapor okuması

Sites proje kimliği: `appgprj_6af57926c0908191a41d61ab017584d0`.
Ölçüm servisi: `https://ebrusim-analytics.sagealto16.chatgpt.site`.

1. Sites `read_database_overview` aracını bu proje kimliğiyle çağırın.
2. Dönen `DB` bağlamasından `analytics_totals` tablosunu `read_database_table_rows` ile okuyun.
3. `bucket = all` genel toplamdır. Tarihli satırlar İstanbul saatine göre oturumun
   başladığı günü gösterir. Sonuçlarda sayfalama varsa gerekli satırlara devam edin.

Ortalama aktif süre: `active_ms_total / sessions / 1000` saniye.
Etkileşim oranı: `engaged_sessions / sessions * 100`.
Kaydetme oranı: `saved_sessions / sessions * 100`.
Kamera kullanım oranı: `camera_sessions / sessions * 100`.
Oturum yoksa ortalama/oran üretmeyin; henüz ölçüm yok deyin.

`paint_drops`, `drag_starts`, `camera_starts`, `image_saves`, `video_saves` özellik
toplamlarıdır. `mobile_sessions` telefon/tablet, `desktop_sessions` bilgisayar
oturumlarını sayar. Etkileşim, gerçekten boya eklenen veya itilen oturumdur;
kaydetme oranı görsel/video indirme işlemi başlatılan oturumların oranıdır.

## Sınırlar

Bir oturum sayfanın açılmasıdır; kişi veya tekil tarayıcı değildir. Eski ziyaretçi
sayacı korunur ve onun sorgusu `VISITOR_COUNTER.md` içindedir. Geçmiş ziyaretlerden
süre veya etkileşim bilgisi çıkarılamaz.

Aktif süre yalnızca görünür ve odaktaki sayfada, son işlemden itibaren en çok
60 saniye boyunca sayılır. Güncellemeler 15 saniyede bir ve sayfadan ayrılırken
gönderilir. Sekmenin arka planda kaldığı süre sayılmaz. Kayıtlar yaklaşık ölçümdür;
reklam engelleyici, bağlantı kopması veya tarayıcının aniden kapanması eksik ölçüme
neden olabilir. DNT/GPC tercihlerinde ve geliştirme ortamında kullanım ölçümü yapılmaz.

Kalıcı kullanıcı kimliği veya çerez kullanılmaz; oturum yazma anahtarı yalnızca
sayfanın belleğindedir. Kamera görüntüsü, ebru görseli, fare koordinatı, renk,
isim/e-posta, IP, ham tarayıcı kimliği ve referrer uygulama veritabanına kaydedilmez.
Geçici oturum kayıtlarının süresi 24 saattir; anonim toplamlar saklanır.

İstemci: `usage-analytics.js`. Olay bağlantıları: `script.js`, `video-recorder.js`.
Kontrol: `node tests/usage-analytics.cjs`.
