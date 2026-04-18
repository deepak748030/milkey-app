// Firebase initialization for Milkey app (Firebase JS SDK only).
// NOTE: We removed `expo-firebase-recaptcha` (deprecated since Expo SDK 48)
// and the `firebase/compat` shim it depended on. Phone OTP is now handled
// server-side (see /api/auth/send-phone-otp + /api/auth/phone-login).
// Firebase JS SDK is still kept for future Google sign-in / ID token flows.
import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Publishable client-side identifiers (safe to ship). Sourced from google-services.json.
export const firebaseConfig: FirebaseOptions = {
    apiKey: 'AIzaSyB5Vd38Z7LKI4o4ped6xt9gnabwgngiALk',
    authDomain: 'milkeyapp.firebaseapp.com',
    projectId: 'milkeyapp',
    storageBucket: 'milkeyapp.firebasestorage.app',
    messagingSenderId: '835983322060',
    appId: '1:835983322060:android:e3ba5212d68a99fcb90b69',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
