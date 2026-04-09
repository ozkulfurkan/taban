import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token as any;
    const { pathname } = req.nextUrl;

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
  ],
};
