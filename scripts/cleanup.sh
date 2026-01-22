#!/bin/bash

# ============================================
# HeyPhom Automatic Cleanup Script
# ============================================
# Dọn dẹp các file upload và export cũ
# Chạy script này định kỳ bằng cron hoặc launchd
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/Users/mac/HeyPhom"
UPLOAD_DIR="${PROJECT_DIR}/backend-api/uploads"
EXPORT_DIR="${PROJECT_DIR}/backend-api/exports"
SESSION_DIR="${PROJECT_DIR}/backend-api/sessions"
LOG_DIR="${PROJECT_DIR}/backend-api/logs"

# Cleanup thresholds (in hours)
UPLOAD_THRESHOLD=24    # Xóa uploads sau 24h
EXPORT_THRESHOLD=168   # Xóa exports sau 7 days (168h)
SESSION_THRESHOLD=24   # Xóa sessions sau 24h

# Log file
CLEANUP_LOG="${LOG_DIR}/cleanup.log"

# ============================================
# Functions
# ============================================

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$CLEANUP_LOG"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$CLEANUP_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$CLEANUP_LOG"
}

# Cleanup old files in a directory
cleanup_directory() {
    local dir=$1
    local threshold=$2
    local description=$3
    
    if [ ! -d "$dir" ]; then
        warning "$description directory not found: $dir"
        return
    fi
    
    log "Cleaning up $description (older than ${threshold}h)..."
    
    # Find and count files older than threshold
    local count=$(find "$dir" -type f -mmin +$((threshold * 60)) | wc -l | xargs)
    
    if [ "$count" -eq 0 ]; then
        log "No old files found in $description"
        return
    fi
    
    # Calculate total size before cleanup
    local size_before=$(du -sh "$dir" 2>/dev/null | cut -f1)
    
    # Delete old files
    find "$dir" -type f -mmin +$((threshold * 60)) -delete
    
    # Delete empty directories
    find "$dir" -type d -empty -delete
    
    # Calculate total size after cleanup
    local size_after=$(du -sh "$dir" 2>/dev/null | cut -f1)
    
    log "Cleaned $count files from $description (${size_before} -> ${size_after})"
}

# Get disk space
check_disk_space() {
    log "Checking disk space..."
    local disk_info=$(df -h "$PROJECT_DIR" | tail -1)
    local usage=$(echo "$disk_info" | awk '{print $5}' | sed 's/%//')
    local available=$(echo "$disk_info" | awk '{print $4}')
    
    log "Disk usage: ${usage}%, Available: ${available}"
    
    if [ "$usage" -gt 90 ]; then
        error "CRITICAL: Disk usage is above 90%!"
        return 1
    elif [ "$usage" -gt 80 ]; then
        warning "WARNING: Disk usage is above 80%"
    fi
}

# Get directory sizes
show_directory_sizes() {
    log "Directory sizes:"
    
    if [ -d "$UPLOAD_DIR" ]; then
        local upload_size=$(du -sh "$UPLOAD_DIR" 2>/dev/null | cut -f1)
        log "  Uploads: $upload_size"
    fi
    
    if [ -d "$EXPORT_DIR" ]; then
        local export_size=$(du -sh "$EXPORT_DIR" 2>/dev/null | cut -f1)
        log "  Exports: $export_size"
    fi
    
    if [ -d "$SESSION_DIR" ]; then
        local session_size=$(du -sh "$SESSION_DIR" 2>/dev/null | cut -f1)
        log "  Sessions: $session_size"
    fi
    
    if [ -d "$LOG_DIR" ]; then
        local log_size=$(du -sh "$LOG_DIR" 2>/dev/null | cut -f1)
        log "  Logs: $log_size"
    fi
}

# Rotate log files
rotate_logs() {
    log "Rotating log files..."
    
    if [ ! -d "$LOG_DIR" ]; then
        return
    fi
    
    # Compress logs older than 7 days
    find "$LOG_DIR" -name "*.log" -mtime +7 -exec gzip {} \;
    
    # Delete compressed logs older than 30 days
    find "$LOG_DIR" -name "*.log.gz" -mtime +30 -delete
    
    log "Log rotation completed"
}

# ============================================
# Main
# ============================================

main() {
    log "========================================"
    log "HeyPhom Cleanup Started"
    log "========================================"
    
    # Create log directory if not exists
    mkdir -p "$LOG_DIR"
    
    # Check disk space
    check_disk_space
    
    # Show current directory sizes
    show_directory_sizes
    
    # Cleanup uploads
    cleanup_directory "$UPLOAD_DIR" "$UPLOAD_THRESHOLD" "Uploads"
    
    # Cleanup exports
    cleanup_directory "$EXPORT_DIR" "$EXPORT_THRESHOLD" "Exports"
    
    # Cleanup sessions
    cleanup_directory "$SESSION_DIR" "$SESSION_THRESHOLD" "Sessions"
    
    # Rotate logs
    rotate_logs
    
    # Final disk space check
    check_disk_space
    
    log "========================================"
    log "HeyPhom Cleanup Completed"
    log "========================================"
}

# Run main function
main

exit 0
