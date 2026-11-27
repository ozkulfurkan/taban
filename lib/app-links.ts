// Mobil uygulama mağaza bağlantıları. Ortam değişkeni verilmezse yayındaki adres kullanılır.
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || 'https://apps.apple.com/tr/app/solecost/id6836669345?l=tr';
// Android yayınlanınca doldurulacak
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '';
