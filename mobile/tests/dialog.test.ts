import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toneOf } from '../src/core/tone';

test('başarı mesajları kısa bildirim olur', () => {
  for (const t of ['Ürün eklendi', 'Müşteri güncellendi', 'Çek kaydedildi', 'Link kopyalandı', '3 çek bankaya verildi', '2 çek tahsil edildi', 'Siparişiniz alındı']) {
    assert.equal(toneOf(t), 'success', t);
  }
});

test('hata ifadeleri başarıdan önce gelir', () => {
  for (const t of ['Kaydedilemedi', 'Silinemedi', 'PDF oluşturulamadı', 'İptal edilemedi', 'Bağlantı isteği gönderilemedi', 'Link kapatılamadı']) {
    assert.equal(toneOf(t), 'error', t);
  }
});

test('diğerleri bilgi penceresi', () => {
  assert.equal(toneOf('Ürün katalogda yok'), 'info');
  assert.equal(toneOf('Bu hareket cariye bağlı'), 'info');
});
