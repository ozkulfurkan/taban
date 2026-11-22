// Google Play uyarısı: "Zorunlu donanım özelliği beyanları kullanılabilirliği kısıtlıyor".
// Bazı paketler/ayarlar manifeste android.hardware.screen.portrait ve android.hardware.wifi
// özelliklerini zorunlu olarak ekliyor; bu da tablet, Chromebook vb. cihazlarda kurulumu engelliyor.
// Burada bu özellikler isteğe bağlı (required=false) işaretlenir; birleştirme sırasında bizimki geçerli olur.
const { withAndroidManifest } = require('@expo/config-plugins');

const OPTIONAL = ['android.hardware.screen.portrait', 'android.hardware.wifi'];

module.exports = function withOptionalHardware(config) {
  return withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = { ...manifest.$, 'xmlns:tools': 'http://schemas.android.com/tools' };
    const features = (manifest['uses-feature'] ??= []);
    for (const name of OPTIONAL) {
      const existing = features.find(f => f.$?.['android:name'] === name);
      const attrs = { 'android:name': name, 'android:required': 'false', 'tools:replace': 'android:required' };
      if (existing) existing.$ = { ...existing.$, ...attrs };
      else features.push({ $: attrs });
    }
    return cfg;
  });
};
