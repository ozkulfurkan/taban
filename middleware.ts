import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/materials/:path*',
    '/calculations/:path*',
    '/admin/:path*',
    '/settings/:path*',
    '/portal/dashboard/:path*',
    '/portal/orders/:path*',
    '/portal/catalog/:path*',
    '/portal-admin/:path*',
    '/portal-admin',
  ],
};
