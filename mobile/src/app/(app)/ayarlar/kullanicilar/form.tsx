import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Button, Card, Field, Loading, Screen, Section, Segmented, T } from '@/components/ui';
import { api } from '@/core/api';
import { confirm, notify } from '@/core/dialog';
import { useApi } from '@/core/query';
import { ASSIGNABLE, PAGES, ROLE_HINT, ROLE_LABEL, fullAccess, type CompanyUser } from '@/core/users';
import { useTheme } from '@/hooks/use-theme';

type Role = (typeof ASSIGNABLE)[number];

// Kullanıcı ekle / düzenle: ad, e-posta, şifre (yalnızca eklerken), rol ve sayfa izinleri.
export default function UserForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const list = useApi<CompanyUser[]>(id ? '/api/users' : null);
  const existing = id ? list.data?.find(u => u.id === id) : undefined;
  if (id && list.isLoading) return <><Stack.Screen options={{ title: 'Kullanıcı' }} /><Loading /></>;
  return <Form key={existing?.id ?? 'new'} existing={existing} />;
}

function Form({ existing }: { existing?: CompanyUser }) {
  const c = useTheme();
  const qc = useQueryClient();
  const [name, setName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>((existing?.role as Role) ?? 'EDITOR');
  const [pages, setPages] = useState<string[]>(existing?.allowedPages ?? PAGES.map(p => p.key));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const toggle = (k: string) => setPages(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));

  const save = async () => {
    setError('');
    if (!existing) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Geçerli bir e-posta girin.');
      if (password.length < 6 || !/[A-Za-zğüşıöçĞÜŞİÖÇ]/.test(password) || !/\d/.test(password)) return setError('Şifre en az 6 karakter, 1 harf ve 1 rakam içermelidir.');
    }
    setBusy(true);
    try {
      const body = { name: name.trim() || null, role, allowedPages: fullAccess(role) ? [] : pages };
      if (existing) await api(`/api/users/${existing.id}`, { method: 'PATCH', body });
      else await api('/api/users', { method: 'POST', body: { ...body, email: email.trim(), password } });
      await qc.invalidateQueries({ queryKey: ['/api/users'] });
      notify(existing ? 'Kullanıcı güncellendi' : 'Kullanıcı eklendi', existing ? '' : `${email.trim()} bu şifreyle giriş yapabilir.`, 'success');
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (!(await confirm('Kullanıcı silinsin mi?', `${existing.email} artık giriş yapamaz. Açık oturumları hemen kapanır.`, 'Sil', true))) return;
    setBusy(true);
    try {
      await api(`/api/users/${existing.id}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['/api/users'] });
      router.back();
    } catch (e: any) {
      notify('Silinemedi', e?.message ?? '', 'error');
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı' }} />
      <Screen>
        <Card style={{ gap: 14 }}>
          <Field label="Ad soyad" value={name} onChangeText={setName} testID="user-name" />
          {existing ? (
            <View style={{ gap: 4 }}><T variant="label">E-posta</T><T>{existing.email}</T></View>
          ) : (
            <>
              <Field label="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="off" testID="user-email" />
              <Field label="Geçici şifre" value={password} onChangeText={setPassword} autoCapitalize="none" autoComplete="off" testID="user-password" />
              <T variant="small">Kullanıcı ilk girişten sonra Ayarlar → Şifre değiştir ile kendi şifresini belirleyebilir.</T>
            </>
          )}
        </Card>

        <Section title="Rol">
          <Segmented<Role> value={role} onChange={setRole} options={ASSIGNABLE.map(r => ({ value: r, label: ROLE_LABEL[r].replace('Firma yöneticisi', 'Yönetici') }))} />
          <T variant="small">{ROLE_HINT[role]}</T>
        </Section>

        {fullAccess(role) ? null : (
          <Section title={`Sayfa izinleri (${pages.length}/${PAGES.length})`}
            action={<Pressable onPress={() => setPages(pages.length === PAGES.length ? [] : PAGES.map(p => p.key))}><T color={c.primary}>{pages.length === PAGES.length ? 'Tümünü kaldır' : 'Tümünü seç'}</T></Pressable>}>
            <Card style={{ gap: 4 }}>
              {PAGES.map(p => (
                <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <T>{p.label}</T>
                  <Switch value={pages.includes(p.key)} onValueChange={() => toggle(p.key)} trackColor={{ true: c.primary }} testID={`page-${p.key}`} />
                </View>
              ))}
            </Card>
          </Section>
        )}

        {error ? <T color={c.danger} testID="user-error">{error}</T> : null}
        <Button title={existing ? 'Kaydet' : 'Kullanıcıyı ekle'} onPress={save} loading={busy} testID="user-save" />
        {existing ? <Button title="Kullanıcıyı sil" variant="danger" icon="trash" onPress={remove} /> : null}
      </Screen>
    </>
  );
}
