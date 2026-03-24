/**
 * packages/db seed — runs AFTER the synthetic generator.
 * Seeds reference data: battery models and a demo lender.
 *
 * Run: pnpm --filter @voltledger/db seed
 * (Real battery + telemetry data comes from synthetic-generator --seed-db)
 */

import { prisma } from './client';

async function main() {
  console.log('🌱 Seeding VoltLedger database...\n');

  // ── 1. Battery Models ──────────────────────────────────────────────────────
  const models = [
    {
      id: 'catl-lfp-60',
      modelName: 'LFP-60 Standard Range',
      manufacturer: 'CATL',
      chemistry: 'LFP' as const,
      capacityKwh: 60.0,
      nominalVoltageV: 355,
      weightKg: 385,
      ratedCycleLife: 3000,
      calendarLifeYears: 15,
      warrantyYears: 8,
      hazardousSubstances: ['Lithium', 'Iron', 'Phosphate'],
      extinguishingAgents: ['Class D Powder', 'Water Mist'],
    },
    {
      id: 'catl-lfp-80',
      modelName: 'LFP-80 Long Range',
      manufacturer: 'CATL',
      chemistry: 'LFP' as const,
      capacityKwh: 80.0,
      nominalVoltageV: 370,
      weightKg: 490,
      ratedCycleLife: 3000,
      calendarLifeYears: 15,
      warrantyYears: 8,
      hazardousSubstances: ['Lithium', 'Iron', 'Phosphate'],
      extinguishingAgents: ['Class D Powder', 'Water Mist'],
    },
    {
      id: 'lg-nmc-75',
      modelName: 'Chem NCMA 75',
      manufacturer: 'LG Energy Solution',
      chemistry: 'NMC' as const,
      capacityKwh: 75.0,
      nominalVoltageV: 400,
      weightKg: 455,
      ratedCycleLife: 1500,
      calendarLifeYears: 10,
      warrantyYears: 8,
      hazardousSubstances: ['Nickel', 'Manganese', 'Cobalt', 'Lithium'],
      extinguishingAgents: ['CO2', 'Water Mist', 'Dry Chemical'],
    },
    {
      id: 'panasonic-nca-100',
      modelName: '2170 NCA 100',
      manufacturer: 'Panasonic',
      chemistry: 'NCA' as const,
      capacityKwh: 100.0,
      nominalVoltageV: 400,
      weightKg: 540,
      ratedCycleLife: 1200,
      calendarLifeYears: 10,
      warrantyYears: 8,
      hazardousSubstances: ['Nickel', 'Cobalt', 'Aluminum', 'Lithium'],
      extinguishingAgents: ['CO2', 'Dry Chemical'],
    },
    {
      id: 'byd-lfp-50',
      modelName: 'Blade LFP 50',
      manufacturer: 'BYD',
      chemistry: 'LFP' as const,
      capacityKwh: 50.0,
      nominalVoltageV: 320,
      weightKg: 310,
      ratedCycleLife: 3500,
      calendarLifeYears: 15,
      warrantyYears: 8,
      hazardousSubstances: ['Lithium', 'Iron', 'Phosphate'],
      extinguishingAgents: ['Class D Powder', 'Water Mist'],
    },
    {
      id: 'sk-nmc-commercial',
      modelName: 'NMC-Commercial 120',
      manufacturer: 'SK On',
      chemistry: 'NMC' as const,
      capacityKwh: 120.0,
      nominalVoltageV: 800,
      weightKg: 660,
      ratedCycleLife: 2000,
      calendarLifeYears: 12,
      warrantyYears: 8,
      hazardousSubstances: ['Nickel', 'Manganese', 'Cobalt', 'Lithium'],
      extinguishingAgents: ['CO2', 'Water Mist'],
    },
  ];

  for (const model of models) {
    await prisma.batteryModel.upsert({
      where: { id: model.id },
      update: {},
      create: model,
    });
    console.log(`  ✓ BatteryModel: ${model.modelName}`);
  }

  // ── 2. Demo Organization + Lender ─────────────────────────────────────────
  const demoOrg = await prisma.organization.upsert({
    where: { id: 'org-demo-greenleaf' },
    update: {},
    create: {
      id: 'org-demo-greenleaf',
      name: 'Greenleaf Auto Finance',
      description: 'Demo lender account for VoltLedger API testing',
      location: 'San Francisco, CA',
      website: 'https://greenleaf.example.com',
    },
  });
  console.log(`\n  ✓ Organization: ${demoOrg.name}`);

  const demoLender = await prisma.lender.upsert({
    where: { organizationId: 'org-demo-greenleaf' },
    update: {},
    create: {
      organizationId: 'org-demo-greenleaf',
      tier: 'PROFESSIONAL',
      lenderType: 'AUTO_FINTECH',
      contactEmail: 'api@greenleaf.example.com',
      contactName: 'Dev Team',
      isActive: true,
      monthlyBatteryQuota: 1000,
      batteriesUsedThisMonth: 0,
      acvUsd: 50000,
    },
  });
  console.log(`  ✓ Lender: ${demoOrg.name} (${demoLender.tier})`);

  // Demo API key (prefix only — hash would be bcrypt in production)
  await prisma.apiKey.upsert({
    where: { keyPrefix: 'vl_test_demo01' },
    update: {},
    create: {
      lenderId: demoLender.id,
      keyPrefix: 'vl_test_demo01',
      keyHash: '$2b$10$PLACEHOLDER_HASH_FOR_DEV_ONLY',
      label: 'Development Key',
      status: 'ACTIVE',
      permissions: [
        'battery:read',
        'risk:read',
        'residual-value:read',
        'ltv:read',
        'second-life:read',
        'portfolio:read',
      ],
    },
  });
  console.log(`  ✓ ApiKey: vl_test_demo01_*** (DEV)`);

  console.log('\n✓ Seed complete.\n');
  console.log('Next steps:');
  console.log('  1. Run synthetic generator:  cd tools/synthetic-generator && pnpm generate -- --seed-db');
  console.log('  2. Start API:                pnpm dev\n');
}

main()
  .catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
