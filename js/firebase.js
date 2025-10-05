import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC8EDj6sgNPs9t_ff7ci9wa9NRkGYYCcIo",
  authDomain: "homeworkck.firebaseapp.com",
  projectId: "homeworkck",
  storageBucket: "homeworkck.firebasestorage.app",
  messagingSenderId: "10938421705",
  appId: "1:10938421705:web:1997e7563dd62891745818"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);