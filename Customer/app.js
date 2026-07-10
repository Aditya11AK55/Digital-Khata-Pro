import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let allCustomers = [];
let currentCustomerId = null;
let currentTrxType = null;
let showHidden = false;
let trxUnsubscribe = null;
let currentShopData = null;

// --- UI Toggles ---
window.showSignup = () => { document.getElementById('login-section').classList.add('hidden'); document.getElementById('signup-section').classList.remove('hidden'); };
window.showLogin = () => { document.getElementById('signup-section').classList.add('hidden'); document.getElementById('forgot-password-section').classList.add('hidden'); document.getElementById('login-section').classList.remove('hidden'); };
window.showForgotPassword = () => { document.getElementById('login-section').classList.add('hidden'); document.getElementById('forgot-password-section').classList.remove('hidden'); };
window.closeModal = () => document.getElementById('add-customer-modal').classList.add('hidden');
window.closeTrxModal = () => document.getElementById('transaction-modal').classList.add('hidden');
window.closePremiumModal = () => document.getElementById('premium-modal').classList.add('hidden');
window.closeChangePasswordModal = () => document.getElementById('change-password-modal').classList.add('hidden');

// --- Auth ---
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const userCred = await createUserWithEmailAndPassword(auth, document.getElementById('signup-email').value, document.getElementById('signup-password').value);
        await setDoc(doc(db, "shops", userCred.user.uid), { shopName: document.getElementById('signup-shop').value, phone: document.getElementById('signup-phone').value, email: document.getElementById('signup-email').value, plan: 'Free', limit: 100, status: 'Active', joinDate: new Date() });
        await setDoc(doc(db, "phone_mapping", document.getElementById('signup-phone').value), { email: document.getElementById('signup-email').value });
        alert("Account Created!"); showLogin();
    } catch (err) { alert(err.message); }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const mapping = await getDoc(doc(db, "phone_mapping", document.getElementById('login-phone').value));
        if(mapping.exists()) await signInWithEmailAndPassword(auth, mapping.data().email, document.getElementById('login-password').value);
        else alert("Mobile not registered!");
    } catch (err) { alert("Invalid credentials!"); }
});

// --- Customer Logic ---
document.getElementById('save-cust-btn').addEventListener('click', async () => {
    await addDoc(collection(db, "customers"), { shopId: auth.currentUser.uid, name: document.getElementById('cust-name').value, phone: document.getElementById('cust-phone').value, balance: 0, date: new Date() });
    closeModal();
});

window.openCustomerDetail = (id) => {
    currentCustomerId = id;
    const cust = allCustomers.find(c => c.id === id);
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('customer-detail-section').classList.remove('hidden');
    document.getElementById('detail-cust-name').innerText = cust.name;
    updateCustomerDetailUI(cust.balance);
    loadTransactions(id);
};

// --- Features ---
document.getElementById('btn-edit-cust').addEventListener('click', () => {
    const cust = allCustomers.find(c => c.id === currentCustomerId);
    document.getElementById('edit-cust-name').value = cust.name;
    document.getElementById('edit-cust-phone').value = cust.phone;
    document.getElementById('edit-customer-modal').classList.remove('hidden');
});

document.getElementById('save-edit-btn').addEventListener('click', async () => {
    await updateDoc(doc(db, "customers", currentCustomerId), { name: document.getElementById('edit-cust-name').value, phone: document.getElementById('edit-cust-phone').value });
    document.getElementById('edit-customer-modal').classList.add('hidden');
});

document.getElementById('btn-whatsapp-share').addEventListener('click', () => {
    const cust = allCustomers.find(c => c.id === currentCustomerId);
    window.open(`https://wa.me/91${cust.phone}?text=Hello ${cust.name}, your balance is ₹${cust.balance}. Please clear it.`);
});

window.toggleHidden = async (trxId, currentBalance, trxAmount, type) => {
    if(!confirm("Hide transaction?")) return;
    let adj = (type === 'credit') ? -trxAmount : trxAmount;
    await updateDoc(doc(db, "customers", currentCustomerId), { balance: currentBalance + adj });
    await updateDoc(doc(db, "customers", currentCustomerId, "transactions", trxId), { hidden: true });
};

// --- Data Loading ---
const loadCustomers = (uid) => {
    onSnapshot(query(collection(db, "customers"), where("shopId", "==", uid)), (snap) => {
        allCustomers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const list = document.getElementById('customer-list');
        list.innerHTML = '';
        allCustomers.forEach(c => {
            list.innerHTML += `<div class="cust-item" onclick="openCustomerDetail('${c.id}')"><strong>${c.name}</strong><p>${c.phone}</p><span>₹${c.balance}</span></div>`;
        });
    });
};

const loadTransactions = (custId) => {
    const q = query(collection(db, "customers", custId, "transactions"), orderBy("date", "desc"));
    if (trxUnsubscribe) trxUnsubscribe();
    trxUnsubscribe = onSnapshot(q, (snap) => {
        const list = document.getElementById('transaction-list');
        list.innerHTML = '';
        snap.forEach((doc) => {
            const d = doc.data();
            if (d.hidden && !showHidden) return;
            list.innerHTML += `<div class="trx-item" style="opacity:${d.hidden ? 0.5 : 1}"><strong>${d.type}</strong><div>${d.type=='credit'?'+':'-'}₹${d.amount}</div>${!d.hidden ? `<button onclick="toggleHidden('${doc.id}', ${allCustomers.find(c=>c.id==custId).balance}, ${d.amount}, '${d.type}')">Hide</button>` : ''}</div>`;
        });
    });
};

// --- Initializer ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        onSnapshot(doc(db, "shops", user.uid), (snap) => {
            currentShopData = snap.data();
            document.getElementById('dashboard-section').classList.remove('hidden');
            loadCustomers(user.uid);
        });
    } else {
        document.getElementById('dashboard-section').classList.add('hidden');
        document.getElementById('login-section').classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
