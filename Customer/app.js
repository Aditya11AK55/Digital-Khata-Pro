import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
let currentTrxType = null; // 'credit' या 'payment'
let trxUnsubscribe = null; // Transaction listener ko rokne ke liye

// --- UI Toggle Functions ---
window.showSignup = () => {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('signup-section').classList.remove('hidden');
};

window.showLogin = () => {
    document.getElementById('signup-section').classList.add('hidden');
    document.getElementById('login-section').classList.remove('hidden');
};

window.openModal = () => document.getElementById('add-customer-modal').classList.remove('hidden');
window.closeModal = () => document.getElementById('add-customer-modal').classList.add('hidden');

window.closeTrxModal = () => {
    document.getElementById('transaction-modal').classList.add('hidden');
    document.getElementById('trx-amount').value = '';
    document.getElementById('trx-note').value = '';
}

// --- Auth Logic ---
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const shopName = document.getElementById('signup-shop').value;
    const phone = document.getElementById('signup-phone').value;
    const password = document.getElementById('signup-password').value;
    const pin = document.getElementById('signup-pin').value;
    const email = `${phone}@digitalkhata.com`;

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
    let totalDue = 0;
    let totalAdvance = 0;

    allCustomers.forEach(c => {
        if (c.balance > 0) totalDue += c.balance;
        else if (c.balance < 0) totalAdvance += Math.abs(c.balance);
    });

    document.getElementById('total-due').innerText = `₹${totalDue}`;
    document.getElementById('total-advance').innerText = `₹${totalAdvance}`;
};

// --- Customer Render Logic ---
const renderCustomers = (customers) => {
    const list = document.getElementById('customer-list');
    list.innerHTML = '';
    customers.forEach((data) => {
        // Left me Amount, Right me Name aur Number
        let amountHtml = '';
        if (data.balance > 0) {
            amountHtml = `<span style="color:#ef4444; font-weight:bold; font-size:18px;">₹${data.balance}</span><br><small style="color:#ef4444;">बाकी</small>`;
        } else if (data.balance < 0) {
            amountHtml = `<span style="color:#10b981; font-weight:bold; font-size:18px;">ADV ₹${Math.abs(data.balance)}</span><br><small style="color:#10b981;">जमा है</small>`;
        } else {
            amountHtml = `<span style="color:#6b7280; font-weight:bold; font-size:18px;">₹0</span>`;
        }

        list.innerHTML += `
            <div class="cust-item" onclick="openCustomerDetail('${data.id}')">
                <div class="left-amount">${amountHtml}</div>
                <div class="right-info">
                    <strong>${data.name}</strong>
                    <p>${data.phone}</p>
                </div>
            </div>
        `;
    });
};

// --- Customer Detail & Transaction Logic ---
window.openCustomerDetail = (custId) => {
    currentCustomerId = custId;
    const customer = allCustomers.find(c => c.id === custId);
    
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('customer-detail-section').classList.remove('hidden');
    
    document.getElementById('detail-cust-name').innerText = customer.name;
    updateCustomerDetailUI(customer.balance);
    
    loadTransactions(custId);
};

const updateCustomerDetailUI = (balance) => {
    const balanceEl = document.getElementById('detail-balance');
    const statusEl = document.getElementById('detail-status');
    
    if (balance > 0) {
        balanceEl.innerText = `₹${balance}`;
        balanceEl.style.color = "#ef4444";
        statusEl.innerText = "ग्राहक को देने हैं (बाकी)";
    } else if (balance < 0) {
        balanceEl.innerText = `₹${Math.abs(balance)}`;
        balanceEl.style.color = "#10b981";
        statusEl.innerText = "एडवांस जमा है (ADV)";
    } else {
        balanceEl.innerText = `₹0`;
        balanceEl.style.color = "#1f2937";
        statusEl.innerText = "कोई हिसाब बाकी नहीं";
    }
};

document.getElementById('back-btn').addEventListener('click', () => {
    document.getElementById('customer-detail-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    if (trxUnsubscribe) trxUnsubscribe(); // Purane listener ko band karna
});

// Transaction Modal Openers
document.getElementById('btn-give-credit').addEventListener('click', () => {
    currentTrxType = 'credit';
    document.getElementById('trx-modal-title').innerText = "उधार दें (Credit)";
    document.getElementById('transaction-modal').classList.remove('hidden');
});

document.getElementById('btn-receive-payment').addEventListener('click', () => {
    currentTrxType = 'payment';
    document.getElementById('trx-modal-title').innerText = "पैसे लें (Payment)";
    document.getElementById('transaction-modal').classList.remove('hidden');
});

// Save Transaction
document.getElementById('save-trx-btn').addEventListener('click', async () => {
    const amount = Number(document.getElementById('trx-amount').value);
    const note = document.getElementById('trx-note').value;

    if (!amount || amount <= 0) { alert("Sahi amount daalein!"); return; }

    const customer = allCustomers.find(c => c.id === currentCustomerId);
    let newBalance = customer.balance || 0;

    // Logic: Credit = balance badhega, Payment = balance ghatega
    if (currentTrxType === 'credit') {
        newBalance += amount;
    } else {
        newBalance -= amount;
    }

    try {
        // 1. Transaction history me add karein
        await addDoc(collection(db, `customers/${currentCustomerId}/transactions`), {
            amount: amount,
            type: currentTrxType,
            note: note,
            date: new Date()
        });

        // 2. Customer ka main balance update karein
        await updateDoc(doc(db, "customers", currentCustomerId), {
            balance: newBalance
        });

        closeTrxModal();
    } catch (err) { alert("Transaction save karne me error aayi!"); }
});

const loadTransactions = (custId) => {
    const q = query(collection(db, `customers/${custId}/transactions`), orderBy("date", "desc"));
    
    if (trxUnsubscribe) trxUnsubscribe(); 

    trxUnsubscribe = onSnapshot(q, (snapshot) => {
        const list = document.getElementById('transaction-list');
        list.innerHTML = '';
        
        if(snapshot.empty) {
            list.innerHTML = '<p style="text-align:center; color:#6b7280;">No transactions yet.</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const dateStr = data.date.toDate ? data.date.toDate().toLocaleString('en-IN') : new Date(data.date).toLocaleString('en-IN');
            
            const isCredit = data.type === 'credit';
            const color = isCredit ? '#ef4444' : '#10b981';
            const sign = isCredit ? '+' : '-';
            const title = isCredit ? 'उधार दिया' : 'पैसे मिले';

            list.innerHTML += `
                <div class="trx-item">
                    <div class="trx-details">
                        <strong>${title}</strong>
                        <p class="trx-date">${dateStr}</p>
                        ${data.note ? `<p class="trx-note">📝 ${data.note}</p>` : ''}
                    </div>
                    <div class="trx-amount" style="color:${color}; font-weight:bold;">
                        ${sign}₹${data.amount}
                    </div>
                </div>
            `;
        });
    });
};

// --- Add New Customer Logic ---
document.getElementById('add-cust-btn').addEventListener('click', openModal);

document.getElementById('save-cust-btn').addEventListener('click', async () => {
    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value; // Ab Amount ki jagah Phone lega

    if(!name || !phone) { alert("Please fill all details!"); return; }

    try {
        await addDoc(collection(db, "customers"), {
            shopId: auth.currentUser.uid,
            name: name,
            phone: phone,
            balance: 0, // Naya customer, toh balance 0
            date: new Date()
        });
        closeModal();
        document.getElementById('cust-name').value = '';
        document.getElementById('cust-phone').value = '';
    } catch (e) { alert("Error adding customer!"); }
});

// --- Search & Load Customers Logic ---
const loadCustomers = (uid) => {
    const q = query(collection(db, "customers"), where("shopId", "==", uid));
    onSnapshot(q, (snapshot) => {
        allCustomers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Agar detail page khula hai toh waha ka balance bhi live update ho
        if(currentCustomerId && !document.getElementById('customer-detail-section').classList.contains('hidden')){
            const updatedCust = allCustomers.find(c => c.id === currentCustomerId);
            if(updatedCust) updateCustomerDetailUI(updatedCust.balance);
        }

        renderCustomers(allCustomers);
        updateStats();
    });
};

document.getElementById('search-customer').addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    const filtered = allCustomers.filter(c => c.name.toLowerCase().includes(term) || c.phone.includes(term));
    renderCustomers(filtered);
});

// --- Initialization Logic ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('signup-section').classList.add('hidden');
        document.getElementById('customer-detail-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');

        const shopDoc = await getDoc(doc(db, "shops", user.uid));
        if (shopDoc.exists()) {
            document.getElementById('shop-name-display').innerText = shopDoc.data().shopName;
        }
        loadCustomers(user.uid);
    } else {
        document.getElementById('dashboard-section').classList.add('hidden');
        document.getElementById('customer-detail-section').classList.add('hidden');
        document.getElementById('login-section').classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
                                                                  
