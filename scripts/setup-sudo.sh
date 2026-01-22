#!/bin/bash
# Script to setup passwordless sudo for heyphom-cli

echo "Setting up passwordless sudo for HeyPhom CLI..."

# Create sudoers file
sudo bash -c 'cat > /etc/sudoers.d/heyphom << EOF
# Allow mac user to run heyphom-cli without password
mac ALL=(ALL) NOPASSWD: /Users/mac/HeyPhom/core-engine/.build/arm64-apple-macosx/release/heyphom-cli
mac ALL=(ALL) NOPASSWD: /usr/bin/chown
EOF'

# Set correct permissions
sudo chmod 440 /etc/sudoers.d/heyphom

# Verify
if sudo visudo -c -f /etc/sudoers.d/heyphom; then
    echo "✅ Sudoers rule created successfully!"
    echo "You can now run: sudo heyphom-cli (without password)"
else
    echo "❌ Error in sudoers file"
    sudo rm /etc/sudoers.d/heyphom
    exit 1
fi
