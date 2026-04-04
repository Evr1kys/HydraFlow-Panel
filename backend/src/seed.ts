import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env['ADMIN_EMAIL'] ?? 'admin@hydraflow.dev';
  const password = process.env['ADMIN_PASSWORD'] ?? 'admin';

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.admin.upsert({
    where: { email },
    update: { password: hashedPassword },
    create: {
      email,
      password: hashedPassword,
    },
  });

  console.log(`Admin created: ${email}`);

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

  console.log('Default settings created');

  const russianISPs = [
    { isp: 'Rostelecom', asn: 12389 },
    { isp: 'MTS', asn: 8359 },
    { isp: 'MegaFon', asn: 31133 },
    { isp: 'Beeline', asn: 3216 },
    { isp: 'Tele2', asn: 15378 },
    { isp: 'ER-Telecom', asn: 9049 },
  ];

  const protocols = ['VLESS+Reality', 'VLESS+WebSocket', 'Shadowsocks'];
  const statuses = ['working', 'working', 'working', 'slow', 'blocked'];

  for (const { isp, asn } of russianISPs) {
    for (const protocol of protocols) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      await prisma.iSPReport.create({
        data: {
          country: 'Russia',
          isp,
          asn,
          protocol,
          status: status ?? 'working',
        },
      });
    }
  }

  console.log('Seed ISP reports created');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
