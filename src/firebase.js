import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { enableIndexedDbPersistence, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "jJ4n4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ch.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "cheeen-ledger",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "chge.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "181107",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1021469081107:we6",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L232"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

enableIndexedDbPersistence(db).catch((error) => {
  if (error.code === "failed-precondition") {
    console.warn("IndexedDB persistence failed: multiple tabs open.");
    return;
  }

  if (error.code === "unimplemented") {
    console.warn("IndexedDB persistence not supported in this browser.");
    return;
  }

  console.warn("IndexedDB persistence init failed.", error);
});

isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});
