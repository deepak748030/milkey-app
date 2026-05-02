// Firebase initialization for Milkey app (Firebase JS SDK only).
// NOTE: We removed `expo-firebase-recaptcha` (deprecated since Expo SDK 48)
// and the `firebase/compat` shim it depended on. Phone OTP is now handled
// server-side (see /api/auth/send-phone-otp + /api/auth/phone-login).
// Firebase JS SDK is still kept for future Google sign-in / ID token flows.
import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Publishable client-side identifiers (safe to ship). Sourced from google-services.json
// (project: milkey-72381, package: com.milkey.app). Keep these in sync whenever the
// google-services.json is regenerated from Firebase console.
export const firebaseConfig: FirebaseOptions = {
    apiKey: 'AIzaSyALlGiMy-qMIvLUT5rB1PKQbG2Cm03B0Ts',
    authDomain: 'milkey-72381.firebaseapp.com',
    projectId: 'milkey-72381',
    storageBucket: 'milkey-72381.firebasestorage.app',
    messagingSenderId: '95043026756',
    appId: '1:95043026756:android:6383a95e8ad4ce2b412111',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
