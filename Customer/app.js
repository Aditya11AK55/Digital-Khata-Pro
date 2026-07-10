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
let trxUnsubscribe = null; 
let currentShopData = null;

// --- UI Toggle Functions ---
window.showSignup = () => {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('forgot-password-section').classList.add('hidden');
    document.getElementById('signup-section').classList.remove('hidden');
};

window.showLogin = () => {
    document.getElementById('signup-section').classList.add('hidden');
    document.getElementById('forgot-password-section').classList.add('hidden');
    document.getElementById('login-section').classList.remove('hidden');
};

window.showForgotPassword = () => {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('forgot-password-section').classList.remove('hidden');
    document.getElementById('recovered-password-display').classList.add('hidden');
    document.getElementById('forgot-email').value = '';
};

window.openModal = () => document.getElementById('add-customer-modal').classList.remove('hidden');
window.closeModal = () => document.getElementById('add-customer-modal').classList.add('hidden');
window.closeTrxModal = () => {
    document.getElementById('transaction-modal').classList.add('hidden');
    document.getElementById('trx-amount').value = '';
    document.getElementById('trx-note').value = '';
}
window.closePremiumModal = () => document.getElementById('premium-modal').classList.add('hidden');
window.closeChangePasswordModal = () => {
    document.getElementById('change-password-modal').classList.add('hidden');
    document.getElementById('new-password-input').value = '';
};

// --- Auth Logic (Email for Auth, Phone mapped in background) ---
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const shopName = document.getElementById('signup-shop').value;
    const phone = document.getElementById('signup-phone').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        // 1. Create account using Email & Password
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        
        // 2. Save Main Profile
        await setDoc(doc(db, "shops", userCred.user.uid), { 
            shopName: shopName, 
            phone: phone, 
            email: email, 
            plan: 'Free',
            limit: 100,
            status: 'Active', 
            joinDate: new Date()
        });

        // 3. Save Phone-to-Email mapping (For smart login)
        await setDoc(doc(db, "phone_mapping", phone), {
            email: email
        });
        
        alert("Account created successfully! Please login.");
        showLogin();
    } catch (err) { alert("Error: " + err.message); }
});

// --- Smart Login Logic (Enter Phone -> Finds Email -> Logs in) ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    
    try {
        // Background search for email using phone number
        const mappingDoc = await getDoc(doc(db, "phone_mapping", phone));
        
        if(mappingDoc.exists()) {
            const userEmail = mappingDoc.data().email;
            // Now login with the actual email
            await signInWithEmailAndPassword(auth, userEmail, password);
        } else {
            alert("Mobile number not registered!");
        }
    } catch (err) { 
        alert("Invalid mobile number or password!"); 
    }
});

// --- Forgot Password Logic (Official Firebase Email Link) ---
document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;

    try {
        await sendPasswordResetEmail(auth, email);
        document.getElementById('recovered-password-display').classList.remove('hidden');
    } catch(err) {
        alert("Error sending reset link: " + err.message);
    }
});

// --- Change Password Logic (Dashboard) ---
document.getElementById('change-pass-btn').addEventListener('click', () => {
    document.getElementById('change-password-modal').classList.remove('hidden');
});

document.getElementById('save-new-password-btn').addEventListener('click', async () => {
    const newPass = document.getElementById('new-password-input').value;
    if(newPass.length < 6) { alert("Password must be at least 6 characters."); return; }
    try {
        await updatePassword(auth.currentUser, newPass);
        alert("Password updated successfully!");
        window.closeChangePasswordModal();
    } catch(err) { alert("Error updating password: " + err.message); }
});

// --- Stats Logic ---
const updateStats = () => {
    let totalDue = 0;
    let todayCollection = 0;
    const todayStr = new Date().toDateString();

    allCustomers.forEach(c => {
        if (c.balance > 0) totalDue += c.balance;
        if (c.lastPaymentDate) {
            const payDateStr = c.lastPaymentDate.toDate ? c.lastPaymentDate.toDate().toDateString() : new Date(c.lastPaymentDate).toDateString();
            if (payDateStr === todayStr) {
                todayCollection += (c.todayCollectionAmount || 0);
            }
        }
    });

    document.getElementById('total-due').innerText = `₹${totalDue}`;
    document.getElementById('today-collection').innerText = `₹${todayCollection}`;
};

// --- Customer Render Logic ---
const renderCustomers = (customers) => {
    const list = document.getElementById('customer-list');
    list.innerHTML = '';
    customers.forEach((data) => {
        let amountHtml = '';
        if (data.balance > 0) amountHtml = `<span style="color:#ef4444; font-weight:bold; font-size:18px;">₹${data.balance}</span><br><small style="color:#ef4444; font-weight:600;">Due</small>`;
        else if (data.balance < 0) amountHtml = `<span style="color:#10b981; font-weight:bold; font-size:18px;">₹${Math.abs(data.balance)}</span><br><small style="color:#10b981; font-weight:600;">Advance</small>`;
        else amountHtml = `<span style="color:#6b7280; font-weight:bold; font-size:18px;">₹0</span><br><small style="color:#6b7280; font-weight:600;">Settled</small>`;

        const displayPhone = (data.phone && data.phone !== 'undefined') ? data.phone : 'No Number';
        list.innerHTML += `
            <div class="cust-item" onclick="openCustomerDetail('${data.id}')">
                <div class="cust-info"><strong>${data.name}</strong><p>${displayPhone}</p></div>
                <div class="cust-amount">${amountHtml}</div>
            </div>
        `;
    });
};

// --- Add Customer Logic (With Premium Paywall Check) ---
document.getElementById('add-cust-btn').addEventListener('click', () => {
    if(currentShopData) {
        if(allCustomers.length >= currentShopData.limit) document.getElementById('premium-modal').classList.remove('hidden');
        else openModal();
    }
});

document.getElementById('save-cust-btn').addEventListener('click', async () => {
    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value; 
    if(!name || !phone) { alert("Please fill all details!"); return; }
    try {
        await addDoc(collection(db, "customers"), { shopId: auth.currentUser.uid, name: name, phone: phone, balance: 0, date: new Date() });
        closeModal();
        document.getElementById('cust-name').value = '';
        document.getElementById('cust-phone').value = '';
    } catch (e) { alert("Error adding customer: " + e.message); }
});

// --- Premium Request Handling ---
const requestPremiumPlan = async (planName, price) => {
    try {
        await addDoc(collection(db, "premium_requests"), {
            shopId: auth.currentUser.uid,
            shopName: currentShopData.shopName,
            phone: currentShopData.phone,
            requestedPlan: planName,
            price: price,
            requestDate: new Date(),
            status: "Pending"
        });
        alert("Your request has been sent! Our support team will contact you on your registered mobile number shortly for activation.");
        window.closePremiumModal();
    } catch(e) { alert("Error sending request: " + e.message); }
};

document.getElementById('btn-plan-399').addEventListener('click', () => requestPremiumPlan('Pro Plan (500)', 399));
document.getElementById('btn-plan-699').addEventListener('click', () => requestPremiumPlan('Max Plan (1000)', 699));

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
    const safeBalance = balance || 0; 
    if (safeBalance > 0) { balanceEl.innerText = `₹${safeBalance}`; balanceEl.style.color = "#ef4444"; statusEl.innerText = "To Collect (Due)"; }
    else if (safeBalance < 0) { balanceEl.innerText = `₹${Math.abs(safeBalance)}`; balanceEl.style.color = "#10b981"; statusEl.innerText = "Advance Received (ADV)"; }
    else { balanceEl.innerText = `₹0`; balanceEl.style.color = "#1f2937"; statusEl.innerText = "No Pending Balance"; }
};

document.getElementById('back-btn').addEventListener('click', () => {
    document.getElementById('customer-detail-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    if (trxUnsubscribe) trxUnsubscribe(); 
});

document.getElementById('btn-give-credit').addEventListener('click', () => {
    currentTrxType = 'credit';
    document.getElementById('trx-modal-title').innerText = "Give Credit";
    document.getElementById('transaction-modal').classList.remove('hidden');
});

document.getElementById('btn-receive-payment').addEventListener('click', () => {
    currentTrxType = 'payment';
    document.getElementById('trx-modal-title').innerText = "Receive Payment";
    document.getElementById('transaction-modal').classList.remove('hidden');
});

document.getElementById('save-trx-btn').addEventListener('click', async () => {
    try {
        const amount = Number(document.getElementById('trx-amount').value);
        const note = document.getElementById('trx-note').value;
        if (!amount || amount <= 0) { alert("Please enter a valid amount!"); return; }
        if (!currentCustomerId) return;
        const customer = allCustomers.find(c => c.id === currentCustomerId);
        if (!customer) return;

        let newBalance = customer.balance || 0;
        const today = new Date();
        const todayStr = today.toDateString();
        let updateData = {};

        if (currentTrxType === 'credit') {
            newBalance += amount;
            updateData = { balance: newBalance };
        } else {
            newBalance -= amount;
            let newTodayAmount = amount;
            if (customer.lastPaymentDate) {
                const payDateStr = customer.lastPaymentDate.toDate ? customer.lastPaymentDate.toDate().toDateString() : new Date(customer.lastPaymentDate).toDateString();
                if (payDateStr === todayStr) newTodayAmount = (customer.todayCollectionAmount || 0) + amount;
            }
            updateData = { balance: newBalance, lastPaymentDate: today, todayCollectionAmount: newTodayAmount };
        }

        await addDoc(collection(db, "customers", currentCustomerId, "transactions"), { amount: amount, type: currentTrxType, note: note, date: today });
        await updateDoc(doc(db, "customers", currentCustomerId), updateData);
        closeTrxModal();
    } catch (err) { alert("Transaction Failed! Reason: " + err.message); }
});

const loadTransactions = (custId) => {
    const q = query(collection(db, "customers", custId, "transactions"), orderBy("date", "desc"));
    if (trxUnsubscribe) trxUnsubscribe(); 
    trxUnsubscribe = onSnapshot(q, (snapshot) => {
        const list = document.getElementById('transaction-list');
        list.innerHTML = '';
        if(snapshot.empty) { list.innerHTML = '<p style="text-align:center; color:#e0e7ff; margin-top:20px;">No transactions yet.</p>'; return; }
        snapshot.forEach((doc) => {
            const data = doc.data();
            const dateStr = data.date.toDate ? data.date.toDate().toLocaleString('en-IN') : new Date(data.date).toLocaleString('en-IN');
            const isCredit = data.type === 'credit';
            const color = isCredit ? '#ef4444' : '#10b981';
            const sign = isCredit ? '+' : '-';
            const title = isCredit ? 'Credit Given' : 'Payment Received';

            list.innerHTML += `
                <div class="trx-item">
                    <div class="trx-details">
                        <strong>${title}</strong><p class="trx-date">${dateStr}</p>${data.note ? `<p class="trx-note">📝 ${data.note}</p>` : ''}
                    </div>
                    <div class="trx-amount" style="color:${color}; font-weight:bold;">${sign}₹${data.amount}</div>
                </div>
            `;
        });
    });
};

const loadCustomers = (uid) => {
    const q = query(collection(db, "customers"), where("shopId", "==", uid));
    onSnapshot(q, (snapshot) => {
        allCustomers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if(currentCustomerId && !document.getElementById('customer-detail-section').classList.contains('hidden')){
            const updatedCust = allCustomers.find(c => c.id === currentCustomerId);
            if(updatedCust) updateCustomerDetailUI(updatedCust.balance);
        }
        renderCustomers(allCustomers);
        updateStats();
    });
};

// --- Initialization Logic ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        onSnapshot(doc(db, "shops", user.uid), (shopDoc) => {
            if (shopDoc.exists()) {
                currentShopData = shopDoc.data();
                document.getElementById('login-section').classList.add('hidden');
                document.getElementById('signup-section').classList.add('hidden');
                document.getElementById('forgot-password-section').classList.add('hidden');

                if (currentShopData.status === 'Blocked') {
                    document.getElementById('dashboard-section').classList.add('hidden');
                    document.getElementById('customer-detail-section').classList.add('hidden');
                    document.getElementById('blocked-section').classList.remove('hidden');
                } else {
                    document.getElementById('blocked-section').classList.add('hidden');
                    document.getElementById('dashboard-section').classList.remove('hidden');
                    document.getElementById('shop-name-display').innerText = currentShopData.shopName;
                    
                    const planInfo = document.getElementById('plan-info');
                    planInfo.innerText = `${currentShopData.plan} Plan`;
                    if(currentShopData.plan === 'Free') { planInfo.style.color = "#10b981"; planInfo.style.background = "rgba(16, 185, 129, 0.1)"; } 
                    else { planInfo.style.color = "#4f46e5"; planInfo.style.background = "rgba(79, 70, 229, 0.1)"; }
                    
                    loadCustomers(user.uid);
                }
            }
        });
    } else {
        document.getElementById('dashboard-section').classList.add('hidden');
        document.getElementById('customer-detail-section').classList.add('hidden');
        document.getElementById('blocked-section').classList.add('hidden');
        document.getElementById('login-section').classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('logout-blocked-btn').addEventListener('click', () => signOut(auth));
                 
