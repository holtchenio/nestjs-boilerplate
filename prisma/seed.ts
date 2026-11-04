import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';
import { RoleEnum } from '../src/roles/roles.enum';
import { StatusEnum } from '../src/statuses/statuses.enum';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://root:secret@localhost:5432/api';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

/**
 * 写入开发用角色、状态和两个固定用户。重复执行只更新名称，不新增行。
 */
async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed when NODE_ENV is production');
  }

  await prisma.role.upsert({
    where: { id: RoleEnum.admin },
    update: { name: 'Admin' },
    create: { id: RoleEnum.admin, name: 'Admin' },
  });
  await prisma.role.upsert({
    where: { id: RoleEnum.user },
    update: { name: 'User' },
    create: { id: RoleEnum.user, name: 'User' },
  });
  await prisma.status.upsert({
    where: { id: StatusEnum.active },
    update: { name: 'Active' },
    create: { id: StatusEnum.active, name: 'Active' },
  });
  await prisma.status.upsert({
    where: { id: StatusEnum.inactive },
    update: { name: 'Inactive' },
    create: { id: StatusEnum.inactive, name: 'Inactive' },
  });

  const salt = await bcrypt.genSalt();
  const password = await bcrypt.hash('secret', salt);

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password,
      firstName: 'Super',
      lastName: 'Admin',
      provider: 'email',
      role: { connect: { id: RoleEnum.admin } },
      status: { connect: { id: StatusEnum.active } },
    },
  });
  await prisma.user.upsert({
    where: { email: 'john.doe@example.com' },
    update: {},
    create: {
      email: 'john.doe@example.com',
      password,
      firstName: 'John',
      lastName: 'Doe',
      provider: 'email',
      role: { connect: { id: RoleEnum.user } },
      status: { connect: { id: StatusEnum.active } },
    },
  });
}

/**
 * 执行种子并关闭数据库连接。
 */
async function main(): Promise<void> {
  try {
    await seed();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
