const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

async function testDirectUpload() {
  console.log('🧪 Testing direct API upload...');
  
  // Check if test images exist
  const testDir = path.join(__dirname, 'test-images');
  if (!fs.existsSync(testDir)) {
    console.log('❌ test-images directory not found');
    console.log('   Create it and add at least 30 images');
    return;
  }
  
  const testImages = fs.readdirSync(testDir)
    .filter(f => /\.(jpg|jpeg|png|heic)$/i.test(f))
    .map(f => path.join(testDir, f));
  
  if (testImages.length < 30) {
    console.log(`❌ Need at least 30 images. Found: ${testImages.length}`);
    return;
  }
  
  console.log(`📤 Uploading ${testImages.length} images...`);
  
  const form = new FormData();
  
  // Add files
  testImages.forEach(imagePath => {
    form.append('files', fs.createReadStream(imagePath));
  });
  
  // Add metadata
  form.append('quality', 'low');
  form.append('formats', 'usdz,obj,stl');
  
  const url = 'https://heyphom.truyenthong.edu.vn/api/upload';
  
  console.log('🌐 Sending request to:', url);
  
  // Get length asynchronously
  const contentLength = await new Promise((resolve, reject) => {
    form.getLength((err, length) => {
      if (err) reject(err);
      else resolve(length);
    });
  });
  console.log('📊 Total size:', contentLength, 'bytes');
  
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const request = form.submit(url, (err, res) => {
      if (err) {
        console.error('❌ Request error:', err.message);
        reject(err);
        return;
      }
      
      console.log('📡 Response status:', res.statusCode);
      console.log('📡 Response headers:', res.headers);
      
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
        console.log('📥 Received chunk:', chunk.length, 'bytes');
      });
      
      res.on('end', () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⏱️  Upload completed in ${elapsed}s`);
        console.log('📄 Response:', data);
        
        try {
          const result = JSON.parse(data);
          if (result.success) {
            console.log('✅ Upload successful!');
            console.log('📦 Session ID:', result.data.sessionId);
            console.log('🔗 Check status at: https://heyphom.truyenthong.edu.vn');
          } else {
            console.log('❌ Upload failed:', result.message);
          }
        } catch (e) {
          console.log('⚠️  Could not parse response as JSON');
        }
        
        resolve(data);
      });
    });
    
    request.on('error', (err) => {
      console.error('❌ Request error:', err.message);
      reject(err);
    });
    
    // Log upload progress
    let uploaded = 0;
    request.on('data', (chunk) => {
      uploaded += chunk.length;
      const percent = ((uploaded / form.getLengthSync()) * 100).toFixed(1);
      process.stdout.write(`\r📤 Uploading: ${percent}%`);
    });
  });
}

testDirectUpload()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });
