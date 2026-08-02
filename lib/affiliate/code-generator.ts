// lib/affiliate/code-generator.ts
import { db } from '@/lib/db';
import { affiliates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Bikin base code dari nama user: huruf besar, non-alfanumerik dibuang, maks 10 karakter,
 * lalu ditambah angka acak 2 digit. Contoh: "Wawan Setiadi" -> "WAWANSETI47".
 */
export function generateAffiliateCode(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10) || 'AFFILIATE';
  const suffix = Math.floor(10 + Math.random() * 90); // 10-99
  return `${base}${suffix}`;
}

/**
 * Generate code unik — cek collision ke DB, retry dengan suffix baru kalau bentrok.
 * Maks 20 percobaan sebelum nyerah (praktis tidak akan kejadian).
 */
export async function generateUniqueAffiliateCode(name: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateAffiliateCode(name);
    const existing = await db.select({ id: affiliates.id })
      .from(affiliates)
      .where(eq(affiliates.code, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  throw new Error('Gagal generate kode affiliate unik setelah 20 percobaan');
}
