# ⚡ HeyPhom - Quick Reference

## 🎯 Mục tiêu dự án
Biến Mac mini M2 thành server Photogrammetry xử lý ảnh → 3D models (USDZ, OBJ, STL)

---

## 📦 Files đã tạo

```
/Users/mac/HeyPhom/
├── README.md                 ✅ Documentation đầy đủ
├── .env.example              ✅ Template cấu hình
├── .gitignore                ✅ Git ignore rules
├── backend-api/              ✅ API server structure
│   ├── uploads/              ✅ Upload directory
│   ├── exports/              ✅ Export directory
│   ├── sessions/             ✅ Session management
│   ├── temp/                 ✅ Temporary files
│   └── logs/                 ✅ Application logs
├── scripts/
│   ├── setup.sh              ✅ Auto setup script
│   └── cleanup.sh            ✅ Auto cleanup script
├── docs/
│   ├── API.md                ✅ API documentation
│   └── DEPLOYMENT.md         ✅ Deployment guide
└── test/samples/             ✅ Test samples directory
```

---

## 🚀 Các bước triển khai nhanh

### 1. Setup môi trường (chạy 1 lần)
```bash
cd /Users/mac/HeyPhom
./scripts/setup.sh
```

### 2. Tạo .env từ template
```bash
cd backend-api
cp ../.env.example .env
nano .env  # Chỉnh PORT=3333 và các paths
```

### 3. Build Swift Engine (khi có code)
```bash
cd core-engine
swift build -c release
```

### 4. Start Backend API
```bash
cd backend-api
npm install
npm start

# Hoặc dùng PM2 (khuyên dùng)
pm2 start src/server.js --name heyphom-api
pm2 save
pm2 startup
```

### 5. Setup Cloudflare Tunnel
```bash
cloudflared tunnel login
cloudflared tunnel create heyphom-tunnel
cloudflared tunnel route dns heyphom-tunnel heyphom.truyenthong.edu.vn

# Tạo config file (xem DEPLOYMENT.md)
nano ~/.cloudflared/config.yml

# Run tunnel
cloudflared tunnel run heyphom-tunnel
```

### 6. Setup Auto Cleanup
```bash
crontab -e
# Add: 0 */6 * * * /Users/mac/HeyPhom/scripts/cleanup.sh >> /Users/mac/HeyPhom/backend-api/logs/cleanup.log 2>&1
```

---

## 🔧 Commands thường dùng

### Backend Management
```bash
pm2 start heyphom-api        # Start
pm2 stop heyphom-api         # Stop
pm2 restart heyphom-api      # Restart
pm2 logs heyphom-api         # View logs
pm2 monit                    # Monitor resources
```

### Testing
```bash
# Health check
curl http://localhost:3333/health
curl https://heyphom.truyenthong.edu.vn/health

# API info
curl http://localhost:3333/api/info
```

### Monitoring
```bash
# Check disk space
df -h

# Check port
lsof -i :3333

# View logs
tail -f backend-api/logs/app.log

# Manual cleanup
./scripts/cleanup.sh

# System resources
top
htop (brew install htop)
```

---

## 📊 Port Allocation

| Port | Service | Status |
|------|---------|--------|
| 3333 | Backend API | ✅ Active |
| 3334 | Frontend Web | 🔄 Reserved |
| 3335 | Redis Queue | 🔄 Reserved |
| 3336 | Monitoring | 🔄 Reserved |
| 3337 | Webhooks | 🔄 Reserved |
| 3338 | Dev/Staging | 🔄 Reserved |

---

## 📝 Environment Variables (quan trọng)

Chỉnh trong `backend-api/.env`:

```bash
# Server
PORT=3333
NODE_ENV=production

# Paths (update these!)
ENGINE_PATH=/Users/mac/HeyPhom/core-engine/.build/release/heyphom-cli
UPLOAD_DIR=/Users/mac/HeyPhom/backend-api/uploads
EXPORT_DIR=/Users/mac/HeyPhom/backend-api/exports

# Limits
MAX_IMAGES_PER_SESSION=300
MAX_FILE_SIZE_MB=10
SESSION_TIMEOUT_HOURS=24

# Cleanup
AUTO_CLEANUP_ENABLED=true
CLEANUP_AFTER_HOURS=24
```

---

## 🎯 Roadmap Implementation

### Phase 1: Core (Current)
- [ ] Implement Swift CLI với RealityKit
- [ ] Build release executable
- [ ] Test với sample images

### Phase 2: Backend API
- [ ] Implement upload endpoint
- [ ] Implement job queue
- [ ] Implement download endpoint
- [ ] Add progress tracking

### Phase 3: Integration
- [ ] Connect API với Swift CLI
- [ ] Test end-to-end workflow
- [ ] Add error handling

### Phase 4: Production
- [ ] Setup PM2 auto-restart
- [ ] Configure Cloudflare Tunnel
- [ ] Setup monitoring
- [ ] Deploy và test production

---

## 🚨 Troubleshooting nhanh

### Port đã được sử dụng
```bash
lsof -i :3333
kill -9 <PID>
```

### PM2 không start
```bash
pm2 delete all
pm2 start src/server.js --name heyphom-api
pm2 save
```

### Cloudflare Tunnel lỗi
```bash
cloudflared tunnel list
cloudflared tunnel run heyphom-tunnel --loglevel debug
```

### Disk đầy
```bash
./scripts/cleanup.sh
du -sh backend-api/{uploads,exports,sessions}/*
```

---

## 📚 Documentation Links

- [README.md](./README.md) - Full documentation
- [API.md](./docs/API.md) - API endpoints & examples
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Step-by-step deployment

---

## 🎓 Learning Resources

- [Apple RealityKit](https://developer.apple.com/documentation/realitykit)
- [Object Capture API](https://developer.apple.com/documentation/realitykit/photogrammetry)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps)
- [Fastify Documentation](https://www.fastify.io/docs/latest/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)

---

## ✅ Pre-deployment Checklist

- [ ] macOS 13.3+ với Apple Silicon
- [ ] Xcode 15+ installed
- [ ] Node.js v18+ installed
- [ ] cloudflared installed
- [ ] 100GB+ disk space free
- [ ] Swift Engine builds successfully
- [ ] Backend API starts without errors
- [ ] .env configured correctly
- [ ] Cloudflare domain configured
- [ ] PM2 setup for auto-restart
- [ ] Cron job for cleanup configured
- [ ] Tested locally (localhost:3333)
- [ ] Tested via Cloudflare domain

---

## 📞 Support

**Email**: [your-email@heyphom.truyenthong.edu.vn]
**Domain**: https://heyphom.truyenthong.edu.vn
**Docs**: /Users/mac/HeyPhom/docs/

---

**Created**: January 18, 2026
**Last Updated**: January 18, 2026
**Status**: ✅ Ready for implementation
