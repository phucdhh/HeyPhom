#!/usr/bin/env node

/**
 * Migration Script: Session Directory → Users Structure
 * 
 * Old structure:
 *   sessions/
 *     sess_xxx/
 *       uploads/
 *     sess_xxx.json
 *   backend-api/uploads/
 *   backend-api/exports/
 * 
 * New structure:
 *   users/
 *     default/
 *       sessions/
 *         sess_xxx/
 *           uploads/
 *           exports/
 *           session.json
 */

const fs = require('fs-extra');
const path = require('path');

async function migrate() {
  console.log('🚀 Starting migration to users structure...\n');
  
  const ROOT = path.join(__dirname, '../..');
  const OLD_SESSIONS = path.join(ROOT, 'sessions');
  const OLD_EXPORTS = path.join(ROOT, 'backend-api/exports');
  const OLD_UPLOADS = path.join(ROOT, 'backend-api/uploads');
  
  const NEW_USERS = path.join(ROOT, 'users');
  const DEFAULT_USER = path.join(NEW_USERS, 'default');
  const NEW_SESSIONS = path.join(DEFAULT_USER, 'sessions');
  
  // Create new structure
  console.log('📁 Creating new directory structure...');
  await fs.ensureDir(NEW_SESSIONS);
  console.log(`   ✅ Created: ${NEW_SESSIONS}`);
  
  // Migrate sessions
  if (await fs.pathExists(OLD_SESSIONS)) {
    console.log('\n📦 Migrating sessions...');
    const items = await fs.readdir(OLD_SESSIONS);
    
    let sessionDirs = 0;
    let sessionFiles = 0;
    
    for (const item of items) {
      const itemPath = path.join(OLD_SESSIONS, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory() && item.startsWith('sess_')) {
        // Session directory with uploads/
        const newSessionDir = path.join(NEW_SESSIONS, item);
        await fs.ensureDir(newSessionDir);
        
        // Copy uploads/
        const oldUploads = path.join(itemPath, 'uploads');
        if (await fs.pathExists(oldUploads)) {
          const newUploads = path.join(newSessionDir, 'uploads');
          await fs.copy(oldUploads, newUploads);
          console.log(`   ✅ Copied uploads: ${item}`);
        }
        
        sessionDirs++;
      } else if (stat.isFile() && item.endsWith('.json')) {
        // Session metadata file
        const sessionId = item.replace('.json', '');
        const newSessionDir = path.join(NEW_SESSIONS, sessionId);
        await fs.ensureDir(newSessionDir);
        
        const newSessionFile = path.join(newSessionDir, 'session.json');
        await fs.copy(itemPath, newSessionFile);
        console.log(`   ✅ Copied metadata: ${item}`);
        
        sessionFiles++;
      }
    }
    
    console.log(`   📊 Migrated ${sessionDirs} session directories, ${sessionFiles} metadata files`);
  }
  
  // Migrate exports
  if (await fs.pathExists(OLD_EXPORTS)) {
    console.log('\n📤 Migrating exports...');
    const exports = await fs.readdir(OLD_EXPORTS);
    
    let exportCount = 0;
    for (const sessionId of exports) {
      if (!sessionId.startsWith('sess_')) continue;
      
      const oldExportPath = path.join(OLD_EXPORTS, sessionId);
      const newSessionDir = path.join(NEW_SESSIONS, sessionId);
      const newExportPath = path.join(newSessionDir, 'exports');
      
      await fs.ensureDir(newSessionDir);
      await fs.copy(oldExportPath, newExportPath);
      console.log(`   ✅ Copied exports: ${sessionId}`);
      
      exportCount++;
    }
    
    console.log(`   📊 Migrated ${exportCount} export directories`);
  }
  
  // Migrate legacy uploads (if any)
  if (await fs.pathExists(OLD_UPLOADS)) {
    console.log('\n📥 Checking legacy uploads...');
    const uploads = await fs.readdir(OLD_UPLOADS);
    
    if (uploads.length > 0) {
      console.log(`   ⚠️  Found ${uploads.length} items in backend-api/uploads/`);
      console.log('   ℹ️  These appear to be legacy uploads - please verify manually');
    } else {
      console.log('   ✅ No legacy uploads found');
    }
  }
  
  console.log('\n✅ Migration completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('   1. Review migrated data in users/default/sessions/');
  console.log('   2. Update environment: export USERS_DIR=/Users/mac/HeyPhom/users');
  console.log('   3. Restart backend server');
  console.log('   4. Optionally backup and remove old directories:');
  console.log('      - sessions/');
  console.log('      - backend-api/exports/');
  console.log('      - backend-api/uploads/\n');
}

// Run migration
migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
