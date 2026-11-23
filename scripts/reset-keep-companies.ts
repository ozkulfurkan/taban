// Canlı veritabanı temizliği için SQL üretir: verilen e-postaların firmaları (tüm verileri, kullanıcıları ve
// portal hesaplarıyla) kalır, geri kalan her şey silinir. Platform yöneticileri (role = ADMIN) de kalır.
//
// Kullanım: npx tsx scripts/reset-keep-companies.ts a@firma.com,b@firma.com > temizlik.sql
// Sonra Neon SQL Editor'da çalıştırın. Dosya tek transaction'dır: kalan firmaların verisi eksilirse ya da firma
// sayısı tutmazsa kendiliğinden geri alınır (hiçbir şey silinmez); sorun yoksa sonda COMMIT eder.
// ÖNCE Neon'da yedek dal (branch) alın. Bu işlem geri alınamaz.
//
// Yöntem (şemadan otomatik): her tablo için "silinecek" kayıt kimlikleri, ebeveynden çocuğa doğru hesaplanır.
// - Company: kalacaklar dışındakiler; companyId alanı olan tablolar: kalmayan firmaya ait olanlar; User: kalmayanlar.
// - Zorunlu (NOT NULL) bir ilişkisi silinecek kayda bakan kayıt da silinir.
// - Kalan bir kaydın isteğe bağlı ilişkisi silinecek kayda bakıyorsa NULL yapılır.
// Silme, çocuktan ebeveyne doğru yapılır.
import { Prisma } from '@prisma/client';

const emails = (process.argv[2] ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
if (!emails.length) { console.error('Kullanım: tsx scripts/reset-keep-companies.ts e1@x.com,e2@y.com'); process.exit(1); }

type Model = (typeof Prisma.dmmf.datamodel.models)[number];
const models = Prisma.dmmf.datamodel.models as Model[];
const byName = new Map(models.map(m => [m.name, m]));
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const idField = (m: Model) => m.fields.find(f => f.isId)?.name;

// Her modelin dışa bakan ilişkileri (FK tutan alanlar)
type Rel = { cols: string[]; refs: string[]; parent: string; required: boolean };
const relsOf = (m: Model): Rel[] => m.fields
  .filter(f => f.kind === 'object' && f.relationFromFields && f.relationFromFields.length)
  .map(f => ({
    cols: f.relationFromFields as string[], refs: f.relationToFields as string[], parent: f.type,
    required: (f.relationFromFields as string[]).every(c => m.fields.find(x => x.name === c)?.isRequired),
  }));

// Ebeveyn önce gelecek şekilde sıralama (döngüler isteğe bağlı ilişkilerle kırılır)
const order: string[] = [];
const state = new Map<string, number>();
const visit = (name: string) => {
  if (state.get(name) === 2) return;
  if (state.get(name) === 1) return; // döngü: isteğe bağlı ilişki, sıralamayı etkilemez
  state.set(name, 1);
  for (const r of relsOf(byName.get(name)!)) if (r.parent !== name && r.required) visit(r.parent);
  for (const r of relsOf(byName.get(name)!)) if (r.parent !== name && !r.required) visit(r.parent);
  state.set(name, 2); order.push(name);
};
['Company', 'User'].forEach(visit);
models.forEach(m => visit(m.name));

const out: string[] = [];
out.push(`-- SoleCost canlı temizlik: yalnızca şu e-postaların firmaları kalır: ${emails.join(', ')}`);
out.push(`-- Üretildi: ${new Date().toISOString()} · ${models.length} tablo`);
out.push('BEGIN;', '');
out.push(`CREATE TEMP TABLE keep_company ON COMMIT DROP AS
  SELECT DISTINCT "companyId" AS id FROM "User" WHERE lower(email) IN (${emails.map(lit).join(', ')}) AND "companyId" IS NOT NULL;`);
out.push(`CREATE TEMP TABLE keep_user ON COMMIT DROP AS
  SELECT id FROM "User" WHERE "companyId" IN (SELECT id FROM keep_company) OR role = 'ADMIN';`);
out.push(`DO $$ BEGIN
  IF (SELECT count(*) FROM keep_company) <> ${emails.length} THEN
    RAISE EXCEPTION 'Kalacak firma sayısı beklenenden farklı (% bulundu, ${emails.length} bekleniyordu). E-postaları kontrol edin.', (SELECT count(*) FROM keep_company);
  END IF;
END $$;`, '');

// Önce: kalan firmaların tablo bazlı kayıt sayıları
const companyTables = models.filter(m => m.fields.some(f => f.name === 'companyId') && m.name !== 'Company');
const countSql = (label: string) => `SELECT '${label}' AS asama, ` + companyTables
  .map(m => `(SELECT count(*) FROM ${q(m.name)} WHERE "companyId" IN (SELECT id FROM keep_company)) AS ${q(m.name)}`).join(', ') + ';';
out.push('-- Kalan firmaların kayıt sayıları (önce)', `CREATE TEMP TABLE sayim_once ON COMMIT DROP AS ${countSql('once').replace(/;$/, '')};`, '');

// Silinecek kimlikler: ebeveynden çocuğa
for (const name of order) {
  const m = byName.get(name)!;
  const id = idField(m);
  if (!id) continue;
  const conds: string[] = [];
  if (name === 'Company') conds.push(`${q(id)} NOT IN (SELECT id FROM keep_company)`);
  else if (name === 'User') conds.push(`${q(id)} NOT IN (SELECT id FROM keep_user)`);
  else if (m.fields.some(f => f.name === 'companyId')) conds.push(`("companyId" IS NOT NULL AND "companyId" NOT IN (SELECT id FROM keep_company))`);
  for (const r of relsOf(m)) {
    if (!r.required || r.parent === name || r.cols.length !== 1) continue;
    conds.push(`${q(r.cols[0])} IN (SELECT id FROM ${q('del_' + r.parent)})`);
  }
  // companyId'si boş olabilen tablolar (portal hesabı, bildirim): isteğe bağlı ilişkisiyle silinen bir kayda bağlıysa ve kendi firması yoksa sil
  if (m.fields.some(f => f.name === 'companyId' && !f.isRequired)) {
    for (const r of relsOf(m)) {
      if (r.required || r.parent === name || r.cols.length !== 1) continue;
      if (!['User', 'Customer', 'PortalCustomer', 'Company'].includes(r.parent)) continue;
      conds.push(`("companyId" IS NULL AND ${q(r.cols[0])} IN (SELECT id FROM ${q('del_' + r.parent)}))`);
    }
  }
  if (name === 'PortalCustomer') conds.push(`("companyId" IS NULL AND "customerId" IS NULL)`);
  const where = conds.length ? conds.join('\n     OR ') : 'false';
  out.push(`CREATE TEMP TABLE ${q('del_' + name)} ON COMMIT DROP AS SELECT ${q(id)} AS id FROM ${q(name)} WHERE ${where};`);
}
out.push('');

// Kalan kayıtların silinecek kayıtlara isteğe bağlı bağlarını kopar; silinecek kayıtlar arasındaki döngüleri de kır
for (const name of order) {
  const m = byName.get(name)!;
  for (const r of relsOf(m)) {
    if (r.required || r.cols.length !== 1) continue;
    out.push(`UPDATE ${q(name)} SET ${q(r.cols[0])} = NULL WHERE ${q(r.cols[0])} IN (SELECT id FROM ${q('del_' + r.parent)});`);
  }
}
out.push('');

// Silme: çocuktan ebeveyne
for (const name of [...order].reverse()) {
  if (!idField(byName.get(name)!)) continue;
  out.push(`DELETE FROM ${q(name)} WHERE ${q(idField(byName.get(name)!)!)} IN (SELECT id FROM ${q('del_' + name)});`);
}
out.push('');

// Doğrulama
out.push('-- Doğrulama: kalan firmalar, kullanıcılar, portal hesapları');
out.push(`SELECT c.name AS firma, (SELECT count(*) FROM "User" u WHERE u."companyId" = c.id) AS kullanici, (SELECT count(*) FROM "PortalCustomer" p WHERE p."companyId" = c.id) AS portal FROM "Company" c ORDER BY c.name;`);
out.push(`SELECT (SELECT count(*) FROM "Company") AS firma_sayisi, (SELECT count(*) FROM "User") AS kullanici_sayisi, (SELECT count(*) FROM "PortalCustomer") AS portal_sayisi;`);
out.push('-- Kalan firmaların kayıt sayıları: önce ve sonra aynı olmalı');
out.push(`SELECT * FROM sayim_once UNION ALL ${countSql('sonra').replace(/;$/, '')};`);
// Güvenlik kilidi: kalan firmaların verisi eksildiyse ya da firma sayısı yanlışsa her şey geri alınır
const checks = companyTables.map(m => `(SELECT count(*) FROM ${q(m.name)} WHERE "companyId" IN (SELECT id FROM keep_company)) <> (SELECT ${q(m.name)} FROM sayim_once)`);
out.push(`DO $$ BEGIN
  IF (SELECT count(*) FROM "Company") <> ${emails.length} THEN RAISE EXCEPTION 'Temizlik sonrası firma sayısı ${emails.length} değil; işlem geri alındı'; END IF;
  IF ${checks.join('\n     OR ')} THEN RAISE EXCEPTION 'Kalan firmaların verisi değişti; işlem geri alındı'; END IF;
END $$;`);
out.push('', '-- Buraya kadar hata yoksa kalıcı yapılır. Hata çıkarsa hiçbir şey silinmez.', 'COMMIT;');
console.log(out.join('\n'));
