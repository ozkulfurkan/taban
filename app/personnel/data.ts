export type Employee = {
  id: string;
  name: string;
  department: string;
  role: string;
  salary: number;
  currency: string;
  status: 'active' | 'left';
  hireDate: string;
  payday: number;
  lastPaymentDate: string | null;
  balance: number;
  leaveBalance: number;
  phone?: string;
  email?: string;
};

export const MOCK_EMPLOYEES: Employee[] = [
  { id: 'emp-1', name: 'Ahmet Yılmaz', department: 'Üretim', role: 'Üretim Operatörü', salary: 25000, currency: 'TRY', status: 'active', hireDate: '2021-03-15', payday: 5, lastPaymentDate: '2026-04-05', balance: 0, leaveBalance: 12, phone: '0532 111 2233', email: 'ahmet@firma.com' },
  { id: 'emp-2', name: 'Fatma Kaya', department: 'Muhasebe', role: 'Muhasebeci', salary: 35000, currency: 'TRY', status: 'active', hireDate: '2020-06-01', payday: 1, lastPaymentDate: '2026-04-01', balance: -2500, leaveBalance: 8, phone: '0533 222 3344', email: 'fatma@firma.com' },
  { id: 'emp-3', name: 'Mehmet Demir', department: 'Üretim', role: 'Makine Operatörü', salary: 28000, currency: 'TRY', status: 'active', hireDate: '2019-09-10', payday: 10, lastPaymentDate: '2026-04-10', balance: 5000, leaveBalance: 4, phone: '0535 333 4455' },
  { id: 'emp-4', name: 'Zeynep Arslan', department: 'Kalite Kontrol', role: 'QC Uzmanı', salary: 32000, currency: 'TRY', status: 'active', hireDate: '2022-01-20', payday: 15, lastPaymentDate: '2026-03-15', balance: 0, leaveBalance: 14, email: 'zeynep@firma.com' },
  { id: 'emp-5', name: 'Ali Çelik', department: 'Lojistik', role: 'Depo Sorumlusu', salary: 22000, currency: 'TRY', status: 'active', hireDate: '2023-05-08', payday: 20, lastPaymentDate: '2026-03-20', balance: 1500, leaveBalance: 10 },
  { id: 'emp-6', name: 'Ayşe Şahin', department: 'İK', role: 'İK Uzmanı', salary: 38000, currency: 'TRY', status: 'active', hireDate: '2018-11-12', payday: 1, lastPaymentDate: '2026-04-01', balance: 0, leaveBalance: 18, phone: '0536 444 5566' },
  { id: 'emp-7', name: 'Hasan Öztürk', department: 'Üretim', role: 'Vardiya Amiri', salary: 42000, currency: 'TRY', status: 'active', hireDate: '2017-02-28', payday: 5, lastPaymentDate: '2026-04-05', balance: -8000, leaveBalance: 6 },
  { id: 'emp-8', name: 'Elif Yıldız', department: 'Muhasebe', role: 'Mali Müşavir Yrd.', salary: 45000, currency: 'TRY', status: 'active', hireDate: '2021-08-16', payday: 25, lastPaymentDate: '2026-03-25', balance: 0, leaveBalance: 15, email: 'elif@firma.com' },
  { id: 'emp-9', name: 'Murat Koç', department: 'Lojistik', role: 'Şoför', salary: 18000, currency: 'TRY', status: 'left', hireDate: '2020-04-01', payday: 10, lastPaymentDate: '2025-12-10', balance: 0, leaveBalance: 0, phone: '0537 555 6677' },
  { id: 'emp-10', name: 'Selin Güneş', department: 'Kalite Kontrol', role: 'Test Teknisyeni', salary: 26000, currency: 'TRY', status: 'active', hireDate: '2024-02-05', payday: 15, lastPaymentDate: '2026-03-15', balance: 2000, leaveBalance: 13 },
];
