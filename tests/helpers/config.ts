export const TEST_CONFIG = {
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  credentials: {
    email: process.env.TEST_EMAIL || 'test@solecost.com',
    password: process.env.TEST_PASSWORD || 'Test123456',
    name: 'Test Kullanıcı',
    companyName: 'Test Firma AS',
  },
  timeouts: {
    short: 5000,
    medium: 10000,
    long: 30000,
  },
};

export const ROUTES = {
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
  orders: '/orders',
  ordersNew: '/orders/new',
  invoices: '/invoices',
  invoicesNew: '/invoices/new',
  products: '/products',
  productsNew: '/products/new',
  materials: '/materials',
  customers: '/customers',
  suppliers: '/suppliers',
  payments: '/payments',
  accounts: '/accounts',
  personnel: '/personnel',
  settings: '/settings',
  destekMerkezi: '/destek-merkezi',
};
