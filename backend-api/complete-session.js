const fs = require('fs');
const path = require('path');

const sessionId = process.argv[2] || 'sess_1768894818144_IhwoY8y7';
const sessionFile = path.join(__dirname, 'sessions', sessionId + '.json');

console.log(`Completing session: ${sessionId}`);

try {
  const session = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  
  // Get file sizes
  const exportDir = path.join(__dirname, 'exports', sessionId);
  const usdzPath = path.join(exportDir, 'model.usdz');
  const objPath = path.join(exportDir, 'model.obj');
  const stlPath = path.join(exportDir, 'model.stl');
  
  const usdzSize = fs.existsSync(usdzPath) ? fs.statSync(usdzPath).size : 0;
  const objSize = fs.existsSync(objPath) ? fs.statSync(objPath).size : 0;
  const stlSize = fs.existsSync(stlPath) ? fs.statSync(stlPath).size : 0;
  
  // Update session
  session.status = 'completed';
  session.progress = 100;
  session.completedAt = new Date().toISOString();
  session.results = {
    usdz: { path: `/exports/${sessionId}/model.usdz`, size: usdzSize },
    obj: { path: `/exports/${sessionId}/model.obj`, size: objSize },
    stl: { path: `/exports/${sessionId}/model.stl`, size: stlSize }
  };
  
  fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
  console.log('✅ Session completed manually');
  console.log(JSON.stringify(session.results, null, 2));
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
