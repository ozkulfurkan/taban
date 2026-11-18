import { Redirect } from 'expo-router';
import { useAuth } from '@/core/auth';

// Açılış yönlendirmesi: oturuma göre giriş, firma uygulaması ya da portal
export default function Index() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={user.type === 'portal' ? '/portal' : '/panel'} />;
}
