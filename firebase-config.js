import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// TODO: Replace with your actual Firebase config from the Firebase Console -> Project Settings
const firebaseConfig = {
  apiKey: "AIzaSyCBes_4ZJISGDJ04SGbRdtWZB-cQC34X44",
  authDomain: "lean-mass-up-tracker.firebaseapp.com",
  databaseURL: "https://lean-mass-up-tracker-default-rtdb.firebaseio.com",
  projectId: "lean-mass-up-tracker",
  storageBucket: "lean-mass-up-tracker.firebasestorage.app",
  messagingSenderId: "318819059829",
  appId: "1:318819059829:web:416fe853edc910e510d03c",
  measurementId: "G-L87N583024"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getDatabase(app);
export { signInWithPopup, onAuthStateChanged, signOut, ref, set, get, child };
