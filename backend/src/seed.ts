import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function validateBootstrapPassword(password: string): void {
  if (password.length < 16) {
    throw new Error('ADMIN_PASSWORD must contain at least 16 characters');
  }
  const normalized = password.toLowerCase();
  const blocked = new Set([
    'admin',
    'password',
    'change-me',
    'changeme',
    'hydraflow',
  ]);
  if (blocked.has(normalized)) {
    throw new Error('ADMIN_PASSWORD is a known insecure default');
  }
}

async function ensureInitialAdmin(): Promise<void> {
  const existingAdmins = await prisma.admin.count();
  if (existingAdmins > 0) {
    console.log('Admin bootstrap skipped: at least one admin already exists');
    return;
  }

  const email = requiredEnv('ADMIN_EMAIL').toLowerCase();
  const password = requiredEnv('ADMIN_PASSWORD');
  validateBootstrapPassword(password);

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.admin.create({
    data: {
      email,
      password: hashedPassword,
      role: 'superadmin',
      enabled: true,
    },
  });

  console.log(`Initial superadmin created: ${email}`);
}

async function ensureDefaultSettings(): Promise<void> {
  await prisma.settings.upsert({
    where: { id: 'main' },
    update: {},
    create: {
      id: 'main',
      realityEnabled: true,
      realityPort: 443,
      realitySni: 'www.apple.com',
      wsEnabled: true,
      wsPort: 2053,
      wsPath: '/ws',
      ssEnabled: false,
      ssPort: 8388,
      ssMethod: '2022-blake3-aes-256-gcm',
      splitTunneling: true,
      adBlocking: true,
    },
  });
}

async function main(): Promise<void> {
  await ensureInitialAdmin();
  await ensureDefaultSettings();
  console.log('HydraFlow bootstrap completed');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('HydraFlow bootstrap failed', error);
    await prisma.$disconnect();
    process.exit(1);
  });
