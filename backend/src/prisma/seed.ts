import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin', 10);
  await prisma.admin.upsert({
    where: { email: 'admin@hydraflow.dev' },
    update: {},
    create: { email: 'admin@hydraflow.dev', password: hashedPassword },
  });
  await prisma.settings.upsert({
    where: { id: 'main' },
    update: {},
    create: { id: 'main', realityPort: 443, realitySni: 'www.apple.com', wsPort: 2053, ssPort: 8388 },
  });
  console.log('Seed completed');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
