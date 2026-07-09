// scripts/seed-production.ts
// Jalankan: npx tsx scripts/seed-production.ts
// Fungsi: Insert data awal untuk production (admin user + store settings + couriers)

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import * as schema from '../lib/db/schema';

// ── Konfigurasi ───────────────────────────────────────────────────────────────
const ADMIN = {
  name: 'Admin OneTone',
  email: 'admin@kanuraga.web.id',   // ← ganti sesuai kebutuhan
  password: 'OnetoneAdmin@123456',            // ← ganti password kuat sebelum jalankan!
};

const STORE_SETTINGS = [
  { key: 'store_name',     value: 'OneTone Store' },
  { key: 'store_phone',    value: '08123456789' },
  { key: 'store_email',    value: 'hello@kanuraga.web.id' },
  { key: 'store_address',  value: 'Bandung, Jawa Barat' },
  { key: 'store_province', value: 'Jawa Barat' },
  { key: 'store_city',     value: 'Bandung' },
  { key: 'store_currency', value: 'IDR' },
  { key: 'store_logo',     value: '' },
];

const COURIERS = [
  { name: 'JNE',     code: 'jne',     isActive: true },
  { name: 'J&T',     code: 'jnt',     isActive: true },
  { name: 'SiCepat', code: 'sicepat', isActive: true },
  { name: 'AnterAja',code: 'anteraja',isActive: true },
  { name: 'Pos Indonesia', code: 'pos', isActive: true },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding production database...\n');

  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
  });

  const db = drizzle(connection, { schema, mode: 'default' });

  // ── 1. Admin user ──────────────────────────────────────────────────────────
  console.log('👤 Membuat admin user...');
  const hashedPassword = await bcrypt.hash(ADMIN.password, 12);

  const existingAdmin = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, ADMIN.email),
  });

  if (existingAdmin) {
    console.log(`   ⚠️  Admin dengan email ${ADMIN.email} sudah ada, skip.`);
  } else {
    await db.insert(schema.users).values({
      name: ADMIN.name,
      email: ADMIN.email,
      password: hashedPassword,
      role: 'admin',
    });
    console.log(`   ✅ Admin berhasil dibuat: ${ADMIN.email}`);
  }

  // ── 2. Store settings ──────────────────────────────────────────────────────
  console.log('\n⚙️  Membuat store settings...');
  for (const setting of STORE_SETTINGS) {
    try {
      await db.insert(schema.storeSettings).values(setting)
        .onDuplicateKeyUpdate({ set: { value: setting.value } });
      console.log(`   ✅ ${setting.key} = ${setting.value}`);
    } catch {
      console.log(`   ⚠️  ${setting.key} sudah ada, skip.`);
    }
  }

  // ── 3. Couriers ────────────────────────────────────────────────────────────
  console.log('\n🚚 Membuat data kurir...');
  for (const courier of COURIERS) {
    try {
      await db.insert(schema.couriers).values(courier)
        .onDuplicateKeyUpdate({ set: { name: courier.name, isActive: courier.isActive } });
      console.log(`   ✅ ${courier.name} (${courier.code})`);
    } catch {
      console.log(`   ⚠️  ${courier.code} sudah ada, skip.`);
    }
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('\n================================================');
  console.log('✅ Seed selesai!');
  console.log('================================================');
  console.log(`\n📋 Ringkasan:`);
  console.log(`   Email admin : ${ADMIN.email}`);
  console.log(`   Password    : ${ADMIN.password}`);
  console.log(`\n⚠️  Segera ganti password setelah login pertama!`);

  await connection.end();
}

main().catch((err) => {
  console.error('❌ Seed gagal:', err);
  process.exit(1);
});