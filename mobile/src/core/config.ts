import Constants from 'expo-constants';

// API adresi: app.json "extra.apiUrl" (canlı: https://solecost.com).
// Geliştirmede EXPO_PUBLIC_API_URL ile değiştirilebilir (örn. http://192.168.1.10:3000).
export const API_URL: string = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  'https://solecost.com'
).replace(/\/+$/, '');

export const WEB_URL = API_URL;
