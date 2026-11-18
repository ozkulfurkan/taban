import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

// Mobil uygulama açılışında oturumun hâlâ geçerli olduğunu ve güncel rolü öğrenir.
// Rol, firma veya izin değişmişse oturum düşer ve 401 döner.
export async function GET() {
  const session = await getServerSession(authOptions);
  const u = session?.user as any;
  if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = u.type === 'portal'
    ? { id: u.id, name: u.name, email: u.email, type: 'portal', portalType: u.portalType ?? 'CUSTOMER' }
    : {
        id: u.id, name: u.name, email: u.email, type: 'staff', role: u.role, companyName: u.companyName ?? null,
        companyType: u.companyType, allowedPages: u.allowedPages ?? [], language: u.language ?? 'tr', currency: u.currency ?? 'TRY',
      };
  return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
}
