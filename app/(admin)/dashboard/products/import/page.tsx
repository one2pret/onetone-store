// app/(admin)/dashboard/products/import/page.tsx
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { ImportProductsForm } from '../_components/ImportProductsForm';

export default function ImportProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Import Produk (CSV)</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload banyak produk sekaligus. Gambar tetap ditambahkan satu-satu setelah import.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
          <p className="text-sm font-medium text-foreground">Format kolom CSV</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li><span className="text-foreground font-medium">nama</span> — wajib</li>
            <li><span className="text-foreground font-medium">harga</span> — wajib, angka tanpa titik/koma (contoh: 175000)</li>
            <li><span className="text-foreground font-medium">kategori</span> — opsional, harus sama persis dengan nama kategori yang sudah ada</li>
            <li><span className="text-foreground font-medium">stok</span>, <span className="text-foreground font-medium">berat</span> (gram) — opsional, default 0</li>
            <li><span className="text-foreground font-medium">deskripsi</span> — opsional</li>
          </ul>
          <p className="text-sm text-muted-foreground pt-1">
            Produk hasil import masuk sebagai <span className="text-foreground font-medium">draft</span> (tidak tampil di toko) — lengkapi gambar dan aktifkan manual di halaman produk.
          </p>
          <a
            href="/templates/template-import-produk.csv"
            download
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-hover transition pt-1"
          >
            <Download className="w-3.5 h-3.5" />
            Download template CSV
          </a>
        </div>

        <ImportProductsForm />
      </div>
    </div>
  );
}
