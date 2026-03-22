import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default company
  const company = await prisma.company.upsert({
    where: { id: 'default-company' },
    update: {},
    create: {
      id: 'default-company',
      name: 'SoleCost Demo',
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // Create admin user
  const adminPassword = await bcrypt.hash('johndoe123', 12);
  await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
      companyId: company.id,
      language: 'tr',
      currency: 'USD',
    },
  });

  // Create sample materials
  const materialsData = [
    { id: 'mat-pvc', name: 'PVC', supplier: 'PlastoChem', pricePerKg: 2.5, currency: 'USD', description: 'Standard PVC granule' },
    { id: 'mat-tpr', name: 'TPR', supplier: 'RubberTech', pricePerKg: 3.2, currency: 'USD', description: 'Thermoplastic rubber' },
    { id: 'mat-eva', name: 'EVA', supplier: 'FoamPlus', pricePerKg: 4.0, currency: 'USD', description: 'Ethylene-vinyl acetate foam' },
    { id: 'mat-pu', name: 'PU', supplier: 'PolyMax', pricePerKg: 5.5, currency: 'USD', description: 'Polyurethane sole material' },
    { id: 'mat-rubber', name: 'Kau\u00e7uk', supplier: 'NatRubber Co.', pricePerKg: 6.0, currency: 'USD', description: 'Natural rubber compound' },
  ];

  for (const mat of materialsData) {
    const material = await prisma.material.upsert({
      where: { id: mat.id },
      update: { pricePerKg: mat.pricePerKg },
      create: {
        id: mat.id,
        companyId: company.id,
        name: mat.name,
        supplier: mat.supplier,
        pricePerKg: mat.pricePerKg,
        currency: mat.currency,
        description: mat.description,
      },
    });

    await prisma.priceHistory.upsert({
      where: { id: `ph-${mat.id}` },
      update: {},
      create: {
        id: `ph-${mat.id}`,
        materialId: material.id,
        pricePerKg: mat.pricePerKg,
        currency: mat.currency,
      },
    });
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
