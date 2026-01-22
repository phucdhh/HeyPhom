const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function testUpload() {
  console.log('🚀 Starting Chrome headless test...');
  
  const browser = await puppeteer.launch({
    headless: 'new', // Use new headless mode
    devtools: false,  // No devtools in headless
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Enable console logging from page
  page.on('console', msg => {
    console.log('PAGE LOG:', msg.text());
  });
  
  // Enable request/response logging
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log('→ REQUEST:', request.method(), request.url());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log('← RESPONSE:', response.status(), response.url());
    }
  });
  
  // Enable network events
  page.on('requestfailed', request => {
    console.log('❌ REQUEST FAILED:', request.url(), request.failure().errorText);
  });
  
  try {
    console.log('📱 Navigating to https://heyphom.truyenthong.edu.vn...');
    await page.goto('https://heyphom.truyenthong.edu.vn', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    console.log('✅ Page loaded');
    
    // Take screenshot
    await page.screenshot({ path: 'page-loaded.png', fullPage: true });
    console.log('📸 Screenshot saved: page-loaded.png');
    
    // Wait for file input
    console.log('🔍 Looking for file input...');
    await page.waitForSelector('input[type="file"]', { timeout: 10000 });
    
    // Create test images if not exist
    const testDir = path.join(__dirname, 'test-images');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
      console.log('📁 Created test-images directory');
      console.log('⚠️  Please add at least 30 test images to:', testDir);
      console.log('   Then run this script again.');
      await browser.close();
      return;
    }
    
    const testImages = fs.readdirSync(testDir)
      .filter(f => /\.(jpg|jpeg|png|heic)$/i.test(f))
      .map(f => path.join(testDir, f));
    
    if (testImages.length < 30) {
      console.log(`⚠️  Need at least 30 images. Found: ${testImages.length}`);
      console.log('   Add more images to:', testDir);
      await browser.close();
      return;
    }
    
    console.log(`📤 Uploading ${testImages.length} images...`);
    
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(...testImages);
    
    console.log('✅ Files selected');
    
    // Wait for quality selector and select low
    await page.waitForSelector('select[value="low"], button:has-text("Low")', { timeout: 5000 });
    
    // Select formats
    await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
    const checkboxes = await page.$$('input[type="checkbox"]');
    for (const checkbox of checkboxes) {
      await checkbox.click();
    }
    
    console.log('⚙️ Quality and formats selected');
    
    // Find and click submit button
    await page.waitForSelector('button:has-text("Start Processing"), button:has-text("Upload")', { timeout: 5000 });
    
    await page.screenshot({ path: 'before-upload.png', fullPage: true });
    console.log('📸 Screenshot saved: before-upload.png');
    
    console.log('🚀 Clicking upload button...');
    await page.click('button'); // Click first button (should be submit)
    
    // Wait for upload to start
    await page.waitForTimeout(5000);
    
    await page.screenshot({ path: 'during-upload.png', fullPage: true });
    console.log('📸 Screenshot saved: during-upload.png');
    
    // Wait for processing (max 10 minutes)
    console.log('⏳ Waiting for processing to complete (max 10 minutes)...');
    await page.waitForSelector('.download-btn, a[download]', { timeout: 600000 });
    
    await page.screenshot({ path: 'completed.png', fullPage: true });
    console.log('📸 Screenshot saved: completed.png');
    
    console.log('✅ Processing completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error.png', fullPage: true });
    console.log('📸 Error screenshot saved: error.png');
  }
  
  console.log('🔍 Keeping browser open for inspection. Press Ctrl+C to close.');
  // Keep browser open for inspection
  // await browser.close();
}

testUpload().catch(console.error);
