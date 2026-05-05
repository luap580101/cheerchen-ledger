import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { enableIndexedDbPersistence, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || ".",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

const envKeyMap = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID",
  measurementId: "VITE_FIREBASE_MEASUREMENT_ID"
};

export const firebaseConfigIssues = Object.entries(firebaseConfig)
  .filter(([, value]) => !value || value === ".")
  .map(([key]) => envKeyMap[key]);

export const app = firebaseConfigIssues.length === 0 ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const googleProvider = auth ? new GoogleAuthProvider() : null;
export const db = app ? getFirestore(app) : null;

if (db) {
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
}

if (app) {
  isSupported().then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  });
}
