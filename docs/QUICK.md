# ⚡ Quick Reference - HeyPhom

## 🚀 Start/Stop/Status

```bash
# Khởi động tất cả services
./start.sh

# Kiểm tra trạng thái
./status.sh

# Dừng tất cả services
./stop.sh

# Khởi động lại
./restart.sh
```

## 🌐 URLs

```
Public:  https://heyphom.truyenthong.edu.vn
Local:   http://localhost:3334
Backend: http://localhost:3333
Health:  http://localhost:3333/health
```

## 📝 Logs

```bash
# Xem tất cả logs
tail -f /tmp/heyphom-*.log

# Backend
tail -f /tmp/heyphom-backend.log

# Frontend
tail -f /tmp/heyphom-frontend.log

# Tunnel
tail -f /tmp/heyphom-tunnel.log
```

## 🔍 Debug

```bash
# Kiểm tra ports
lsof -i:3333  # Backend
lsof -i:3334  # Frontend

# Kiểm tra processes
ps aux | grep -E "node.*3333|vite|cloudflared" | grep -v grep

# Test API
curl http://localhost:3333/health
curl http://localhost:3333/api/info
```

## 🛠️ Manual Control

```bash
# Backend
cd /Users/mac/HeyPhom/backend-api
npm start

# Frontend
cd /Users/mac/HeyPhom/frontend-web
npm run dev

# Cloudflare Tunnel
cloudflared tunnel run heyphom
```

## 📚 Docs

- [SCRIPTS.md](SCRIPTS.md) - Scripts documentation
- [README.md](README.md) - Full documentation
- [HOÀN_THÀNH.md](HOÀN_THÀNH.md) - Vietnamese guide
