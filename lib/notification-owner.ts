import { getServerSession } from 'next-auth';
import type { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth-options';

// Oturumdaki kişinin bildirim kutusu filtresi: firma kullanıcısı kendi kaydını yalnızca şu anki
// firmasında görür; portal hesabı kendi kaydını görür. Başkasının bildirimine hiçbir yol açılmaz.
export async function notificationOwner(): Promise<{ where: Prisma.NotificationWhereInput; portal: boolean } | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (!u?.id) return null;
  if (u.type === 'portal') return { where: { portalCustomerId: String(u.id) }, portal: true };
  if (!u.companyId) return null;
  return { where: { userId: String(u.id), companyId: String(u.companyId) }, portal: false };
}
