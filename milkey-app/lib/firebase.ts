// Firebase initialization for Milkey app.
// Required by expo-firebase-recaptcha (web) and firebase/auth phone sign-in.
import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

// NOTE: These values are publishable client-side identifiers (safe to ship).
// Sourced from milkey-app/google-services.json (project: milkeyapp).
export const firebaseConfig: FirebaseOptions = {
    apiKey: 'AIzaSyB5Vd38Z7LKI4o4ped6xt9gnabwgngiALk',
    authDomain: 'milkeyapp.firebaseapp.com',
    projectId: 'milkeyapp',
    storageBucket: 'milkeyapp.firebasestorage.app',
    messagingSenderId: '835983322060',
    appId: '1:835983322060:android:e3ba5212d68a99fcb90b69',
};

// Initialize the modern SDK for direct app usage.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

// Also initialize the compat default app because expo-firebase-recaptcha.web
// internally uses Firebase compat APIs and expects a [DEFAULT] compat app.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

export const firebaseCompatApp = firebase.app();
