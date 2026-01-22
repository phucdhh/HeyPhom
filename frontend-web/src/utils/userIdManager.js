/**
 * User ID Management
 * Generates and persists a unique user ID in IndexedDB
 */

const DB_NAME = 'HeyPhomUserDB';
const STORE_NAME = 'userData';
const USER_ID_KEY = 'userId';
const DB_VERSION = 1;

// Open IndexedDB connection
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// Generate a proper UUID v4
function generateUserId() {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: Generate UUID v4 manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Get or create user ID from IndexedDB
export async function getUserId() {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(USER_ID_KEY);
      
      request.onsuccess = () => {
        const userId = request.result;
        
        if (userId) {
          console.log('📱 Existing user ID:', userId);
          resolve(userId);
        } else {
          // No user ID found, create new one
          const newUserId = generateUserId();
          console.log('🆕 Generated new user ID:', newUserId);
          
          // Save to IndexedDB
          const writeTransaction = db.transaction([STORE_NAME], 'readwrite');
          const writeStore = writeTransaction.objectStore(STORE_NAME);
          const writeRequest = writeStore.put(newUserId, USER_ID_KEY);
          
          writeRequest.onsuccess = () => resolve(newUserId);
          writeRequest.onerror = () => {
            console.warn('Failed to save user ID, using in-memory only');
            resolve(newUserId);
          };
        }
      };
      
      request.onerror = () => {
        console.error('Failed to get user ID from IndexedDB:', request.error);
        // Fallback to sessionStorage
        let userId = sessionStorage.getItem(USER_ID_KEY);
        if (!userId) {
          userId = generateUserId();
          sessionStorage.setItem(USER_ID_KEY, userId);
        }
        resolve(userId);
      };
    });
  } catch (err) {
    console.error('IndexedDB error, using fallback:', err);
    
    // Fallback to sessionStorage
    let userId = sessionStorage.getItem(USER_ID_KEY);
    if (!userId) {
      userId = generateUserId();
      sessionStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
  }
}

// Clear user ID (for testing or reset)
export async function clearUserId() {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(USER_ID_KEY);
      
      request.onsuccess = () => {
        sessionStorage.removeItem(USER_ID_KEY);
        console.log('🗑️ User ID cleared');
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to clear user ID:', err);
    sessionStorage.removeItem(USER_ID_KEY);
  }
}
