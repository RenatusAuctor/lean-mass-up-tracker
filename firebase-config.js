import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// TODO: Replace with your actual Firebase config from the Firebase Console -> Project Settings
const firebaseConfig = {
  apiKey: "AIzaSy_YOUR_FIREBASE_API_KEY",
  authDomain: "lean-mass-up-tracker-default.firebaseapp.com",
  databaseURL: "https://lean-mass-up-tracker-default-rtdb.firebaseio.com",
  projectId: "lean-mass-up-tracker-default",
  storageBucket: "lean-mass-up-tracker-default.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getDatabase(app);
export { signInWithPopup, onAuthStateChanged, signOut, ref, set, get, child };
