import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { canSeePage, checkApiAccess } from '@/lib/access';
import { decode } from 'next-auth/jwt';
import { bearerToken, withBearerCookie } from '@/lib/mobile-auth';

export default withAuth(
  async function middleware(req) {
    let token = req.nextauth.token as any;
    const { pathname } = req.nextUrl;

    // API istekleri: rol, portal ayrımı ve hassas sayfa izinleri
    if (pathname.startsWith('/api/')) {
      // Mobil uygulama: Bearer token varsa yetki kararı da onunla verilir (çerezdeki eski
      // bir oturum değil). Route'lar aynı token'ı withBearerCookie ile görür.
      const bearer = bearerToken(req.headers.get('authorization'));
      if (bearer) {
        token = await decode({ token: bearer, secret: process.env.NEXTAUTH_SECRET! }).catch(() => null);
      }
      const decision = checkApiAccess(token, req.method, pathname);
      if (!decision.ok) {
        return NextResponse.json({ error: decision.error }, { status: decision.status });
      }
      // Mobil uygulama: Bearer token route'lara oturum çerezi olarak iletilir (getServerSession çerez okur)
      const headers = withBearerCookie(req.headers);
      return headers ? NextResponse.next({ request: { headers } }) : NextResponse.next();
    }

    // Portal users must not access main app routes
    if (token?.type === 'portal') {
      const portalType = (token as any).portalType ?? 'CUSTOMER';
      const isPortalRoute =
        pathname.startsWith('/portal/') ||
        pathname.startsWith('/api/portal/');
      if (!isPortalRoute) {
        const redirect = portalType === 'SUBCONTRACTOR' ? '/portal/fason/dashboard' : '/portal/dashboard';
        return NextResponse.redirect(new URL(redirect, req.url));
      }
      // SUBCONTRACTOR portalı müşteri rotalarına erişemez
      if (portalType === 'SUBCONTRACTOR') {
        const isCustomerOnly =
          pathname.startsWith('/portal/dashboard') ||
          pathname.startsWith('/portal/orders') ||
          pathname.startsWith('/portal/catalog');
        if (isCustomerOnly) {
          return NextResponse.redirect(new URL('/portal/fason/dashboard', req.url));
        }
      }
      // CUSTOMER portalı fason rotalarına erişemez
      if (portalType === 'CUSTOMER' && pathname.startsWith('/portal/fason/')) {
        return NextResponse.redirect(new URL('/portal/dashboard', req.url));
      }
    }

    // Staff/admin users must not access portal customer routes
    if (token && token.type !== 'portal') {
      const isPortalCustomerRoute =
        pathname.startsWith('/portal/dashboard') ||
        pathname.startsWith('/portal/orders') ||
        pathname.startsWith('/portal/catalog') ||
        pathname.startsWith('/portal/fason/');
      if (isPortalCustomerRoute) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
      // Sayfa izinleri (menüde gizlenen sayfaya adresle girilmesini engeller)
      if (!canSeePage(token, pathname)) {
        return NextResponse.redirect(new URL('/yetkisiz', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: '/login',
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (pathname === '/portal/fason/login') return true;
        // API'lerde oturum kontrolünü route yapar (giriş, kayıt, cron gibi açık uç noktalar var)
        if (pathname.startsWith('/api/')) return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/materials/:path*',
    '/calculations/:path*',
    '/admin/:path*',
    '/settings/:path*',
    '/customers/:path*',
    '/suppliers/:path*',
    '/invoices/:path*',
    '/purchases/:path*',
    '/payments/:path*',
    '/accounts/:path*',
    '/products/:path*',
    '/quotes/:path*',
    '/cek-portfolyo/:path*',
    '/portal/dashboard/:path*',
    '/portal/orders/:path*',
    '/portal/catalog/:path*',
    '/portal-admin/:path*',
    '/portal-admin',
    '/subcontractors/:path*',
    '/subcontractors',
    '/subcontractor-orders/:path*',
    '/subcontractor-orders',
    '/portal/fason/:path*',
    '/portal/fason',
    '/orders/:path*',
    '/orders',
    '/personnel/:path*',
    '/personnel',
    '/destek-merkezi/:path*',
    '/destek-merkezi',
    '/hesaplayici/:path*',
    '/hesaplayici',
    '/logs/:path*',
    '/logs',
    '/yetkisiz',
    '/api/:path*',
  ],
};
