# Setup Sudo for HeyPhom

Để HeyPhom backend có thể chạy photogrammetry engine mà không cần nhập password, cần cấu hình sudoers.

## Cách 1: Tự động (Khuyến nghị)

```bash
cd /Users/mac/HeyPhom
sudo ./scripts/setup-sudo.sh
```

## Cách 2: Thủ công

1. Mở sudoers editor:
```bash
sudo visudo -f /etc/sudoers.d/heyphom
```

2. Thêm nội dung sau:
```
# Allow mac user to run heyphom-cli without password
mac ALL=(ALL) NOPASSWD: /Users/mac/HeyPhom/core-engine/.build/arm64-apple-macosx/release/heyphom-cli
mac ALL=(ALL) NOPASSWD: /usr/bin/chown
```

3. Lưu và thoát (`:wq` trong vi)

4. Verify:
```bash
sudo visudo -c -f /etc/sudoers.d/heyphom
```

## Kiểm tra

Sau khi setup, test bằng lệnh:
```bash
# Should NOT ask for password
sudo /Users/mac/HeyPhom/core-engine/.build/arm64-apple-macosx/release/heyphom-cli --version
```

## Lưu ý bảo mật

- Chỉ user `mac` mới được chạy command này không cần password
- Chỉ áp dụng cho heyphom-cli binary cụ thể (full path)
- Không ảnh hưởng đến các sudo command khác
