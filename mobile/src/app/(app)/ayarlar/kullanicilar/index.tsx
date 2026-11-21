import { Stack, router } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Empty, ErrorState, ListRow, Loading, Screen, T } from '@/components/ui';
import { useAuth } from '@/core/auth';
import { useApi } from '@/core/query';
import { PAGES, ROLE_LABEL, fullAccess, type CompanyUser } from '@/core/users';

// Firma kullanıcıları: yalnızca firma sahibi / yönetici (sunucu da kontrol eder)
export default function Users() {
  const { user } = useAuth();
  const q = useApi<CompanyUser[]>('/api/users');
  const title = { title: 'Kullanıcılar' };
  if (q.isLoading) return <><Stack.Screen options={title} /><Loading /></>;
  if (q.error || !q.data) return <><Stack.Screen options={title} /><ErrorState message={(q.error as Error)?.message || 'Yüklenemedi'} onRetry={() => q.refetch()} /></>;
  return (
    <>
      <Stack.Screen options={title} />
      <Screen refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }}>
        <Button title="Kullanıcı ekle" icon="plus" onPress={() => router.push('/ayarlar/kullanicilar/form')} testID="user-add" />
        {q.data.length === 0 ? <Empty message="Henüz kullanıcı yok." /> : (
          <Card style={{ padding: 0, gap: 0 }}>
            {q.data.map(u => (
              <View key={u.id}>
                <ListRow
                  testID={`user-${u.id}`}
                  title={`${u.name || u.email}${u.id === user?.id ? ' (siz)' : ''}`}
                  subtitle={`${u.email}${fullAccess(u.role) ? '' : ` · ${u.allowedPages.length}/${PAGES.length} sayfa`}`}
                  right={ROLE_LABEL[u.role] ?? u.role}
                  onPress={u.id === user?.id || u.role === 'ADMIN' ? undefined : () => router.push(`/ayarlar/kullanicilar/form?id=${u.id}`)}
                />
              </View>
            ))}
          </Card>
        )}
        <T variant="small">Kendi hesabınız ve sistem yöneticileri buradan düzenlenemez.</T>
      </Screen>
    </>
  );
}
