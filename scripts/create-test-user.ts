import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'playwright@solecost.test';
  const password = 'PlaywrightTest123';

  // Check if company exists
  let company = await prisma.company.findFirst({ where: { name: 'Playwright Test Co' } });
  if (!company) {
    company = await prisma.company.create({
      data: { name: 'Playwright Test Co', companyType: 'SOLE_MANUFACTURER' },
    });
    console.log('Company created:', company.id);
  }

  // Check if user exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Test user already exists:', email);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Playwright Tester',
      password: hashedPassword,
      role: 'COMPANY_OWNER',
      emailVerified: true,
      companyId: company.id,
    },
  });
  console.log('Test user created:', user.email);
  console.log('TEST_EMAIL=' + email);
  console.log('TEST_PASSWORD=' + password);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
