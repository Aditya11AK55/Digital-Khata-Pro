import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, collection, updateDoc, deleteDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// --- Admin Login Logic ---
document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        alert("Invalid Admin Credentials! " + err.message);
    }
});

document.getElementById('admin-logout-btn').addEventListener('click', () => {
    signOut(auth);
});

// --- Auth State Change ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('admin-login-section').classList.add('hidden');
        document.getElementById('admin-dashboard-section').classList.remove('hidden');
        loadAdminData(); 
    } else {
        document.getElementById('admin-dashboard-section').classList.add('hidden');
        document.getElementById('admin-login-section').classList.remove('hidden');
    }
});

// --- Load Dashboard Data ---
const loadAdminData = () => {
    
    // 1. Load Premium Requests (Pending)
    const qRequests = query(collection(db, "premium_requests"), where("status", "==", "Pending"));
    onSnapshot(qRequests, (snapshot) => {
        const requestsList = document.getElementById('requests-list');
        requestsList.innerHTML = '';
        document.getElementById('pending-requests-count').innerText = snapshot.size;

        if (snapshot.empty) {
            requestsList.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#6b7280;">No pending requests right now.</td></tr>`;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const dateStr = data.requestDate.toDate ? data.requestDate.toDate().toLocaleString('en-IN') : new Date(data.requestDate).toLocaleString('en-IN');
            
            requestsList.innerHTML += `
                <tr>
                    <td><strong>${data.shopName}</strong></td>
                    <td>${data.phone}</td>
                    <td style="color: #4f46e5; font-weight:bold;">${data.requestedPlan} (₹${data.price})</td>
                    <td style="font-size: 12px; color: #6b7280;">${dateStr}</td>
                    <td>
                        <button class="action-btn btn-success" onclick="approvePlan('${docSnap.id}', '${data.shopId}', '${data.requestedPlan}')">Approve</button>
                    </td>
                </tr>
            `;
        });
    });

    // 2. Load All Shops Data
    const qShops = collection(db, "shops");
    onSnapshot(qShops, (snapshot) => {
        const shopsList = document.getElementById('shops-list');
        shopsList.innerHTML = '';
        
        let totalShops = snapshot.size;
        let premiumUsers = 0;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.plan !== 'Free') premiumUsers++;
            
            const dateStr = data.joinDate && data.joinDate.toDate ? data.joinDate.toDate().toLocaleDateString('en-IN') : 'N/A';
            const statusClass = data.status === 'Blocked' ? 'status-blocked' : 'status-active';
            const statusText = data.status || 'Active';
            const blockActionText = data.status === 'Blocked' ? 'Unblock' : 'Block';
            const blockActionClass = data.status === 'Blocked' ? 'btn-success' : 'btn-warning';
            
            const displayContact = `${data.phone}<br><small style="color:#6b7280;">${data.email || 'No Email'}</small>`;

            shopsList.innerHTML += `
                <tr>
                    <td><strong>${data.shopName}</strong></td>
                    <td>${displayContact}</td>
                    <td style="font-weight: bold; color: ${data.plan === 'Free' ? '#10b981' : '#4f46e5'}">${data.plan}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td style="font-size: 12px;">${dateStr}</td>
                    <td>
                        <button class="action-btn ${blockActionClass}" onclick="toggleBlockStatus('${docSnap.id}', '${statusText}')">${blockActionText}</button>
                        <button class="action-btn btn-danger" onclick="deleteShop('${docSnap.id}', '${data.shopName}', '${data.phone}')">Delete</button>
                    </td>
                </tr>
            `;
        });

        document.getElementById('total-shops-count').innerText = totalShops;
        document.getElementById('premium-users-count').innerText = premiumUsers;
    });
};

// --- Action Functions (Updated with New Plans) ---

window.approvePlan = async (requestId, shopId, planName) => {
    if(!confirm(`Are you sure you have received payment and want to approve ${planName}?`)) return;
    
    let newLimit = 100;
    let finalPlanName = 'Free';

    // New Pricing Logic
    if(planName.includes('Starter') || planName.includes('249')) {
        newLimit = 500;
        finalPlanName = 'Starter Plan';
    } else if (planName.includes('Pro') || planName.includes('499')) {
        newLimit = 1000;
        finalPlanName = 'Pro Plan';
    } else if (planName.includes('Advanced') || planName.includes('749')) {
        newLimit = 1500;
        finalPlanName = 'Advanced Plan';
    } else if (planName.includes('Unlimited') || planName.includes('999')) {
        newLimit = 9999999; // 99 Lakh limit means practically Unlimited
        finalPlanName = 'Unlimited Plan';
    }

    try {
        // Update shop plan & limit
        await updateDoc(doc(db, "shops", shopId), {
            plan: finalPlanName,
            limit: newLimit
        });

        // Mark request as Approved
        await updateDoc(doc(db, "premium_requests", requestId), {
            status: "Approved"
        });

        alert("Plan upgraded successfully!");
    } catch(err) {
        alert("Error approving plan: " + err.message);
    }
};

window.toggleBlockStatus = async (shopId, currentStatus) => {
    const newStatus = currentStatus === 'Blocked' ? 'Active' : 'Blocked';
    const msg = currentStatus === 'Blocked' ? 'Unblock this user?' : 'Block this user? They will not be able to access their dashboard.';
    if(!confirm(msg)) return;

    try { await updateDoc(doc(db, "shops", shopId), { status: newStatus }); } 
    catch(err) { alert("Error changing status: " + err.message); }
};

window.deleteShop = async (shopId, shopName, phone) => {
    if(!confirm(`WARNING: Are you sure you want to PERMANENTLY DELETE "${shopName}" from database?`)) return;
    
    try {
        await deleteDoc(doc(db, "shops", shopId));
        if(phone) { await deleteDoc(doc(db, "phone_mapping", phone)); }
        alert("Shop database record deleted successfully.");
    } catch(err) {
        alert("Error deleting shop: " + err.message);
    }
};
        
