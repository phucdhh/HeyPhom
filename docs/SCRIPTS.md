# 🚀 HeyPhom Management Scripts

Các scripts quản lý HeyPhom ở thư mục gốc dự án.

## 📋 Available Scripts

### 1. `./start.sh` - Khởi động services
Khởi động tất cả dịch vụ HeyPhom:
- Backend API (Port 3333)
- Frontend Web (Port 3334)
- Cloudflare Tunnel

```bash
./start.sh
```

**Output:**
- ✅ Services started successfully
- 🌐 Access URLs
- 📊 Running processes with PIDs
- 📝 Log file locations

### 2. `./stop.sh` - Dừng services
Dừng tất cả dịch vụ HeyPhom:

```bash
./stop.sh
```

**Output:**
- ✅ Services stopped successfully
- 🧹 Log files cleaned
- ⚠️ Warning if any process still running

### 3. `./restart.sh` - Khởi động lại services
Dừng và khởi động lại tất cả services:

```bash
./restart.sh
```

**Output:**
- Combines `stop.sh` + `start.sh`
- Full status of restart operation

### 4. `./status.sh` - Kiểm tra trạng thái
Hiển thị trạng thái chi tiết của tất cả services:

```bash
./status.sh
```

**Output:**
- 📊 Status của từng service (Running/Stopped)
- PID, Uptime, URLs
- Health check results
- 💻 System resources (CPU, Memory, Disk)
- 📝 Log file information
- 🌐 Access URLs

---

## 🎯 Quick Commands

```bash
# Xem trạng thái
./status.sh

# Khởi động
./start.sh

# Dừng
./stop.sh

# Khởi động lại
./restart.sh
```

---

## 📁 Log Files

Tất cả logs được lưu tại `/tmp/`:
- `/tmp/heyphom-backend.log` - Backend API logs
- `/tmp/heyphom-frontend.log` - Frontend Web logs
- `/tmp/heyphom-tunnel.log` - Cloudflare Tunnel logs

Xem logs:
```bash
# Backend
tail -f /tmp/heyphom-backend.log

# Frontend
tail -f /tmp/heyphom-frontend.log

# Tunnel
tail -f /tmp/heyphom-tunnel.log

# All logs
tail -f /tmp/heyphom-*.log
```

---

## 🔍 Status Output Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 HeyPhom System Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date: 2026-01-18 23:32:17
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/3] Backend API (Port 3333)
      Status: ✅ RUNNING
      PID:    57482
      Uptime: 02:11:44
      URL:    http://localhost:3333
      Health: ✅ OK (HTTP 200)

[2/3] Frontend Web (Port 3334)
      Status: ✅ RUNNING
      PID:    36574
      Uptime: 32:58
      URL:    http://localhost:3334
      HTTP:   ✅ OK (HTTP 200)

[3/3] Cloudflare Tunnel
      Status:     ✅ RUNNING
      PID:        38251
      Uptime:     31:42
      Processes:  1
      Public URL: https://heyphom.truyenthong.edu.vn
      Connections: 4 active

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Process Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

38251    0.1%   0.2%   50M    cloudflared tunnel run heyphom
36574    0.0%   0.4%   102M   node .../vite
57482    0.0%   0.3%   92M    node .../fastify

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Access URLs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Public:  https://heyphom.truyenthong.edu.vn
Local:   http://localhost:3334
Backend: http://localhost:3333
API:     http://localhost:3333/api/info
Health:  http://localhost:3333/health
```

---

## 🛠️ Troubleshooting

### Service không start
```bash
# Kiểm tra log files
tail -50 /tmp/heyphom-backend.log
tail -50 /tmp/heyphom-frontend.log
tail -50 /tmp/heyphom-tunnel.log
```

### Port đã được sử dụng
```bash
# Tìm process đang dùng port
lsof -i:3333
lsof -i:3334

# Kill process
kill -9 <PID>

# Hoặc dùng stop script
./stop.sh
```

### Service không stop
```bash
# Stop lại lần nữa
./stop.sh

# Hoặc kill thủ công
lsof -ti:3333 | xargs kill -9
lsof -ti:3334 | xargs kill -9
pkill -f "cloudflared tunnel run heyphom"
```

---

## 📦 Script Features

### ✅ start.sh
- Kiểm tra service đã chạy chưa
- Start từng service tuần tự
- Verify PID và port
- Health check
- Colored output
- Log file locations

### ✅ stop.sh
- Stop tất cả services
- Clean up log files
- Verify stopped successfully
- Warning nếu còn process chạy

### ✅ restart.sh
- Automated stop + start
- Wait time giữa operations
- Full status report

### ✅ status.sh
- Detailed status cho từng service
- PID, Uptime, URLs
- Health checks (HTTP 200)
- System resources
- Log file info
- Colored output
- Auto-refresh friendly

---

## 🎨 Color Coding

Scripts sử dụng colors để dễ đọc:
- 🔵 **Blue** - Headers, sections
- 🟢 **Green** - Success, running
- 🟡 **Yellow** - Warnings, info
- 🔴 **Red** - Errors, stopped
- 🔷 **Cyan** - URLs, links

---

## ⚡ Auto-start on Boot (Optional)

### macOS launchd

Tạo file `/Library/LaunchDaemons/com.heyphom.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.heyphom</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/mac/HeyPhom/start.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
```

Load:
```bash
sudo launchctl load /Library/LaunchDaemons/com.heyphom.plist
```

---

## 📚 Related Documentation

- [README.md](README.md) - Main documentation
- [QUICKSTART.md](QUICKSTART.md) - Quick start guide
- [HOÀN_THÀNH.md](HOÀN_THÀNH.md) - Vietnamese deployment guide
- [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) - Deployment status

---

*HeyPhom Management Scripts v1.0*
*Mac Mini M2 24GB RAM - macOS*
