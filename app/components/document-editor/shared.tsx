'use client';

import { useCallback } from 'react';
import { useLanguage } from '@/lib/i18n/language-context';

// Belge türüne göre vurgu rengi. Tailwind sınıfları tam yazılmalı (derlemede taranır).
export type Accent = 'blue' | 'red' | 'indigo' | 'amber';

export const ACCENTS: Record<Accent, {
  head: string; solid: string; solidHover: string; ring: string; text: string; soft: string; border: string;
}> = {
  blue: { head: 'bg-brand-700', solid: 'bg-brand-700', solidHover: 'hover:bg-brand-800', ring: 'focus:ring-brand-600', text: 'text-brand-700', soft: 'bg-brand-50', border: 'focus:border-brand-600' },
  red: { head: 'bg-red-600', solid: 'bg-red-600', solidHover: 'hover:bg-red-700', ring: 'focus:ring-red-500', text: 'text-red-600', soft: 'bg-red-50', border: 'focus:border-red-500' },
  amber: { head: 'bg-amber-600', solid: 'bg-amber-600', solidHover: 'hover:bg-amber-700', ring: 'focus:ring-amber-500', text: 'text-amber-700', soft: 'bg-amber-50', border: 'focus:border-amber-500' },
  indigo: { head: 'bg-brand-700', solid: 'bg-brand-700', solidHover: 'hover:bg-brand-800', ring: 'focus:ring-brand-600', text: 'text-brand-700', soft: 'bg-brand-50', border: 'focus:border-brand-600' },
};

const TR = {
  customer: 'Müşteri', supplier: 'Tedarikçi', selectCustomer: 'Müşteri seçin...', selectSupplier: 'Tedarikçi seçin...',
  noCustomer: 'Müşteri seçilmedi', noSupplier: 'Tedarikçi seçilmedi',
  docNo: 'Belge No', autoNo: 'Otomatik oluşturulur', date: 'Tarih', time: 'Saat', currency: 'Para Birimi',
  partyCurrency: '(cari para birimi)', dueDate: 'Vade Tarihi', waybillNo: 'İrsaliye No', shipDate: 'Sevk Tarihi',
  notes: 'Notlar', advanced: 'Gelişmiş Seçenekler', depot: 'Hedef Depo', depotReturn: 'Çıkış Deposu', mainDepot: 'Ana Depo',
  lines: 'Kalemler', searchProducts: 'Ürün adı, kodu veya barkod ile arayın', searchProductsMaterials: 'Hammadde veya ürün arayın',
  typeMore: 'En az iki harf yazın...', noResults: 'Sonuç bulunamadı', manualLine: 'Elle Kalem Ekle', quickAddProduct: 'Listede Olmayan Ürün Ekle',
  quickAddItem: 'Listede Olmayan Ekle', emptyLines: 'Yukarıdan arayarak ya da "Elle Kalem Ekle" ile kalem ekleyin',
  emptyLinesPurchase: 'Yukarıdan hammadde veya ürün arayarak kalem ekleyin',
  product: 'Ürün', material: 'Hammadde', item: 'Kalem', qty: 'Miktar', qtyKg: 'Miktar (kg)', unitPrice: 'Birim Fiyat', pricePerKg: 'Kg Fiyatı',
  discount: 'İskonto', discountPct: 'İskonto (%)', gross: 'Brüt', lineTotal: 'Tutar', lineNotes: 'Açıklama (isteğe bağlı)',
  subtotal: 'Ara Toplam', vatRate: 'KDV Oranı', vat: 'KDV', grandTotal: 'Genel Toplam',
  newLine: 'Yeni Kalem', editLine: 'Kalemi Düzenle', addLine: 'Ekle', updateLine: 'Güncelle', cancel: 'Vazgeç', close: 'Kapat',
  chooseProduct: 'Ürün kataloğundan seçin', chooseMaterial: 'Hammadde seçin', selectPlaceholder: '— Seçin —', manualEntry: 'Elle giriş (katalog dışı)',
  description: 'Ürün / Hizmet Adı', descriptionPlaceholder: 'Açıklama girin', stock: 'Stok', specialPrice: 'Müşteriye özel fiyat', catalogPrice: 'Katalog fiyatı',
  partMaterials: 'Parça hammaddeleri', noPartsInfo: 'Ürünün parça ve gramaj bilgisi olmadığı için hammadde stoğu değişmeyecek.',
  back: 'Geri', salesList: 'Satışlar', purchasesList: 'Alışlar', edit: 'Düzenle', remove: 'Kaldır', saving: 'Kaydediliyor...', noPartsShort: 'Parça bilgisi yok',
  quickAddTitleProduct: 'Yeni Ürün (kataloğa eklenir)', quickAddTitleMaterial: 'Yeni Hammadde (kataloğa eklenir)',
  name: 'Ad', code: 'Kod', category: 'Kategori', unit: 'Birim', price: 'Fiyat', saveAndAdd: 'Kaydet ve Ekle',
  requiredParty: 'Cari seçin', requiredLines: 'En az bir kalem ekleyin', linkedOrder: 'Sipariş No',
  legacyNoLines: 'Bu alışın kalem bilgisi yok. Kalem eklerseniz toplam kalemlerden hesaplanır.',
  stockConfirmTitle: 'Stok Düşümü Onayı', stockShortage: 'Yetersiz ürün stoğu (satış yine kaydedilir, stok eksiye düşer)',
  materialDeduction: 'Düşülecek hammaddeler', confirmSave: 'Onayla ve Kaydet', goBack: 'Geri Dön',
};
type Key = keyof typeof TR;

const EN: Record<Key, string> = {
  customer: 'Customer', supplier: 'Supplier', selectCustomer: 'Select customer...', selectSupplier: 'Select supplier...',
  noCustomer: 'No customer selected', noSupplier: 'No supplier selected',
  docNo: 'Document No', autoNo: 'Auto-generated', date: 'Date', time: 'Time', currency: 'Currency',
  partyCurrency: '(account currency)', dueDate: 'Due Date', waybillNo: 'Waybill No', shipDate: 'Shipping Date',
  notes: 'Notes', advanced: 'Advanced Options', depot: 'Target Warehouse', depotReturn: 'Source Warehouse', mainDepot: 'Main Warehouse',
  lines: 'Items', searchProducts: 'Search by product name, code or barcode', searchProductsMaterials: 'Search raw materials or products',
  typeMore: 'Type at least two characters...', noResults: 'No results', manualLine: 'Add Item Manually', quickAddProduct: 'Add Product Not in List',
  quickAddItem: 'Add New Item', emptyLines: 'Search above or use "Add Item Manually"',
  emptyLinesPurchase: 'Search above for raw materials or products',
  product: 'Product', material: 'Raw Material', item: 'Item', qty: 'Quantity', qtyKg: 'Quantity (kg)', unitPrice: 'Unit Price', pricePerKg: 'Price per kg',
  discount: 'Discount', discountPct: 'Discount (%)', gross: 'Gross', lineTotal: 'Amount', lineNotes: 'Note (optional)',
  subtotal: 'Subtotal', vatRate: 'VAT Rate', vat: 'VAT', grandTotal: 'Grand Total',
  newLine: 'New Item', editLine: 'Edit Item', addLine: 'Add', updateLine: 'Update', cancel: 'Cancel', close: 'Close',
  chooseProduct: 'Choose from catalog', chooseMaterial: 'Choose raw material', selectPlaceholder: '— Select —', manualEntry: 'Manual entry (not in catalog)',
  description: 'Product / Service Name', descriptionPlaceholder: 'Enter a description', stock: 'Stock', specialPrice: 'Customer price', catalogPrice: 'Catalog price',
  partMaterials: 'Part materials', noPartsInfo: 'This product has no part/weight data, so raw material stock will not change.',
  back: 'Back', salesList: 'Sales', purchasesList: 'Purchases', edit: 'Edit', remove: 'Remove', saving: 'Saving...', noPartsShort: 'No part data',
  quickAddTitleProduct: 'New Product (added to catalog)', quickAddTitleMaterial: 'New Raw Material (added to catalog)',
  name: 'Name', code: 'Code', category: 'Category', unit: 'Unit', price: 'Price', saveAndAdd: 'Save and Add',
  requiredParty: 'Select an account', requiredLines: 'Add at least one item', linkedOrder: 'Order No',
  legacyNoLines: 'This purchase has no item details. If you add items, the total is recalculated from them.',
  stockConfirmTitle: 'Confirm Stock Deduction', stockShortage: 'Insufficient product stock (the sale is still saved; stock goes negative)',
  materialDeduction: 'Raw materials to deduct', confirmSave: 'Confirm and Save', goBack: 'Go Back',
};

export function useDocText() {
  const { language } = useLanguage();
  return useCallback((k: Key) => (language === 'en' ? EN[k] : TR[k]), [language]);
}

export const fmtMoney = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
