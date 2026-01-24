const { getDatabase, ref, get } = require('firebase/database');
const { initializeApp } = require('firebase/app');
const fs = require('fs');

// Load environment variables from .env.local if it exists
const envPath = '.env.local';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  });
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.databaseURL) {
  console.log('Firebase Database URL nicht konfiguriert');
  console.log('Bitte .env.local Datei mit Firebase Konfiguration erstellen');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function checkTables() {
  try {
    const tablesRef = ref(database, 'tables');
    const snapshot = await get(tablesRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const tableCount = Object.keys(data).length;
      console.log(`Individuelle Tische in der Datenbank: ${tableCount}`);
      
      if (tableCount > 0) {
        console.log('\nTisch-Details:');
        Object.entries(data).forEach(([id, table]) => {
          console.log(`- Tisch ${table.number}: Code ${table.code} (ID: ${id})`);
        });
      }
    } else {
      console.log('Keine individuellen Tische in der Datenbank gefunden - alle wurden gelöscht');
    }
  } catch (error) {
    console.error('Fehler beim Überprüfen der Datenbank:', error.message);
  }
}

checkTables();
