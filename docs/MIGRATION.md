# 🔄 Migration to Users Directory Structure

## Overview

Migrated from scattered directory structure to unified user-based organization:

### Old Structure ❌
```
sessions/
  sess_xxx.json
  sess_xxx/uploads/
backend-api/uploads/
backend-api/exports/
backend-api/sessions/
```

### New Structure ✅
```
users/
  <userID>/
    sessions/
      <sessionID>/
        uploads/
        exports/
        session.json
```

## Benefits

- **Scalable**: Easy to add multi-user support
- **Organized**: All user data in one place
- **Clean**: No scattered directories
- **Future-proof**: Ready for authentication system

## Migration Steps Completed

1. ✅ Created migration script: `backend-api/scripts/migrate-to-users-structure.js`
2. ✅ Updated backend routes to use new structure
3. ✅ Added userID support in API endpoints
4. ✅ Updated frontend to generate/send userID
5. ✅ Migrated existing sessions to `users/default/sessions/`

## Environment Variables

**New:**
```bash
export USERS_DIR=/Users/mac/HeyPhom/users
```

**Deprecated (no longer used):**
- ~~SESSION_DIR~~
- ~~UPLOAD_DIR~~
- ~~EXPORT_DIR~~

## User ID Management

### Frontend
- Generates UUID from IndexedDB
- Stored persistently across browser sessions
- Sent in `X-User-Id` header with all requests
- Fallback to `default` if generation fails

### Backend
- Accepts `X-User-Id` header
- Uses `default` if not provided
- Creates user directory automatically

## API Changes

### All endpoints now accept:
```http
X-User-Id: user_1234567890_abc123
```

### Affected Endpoints:
- `POST /api/upload` - Local file upload
- `POST /api/github-dataset` - GitHub dataset
- `POST /api/upload/gdrive` - Google Drive import
- `GET /api/jobs/:sessionId` - Get job status

## Testing

### Backend Test:
```bash
curl -X POST http://localhost:4444/api/github-dataset \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user_test_12345" \
  -d '{...}'
```

### Directory Check:
```bash
ls -la /Users/mac/HeyPhom/users/
ls -la /Users/mac/HeyPhom/users/default/sessions/
```

## Rollback (if needed)

If you need to rollback, the old directories still exist:
- `sessions/`
- `backend-api/uploads/`
- `backend-api/exports/`

Simply restart backend without `USERS_DIR` environment variable.

## Cleanup Old Directories

After confirming everything works:
```bash
# Backup first
tar -czf old-structure-backup.tar.gz sessions/ backend-api/uploads/ backend-api/exports/

# Then remove
rm -rf sessions/
rm -rf backend-api/uploads/
rm -rf backend-api/exports/
```

## Notes

- Migration script copies data (doesn't move), so original data is safe
- Default user (`users/default/`) holds all anonymous sessions
- Each user's sessions are isolated
- Ready for future authentication integration
