import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, collection, updateDoc, deleteDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- Firebase Config (Same as app.js) ---
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

// --- Auth State Change (Check if Admin) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Admin Access (Yahan aap apna personal admin email set kar sakte hain)
        // Abhi ke liye hum assume kar rahe hain ki jo yahan login karega wo admin hai.
        document.getElementById('admin-login-section').classList.add('hidden');
        document.getElementById('admin-dashboard-section').classList.remove('hidden');
        
        loadAdminData(); // Load all tables and stats
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

            shopsList.innerHTML += `
                <tr>
                    <td><strong>${data.shopName}</strong></td>
                    <td>${data.phone}</td>
                    <td style="font-weight: bold; color: ${data.plan === 'Free' ? '#10b981' : '#4f46e5'}">${data.plan}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td style="font-size: 12px;">${dateStr}</td>
                    <td>
                        <button class="action-btn ${blockActionClass}" onclick="toggleBlockStatus('${docSnap.id}', '${statusText}')">${blockActionText}</button>
                        <button class="action-btn btn-danger" onclick="deleteShop('${docSnap.id}', '${data.shopName}')">Delete</button>
                    </td>
                </tr>
            `;
        });

        // Update Top Stats
        document.getElementById('total-shops-count').innerText = totalShops;
        document.getElementById('premium-users-count').innerText = premiumUsers;
    });
};

// --- Action Functions (Made global to attach to inline HTML onclick) ---

window.approvePlan = async (requestId, shopId, planName) => {
    if(!confirm(`Are you sure you have received payment and want to approve ${planName}?`)) return;
    
    // Determine limit based on plan name
    let newLimit = 100;
    let finalPlanName = 'Free';

    if(planName.includes('Pro Plan') || planName.includes('399')) {
        newLimit = 500;
        finalPlanName = 'Pro Plan';
    } else if (planName.includes('Max Plan') || planName.includes('699')) {
        newLimit = 1000;
        finalPlanName = 'Max Plan';
    }

    try {
        // 1. Update Shop's Plan & Limit
        await updateDoc(doc(db, "shops", shopId), {
            plan: finalPlanName,
            limit: newLimit
        });

        // 2. Mark Request as Approved
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

    try {
        await updateDoc(doc(db, "shops", shopId), {
            status: newStatus
        });
    } catch(err) {
        alert("Error changing status: " + err.message);
    }
};

window.deleteShop = async (shopId, shopName) => {
    if(!confirm(`WARNING: Are you sure you want to PERMANENTLY DELETE the database record for "${shopName}"?`)) return;
    
    try {
        await deleteDoc(doc(db, "shops", shopId));
        alert("Shop database record deleted successfully.");
    } catch(err) {
        alert("Error deleting shop: " + err.message);
    }
};
              
