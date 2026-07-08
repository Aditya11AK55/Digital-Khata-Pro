// Firebase SDKs Import करें (यह सबसे लेटेस्ट तरीका है)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🚀 यहाँ अपना Firebase Config पेस्ट करें (नया प्रोजेक्ट बनाने के बाद)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// लॉगिन याद रखने की सेटिंग (ताकि बार-बार लॉग इन न करना पड़े)
setPersistence(auth, browserLocalPersistence);

// टॉगल फंक्शन (HTML में बटन क्लिक करने पर काम आएगा)
window.showSignup = () => {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('signup-section').classList.remove('hidden');
};

window.showLogin = () => {
    document.getElementById('signup-section').classList.add('hidden');
    document.getElementById('login-section').classList.remove('hidden');
};

// साइन-अप लॉजिक
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const shopName = document.getElementById('signup-shop').value;
    const phone = document.getElementById('signup-phone').value;
    const password = document.getElementById('signup-password').value;
    const pin = document.getElementById('signup-pin').value;
    
    // डमी ईमेल बनाना (क्योंकि Firebase ईमेल मांगता है)
    const email = `${phone}@digitalkhata.com`;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "shops", userCredential.user.uid), {
            shopName, phone, pin, createdAt: new Date()
        });
        alert("अकाउंट बन गया! अब लॉगिन करें।");
        showLogin();
    } catch (err) {
        alert("Error: " + err.message);
    }
});

// लॉगिन लॉजिक
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    const email = `${phone}@digitalkhata.com`;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        alert("लॉगिन सफल!");
        // यहाँ से हम डैशबोर्ड स्क्रीन दिखाएंगे
    } catch (err) {
        alert("गलत नंबर या पासवर्ड!");
    }
});
