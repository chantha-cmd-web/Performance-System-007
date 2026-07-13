import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "quiet-gift-drtgb",
  appId: "1:212159877016:web:0751f6001447a4b77765ed",
  apiKey: "AIzaSyDNYFeu0drNIXKsGnabiBtpYPEvgQyv30Q",
  authDomain: "quiet-gift-drtgb.firebaseapp.com",
  storageBucket: "quiet-gift-drtgb.firebasestorage.app",
  messagingSenderId: "212159877016"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
