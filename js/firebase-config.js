import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app-check.js";

self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

const firebaseConfig = {
  apiKey: "AIzaSyCLMQQpa04oSPl07UgCAzT5mjXLhWKK7us",
  authDomain: "cid-sapd.firebaseapp.com",
  projectId: "cid-sapd",
  storageBucket: "cid-sapd.firebasestorage.app",
  messagingSenderId: "817844695774",
  appId: "1:817844695774:web:fac10fa8868708b15a084f",
  measurementId: "G-HRRYYNPG0T"
};

const app = initializeApp(firebaseConfig);

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("6LfK-ZosAAAAAMrqe-eBgbz1GwSMovrBKQA964Rb"),
  isTokenAutoRefreshEnabled: true
});

const auth = getAuth(app);
const db = getFirestore(app);
console.log("firebase-config cargado");
console.log("debug token flag:", self.FIREBASE_APPCHECK_DEBUG_TOKEN);

export { auth, db };


