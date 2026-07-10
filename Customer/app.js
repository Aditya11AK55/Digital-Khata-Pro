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
let showHidden = false; // Toggle for hidden transactions
let trxUnsubscribe = null;
let currentShopData = null;

// --- Helper Functions ---
window.showSignup = () => { document.getElementById('login-section').classList.add('hidden'); document.getElementById('signup-section').classList.remove('hidden'); };
window.showLogin = () => { document.getElementById('signup-section').classList.add('hidden'); document.getElementById('forgot-password-section').classList.add('hidden'); document.getElementById('login-section').classList.remove('hidden'); };
window.showForgotPassword = () => { document.getElementById('login-section').classList.add('hidden'); document.getElementById('forgot-password-section').classList.remove('hidden'); };
window.closeModal = () => document.getElementById('add-customer-modal').classList.add('hidden');
window.closeTrxModal = () => document.getElementById('transaction-modal').classList.add('hidden');
window.closePremiumModal = () => document.getElementById('premium-modal').classList.add('hidden');
window.closeChangePasswordModal = () => document.getElementById('change-password-modal').classList.add('hidden');

// --- WhatsApp Share ---
document.getElementById('btn-whatsapp-share').addEventListener('click', () => {
    const cust = allCustomers.find(c => c.id === currentCustomerId);
    const msg = `Namaste ${cust.name}, your total balance in Digital Khata is ₹${cust.balance}. Please clear it soon.`;
    window.open(`https://wa.me/91${cust.phone}?text=${encodeURIComponent(msg)}`);
});

// --- Edit Customer ---
document.getElementById('btn-edit-cust').addEventListener('click', () => {
    const cust = allCustomers.find(c => c.id === currentCustomerId);
    document.getElementById('edit-cust-name').value = cust.name;
    document.getElementById('edit-cust-phone').value = cust.phone;
    document.getElementById('edit-customer-modal').classList.remove('hidden');
});

document.getElementById('save-edit-btn').addEventListener('click', async () => {
    await updateDoc(doc(db, "customers", currentCustomerId), { 
        name: document.getElementById('edit-cust-name').value, 
        phone: document.getElementById('edit-cust-phone').value 
    });
    document.getElementById('edit-customer-modal').classList.add('hidden');
});

// --- Hide Transaction Logic ---
window.toggleHidden = async (trxId, currentBalance, trxAmount, type) => {
    if(!confirm("Hide this transaction?")) return;
    
    // Reverse balance logic
    let adjustment = (type === 'credit') ? -trxAmount : trxAmount;
    await updateDoc(doc(db, "customers", currentCustomerId), { balance: currentBalance + adjustment });
    await updateDoc(doc(db, "customers", currentCustomerId, "transactions", trxId), { hidden: true });
};

// --- Updated Premium Request Handling ---
const requestPremiumPlan = async (planName, price) => {
    await addDoc(collection(db, "premium_requests"), {
        shopId: auth.currentUser.uid, shopName: currentShopData.shopName, phone: currentShopData.phone,
        requestedPlan: planName, price: price, requestDate: new Date(), status: "Pending"
    });
    alert("Request sent! Support will contact you shortly.");
    window.closePremiumModal();
};

document.getElementById('btn-plan-249').addEventListener('click', () => requestPremiumPlan('Starter Plan (500)', 249));
document.getElementById('btn-plan-499').addEventListener('click', () => requestPremiumPlan('Pro Plan (1000)', 499));
document.getElementById('btn-plan-749').addEventListener('click', () => requestPremiumPlan('Advanced Plan (1500)', 749));
document.getElementById('btn-plan-999').addEventListener('click', () => requestPremiumPlan('Unlimited Plan', 999));

// --- Transactions Listener ---
const loadTransactions = (custId) => {
    const q = query(collection(db, "customers", custId, "transactions"), orderBy("date", "desc"));
    if (trxUnsubscribe) trxUnsubscribe();
    trxUnsubscribe = onSnapshot(q, (snapshot) => {
        const list = document.getElementById('transaction-list');
        list.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.hidden && !showHidden) return;
            
            const color = data.type === 'credit' ? '#ef4444' : '#10b981';
            list.innerHTML += `
                <div class="trx-item" style="opacity: ${data.hidden ? 0.5 : 1}">
                    <strong>${data.type === 'credit' ? 'Credit' : 'Payment'}</strong>
                    <div style="color:${color}">${data.type === 'credit' ? '+' : '-'}₹${data.amount}</div>
                    ${!data.hidden ? `<button onclick="toggleHidden('${doc.id}', ${allCustomers.find(c=>c.id==custId).balance}, ${data.amount}, '${data.type}')">Hide</button>` : ''}
                </div>`;
        });
    });
};

document.getElementById('toggle-hidden-trx').addEventListener('click', () => {
    showHidden = !showHidden;
    document.getElementById('toggle-hidden-trx').innerText = showHidden ? "Hide Cancelled" : "Show Hidden";
    loadTransactions(currentCustomerId);
});

// --- Settings & Auth Logic ---
document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('modal-plan-info').innerText = currentShopData.plan + " Plan";
    document.getElementById('settings-modal').classList.remove('hidden');
});

document.getElementById('change-pass-modal-btn').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
    document.getElementById('change-password-modal').classList.remove('hidden');
});

// [ बाकी का Auth और Customer Logic पिछले कोड जैसा ही है... ]
// सुनिश्चित करें कि आप पिछले कोड का पूरा हिस्सा यहाँ जोड़ लें। 
        
