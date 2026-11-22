// app.json'ı genişletir. Android anlık bildirimi için Firebase dosyası repoda değil (depo herkese açık):
// Expo'daki dosya türü ortam değişkeni GOOGLE_SERVICES_JSON derlemede dosyanın yolunu verir.
// Değişken yoksa (yerel geliştirme, web) alan eklenmez.
module.exports = ({ config }) => {
  const file = process.env.GOOGLE_SERVICES_JSON;
  if (!file) return config;
  return { ...config, android: { ...config.android, googleServicesFile: file } };
};
