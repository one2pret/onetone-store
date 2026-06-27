#!/bin/bash
set -e

echo "🚀 Deploying NextElektronik..."

# cd /var/www/next-olshop

echo "📥 Pulling latest code..."
# git pull

echo "📦 Installing dependencies..."
pnpm install

echo "🔨 Building production..."
pnpm build

echo "♻️  Restarting PM2..."
pm2 restart next-olshop

echo "✅ Deploy selesai!"
