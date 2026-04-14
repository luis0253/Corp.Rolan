// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDC7dmucxzszwN4E3WUoJeQuDdjWdcDexw",
  authDomain: "corporativo-rolan.firebaseapp.com",
  projectId: "corporativo-rolan",
  storageBucket: "corporativo-rolan.firebasestorage.app",
  messagingSenderId: "618300650049",
  appId: "1:618300650049:web:6cbed9b984075d083a0cc0",
  measurementId: "G-50ZQ4Y2NML"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the services you need
const db = getFirestore(app);

export { app, db };
