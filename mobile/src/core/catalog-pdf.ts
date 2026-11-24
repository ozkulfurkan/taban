import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { api } from './api';
import { catalogHtml, type CatalogCompany, type CatalogOptions, type CatalogProduct } from '@shared/catalog-html';

/** Seçilen ürünlerden katalog PDF'i: fotoğraflar sunucudan gömülü gelir, PDF cihazda üretilip paylaşılır */
export async function shareCatalogPdf(productIds: string[], opts: Omit<CatalogOptions, 'date'>) {
  const data = await api<{ company: CatalogCompany | null; products: CatalogProduct[] }>('/api/products/catalog-pdf', {
    method: 'POST', body: { productIds },
  });
  const company = data.company ?? { name: 'SoleCost', logoUrl: null, phone: null, address: null };
  const html = catalogHtml(company, data.products, { ...opts, date: new Date() });
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return; }
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: opts.title || 'Ürün kataloğu' });
}
