import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCX_lsJou0xiJux8IV34tBBwtpRBEzTpsk",
  authDomain: "vogue-parrucchieri-37962.firebaseapp.com",
  projectId: "vogue-hairdressers-37962",
  storageBucket: "vogue-parrucchieri-37962.firebasestorage.app",
  messagingSenderId: "797408634647",
  appId: "1:797408634647:web:aa3da66e340e8e25617952"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);