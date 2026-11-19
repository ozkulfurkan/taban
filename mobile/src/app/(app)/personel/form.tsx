import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, ErrorState, Field, Loading, Screen, Segmented, T } from '@/components/ui';
import { amountToInput, formatAmountInput, parseAmountInput } from '@/core/amount';
import { api } from '@/core/api';
import { notify } from '@/core/dialog';
import { isoDay } from '@/core/format';
import type { Employee } from '@/core/personnel';
import { useApi } from '@/core/query';
import { useTheme } from '@/hooks/use-theme';

// Personel ekleme / düzenleme
export default function PersonelForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const q = useApi<Employee>(id ? `/api/personnel/${id}` : null);
  if (id && q.isLoading) return <><Stack.Screen options={{ title: 'Personel düzenle' }} /><Loading /></>;
  if (id && (q.error || !q.data)) return <><Stack.Screen options={{ title: 'Personel düzenle' }} /><ErrorState message={(q.error as Error)?.message || 'Personel bulunamadı'} /></>;
  return <Form key={id ?? 'new'} employee={q.data ?? null} />;
}

function Form({ employee: e }: { employee: Employee | null }) {
  const c = useTheme();
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: e?.name ?? '', department: e?.department ?? '', role: e?.role ?? '',
    salary: e ? amountToInput(e.salary) : '', currency: e?.currency ?? 'TRY',
    hireDate: e?.hireDate ? isoDay(new Date(e.hireDate)) : isoDay(), payday: String(e?.payday ?? 1),
    phone: e?.phone ?? '', email: e?.email ?? '', notes: e?.notes ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(s => ({ ...s, [k]: v }));

  const save = async () => {
    setError('');
    if (!f.name.trim() || !f.department.trim() || !f.role.trim()) return setError('Ad, departman ve görev zorunlu.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.hireDate)) return setError('İşe giriş tarihini YYYY-AA-GG biçiminde girin.');
    const payday = parseInt(f.payday, 10);
    if (!(payday >= 1 && payday <= 31)) return setError('Maaş günü 1–31 arasında olmalı.');
    const body = {
      name: f.name.trim(), department: f.department.trim(), role: f.role.trim(),
      salary: parseAmountInput(f.salary) || 0, currency: f.currency, hireDate: f.hireDate, payday,
      phone: f.phone.trim(), email: f.email.trim(), notes: f.notes.trim(),
    };
    setSaving(true);
    try {
      const saved = e
        ? await api<Employee>(`/api/personnel/${e.id}`, { method: 'PUT', body })
        : await api<Employee>('/api/personnel', { method: 'POST', body });
      await qc.invalidateQueries();
      if (e) router.back(); else router.replace(`/personel/${saved.id}`);
      notify(e ? 'Personel güncellendi' : 'Personel eklendi', body.name);
    } catch (err: any) { setError(err?.message || 'Kaydedilemedi'); } finally { setSaving(false); }
  };

  return (
    <>
      <Stack.Screen options={{ title: e ? 'Personel düzenle' : 'Yeni personel' }} />
      <Screen>
        <Field label="Ad soyad *" value={f.name} onChangeText={set('name')} testID="employee-name" />
        <Field label="Departman *" value={f.department} onChangeText={set('department')} placeholder="örn. Üretim" testID="employee-department" />
        <Field label="Görev *" value={f.role} onChangeText={set('role')} placeholder="örn. Usta" testID="employee-role" />
        <Field label="Maaş" value={f.salary} onChangeText={v => set('salary')(formatAmountInput(v))} keyboardType="decimal-pad" placeholder="0,00" testID="employee-salary" />
        <Segmented value={f.currency} onChange={set('currency')} options={['TRY', 'USD', 'EUR'].map(x => ({ value: x, label: x }))} />
        <Field label="Maaş günü (1–31)" value={f.payday} onChangeText={v => set('payday')(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
        <Field label="İşe giriş (YYYY-AA-GG)" value={f.hireDate} onChangeText={set('hireDate')} autoCapitalize="none" />
        <Field label="Telefon" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label="E-posta" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Notlar" value={f.notes} onChangeText={set('notes')} multiline style={{ minHeight: 60, paddingTop: 12 }} />
        {error ? <T color={c.danger} testID="employee-error">{error}</T> : null}
        <Button title="Kaydet" onPress={save} loading={saving} testID="employee-save" />
      </Screen>
    </>
  );
}
