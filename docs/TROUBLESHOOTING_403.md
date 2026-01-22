# 🚨 HeyPhom Public URL Issue

## ❌ Vấn đề: HTTP 403 Forbidden

Public URL `https://heyphom.truyenthong.edu.vn` đang trả về **HTTP 403**.

### ✅ Services đang hoạt động

- **Backend API**: ✅ Running (Port 3333)
- **Frontend Web**: ✅ Running (Port 3334, HTTP 200)
- **Cloudflare Tunnel**: ✅ Connected (4 connections)

### ✅ Local Access hoạt động tốt

```bash
# Frontend
curl -I http://localhost:3334
# HTTP/1.1 200 OK ✅

# Backend
curl http://localhost:3333/health
# {"status":"ok",...} ✅
```

### ❌ Public URL bị 403

```bash
curl -I https://heyphom.truyenthong.edu.vn
# HTTP/2 403 ❌
```

## 🔍 Nguyên nhân

HTTP 403 từ Cloudflare thường do:

1. **Cloudflare Access / Zero Trust** - Domain có authentication rules
2. **Firewall Rules** - IP/Country blocking
3. **WAF Rules** - Web Application Firewall
4. **Rate Limiting** - Quá nhiều requests

## 🔧 Cách fix

### Option 1: Cloudflare Dashboard (Khuyến nghị)

1. Đăng nhập: https://dash.cloudflare.com
2. Chọn domain: `truyenthong.edu.vn`
3. Kiểm tra:
   - **Zero Trust → Access → Applications**
     - Tìm rule cho `heyphom.truyenthong.edu.vn`
     - Disable hoặc thêm bypass
   - **Security → WAF**
     - Check managed rules
     - Thêm exception cho subdomain
   - **Security → Firewall Rules**
     - Check nếu có rule block subdomain

### Option 2: Cloudflare CLI

```bash
# List access applications
cloudflared access applications list

# Check tunnel routes
cloudflared tunnel route dns heyphom heyphom.truyenthong.edu.vn
```

### Option 3: Sử dụng local URL tạm thời

```bash
# Truy cập local thay vì public
http://localhost:3334

# Hoặc qua network
http://192.168.1.100:3334
```

## 📋 Current Status

```bash
# Check status
cd /Users/mac/HeyPhom
./status.sh

# Access URLs
Local:   http://localhost:3334     ✅ WORKING
Backend: http://localhost:3333     ✅ WORKING
Public:  https://heyphom.truyenthong.edu.vn  ❌ 403 FORBIDDEN
```

## 🎯 Next Steps

1. **Check Cloudflare dashboard** để tìm access rule
2. **Disable Zero Trust** cho subdomain heyphom nếu không cần
3. **Hoặc dùng local URL** tạm thời trong khi fix

## 📝 Tunnel Config

File: `/Users/mac/.cloudflared/config.yml`

```yaml
tunnel: 12f840ec-d123-4ffe-9b19-e665ba48f2b9
credentials-file: /Users/mac/.cloudflared/12f840ec-d123-4ffe-9b19-e665ba48f2b9.json

ingress:
  - hostname: heyphom.truyenthong.edu.vn
    service: http://127.0.0.1:3334
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

Tunnel config **đúng** nhưng bị block bởi Cloudflare security policies.

---

*Cập nhật: 18/01/2026 16:56*
*Status: Services running, waiting for Cloudflare access configuration*
