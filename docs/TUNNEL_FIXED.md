# ✅ HeyPhom Tunnel Configuration - FIXED

## 🎯 Vấn đề đã fix

**Config file riêng biệt** - HeyPhom giờ sử dụng config riêng giống các app khác:
- `/Users/mac/.cloudflared/config-heyphom.yml`

## ✅ Tunnel Status

```bash
Tunnel ID:    12f840ec-d123-4ffe-9b19-e665ba48f2b9
Config File:  config-heyphom.yml
Connections:  4 active (HKG01, HKG09, HKG10)
Status:       ✅ RUNNING
```

## 📋 So sánh với các app khác

### Apps hoạt động tốt:
- **CoSheet**: config-cosheet.yml → https://cosheet.truyenthong.edu.vn (HTTP 200 ✅)
- **HeyStat**: config-heystat.yml → https://heystat.truyenthong.edu.vn (HTTP 405 ✅)
- **HeyMac**: config-heymac.yml → https://heymac.truyenthong.edu.vn ✅

### HeyPhom (mới):
- **HeyPhom**: config-heyphom.yml → https://heyphom.truyenthong.edu.vn (HTTP 403 ❌)

## 🔍 Nguyên nhân HTTP 403

**Cloudflare Access Policy** - Domain `heyphom.truyenthong.edu.vn` chưa được thêm vào whitelist.

### Chứng cứ:
1. ✅ Tunnel running OK (4 connections)
2. ✅ Local access works (HTTP 200)
3. ✅ Config giống các app khác
4. ❌ Public URL bị 403 TRƯỚC KHI đến tunnel (không có log request trong tunnel)

→ 403 từ **Cloudflare Edge**, không phải từ origin server.

## 🔧 Fix bằng Cloudflare Dashboard

### Bước 1: Đăng nhập Cloudflare
https://dash.cloudflare.com

### Bước 2: Chọn domain
`truyenthong.edu.vn`

### Bước 3: Kiểm tra Zero Trust
**Zero Trust → Access → Applications**

Tìm application có rules cho `*.truyenthong.edu.vn` hoặc specific subdomains.

### Bước 4A: Thêm HeyPhom vào whitelist

Nếu có application policy:
```
Hostname: *.truyenthong.edu.vn
HOẶC
Add hostname: heyphom.truyenthong.edu.vn
```

### Bước 4B: Tạo bypass rule

Hoặc tạo bypass rule cho HeyPhom:
```
Rule: Bypass
Hostname: heyphom.truyenthong.edu.vn
```

### Bước 5: Verify DNS

Check DNS record đã tồn tại:
```bash
nslookup heyphom.truyenthong.edu.vn
# Should return Cloudflare IPs
```

## 📝 Config File

File: `/Users/mac/.cloudflared/config-heyphom.yml`

```yaml
# Cloudflare Tunnel Configuration for HeyPhom
tunnel: 12f840ec-d123-4ffe-9b19-e665ba48f2b9
credentials-file: /Users/mac/.cloudflared/12f840ec-d123-4ffe-9b19-e665ba48f2b9.json

ingress:
  - hostname: heyphom.truyenthong.edu.vn
    service: http://127.0.0.1:3334
    originRequest:
      noTLSVerify: true
      connectTimeout: 60s
      http2Origin: false
      disableChunkedEncoding: false
      keepAliveTimeout: 120s
      keepAliveConnections: 100
      httpHostHeader: heyphom.truyenthong.edu.vn
  
  - service: http_status:404
```

## 🚀 Scripts đã update

Tất cả scripts giờ sử dụng config file riêng:

```bash
# Start với config riêng
cloudflared tunnel --config /Users/mac/.cloudflared/config-heyphom.yml run heyphom

# Scripts
./start.sh   # Sử dụng config-heyphom.yml
./stop.sh    # Chỉ stop HeyPhom tunnel
./status.sh  # Show config file being used
./restart.sh # Restart với config mới
```

## ✅ Không ảnh hưởng các app khác

### Tunnels đang chạy:

```
PID 548   - HeyStat  (config-heystat.yml)
PID 94394 - HeyMac   (config-heymac.yml)
PID 85536 - CoSheet  (config-cosheet.yml)
PID 97361 - HeyPhom  (config-heyphom.yml) ← MỚI
```

Mỗi tunnel **độc lập hoàn toàn**, không conflict.

## 🎯 Next Steps

1. **Vào Cloudflare dashboard** (bắt buộc)
2. **Add heyphom.truyenthong.edu.vn vào Access whitelist**
3. Hoặc **disable Zero Trust** cho subdomain này
4. Test lại: `curl -I https://heyphom.truyenthong.edu.vn`

## 📊 Current Status

```bash
# All services running
cd /Users/mac/HeyPhom
./status.sh

# Test local (working)
curl http://localhost:3334  # ✅ HTTP 200

# Test public (waiting for Cloudflare config)
curl https://heyphom.truyenthong.edu.vn  # ❌ HTTP 403
```

---

**Kết luận:**
- ✅ Config đúng (giống CoSheet, HeyStat, HeyMac)
- ✅ Tunnel running
- ✅ Local works
- ❌ Cần config Cloudflare Access policy

*Cập nhật: 18/01/2026 17:04*
