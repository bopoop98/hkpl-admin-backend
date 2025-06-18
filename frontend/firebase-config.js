// frontend/firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyDikFHg3TNUng-I9WgeTWXbO29SKxWNLZE",
    authDomain: "hkplweb.firebaseapp.com",
    projectId: "hkplweb",
    storageBucket: "hkplweb.firebasestorage.app",
    messagingSenderId: "1774261075",
    appId: "1:1774261075:web:cc26aa5d553dfd38ef87a6",
    measurementId: "G-XXXXXXXXXX"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(); // Get the Auth instance for client-side use