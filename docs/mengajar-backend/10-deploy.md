# Sesi 10 — Deploy ke VPS Ubuntu

> ⏱️ Estimasi: 30 menit
> 🎯 Tujuan: Peserta bisa deploy aplikasi Next.js ke VPS Ubuntu dengan Nginx + PM2 + SSL.

---

## 1. Persiapan VPS

### Spec Rekomendasi
- **OS**: Ubuntu 22.04 LTS atau 24.04 LTS
- **RAM**: Minimal 1 GB (rekomendasi 2 GB)
- **Disk**: 20 GB SSD
- **Provider**: Niagahoster, Hostinger, DigitalOcean, Vultr, Contabo

### SSH Login
```bash
ssh root@your-vps-ip
```

### Update System
```bash
apt update && apt upgrade -y
```

### Tambah User Non-Root
```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

---

## 2. Install Dependencies

### Node.js 20+
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verifikasi
node -v   # v20.x.x
npm -v
```

### pnpm
```bash
sudo npm i -g pnpm
pnpm -v
```

### MySQL Server
```bash
sudo apt install mysql-server -y
sudo systemctl enable mysql
sudo systemctl start mysql
sudo mysql_secure_installation
```

### Buat Database & User
```bash
sudo mysql -u root -p
```
```sql
CREATE DATABASE next_olshop_db;
CREATE USER 'olshop'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON next_olshop_db.* TO 'olshop'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Nginx
```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

### PM2 (Process Manager)
```bash
sudo npm i -g pm2
```

### Git
```bash
sudo apt install git -y
```

---

## 3. Clone & Setup Project

### Clone Repo
```bash
cd ~
git clone https://github.com/your-username/next-olshop.git
cd next-olshop
```

### Install Dependencies
```bash
pnpm install
```

### Setup `.env`
```bash
nano .env
```

Isi:
```env
DATABASE_URL=mysql://olshop:STRONG_PASSWORD@localhost:3306/next_olshop_db
AUTH_SECRET=GENERATE_NEW_SECRET_HERE
XENDIT_SECRET_KEY=xnd_production_xxx
XENDIT_WEBHOOK_TOKEN=production-webhook-token
BITSHIP_API_URL=https://api.biteship.com
BITSHIP_API_KEY=biteship_production_xxx
CRON_SECRET=production-cron-token
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### Push Schema & Seed
```bash
pnpm db:push
pnpm db:seed
```

### Build
```bash
pnpm build
```

Pastikan tidak ada error.

---

## 4. Setup PM2

### Buat `ecosystem.config.js`
```javascript
module.exports = {
  apps: [
    {
      name: "next-olshop",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/home/deploy/next-olshop",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
```

### Jalankan
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Copy command yang muncul, jalankan dengan sudo
```

### Cek Status
```bash
pm2 list
pm2 logs next-olshop
```

Aplikasi sekarang running di `localhost:3000` di VPS.

---

## 5. Setup Nginx Reverse Proxy

### Buat Config Site
```bash
sudo nano /etc/nginx/sites-available/next-olshop
```

Isi:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Body size untuk upload
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files (jika ada)
    location /_next/static {
        proxy_pass http://localhost:3000/_next/static;
        proxy_cache_bypass $http_upgrade;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/next-olshop /etc/nginx/sites-enabled/
sudo nginx -t   # test config
sudo systemctl reload nginx
```

### Setup DNS
Di domain provider (Niagahoster, dll), arahkan:
- `A` record `@` → IP VPS
- `A` record `www` → IP VPS

Tunggu propagasi (5-30 menit).

---

## 6. Setup SSL (HTTPS) dengan Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Ikuti prompt:
- Masukkan email
- Setuju TOS
- Pilih "Redirect HTTP → HTTPS"

Certbot otomatis update Nginx config. Test:
```bash
curl https://your-domain.com
```

### Auto-Renew
Certbot sudah set cron auto-renew. Test:
```bash
sudo certbot renew --dry-run
```

---

## 7. Setup Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 8. Setup Cron untuk Auto-Expire Orders

```bash
crontab -e
```

Tambah:
```bash
# Setiap 5 menit, panggil endpoint cron
*/5 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/check-expired-orders > /dev/null
```

---

## 9. Setup Webhook URLs di Production

### Xendit Dashboard
- URL: `https://your-domain.com/api/webhooks/xendit`
- Verification Token: sama dengan `XENDIT_WEBHOOK_TOKEN` di `.env`

### Bitship Dashboard
- URL: `https://your-domain.com/api/webhooks/bitship`

---

## 10. Deploy Updates (Workflow)

### Buat Script `deploy.sh`
```bash
#!/bin/bash
set -e

cd /home/deploy/next-olshop

echo "→ Pull latest..."
git pull origin main

echo "→ Install deps..."
pnpm install --frozen-lockfile

echo "→ Migrate DB..."
pnpm db:push

echo "→ Build..."
pnpm build

echo "→ Restart..."
pm2 restart next-olshop

echo "✓ Deploy done!"
```

```bash
chmod +x deploy.sh
```

### Workflow Update
```bash
# Lokal
git push origin main

# VPS
ssh deploy@your-vps-ip
cd ~/next-olshop
./deploy.sh
```

---

## 11. Monitoring & Logs

### PM2 Logs
```bash
pm2 logs next-olshop          # realtime logs
pm2 logs next-olshop --lines 100  # last 100 lines
pm2 monit                     # dashboard CPU/RAM
```

### Nginx Logs
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### MySQL Logs
```bash
sudo tail -f /var/log/mysql/error.log
```

---

## 12. Backup Strategy

### MySQL Backup Script
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/deploy/backups"
mkdir -p $BACKUP_DIR

mysqldump -u olshop -p'STRONG_PASSWORD' next_olshop_db | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Hapus backup > 7 hari
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

Tambah ke cron:
```bash
0 2 * * * /home/deploy/backup.sh
```

---

## 13. Alternative: Deploy ke Vercel (Lebih Mudah)

Kalau VPS terlalu ribet, pakai Vercel:

```bash
pnpm i -g vercel
vercel login
vercel
```

Set env vars di Vercel dashboard.

**Pro**: Auto deploy, free SSL, CDN, no setup
**Con**: Vendor lock-in, fungsi serverless limited (Xendit webhook OK), MySQL harus eksternal (PlanetScale, Aiven)

---

## ✅ Checklist Akhir Sesi 10

- [ ] VPS Ubuntu siap, user `deploy` ada
- [ ] Node.js, pnpm, MySQL, Nginx, PM2 terinstall
- [ ] Project di-clone, `.env` siap, `pnpm build` sukses
- [ ] PM2 running, autostart on reboot
- [ ] Nginx reverse proxy ke `localhost:3000`
- [ ] Domain pointed ke VPS, HTTPS aktif
- [ ] Firewall ufw enabled
- [ ] Cron auto-expire jalan
- [ ] Webhook Xendit & Bitship pakai URL production
- [ ] `deploy.sh` siap untuk update workflow
- [ ] Backup script harian

---

## 🐛 Common Issues

| Error | Fix |
|-------|-----|
| `502 Bad Gateway` | Next.js mati (cek `pm2 list`, restart) |
| `EADDRINUSE: port 3000` | PM2 sudah jalan, atau ada process lain. `pm2 list` cek |
| `nginx: command not found` | `sudo apt install nginx` |
| SSL gagal | Domain belum propagate. Cek `dig your-domain.com` |
| Webhook gagal di production | Cek firewall, cek log Nginx |
| `pm2 restart` tapi code lama | Lupa `pnpm build` setelah pull |
| Out of memory saat build | VPS RAM <2GB. Tambah swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |

---

## 📚 Resource Tambahan

- DigitalOcean VPS tutorial: https://www.digitalocean.com/community/tutorials
- Nginx config generator: https://www.digitalocean.com/community/tools/nginx
- PM2 docs: https://pm2.keymetrics.io/docs
- Let's Encrypt: https://letsencrypt.org/getting-started

---

## 🎉 Selesai!

Setelah sesi ini, peserta sudah punya:
- ✅ Full-stack Next.js backend running di production
- ✅ Database production-ready
- ✅ Payment + shipping integration live
- ✅ Auto SSL + auto deploy workflow
- ✅ Monitoring + backup

**Skills yang diasah**:
- Next.js 16 App Router, Server Components, Server Actions
- TypeScript, Drizzle ORM, MySQL
- NextAuth v5, JWT, role-based auth
- REST API design untuk Flutter
- Webhook integration (idempotency, security)
- Vitest testing
- Linux server admin, Nginx, PM2, SSL

**Next Steps (lanjutan kelas)**:
- Build Flutter app yang konsumsi API ini
- Add advanced features: discount, voucher, multi-currency
- Performance optimization: caching, indexing
- Real monitoring: Sentry, Grafana

---

> 🚀 **Selamat mengajar, Bahri!**
> Tetap semangat sharing knowledge. JagoFlutter Academy 💪
