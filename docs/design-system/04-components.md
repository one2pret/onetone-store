# 04 — Components

> Panduan penggunaan setiap komponen UI. Semua komponen ada di `components/ui/`.
> Base: shadcn/ui New York style — di-override dengan Onetone dark token.

---

## Button

```tsx
import { Button } from "@/components/ui/button"

// Primary — CTA utama (gold)
<Button variant="default">Beli Sekarang</Button>

// Outline — aksi sekunder
<Button variant="outline">Lihat Detail</Button>

// Destructive — hapus / batalkan
<Button variant="destructive">Batalkan Pesanan</Button>

// Ghost — aksi tersier, di dalam card
<Button variant="ghost" size="icon"><Heart /></Button>

// Loading state
<Button disabled>
  <Loader2 className="animate-spin" /> Memproses...
</Button>
```

### Size
```tsx
<Button size="xs">Tiny</Button>     // h-6
<Button size="sm">Small</Button>    // h-8
<Button>Default</Button>            // h-9
<Button size="lg">Large</Button>    // h-10
<Button size="icon"><Plus /></Button> // 36x36
```

---

## Badge

```tsx
import { Badge } from "@/components/ui/badge"

// Brand / highlight
<Badge variant="gold">Terlaris</Badge>

// Status order
<Badge variant="success">Terkirim</Badge>
<Badge variant="warning">Dikemas</Badge>
<Badge variant="danger">Dibatalkan</Badge>

// Default (gold solid)
<Badge>Baru</Badge>

// Outline netral
<Badge variant="outline">Kategori</Badge>
```

---

## Card

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Card standard
<Card>
  <CardHeader>
    <CardTitle>Judul Card</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground text-sm">Konten card</p>
  </CardContent>
</Card>

// Card produk dengan hover effect:
<div className="bg-card border border-border rounded-xl p-4
               hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10
               transition-all duration-200 cursor-pointer">
```

---

## Input & Form

```tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

// Input standard
<div className="space-y-1.5">
  <Label htmlFor="email">Email</Label>
  <Input
    id="email"
    type="email"
    placeholder="email@example.com"
  />
</div>

// Input dengan error state
<Input aria-invalid={!!error} />
{error && <p className="text-danger text-xs mt-1">{error}</p>}

// Textarea
<Textarea
  placeholder="Tulis catatan pengiriman..."
  className="min-h-[100px] resize-none"
/>
```

---

## Select

```tsx
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui/select"

<Select onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Pilih kategori" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="electronics">Elektronik</SelectItem>
    <SelectItem value="fashion">Fashion</SelectItem>
  </SelectContent>
</Select>
```

---

## Dialog / Modal

```tsx
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription
} from "@/components/ui/dialog"

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Konfirmasi</DialogTitle>
      <DialogDescription className="text-muted-foreground">
        Apakah kamu yakin ingin melanjutkan?
      </DialogDescription>
    </DialogHeader>
    <div className="flex gap-2 justify-end">
      <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
      <Button onClick={handleConfirm}>Ya, Lanjutkan</Button>
    </div>
  </DialogContent>
</Dialog>
```

---

## Table (Admin)

```tsx
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow
} from "@/components/ui/table"

<div className="border border-border rounded-xl overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow className="bg-surface hover:bg-surface">
        <TableHead className="text-muted-foreground">Produk</TableHead>
        <TableHead className="text-muted-foreground">Harga</TableHead>
        <TableHead className="text-muted-foreground">Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow className="hover:bg-accent border-border">
        <TableCell className="text-foreground">iPhone 15</TableCell>
        <TableCell className="text-primary font-semibold">Rp 15.000.000</TableCell>
        <TableCell><Badge variant="gold">Aktif</Badge></TableCell>
      </TableRow>
    </TableBody>
  </Table>
</div>
```

---

## ProductCard (Shop)

```tsx
// Pola card produk Onetone yang benar:
<div className="group bg-card border border-border rounded-xl overflow-hidden
               hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10
               transition-all duration-200">
  {/* Gambar */}
  <div className="relative aspect-square overflow-hidden bg-surface">
    <Image
      src={product.image}
      alt={product.name}
      fill
      className="object-cover group-hover:scale-105 transition-transform duration-300"
    />
  </div>

  {/* Info */}
  <div className="p-3">
    <p className="text-muted-foreground text-xs mb-1">{product.category}</p>
    <h3 className="text-foreground text-sm font-medium line-clamp-2 mb-2">
      {product.name}
    </h3>
    <div className="flex items-center justify-between">
      <span className="text-primary font-bold text-base">
        {formatRupiah(product.price)}
      </span>
      <Button size="icon-sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ShoppingCart className="size-3.5" />
      </Button>
    </div>
  </div>
</div>
```
