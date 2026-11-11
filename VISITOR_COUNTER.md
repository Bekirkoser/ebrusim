# Ziyaretçi sayısını sorgulama

Sayaç arka planda çalışır; sitede toplam ziyaretçi satırı gösterilmez.
Mevcut toplamı sayıyı artırmadan okumak için GET isteği:

https://countapi.mileshilliard.com/api/v1/get/ebrusim-art-visitors-72860256b50144dab8f9ef3815be91a6

JSON yanıtındaki `value` toplam sayıdır. Sorgularken `/get/` kullanın;
`/hit/` sayıyı artırır.

Mevcut sayaç anahtarı ve tarayıcı kayıtları korunmuştur; toplam sıfırlanmaz.
Bu, 9 Kasım 2026'dan itibaren tarayıcı bazlı yaklaşık sayıdır. Aynı tarayıcı
tekrar sayılmaz; depolama temizlenirse veya farklı tarayıcı kullanılırsa
aynı kişi yeniden sayılabilir. Sayım yalnızca `ebrusim.art`,
`www.ebrusim.art` ve `bekirkoser.github.io` üzerinde artar.

Başlatma kodu `visitor-counter.js` içindedir; kontrol panelinden ve WebGL'den
bağımsız çalışır. Açık bir sayfada konsoldan `window.ebruVisitorCounter.count`
okunabilir; `await window.ebruVisitorCounter.load(false)` toplamı artırmadan yeniler.
