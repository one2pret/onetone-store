# Deploy NextElektronik ke VPS Ubuntu

Panduan lengkap deploy aplikasi Next.js ke VPS Ubuntu menggunakan SSH.
Cocok untuk VPS yang sudah biasa dipakai deploy Laravel (Nginx & MySQL sudah tersedia).

---

## Prerequisites

- VPS Ubuntu 20.04 / 22.04 / 24.04
- Akses SSH (root atau user sudo)
- Domain/subdomain sudah pointing ke IP VPS (A record)
- MySQL sudah terinstall (biasanya sudah ada kalau pernah deploy Laravel)

---

## Step 1: SSH ke VPS

```bash
ssh root@IP_VPS
# atau
ssh user@IP_VPS
```

---

## Step 2: Install Node.js 20 LTS

Cek apakah Node.js sudah terinstall:

```bash
node -v
```

Jika belum ada atau versi lama (< 18), install Node.js 20 LTS:

```bash
# Hapus versi lama (jika ada)
sudo apt remove -y nodejs
sudo apt autoremove -y

# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi
node -v   # harus v20.x.x
npm -v    # harus 10.x.x
```

---

## Step 3: Install pnpm & PM2

```bash
# Install pnpm (package manager)
npm install -g pnpm

# Install PM2 (process manager untuk Node.js)
npm install -g pm2

# Verifikasi
pnpm -v
pm2 -v
```

> **PM2** fungsinya seperti Supervisor untuk PHP — menjaga proses Node.js tetap berjalan dan auto-restart jika crash.

---

## Step 4: Siapkan Database MySQL/MariaDB

sudo apt-get update
sudo apt install mariadb-server mariadb-client
sudo mysql_secure_installation
Enter current password for root: (Enter your SSH root user password)
-Switch to unix_socket authentication [Y/n]: Y
-Change the root password? [Y/n]: Y
It will ask you to set new MySQL root password at this step. This can be different from the SSH root user password.
-Remove anonymous users? [Y/n] Y
-Disallow root login remotely? [Y/n]: N
This is set as N because we might want to access the database from a remote server for using business analytics software like Metabase / PowerBI / Tableau, etc.
-Remove test database and access to it? [Y/n]: Y
-Reload privilege tables now? [Y/n]: Y


```bash
# Login ke MySQL
mysql -u root -p

# Buat database
CREATE DATABASE next_olshop_db;

# (Opsional) Buat user khusus
CREATE USER 'nextolshop'@'localhost' IDENTIFIED BY 'password_kuat_disini';
GRANT ALL PRIVILEGES ON next_olshop_db.* TO 'nextolshop'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## Step 4: Install Nginx
sudo apt install nginx


## Step 5: Clone Repository

```bash
# Masuk ke direktori web
cd /var/www

# Clone repo
git clone git@github.com:bahrie127/next-olshop-system.git next-olshop

# Masuk ke folder project
cd next-olshop
```

> Jika git clone via SSH error, pakai HTTPS:
> ```bash
> git clone https://github.com/bahrie127/next-olshop-system.git next-olshop
> ```

---

## Step 6: Setup Environment Variables

```bash
# Copy file example
cp .env.example .env

# Edit file .env
nano .env
```

Isi `.env` seperti berikut:

```env
# Database
DATABASE_URL=mysql://nextolshop:password_kuat_disini@localhost:3306/next_olshop_db

# NextAuth
AUTH_SECRET=RANDOM_STRING_32_KARAKTER
AUTH_URL=https://olshop.domainkamu.com
```

Generate `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Copy hasilnya, paste ke `AUTH_SECRET` di `.env`.

Simpan file: `Ctrl+O` → Enter → `Ctrl+X`

---

## Step 7: Install Dependencies & Build

```bash
cd /var/www/next-olshop

# Install dependencies
pnpm install

# Push schema ke database
pnpm db:push

# Seed data awal (demo products, categories, users)
pnpm db:seed

# Build production
pnpm build
```

> `pnpm build` akan membuat folder `.next/` berisi aplikasi production.
> Proses ini membutuhkan RAM minimal ~512MB. Jika VPS RAM kecil, bisa tambahkan swap.

### Jika RAM Kurang (Opsional)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Step 8: Test Jalankan Manual

```bash
pnpm start
```

Buka browser: `http://IP_VPS:3000` — pastikan muncul.
Tekan `Ctrl+C` untuk stop setelah test berhasil.

> Jika port 3000 tidak bisa diakses, buka firewall:
> ```bash
> sudo ufw allow 3000
> ```
> (Nanti setelah Nginx jalan, port 3000 bisa ditutup lagi)

---

## Step 9: Jalankan dengan PM2

```bash
cd /var/www/next-olshop

# Start Next.js via PM2
pm2 start pnpm --name "next-olshop" -- start

# Cek status
pm2 status

# Lihat logs
pm2 logs next-olshop
```

Setup auto-start saat VPS reboot:

```bash
pm2 save
pm2 startup
```

> PM2 akan menampilkan command `sudo env PATH=...`. Copy dan jalankan command tersebut.

### Perintah PM2 yang Berguna

```bash
pm2 status              # Lihat semua proses
pm2 logs next-olshop    # Lihat logs realtime
pm2 restart next-olshop # Restart aplikasi
pm2 stop next-olshop    # Stop aplikasi
pm2 delete next-olshop  # Hapus dari PM2
pm2 monit               # Monitor CPU/RAM
```

---

## Step 10: Setup Nginx (Reverse Proxy)

Nginx berfungsi sebagai reverse proxy — meneruskan request dari port 80/443 ke Node.js di port 3000.

```bash
sudo nano /etc/nginx/sites-available/next-olshop
```

Paste konfigurasi berikut (ganti `olshop.domainkamu.com` dengan subdomain kamu):

```nginx
server {
    listen 80;
    server_name olshop.domainkamu.com;

    # Maksimum upload size (untuk upload gambar produk nanti)
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Simpan: `Ctrl+O` → Enter → `Ctrl+X`

Enable site & restart Nginx:

```bash
# Buat symlink ke sites-enabled
sudo ln -s /etc/nginx/sites-available/next-olshop /etc/nginx/sites-enabled/

# Test konfigurasi Nginx (pastikan OK)
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

Buka browser: `http://olshop.domainkamu.com` — harus sudah tampil.

---

## Step 11: Setup SSL (HTTPS) dengan Certbot

```bash
# Install Certbot (jika belum)
sudo apt install -y certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d olshop.domainkamu.com
```

Ikuti prompt:
1. Masukkan email
2. Agree to terms → `Y`
3. Redirect HTTP to HTTPS → pilih `2` (redirect)

Certbot akan otomatis update konfigurasi Nginx dan setup auto-renewal.

Verifikasi auto-renewal:

```bash
sudo certbot renew --dry-run
```

Buka browser: `https://olshop.domainkamu.com` — seharusnya sudah HTTPS.

---

## Step 12: Tutup Port 3000 (Keamanan)

Setelah Nginx sudah jalan, tutup akses langsung ke port 3000:

```bash
sudo ufw deny 3000
```

Pastikan port 80 dan 443 terbuka:

```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow ssh
sudo ufw enable
sudo ufw status
```

---

## Update / Deploy Ulang

Setiap kali ada perubahan code, jalankan:

```bash
cd /var/www/next-olshop

# Pull perubahan terbaru
git pull

# Install dependencies baru (jika ada)
pnpm install

# Build ulang
pnpm build

# Restart PM2
pm2 restart next-olshop
```

### Script Deploy Otomatis (Opsional)

Buat file `deploy.sh` di VPS:

```bash
nano /var/www/next-olshop/deploy.sh
```

```bash
#!/bin/bash
set -e

echo "🚀 Deploying NextElektronik..."

cd /var/www/next-olshop

echo "📥 Pulling latest code..."
git pull

echo "📦 Installing dependencies..."
pnpm install

echo "🔨 Building production..."
pnpm build

echo "♻️  Restarting PM2..."
pm2 restart next-olshop

echo "✅ Deploy selesai!"
```

```bash
chmod +x /var/www/next-olshop/deploy.sh
```

Jalankan deploy:

```bash
/var/www/next-olshop/deploy.sh
```

---

## Troubleshooting

### Build gagal — RAM tidak cukup
```bash
# Cek RAM
free -h

# Tambahkan swap (lihat Step 7)
```

### Port 3000 sudah dipakai
```bash
# Cek siapa yang pakai port 3000
sudo lsof -i :3000

# Kill prosesnya
sudo kill -9 PID_DISINI
```

### Nginx 502 Bad Gateway
```bash
# Cek apakah Next.js jalan
pm2 status

# Jika stopped, restart
pm2 restart next-olshop

# Cek logs
pm2 logs next-olshop --lines 50
```

### Database connection error
```bash
# Test koneksi MySQL manual
mysql -u nextolshop -p next_olshop_db

# Cek .env DATABASE_URL format-nya benar
cat /var/www/next-olshop/.env
```

### Permission denied saat git pull
```bash
# Set ownership ke user yang benar
sudo chown -R $USER:$USER /var/www/next-olshop
```

---

## Struktur di VPS

```
/var/www/next-olshop/        ← Project root
├── .env                     ← Environment variables (JANGAN commit)
├── .next/                   ← Build output (auto-generated)
├── node_modules/            ← Dependencies (auto-generated)
├── deploy.sh                ← Script deploy (opsional)
└── ...                      ← Source code
```

---

## Perbandingan dengan Deploy Laravel

| | Laravel | Next.js |
|---|---|---|
| Runtime | PHP-FPM | Node.js (PM2) |
| Nginx | Serve langsung ke public/ | Reverse proxy ke port 3000 |
| Build | `composer install` | `pnpm install && pnpm build` |
| Process Manager | php-fpm / supervisor | PM2 |
| Migrate DB | `php artisan migrate` | `pnpm db:push` |
| Seed | `php artisan db:seed` | `pnpm db:seed` |
| Env file | `.env` | `.env` |
| Storage | `storage/` | _(belum ada file upload)_ |

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@store.com | password123 |
| Customer | john@example.com | password123 |
