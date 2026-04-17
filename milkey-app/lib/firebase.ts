// Firebase JS SDK config for Expo (works in Expo Go via expo-firebase-recaptcha)
// Project: milkeyapp — values mirror google-services.json
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
    apiKey: 'AIzaSyB5Vd38Z7LKI4o4ped6xt9gnabwgngiALk',
    authDomain: 'milkeyapp.firebaseapp.com',
    projectId: 'milkeyapp',
    storageBucket: 'milkeyapp.firebasestorage.app',
    messagingSenderId: '835983322060',
    appId: '1:835983322060:android:e3ba5212d68a99fcb90b69',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export default app;
