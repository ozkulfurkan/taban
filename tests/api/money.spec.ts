import { test, expect, APIRequestContext } from '@playwright/test';
import { prisma, RUN, createCompany, cleanup } from '../security/helpers';

// Para hesapları: iade, belge numaraları, yuvarlama, döviz, fazla ödeme, stok.
// 18.11.2026 test raporundaki para bulgularının geri gelmemesi için.

let A: { companyId: string; owner: APIRequestContext };
const year = new Date().getFullYear();

async function newCustomer(currency: 'TRY' | 'USD' | 'EUR' = 'TRY') {
  const r = await A.owner.post('/api/customers', { data: { name: `Müşteri ${currency} ${RUN} ${Math.random()}`, currency } });
  expect(r.status(), await r.text()).toBe(200);
  return (await r.json()).id as string;
}

async function invoice(customerId: string, items: any[], extra: Record<string, unknown> = {}) {
  return A.owner.post('/api/invoices', { data: { customerId, vatRate: 0, items, ...extra } });
}

const line = (quantity: unknown, unitPrice: unknown, extra: Record<string, unknown> = {}) =>
  ({ description: 'Taban', quantity, unitPrice, ...extra });

async function balanceOf(customerId: string) {
  const list = await (await A.owner.get(`/api/customers?search=${encodeURIComponent(RUN)}&limit=200`)).json();
  const fromList = (list.customers ?? list).find((c: any) => c.id === customerId)?.balance;
  const fromDetail = (await (await A.owner.get(`/api/customers/${customerId}`)).json()).balance;
  return { fromList, fromDetail };
}

test.beforeAll(async () => {
  A = await createCompany('para');
});

test.afterAll(async () => {
  await cleanup();
});

test.describe('İade faturaları', () => {
  test('iade müşteri borcunu azaltır; liste ve detay aynı bakiyeyi gösterir', async () => {
    const c = await newCustomer();
    expect((await invoice(c, [line(10, 100)])).status()).toBe(200);
    const ret = await invoice(c, [line(2, 100)], { isReturn: true });
    expect(ret.status()).toBe(200);
    const body = await ret.json();
    expect(body.total).toBe(200);
    expect(body.invoiceNo).toMatch(new RegExp(`^IAD-${year}-\\d{4}$`));
    expect(await balanceOf(c)).toEqual({ fromList: 800, fromDetail: 800 });
  });

  test('eski negatif iade kayıtları da doğru hesaplanır', async () => {
    const c = await newCustomer();
    await invoice(c, [line(10, 100)]);
    const ret = await (await invoice(c, [line(3, 100)], { isReturn: true })).json();
    await prisma.invoice.update({ where: { id: ret.id }, data: { total: -300, subtotal: -300 } });
    expect(await balanceOf(c)).toEqual({ fromList: 700, fromDetail: 700 });
  });

  test('iade faturası düzenlenince de borcu azaltmaya devam eder', async () => {
    const c = await newCustomer();
    await invoice(c, [line(10, 100)]);
    const ret = await (await invoice(c, [line(2, 100)], { isReturn: true })).json();
    const r = await A.owner.put(`/api/invoices/${ret.id}`, { data: { items: [line(4, 100)] } });
    expect(r.status(), await r.text()).toBe(200);
    expect(await balanceOf(c)).toEqual({ fromList: 600, fromDetail: 600 });
  });
});

test.describe('Tutar hesapları', () => {
  test('Türkçe sayı biçimi ve kuruş yuvarlaması', async () => {
    const c = await newCustomer();
    const a = await (await invoice(c, [line('1', '1.234,56')])).json();
    expect(a.total).toBe(1234.56);
    const b = await (await invoice(c, [line(3, '33,33'), line(1, '0,1'), line(1, '0,2')], { vatRate: 20 })).json();
    expect([b.subtotal, b.vatAmount, b.total]).toEqual([100.29, 20.06, 120.35]);
  });

  test('düzenlemede KDV oranı gönderilmezse eski oran korunur', async () => {
    const c = await newCustomer();
    const inv = await (await invoice(c, [line(1, 100)], { vatRate: 18 })).json();
    const r = await (await A.owner.put(`/api/invoices/${inv.id}`, { data: { items: [line(2, 100)] } })).json();
    expect([r.vatRate, r.total]).toEqual([18, 236]);
  });

  for (const [name, items, extra] of [
    ['negatif miktar', [line(-5, 100)], {}],
    ['%150 iskonto', [line(1, 100, { discount: 150 })], {}],
    ['negatif KDV', [line(1, 100)], { vatRate: -20 }],
    ['kalemsiz fatura', [], {}],
    ['sayı olmayan miktar', [line('abc', 100)], {}],
    ['aşırı büyük fiyat', [line(1, 1e12)], {}],
    ['30 Şubat', [line(1, 1)], { date: `${year}-02-30` }],
  ] as const) {
    test(`geçersiz fatura reddedilir: ${name}`, async () => {
      const r = await invoice(await newCustomer(), items as any, extra as any);
      expect(r.status()).toBe(400);
      expect((await r.json()).error).toBeTruthy();
    });
  }

  test('müşterisiz fatura 400 döner', async () => {
    const r = await A.owner.post('/api/invoices', { data: { items: [line(1, 1)] } });
    expect(r.status()).toBe(400);
  });
});

test.describe('Belge numaraları', () => {
  test('9999 sonrası 10000, 10001 diye devam eder', async () => {
    const c = await newCustomer();
    const first = await (await invoice(c, [line(1, 1)])).json();
    await prisma.invoice.update({ where: { id: first.id }, data: { invoiceNo: `FTR-${year}-9999` } });
    await prisma.documentCounter.deleteMany({ where: { companyId: A.companyId } });
    // İçerikler farklı: aynı içerikli istek mükerrer kayıt korumasına takılır (lib/request-dedup.ts)
    const n1 = await (await invoice(c, [line(1, 2)])).json();
    const n2 = await (await invoice(c, [line(1, 3)])).json();
    expect([n1.invoiceNo, n2.invoiceNo]).toEqual([`FTR-${year}-10000`, `FTR-${year}-10001`]);
  });

  test('aynı anda kesilen 10 fatura hatasız ve farklı numaralı oluşur', async () => {
    const c = await newCustomer();
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => invoice(c, [line(1, i + 1)])));
    expect(results.map(r => r.status())).toEqual(Array(10).fill(200));
    const numbers = await Promise.all(results.map(async r => (await r.json()).invoiceNo));
    expect(new Set(numbers).size).toBe(10);
  });

  test('aynı anda açılan 5 sipariş hatasız oluşur', async () => {
    const c = await newCustomer();
    const results = await Promise.all(Array.from({ length: 5 }, () =>
      A.owner.post('/api/orders', { data: { customerId: c, sizeDistribution: { '40': 1 } } })));
    expect(results.map(r => r.status())).toEqual(Array(5).fill(201));
  });

  test('yıl fatura tarihinden alınır', async () => {
    const r = await (await invoice(await newCustomer(), [line(1, 1)], { date: `${year + 1}-01-02` })).json();
    expect(r.invoiceNo).toMatch(new RegExp(`^FTR-${year + 1}-`));
  });

  test('elle girilen numara çakışırsa anlaşılır hata verir', async () => {
    const c = await newCustomer();
    const no = `ELLE-${RUN}`;
    expect((await invoice(c, [line(1, 1)], { invoiceNo: no })).status()).toBe(200);
    const dup = await invoice(c, [line(1, 2)], { invoiceNo: no });
    expect(dup.status()).toBe(409);
    expect((await dup.json()).error).toContain(no);
  });
});

test.describe('Ödemeler', () => {
  test('USD faturaya TRY olarak işaretli ödeme reddedilir', async () => {
    const c = await newCustomer('USD');
    const inv = await (await invoice(c, [line(1, 100)], { currency: 'USD' })).json();
    const r = await A.owner.post('/api/payments', { data: { invoiceId: inv.id, customerId: c, amount: 100, currency: 'TRY' } });
    expect(r.status()).toBe(400);
    expect((await prisma.invoice.findUnique({ where: { id: inv.id } }))?.status).toBe('PENDING');
  });

  test('fazla ödeme önce onay ister, onaylanınca kaydedilir', async () => {
    const c = await newCustomer('EUR');
    const inv = await (await invoice(c, [line(1, 50)], { currency: 'EUR' })).json();
    const first = await A.owner.post('/api/payments', { data: { invoiceId: inv.id, customerId: c, amount: '500', currency: 'EUR' } });
    expect(first.status()).toBe(409);
    const body = await first.json();
    expect(body).toMatchObject({ code: 'OVERPAYMENT', remaining: 50, currency: 'EUR' });
    expect((await prisma.invoice.findUnique({ where: { id: inv.id } }))?.paidAmount).toBe(0);
    const ok = await A.owner.post('/api/payments', { data: { invoiceId: inv.id, customerId: c, amount: '500', currency: 'EUR', allowOverpayment: true } });
    expect(ok.status()).toBe(200);
    expect((await prisma.invoice.findUnique({ where: { id: inv.id } }))?.status).toBe('PAID');
  });

  test('kısmi ödeme Türkçe biçimle girilir ve yuvarlanır', async () => {
    const c = await newCustomer();
    const inv = await (await invoice(c, [line(1, 2000)])).json();
    const r = await A.owner.post('/api/payments', { data: { invoiceId: inv.id, customerId: c, amount: '1.234,567' } });
    expect(r.status()).toBe(200);
    const after = await prisma.invoice.findUnique({ where: { id: inv.id } });
    expect([after?.paidAmount, after?.status]).toEqual([1234.57, 'PARTIAL']);
  });

  test('fatura tutarı düşürülünce ödeme durumu güncellenir', async () => {
    const c = await newCustomer();
    const inv = await (await invoice(c, [line(1, 100)])).json();
    await A.owner.post('/api/payments', { data: { invoiceId: inv.id, customerId: c, amount: 60 } });
    const r = await (await A.owner.put(`/api/invoices/${inv.id}`, { data: { items: [line(1, 60)] } })).json();
    expect(r.status).toBe('PAID');
  });
});

test.describe('Stok', () => {
  async function product(stock: number) {
    const p = await (await A.owner.post('/api/products', { data: { name: `Ürün ${RUN} ${Math.random()}`, stock } })).json();
    return p.id as string;
  }
  const stockOf = async (id: string) => (await prisma.product.findUnique({ where: { id } }))!.stock;

  test('stoktan fazla satış kaydedilir, stok eksiye düşer ve uyarı döner', async () => {
    const p = await product(5);
    const r = await invoice(await newCustomer(), [line(8, 10, { productId: p })]);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(await stockOf(p)).toBe(-3);
    expect(body.stockWarnings).toEqual([expect.objectContaining({ id: p, stock: -3 })]);
  });

  test('fatura düzenlenince ürün stoğu farka göre güncellenir', async () => {
    const p = await product(100);
    const inv = await (await invoice(await newCustomer(), [line(10, 1, { productId: p })])).json();
    expect(await stockOf(p)).toBe(90);
    await A.owner.put(`/api/invoices/${inv.id}`, { data: { items: [line(25, 1, { productId: p })] } });
    expect(await stockOf(p)).toBe(75);
  });

  test('ürün kaydedilirken arada yapılan satışın stok düşümü ezilmez', async () => {
    const p = await product(100);
    const loaded = await (await A.owner.get(`/api/products/${p}`)).json();
    await invoice(await newCustomer(), [line(30, 1, { productId: p })]);
    const r = await A.owner.put(`/api/products/${p}`, { data: { ...loaded, stock: 100, stockLoaded: loaded.stock, unitPrice: 5 } });
    expect(r.status()).toBe(200);
    expect(await stockOf(p)).toBe(70);
    await A.owner.put(`/api/products/${p}`, { data: { ...loaded, stock: 80, stockLoaded: 70 } });
    expect(await stockOf(p)).toBe(80);
  });
});

test.describe('Müşteri kaydı doğrulama', () => {
  for (const [name, data] of [
    ['boş ad', { name: '   ', currency: 'TRY' }],
    ['geçersiz para birimi', { name: `X ${RUN}`, currency: 'XYZ' }],
    ['geçersiz e-posta', { name: `Y ${RUN}`, currency: 'TRY', email: 'bu-mail-degil' }],
  ] as const) {
    test(`reddedilir: ${name}`, async () => {
      expect((await A.owner.post('/api/customers', { data })).status()).toBe(400);
    });
  }
});
