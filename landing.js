import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

let isSignUpMode = false;

// DOM Elements
const authModal = document.getElementById("auth-modal");
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authRoleGroup = document.getElementById("auth-role-group");
const authRole = document.getElementById("auth-role");
const providerFields = document.getElementById("provider-fields");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggleBtn = document.getElementById("auth-toggle-btn");
const authToggleText = document.getElementById("auth-toggle-text");
const googleAuthBtn = document.getElementById("google-auth-btn");

// Redirect if already authenticated
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "main.html";
  }
});

// Modal Actions
window.openAuthModal = () => authModal.classList.remove("hidden");
document.getElementById("close-auth-modal").onclick = () => authModal.classList.add("hidden");

// Google Auth
googleAuthBtn.onclick = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    const userSnap = await get(ref(db, `users/${user.uid}`));
    if (!userSnap.exists()) {
      await set(ref(db, `users/${user.uid}`), {
        uid: user.uid,
        email: user.email,
        role: "customer",
        createdAt: Date.now()
      });
    }
    window.location.href = "main.html";
  } catch (err) {
    alert(`Google Auth Failed: ${err.message}`);
  }
};

// Email Sign In / Sign Up
authToggleBtn.onclick = (e) => {
  e.preventDefault();
  isSignUpMode = !isSignUpMode;
  authTitle.innerText = isSignUpMode ? "Create Account" : "Sign In";
  authSubmitBtn.innerText = isSignUpMode ? "Sign Up" : "Sign In";
  authToggleText.innerText = isSignUpMode ? "Already have an account?" : "Don't have an account?";
  authToggleBtn.innerText = isSignUpMode ? "Sign In" : "Sign Up";
  authRoleGroup.classList.toggle("hidden", !isSignUpMode);
};

authRole.onchange = () => {
  providerFields.classList.toggle("hidden", authRole.value !== "provider");
};

authForm.onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;

  try {
    if (isSignUpMode) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const role = authRole.value;

      const profileData = { uid, email, role, createdAt: Date.now() };

      if (role === "provider") {
        profileData.service = document.getElementById("auth-service").value;
        profileData.location = document.getElementById("auth-location").value || "Metro Center";
        profileData.price = document.getElementById("auth-price").value || 60;
        profileData.rating = 5.0;
      }

      await set(ref(db, `users/${uid}`), profileData);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    window.location.href = "main.html";
  } catch (err) {
    alert(`Auth Notice: ${err.message}`);
  }
};