import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { eget, attach } from "./structure.js";
import { auth, db } from "./firebase.js";

async function signUp() {
  await registerUser(eget("name"), eget("email"), eget("password"));
}

async function signIn() {
  await loginUser(eget("email"), eget("password"));
}

async function registerUser(name, email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, "teachers", user.uid), { name, email, role: "user"});
    localStorage.setItem("teacherId", user.uid);
    localStorage.setItem("originalTeacherId", user.uid);
    console.log("Register successfully!");
    window.location.href = "index.html";
  } catch (e) {
    console.log("Failed to save teacher info:", e.message);
    return null;
  }
}

async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    localStorage.setItem("teacherId", user.uid);
    localStorage.setItem("originalTeacherId", user.uid);
    console.log("Login successful!");
    window.location.href = "index.html";
  } catch (e) {
    console.log("Failed to login:", e.message);
    return null;
  }
}

onAuthStateChanged(auth, (user) => {
  const currentPage = window.location.pathname.split("/").pop();
  if (!user && currentPage !== "login.html" && currentPage !== "register.html") {
    console.log("User not logged in, redirecting...");
    window.location.href = "login.html";
  } else if (user && (currentPage === "login.html")) {
    console.log("Already logged in, redirecting to index...");
    window.location.href = "index.html";
  }
});

const logOut = async () => {
  await signOut(auth);
  console.log("Signed out!");
  localStorage.clear();
  window.location.href = "login.html";
};

document.addEventListener("DOMContentLoaded", () => {
  attach("login", signIn);
  attach("register", signUp);
  attach("logout", logOut);
});
