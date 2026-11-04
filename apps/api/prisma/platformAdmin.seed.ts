import 'dotenv/config';
import { PlatformRole, PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Credentials come from the environment so no shared password lives in source.
// Defaults match the platform admin created by prisma/seed.ts.
const EMAIL = process.env.PLATFORM_ADMIN_EMAIL ?? 'platform.admin@tradunio.com';
const PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD ?? 'D5xzJmymKWBA9DETjUSUe6YxCXHDLL6';
const NAME = process.env.PLATFORM_ADMIN_NAME ?? 'Platform Admin';

async function main() {
  if (PASSWORD.length < 8) {
    throw new Error('PLATFORM_ADMIN_PASSWORD must be at least 8 characters');
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });

  const platformAdmin = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      name: NAME,
      platformRole: PlatformRole.platform_admin,
      passwordHash,
      status: UserStatus.active,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email: EMAIL,
      name: NAME,
      platformRole: PlatformRole.platform_admin,
      passwordHash,
      status: UserStatus.active,
    },
  });

  console.log(`${existing ? 'Updated' : 'Created'} platform admin: ${platformAdmin.email} (${platformAdmin.id})`);
  console.log('Password set from PLATFORM_ADMIN_PASSWORD (or its default).');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
