# HeyPhom Deployment Guide

Hướng dẫn triển khai HeyPhom trên Mac mini M2 từ đầu đến cuối.

---

## 📋 Mục lục

1. [Chuẩn bị hệ thống](#1-chuẩn-bị-hệ-thống)
2. [Cài đặt dependencies](#2-cài-đặt-dependencies)
3. [Build Swift Engine](#3-build-swift-engine)
4. [Setup Backend API](#4-setup-backend-api)
5. [Cấu hình Cloudflare Tunnel](#5-cấu-hình-cloudflare-tunnel)
6. [Cấu hình Nginx (Optional)](#6-cấu-hình-nginx-optional)
7. [Setup PM2 Auto-restart](#7-setup-pm2-auto-restart)
8. [Cấu hình Auto Cleanup](#8-cấu-hình-auto-cleanup)
9. [Testing](#9-testing)
10. [Monitoring](#10-monitoring)

---

## 1. Chuẩn bị hệ thống

### Kiểm tra yêu cầu

```bash
# Kiểm tra macOS version
sw_vers
# Output: ProductVersion: 14.x hoặc cao hơn

# Kiểm tra chip
uname -m
# Output: arm64 (Apple Silicon)

# Kiểm tra RAM
sysctl hw.memsize | awk '{print $2/1024/1024/1024 " GB"}'
# Output: 24 GB

# Kiểm tra disk space
df -h /
# Cần ít nhất 100GB free
```

### Tạo cấu trúc thư mục

```bash
cd /Users/mac/HeyPhom

# Chạy script setup tự động
chmod +x scripts/setup.sh
./scripts/setup.sh
```

Hoặc tạo thủ công:

```bash
mkdir -p core-engine/{Sources,Tests}
mkdir -p backend-api/{src/{routes,services,middleware},uploads,exports,sessions,logs,temp}
mkdir -p frontend-web/{pages,components}
mkdir -p deployment/{cloudflare,nginx}
mkdir -p scripts docs test/samples
```

---

## 2. Cài đặt dependencies

### Xcode & Command Line Tools

```bash
# Cài Xcode từ App Store (nếu chưa có)
# Hoặc chỉ cài Command Line Tools:
xcode-select --install

# Verify
xcode-select -p
# Output: /Library/Developer/CommandLineTools hoặc /Applications/Xcode.app/Contents/Developer

swift --version
# Output: Swift version 5.9 trở lên
```

### Homebrew (nếu chưa có)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Node.js

```bash
# Cài Node.js LTS
brew install node@20

# Verify
node --version  # v20.x.x
npm --version   # 10.x.x
```

### PM2 (Process Manager)

```bash
npm install -g pm2

# Verify
pm2 --version
```

### Cloudflared (đã cài sẵn)

```bash
# Verify
cloudflared --version
```

---

## 3. Build Swift Engine

### Tạo Package.swift

```bash
cd /Users/mac/HeyPhom/core-engine
```

Tạo file `Package.swift`:

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "heyphom-cli",
    platforms: [
        .macOS(.v13)
    ],
    dependencies: [
        // Add dependencies here if needed
    ],
    targets: [
        .executableTarget(
            name: "heyphom-cli",
            dependencies: [],
            path: "Sources"
        )
    ]
)
```

### Tạo main.swift (basic template)

```bash
mkdir -p Sources
nano Sources/main.swift
```

```swift
import Foundation
import RealityKit
import ModelIO

print("HeyPhom CLI v1.0.0")

// TODO: Implement photogrammetry logic
// See: https://developer.apple.com/documentation/realitykit/photogrammetry
```

### Build

```bash
swift build -c release

# Executable sẽ ở:
# .build/release/heyphom-cli

# Test
.build/release/heyphom-cli --version
```

---

## 4. Setup Backend API

### Tạo package.json

```bash
cd /Users/mac/HeyPhom/backend-api
```

```json
{
  "name": "heyphom-api",
  "version": "1.0.0",
  "description": "HeyPhom Backend API",
  "main": "src/server.js",
  "scripts": {
    "start": "NODE_ENV=production node src/server.js",
    "dev": "NODE_ENV=development nodemon src/server.js",
    "test": "jest"
  },
  "dependencies": {
    "fastify": "^4.25.0",
    "@fastify/cors": "^8.5.0",
    "@fastify/multipart": "^8.0.0",
    "@fastify/rate-limit": "^9.1.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0"
  }
}
```

### Install dependencies

```bash
npm install
```

### Tạo basic server

```bash
mkdir -p src/routes src/services src/middleware
nano src/server.js
```

```javascript
require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');
const multipart = require('@fastify/multipart');
const rateLimit = require('@fastify/rate-limit');

const PORT = process.env.PORT || 3333;
const HOST = process.env.HOST || '0.0.0.0';

// Plugins
fastify.register(cors, { origin: '*' });
fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
fastify.register(rateLimit, {
  max: 100,
  timeWindow: '15 minutes'
});

// Routes
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  };
});

fastify.get('/api/info', async (request, reply) => {
  return {
    name: 'HeyPhom API',
    version: '1.0.0',
    description: 'Photogrammetry Processing API',
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    }
  };
});

// TODO: Add more routes (upload, jobs, download)

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`🚀 HeyPhom API running on http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
```

### Cấu hình .env

```bash
cp ../.env.example .env
nano .env
```

Chỉnh các giá trị cần thiết (đã có template sẵn).

### Test server

```bash
npm start

# Trong terminal khác:
curl http://localhost:3333/health
```

---

## 5. Cấu hình Cloudflare Tunnel

### Login to Cloudflare

```bash
cloudflared tunnel login
```

Trình duyệt sẽ mở, đăng nhập Cloudflare và chọn domain.

### Tạo tunnel

```bash
cloudflared tunnel create heyphom-tunnel

# Output:
# Tunnel credentials written to /Users/mac/.cloudflared/<TUNNEL_ID>.json
```

### Route DNS

```bash
cloudflared tunnel route dns heyphom-tunnel heyphom.truyenthong.edu.vn
```

### Tạo config file

```bash
nano ~/.cloudflared/config.yml
```

```yaml
tunnel: heyphom-tunnel
credentials-file: /Users/mac/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: heyphom.truyenthong.edu.vn
    service: http://localhost:3333
  - service: http_status:404
```

**Thay `<TUNNEL_ID>` bằng ID thực tế từ bước tạo tunnel.**

### Test tunnel

```bash
cloudflared tunnel run heyphom-tunnel
```

Truy cập: https://heyphom.truyenthong.edu.vn/health

### Chạy tunnel như service (auto-start)

```bash
# Install service
sudo cloudflared service install

# Start service
sudo launchctl start com.cloudflare.cloudflared

# Check status
sudo launchctl list | grep cloudflared
```

---

## 6. Cấu hình Nginx (Optional)

Nếu bạn muốn reverse proxy nội bộ.

### Tạo config

```bash
sudo mkdir -p /opt/homebrew/etc/nginx/servers
sudo nano /opt/homebrew/etc/nginx/servers/heyphom.conf
```

Nội dung đã có trong [README.md](../README.md#4%EF%B8%8F⃣-cấu-hình-nginx).

### Test và reload

```bash
sudo nginx -t
sudo nginx -s reload
```

---

## 7. Setup PM2 Auto-restart

### Start với PM2

```bash
cd /Users/mac/HeyPhom/backend-api

pm2 start src/server.js --name heyphom-api

# Check status
pm2 status

# View logs
pm2 logs heyphom-api

# Monitor
pm2 monit
```

### Save configuration

```bash
pm2 save
```

### Setup startup script

```bash
pm2 startup

# Follow instructions, usually:
# sudo env PATH=$PATH:/usr/local/bin pm2 startup launchd -u mac --hp /Users/mac
```

### Test auto-restart

```bash
# Reboot Mac
sudo reboot

# After reboot, check:
pm2 list
# Should show heyphom-api running
```

---

## 8. Cấu hình Auto Cleanup

### Make script executable

```bash
cd /Users/mac/HeyPhom
chmod +x scripts/cleanup.sh
```

### Test cleanup script

```bash
./scripts/cleanup.sh
```

### Setup cron job

```bash
crontab -e
```

Thêm dòng này (chạy mỗi 6 giờ):

```cron
0 */6 * * * /Users/mac/HeyPhom/scripts/cleanup.sh >> /Users/mac/HeyPhom/backend-api/logs/cleanup.log 2>&1
```

Lưu và thoát (`:wq` trong vim).

### Verify cron

```bash
crontab -l
```

---

## 9. Testing

### Test local

```bash
# Health check
curl http://localhost:3333/health

# API info
curl http://localhost:3333/api/info
```

### Test via Cloudflare

```bash
curl https://heyphom.truyenthong.edu.vn/health
```

### Test upload (khi đã implement)

```bash
curl -X POST https://heyphom.truyenthong.edu.vn/api/upload \
  -F "files=@test1.jpg" \
  -F "files=@test2.jpg" \
  -F "quality=medium"
```

---

## 10. Monitoring

### System resources

```bash
# CPU & Memory
top
# or
htop (install via: brew install htop)

# GPU usage
sudo powermetrics --samplers gpu_power -i 1000

# Disk usage
df -h

# Network
nettop
```

### Application logs

```bash
# PM2 logs
pm2 logs heyphom-api

# App logs
tail -f /Users/mac/HeyPhom/backend-api/logs/app.log

# Cleanup logs
tail -f /Users/mac/HeyPhom/backend-api/logs/cleanup.log
```

### Cloudflare Tunnel status

```bash
cloudflared tunnel info heyphom-tunnel
```

### Setup monitoring dashboard (Optional)

Có thể dùng:
- **PM2 Plus**: https://pm2.io
- **Grafana + Prometheus**
- **Uptime Robot**: https://uptimerobot.com (free tier)

---

## 🔄 Maintenance Tasks

### Daily
```bash
# Check logs
pm2 logs heyphom-api --lines 100

# Check disk space
df -h

# Check cleanup
ls -lh backend-api/uploads
```

### Weekly
```bash
# Update dependencies
cd backend-api && npm outdated
cd ../core-engine && swift package update

# Review error logs
grep ERROR backend-api/logs/app.log
```

### Monthly
```bash
# macOS updates
softwareupdate -l

# Backup configurations
tar -czf heyphom-backup-$(date +%Y%m%d).tar.gz \
  .env deployment/ scripts/

# Review performance
pm2 monit
```

---

## 🚨 Troubleshooting

Xem [README.md - Troubleshooting section](../README.md#-troubleshooting) để biết chi tiết.

### Quick fixes

```bash
# Restart API
pm2 restart heyphom-api

# Restart Cloudflare Tunnel
sudo launchctl stop com.cloudflare.cloudflared
sudo launchctl start com.cloudflare.cloudflared

# Clear temp files
./scripts/cleanup.sh

# Check port 3333
lsof -i :3333
```

---

## 📞 Support

Nếu cần hỗ trợ:
1. Kiểm tra logs: `pm2 logs heyphom-api`
2. Xem [Troubleshooting](../README.md#-troubleshooting)
3. Tạo issue trên GitHub với đầy đủ thông tin
4. Liên hệ: [your-email@heyphom.truyenthong.edu.vn]

---

**✅ Deployment hoàn tất! Chúc bạn thành công với HeyPhom!** 🎉
