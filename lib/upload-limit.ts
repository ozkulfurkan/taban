// İçe aktarma (Excel/CSV) dosyaları için boyut sınırı: büyük ya da kötü niyetli dosyalarla
// sunucuyu yormayı (ayrıştırıcı açıkları, bellek) önler. 5 MB on binlerce satıra yeter.
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const importTooLarge = (file: { size: number }) => file.size > MAX_IMPORT_BYTES;
export const IMPORT_TOO_LARGE_MESSAGE = 'Dosya çok büyük (en fazla 5 MB). Dosyayı bölerek yükleyin.';
