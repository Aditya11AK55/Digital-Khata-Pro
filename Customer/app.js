import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyCzsLxPKdhRpdiy-5tUfDaoyDJzhXP8Kj8",
    authDomain: "digitalkhatapro-b0400.firebaseapp.com",
    projectId: "digitalkhatapro-b0400",
    storageBucket: "digitalkhatapro-b0400.appspot.com",
    messagingSenderId: "320481964196",
    appId: "1:320481964196:web:960fef49b099107d92f631"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// customers ko yaha cache karke rakhenge, taaki search aur totals
// bina baar baar Firestore query kiye calculate ho sakein
let allCustomers = [];

// --- UI Toggle Functions ---
window.showSignup = () => {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('signup-section').classList.remove('hidden');
};

window.showLogin = () => {
    document.getElementById('signup-section').classList.add('hidden');
    document.getElementById('login-section').classList.remove('hidden');
};

// Modal functions
window.openModal = () => document.getElementById('add-customer-modal').classList.remove('hidden');
window.closeModal = () => document.getElementById('add-customer-modal').classList.add('hidden');

// --- Auth Logic ---
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const shopName = document.getElementById('signup-shop').value;
    const phone = document.getElementById('signup-phone').value;
    const password = document.getElementById('signup-password').value;
    const pin = document.getElementById('signup-pin').value;
    const email = `${phone}@digitalkhata.com`;

    // PIN hamesha exactly 4 digit ka hona chahiye (number field me leading
    // zero jaise "0512" ki value "512" ban jaati hai, isliye string length check zaroori hai)
    if (!/^\d{4}$/.test(pin)) {
        alert("Recovery PIN exactly 4 digit ka hona chahiye!");
        return;
    }

    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "shops", userCred.user.uid), { shopName, phone, pin });
        alert("Account created successfully! Please login.");
        showLogin();
    } catch (err) { alert("Error: " + err.message); }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, `${phone}@digitalkhata.com`, password);
    } catch (err) { alert("Invalid mobile number or password!"); }
});

// --- Stats Logic ---
const updateStats = () => {
    const totalDue = allCustomers.reduce((sum, c) => sum + Number(c.due || 0), 0);

    const today = new Date();
    const todayCollection = allCustomers.reduce((sum, c) => {
        if (c.lastPaymentDate) {
            const paidOn = c.lastPaymentDate.toDate ? c.lastPaymentDate.toDate() : new Date(c.lastPaymentDate);
            if (paidOn.toDateString() === today.toDateString()) {
                sum += Number(c.lastPaymentAmount || 0);
            }
        }
        return sum;
    }, 0);

    document.getElementById('total-due').innerText = `₹${totalDue}`;
    document.getElementById('today-collection').innerText = `₹${todayCollection}`;
};

// --- Customer Render Logic ---
const renderCustomers = (customers) => {
    const list = document.getElementById('customer-list');
    list.innerHTML = '';
    customers.forEach((data) => {
        list.innerHTML += `
            <div class="cust-item" style="background:white; color:black; padding:15px; margin:10px 0; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                <span>${data.name}</span>
                <span style="display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:bold; color:#e11d48;">₹${data.due}</span>
                    <button class="collect-btn" data-id="${data.id}" data-due="${data.due}" style="background:#10b981; color:white; border:none; border-radius:6px; padding:5px 10px; cursor:pointer;">Collect</button>
                </span>
            </div>
        `;
    });

    // Collect button ke liye event listeners (innerHTML dobara likhne ke baad har baar attach karne padte hain)
    document.querySelectorAll('.collect-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const custId = btn.dataset.id;
            const currentDue = Number(btn.dataset.due);
            const amountStr = prompt("Kitni rashi jama karni hai?");
            if (amountStr === null) return;
            const amount = Number(amountStr);
            if (!amount || amount <= 0) { alert("Sahi amount daalein!"); return; }

            const newDue = Math.max(0, currentDue - amount);
            try {
                await updateDoc(doc(db, "customers", custId), {
                    due: newDue,
                    lastPaymentAmount: amount,
                    lastPaymentDate: new Date()
                });
            } catch (err) { alert("Payment update karne me error aayi!"); }
        });
    });
};

// --- Customer Logic ---
const loadCustomers = (uid) => {
    const q = query(collection(db, "customers"), where("shopId", "==", uid));
    onSnapshot(q, (snapshot) => {
        allCustomers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCustomers(allCustomers);
        updateStats();
    });
};

// --- Search Logic ---
document.getElementById('search-customer').addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    const filtered = allCustomers.filter(c => c.name.toLowerCase().includes(term));
    renderCustomers(filtered);
});

document.getElementById('add-cust-btn').addEventListener('click', openModal);

document.getElementById('save-cust-btn').addEventListener('click', async () => {
    const name = document.getElementById('cust-name').value;
    const due = document.getElementById('cust-due').value;

    if(!name || !due) { alert("Please fill all details!"); return; }

    try {
        await addDoc(collection(db, "customers"), {
            shopId: auth.currentUser.uid,
            name: name,
            due: Number(due), // string ki jagah number save karna zaroori, warna total galat aayega
            date: new Date()
        });
        alert("Customer added successfully!");
        closeModal();
        document.getElementById('cust-name').value = '';
        document.getElementById('cust-due').value = '';
    } catch (e) { alert("Error adding customer!"); }
});

// --- Dashboard Logic ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('signup-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');

        const shopDoc = await getDoc(doc(db, "shops", user.uid));
        if (shopDoc.exists()) {
            document.getElementById('shop-name-display').innerText = shopDoc.data().shopName;
        }
        loadCustomers(user.uid);
    } else {
        document.getElementById('dashboard-section').classList.add('hidden');
        document.getElementById('login-section').classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        
