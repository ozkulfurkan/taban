import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cartItem, cleanSizes, orderBody, orderLines, sizeSummary, sizesOf, stepIndex, type CatalogProduct } from '../src/core/portal';

const p: CatalogProduct = { id: 'p1', code: 'SC-100', name: 'Termo Taban', description: null, sizes: ['38', '39', '40'] };

test('beden listesi: üründe yoksa varsayılan 36-46', () => {
  assert.deepEqual(sizesOf(p), ['38', '39', '40']);
  assert.equal(sizesOf({ sizes: [] }).length, 11);
});

test('beden adetleri: boş, sıfır ve rakam dışı karakterler atılır; ürün dışı beden alınmaz', () => {
  assert.deepEqual(cleanSizes(['38', '39', '40'], { '38': '12', '39': '', '40': '0', '41': '5' }), { '38': 12 });
  assert.deepEqual(cleanSizes(['38'], { '38': '1.200' }), { '38': 1200 });
});

test('sepet kalemi: renk ve en az 1 adet şart', () => {
  assert.equal(cartItem(p, ' ', { '38': '5' }), 'Renk girin.');
  assert.equal(cartItem(p, 'Siyah', {}), 'En az 1 adet girin.');
  assert.deepEqual(cartItem(p, ' Siyah ', { '38': '12', '40': '24' }), {
    productId: 'p1', productCode: 'SC-100', productName: 'Termo Taban', color: 'Siyah',
    sizeDistribution: { '38': 12, '40': 24 }, totalQuantity: 36, unit: 'çift',
  });
});

test('sipariş gövdesi web portalıyla aynı (paket sipariş)', () => {
  const item = cartItem(p, 'Siyah', { '38': '2' });
  assert.ok(typeof item !== 'string');
  assert.deepEqual(orderBody([item], '', '  '), { orderItems: [item], requestedDeliveryDate: undefined, notes: undefined });
  assert.deepEqual(orderBody([item], '2026-12-01', 'Acil'), { orderItems: [item], requestedDeliveryDate: '2026-12-01', notes: 'Acil' });
});

test('tekli siparişte satır; beden özeti sayısal sırada; durum adımı', () => {
  const lines = orderLines({ id: 'o', orderNo: 'ORD', status: 'MOLDING', createdAt: '', totalQuantity: 5, productCode: 'X', color: 'Beyaz', sizeDistribution: { '40': 3, '39': 2 } });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].color, 'Beyaz');
  assert.equal(sizeSummary({ '40': 3, '39': 2, '41': 0 }), '39×2 · 40×3');
  assert.equal(stepIndex('MOLDING'), 2);
  assert.equal(stepIndex('YOK'), -1);
});

test('birime göre sepet kalemi: kg ondalıklı miktar, adet tam sayı, renk isteğe bağlı', () => {
  const kg: CatalogProduct = { id: 'm1', code: 'PVC', name: 'PVC Granül', description: null, sizes: [], unit: 'kg' };
  assert.deepEqual(cartItem(kg, '', {}, '1.250,5'), {
    productId: 'm1', productCode: 'PVC', productName: 'PVC Granül', color: '', sizeDistribution: {},
    totalQuantity: 1250.5, unit: 'kg', quantity: 1250.5,
  });
  assert.equal(cartItem(kg, '', {}, ''), 'Geçerli bir miktar girin (kg).');
  const adet: CatalogProduct = { ...kg, id: 'a1', unit: 'adet' };
  assert.equal(cartItem(adet, '', {}, '2,5'), 'Geçerli bir miktar girin (adet).');
  assert.equal((cartItem(adet, 'Mavi', {}, '40') as any).totalQuantity, 40);
});
