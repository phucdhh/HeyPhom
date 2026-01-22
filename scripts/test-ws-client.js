#!/usr/bin/env node

const WebSocket = require('ws');

// Test WebSocket progress updates
const sessionId = 'test_' + Date.now();
const ws = new WebSocket(`ws://localhost:3333/ws/${sessionId}`);

ws.on('open', () => {
  console.log('✅ WebSocket connected');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📩 Received:', JSON.stringify(msg, null, 2));
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', () => {
  console.log('🔌 WebSocket closed');
  process.exit(0);
});

// Simulate progress updates from backend
setTimeout(() => {
  console.log('\n🧪 Simulating manual test - connect browser to see real updates');
  console.log(`   Session ID: ${sessionId}`);
  console.log('   Open DevTools Console to see messages\n');
  
  // Keep alive for 30 seconds
  setTimeout(() => {
    console.log('\n⏰ Test complete');
    ws.close();
  }, 30000);
}, 1000);
