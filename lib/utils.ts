// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: Date | string, timeZone?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    // Default WIB for server-side, client components can pass undefined to use browser timezone
    timeZone: timeZone ?? 'Asia/Jakarta',
  }).format(d);
}

export function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD${y}${m}${d}${random}`;
}

export function formatShortDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(d);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    waiting_payment: 'bg-yellow-100 text-yellow-700',
    packing: 'bg-blue-100 text-blue-700',
    shipping: 'bg-indigo-100 text-indigo-700',
    delivered: 'bg-green-100 text-green-700',
    expired: 'bg-orange-100 text-orange-700',
    cancelled: 'bg-red-100 text-red-700',
    // invoice statuses
    pending: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    waiting_payment: 'Menunggu Pembayaran',
    packing: 'Dikemas',
    shipping: 'Dikirim',
    delivered: 'Selesai',
    expired: 'Expired',
    cancelled: 'Dibatalkan',
    // invoice statuses
    pending: 'Menunggu',
    paid: 'Sudah Bayar',
  };
  return labels[status] || status;
}
