import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as any;
    const { pathname } = req.nextUrl;

    // Portal users must not access main app routes
    if (token?.type === 'portal') {
      const isPortalRoute =
        pathname.startsWith('/portal/') ||
        pathname.startsWith('/api/portal/');
      if (!isPortalRoute) {
        return NextResponse.redirect(new URL('/portal/dashboard', req.url));
      }
    }

    // Staff/admin users must not access portal customer routes
    if (token && token.type !== 'portal') {
      const isPortalCustomerRoute =
        pathname.startsWith('/portal/dashboard') ||
        pathname.startsWith('/portal/orders') ||
        pathname.startsWith('/portal/catalog');
      if (isPortalCustomerRoute) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: '/login',
    },
    callbacks: {
      authorized: ({ token }) => !!token,
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
  ],
};
