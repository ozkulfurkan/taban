import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, ErrorState, Field, Loading, Screen, Segmented, T } from '@/components/ui';
import { api, ApiError } from '@/core/api';
import { confirm, notify } from '@/core/dialog';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

type Kind = 'customer' | 'supplier';
type Party = { id: string; name: string; currency: string; phone?: string | null; email?: string | null; address?: string | null; taxId?: string | null; taxOffice?: string | null; notes?: string | null };
const CURRENCIES = ['TRY', 'USD', 'EUR'] as const;

// Müşteri / tedarikçi ekleme ve düzenleme (web ile aynı kurallar: para birimi sonradan değişmez,
// aynı adlı kayıt varsa onay istenir; tedarikçide SoleCost firma koduyla bağlantı isteği)
export default function PartyForm() {
  const params = useLocalSearchParams<{ kind: Kind; id?: string }>();
  const kind: Kind = params.kind === 'supplier' ? 'supplier' : 'customer';
  const base = kind === 'customer' ? '/api/customers' : '/api/suppliers';
  const label = kind === 'customer' ? 'Müşteri' : 'Tedarikçi';
  const existing = useApi<Party>(params.id ? `${base}/${params.id}` : null);

  if (params.id && existing.isLoading) return <><Stack.Screen options={{ title: `${label} düzenle` }} /><Loading /></>;
  if (params.id && (existing.error || !existing.data)) {
    return <><Stack.Screen options={{ title: `${label} düzenle` }} /><ErrorState message={(existing.error as Error)?.message || 'Kayıt bulunamadı'} /></>;
  }
  return <Form key={params.id ?? 'new'} kind={kind} base={base} label={label} party={existing.data ?? null} />;
}

function Form({ kind, base, label, party }: { kind: Kind; base: string; label: string; party: Party | null }) {
  const c = useTheme();
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: party?.name ?? '', currency: party?.currency ?? (kind === 'customer' ? 'TRY' : 'USD'),
    phone: party?.phone ?? '', email: party?.email ?? '', address: party?.address ?? '',
    taxId: party?.taxId ?? '', taxOffice: party?.taxOffice ?? '', notes: party?.notes ?? '', code: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(s => ({ ...s, [k]: v }));

  const save = async () => {
    setError('');
    if (!f.name.trim()) return setError('Ad / unvan girin.');
    const body: Record<string, unknown> = {
      name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), address: f.address.trim(),
      taxId: f.taxId.trim(), notes: f.notes.trim(),
      ...(kind === 'customer' ? { taxOffice: f.taxOffice.trim() } : {}),
    };
    setSaving(true);
    try {
      let id = party?.id;
      if (party) {
        await api(`${base}/${party.id}`, { method: 'PUT', body });
      } else {
        const send = (extra: object = {}) => api<{ id: string }>(base, { method: 'POST', body: { ...body, currency: f.currency, ...extra } });
        let created: { id: string };
        try {
          created = await send();
        } catch (e) {
          if (!(e instanceof ApiError) || e.code !== 'DUPLICATE_NAME') throw e;
          if (!(await confirm('Aynı adlı kayıt var', `${e.message}\nYine de yeni kayıt açılsın mı?`, 'Yeni kayıt aç'))) { setSaving(false); return; }
          created = await send({ allowDuplicate: true });
        }
        id = created.id;
        // Tedarikçi SoleCost kullanıyorsa firma koduyla bağlantı isteği
        if (kind === 'supplier' && f.code.trim()) {
          await api('/api/network/links', { method: 'POST', body: { code: f.code, supplierId: id } })
            .catch((e: any) => notify('Bağlantı isteği gönderilemedi', `${e?.message ?? ''} Tedarikçi sayfasından tekrar deneyebilirsiniz.`));
        }
      }
      await qc.invalidateQueries();
      // Düzenlemede açık olan cari sayfasına dön; yeni kayıtta formun yerine cari sayfası açılır
      if (party) router.back(); else router.replace(`/cariler/${kind}/${id}`);
      notify(party ? `${label} güncellendi` : `${label} eklendi`, f.name.trim());
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: party ? `${label} düzenle` : `Yeni ${label.toLocaleLowerCase('tr')}` }} />
      <Screen>
        <Field label="Ad / unvan *" value={f.name} onChangeText={set('name')} placeholder="örn. Ayakkabı Dünyası A.Ş." testID="party-name" />
        {party ? (
          <T variant="small">Para birimi: {party.currency} (kayıttan sonra değiştirilemez)</T>
        ) : (
          <>
            <T variant="label">Para birimi</T>
            <Segmented value={f.currency} onChange={set('currency')} options={CURRENCIES.map(x => ({ value: x, label: x }))} />
          </>
        )}
        <Field label="Telefon" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" testID="party-phone" />
        <Field label="E-posta" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" testID="party-email" />
        <Field label="Adres" value={f.address} onChangeText={set('address')} multiline style={{ minHeight: 60, paddingTop: 12 }} />
        <Field label="Vergi no" value={f.taxId} onChangeText={set('taxId')} keyboardType="number-pad" />
        {kind === 'customer' ? <Field label="Vergi dairesi" value={f.taxOffice} onChangeText={set('taxOffice')} /> : null}
        <Field label="Notlar" value={f.notes} onChangeText={set('notes')} multiline style={{ minHeight: 60, paddingTop: 12 }} />
        {kind === 'supplier' && !party ? (
          <Field label="SoleCost firma kodu (isteğe bağlı)" value={f.code} onChangeText={set('code')} autoCapitalize="characters" placeholder="SC-XXXXXX" testID="party-code" />
        ) : null}
        {error ? <T color={c.danger} testID="party-error">{error}</T> : null}
        <Button title="Kaydet" onPress={save} loading={saving} testID="party-save" />
      </Screen>
    </>
  );
}
