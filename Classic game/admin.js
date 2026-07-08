// ==================== FIREBASE CONFIGURATION ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, updateDoc, deleteDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ✅ DigitalKhataPro (Customer Panel) वाली चाबियां यहाँ डाल दी गई हैं
const firebaseConfig = {
    apiKey: "AIzaSyCzsLxPKdhRpdiy-5tUfDaoyDJzhXP8Kj8",
    authDomain: "digitalkhatapro-b0400.firebaseapp.com",
    projectId: "digitalkhatapro-b0400",
    storageBucket: "digitalkhatapro-b0400.appspot.com",
    messagingSenderId: "320481964196",
    appId: "1:320481964196:web:960fef49b099107d92f631"
};

const app = initializeApp(firebaseConfig, "AdminApp"); 
const auth = getAuth(app);
const db = getFirestore(app);

// ==================== SUPER ADMIN CREDENTIALS ====================
const MASTER_ADMIN_EMAIL = "admin@khata.com"; // इसी ईमेल से एडमिन लॉगिन होगा

// ==================== DOM ELEMENTS ====================
const loginScreen = document.getElementById('admin-login-section');
const dashboardScreen = document.getElementById('admin-dashboard-section');
const loginForm = document.getElementById('admin-login-form');
const shopsListContainer = document.getElementById('shops-list');
const requestsListContainer = document.getElementById('requests-list');

// ==================== 1. SECURE AUTHENTICATION ====================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;

    if (email !== MASTER_ADMIN_EMAIL) {
        alert("Access Denied! You are not authorized. Only Admin is allowed.");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginForm.reset();
    } catch (error) {
        alert("Invalid Admin Credentials! गलत ईमेल या पासवर्ड।");
    }
});

document.getElementById('admin-logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user && user.email === MASTER_ADMIN_EMAIL) {
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        loadAllShops();
        loadPremiumRequests();
    } else {
        loginScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
    }
});

// ==================== 2. LOAD & RENDER SHOPS ====================
function loadAllShops() {
    // 'shops' कलेक्शन से डेटा उठा रहे हैं (Customer panel यहीं डेटा सेव करता है)
    onSnapshot(collection(db, "shops"), (snapshot) => {
        let totalShops = 0;
        let premiumShops = 0;
        shopsListContainer.innerHTML = '';

        if (snapshot.empty) {
            shopsListContainer.innerHTML = '<tr><td colspan="6" style="text-align:center;">No shops registered yet.</td></tr>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const shop = { id: docSnap.id, ...docSnap.data() };
            totalShops++;
            
            const isPremium = shop.plan !== 'Free';
            if (isPremium) premiumShops++;

            const isBlocked = shop.status === 'Blocked';
            const joinDate = shop.joinDate?.toDate ? shop.joinDate.toDate().toLocaleDateString('en-IN') : 'N/A';

            // Table Row Generate करना (admin.html के डिज़ाइन के अनुसार)
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${shop.shopName || 'N/A'}</strong><br><small style="color:#6b7280;">Pass: ${shop.password || 'Hidden'}</small></td>
                <td>${shop.phone || 'N/A'}</td>
                <td><span class="status-badge ${isPremium ? 'status-active' : ''}" style="${!isPremium ? 'background:#e5e7eb; color:#374151;' : 'background:#dbeafe; color:#1e40af;'}">${shop.plan || 'Free'}</span></td>
                <td><span class="status-badge ${isBlocked ? 'status-blocked' : 'status-active'}">${shop.status || 'Active'}</span></td>
                <td>${joinDate}</td>
                <td>
                    ${!isPremium 
                        ? `<button class="action-btn btn-warning" onclick="makePremium('${shop.id}')">★ Pro</button>` 
                        : `<button class="action-btn btn-success" onclick="removePremium('${shop.id}')">✖ Free</button>`}
                    
                    ${!isBlocked 
                        ? `<button class="action-btn btn-danger" onclick="toggleBlock('${shop.id}', 'Blocked')">⊘ Block</button>` 
                        : `<button class="action-btn btn-success" onclick="toggleBlock('${shop.id}', 'Active')">✓ Unblock</button>`}
                    
                    <button class="action-btn" style="background:#1f2937; color:white;" onclick="deleteShop('${shop.id}')">🗑</button>
                </td>
            `;
            shopsListContainer.appendChild(tr);
        });

        document.getElementById('total-shops-count').innerText = totalShops;
        document.getElementById('premium-users-count').innerText = premiumShops;
    }, (error) => {
        console.error("Error loading shops:", error);
    });
}

// ==================== 3. LOAD PREMIUM REQUESTS ====================
function loadPremiumRequests() {
    const q = query(collection(db, "premium_requests"), where("status", "==", "Pending"));
    
    onSnapshot(q, (snapshot) => {
        requestsListContainer.innerHTML = '';
        document.getElementById('pending-requests-count').innerText = snapshot.size;

        if (snapshot.empty) {
            requestsListContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;">No pending requests.</td></tr>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const req = { id: docSnap.id, ...docSnap.data() };
            const reqDate = req.requestDate?.toDate ? req.requestDate.toDate().toLocaleDateString('en-IN') : 'N/A';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${req.shopName}</strong></td>
                <td>${req.phone}</td>
                <td><span style="font-weight:bold; color:#7c3aed;">${req.requestedPlan}</span></td>
                <td>${reqDate}</td>
                <td>
                    <button class="action-btn btn-success" onclick="approveRequest('${req.id}', '${req.shopId}', '${req.requestedPlan}')">✓ Approve</button>
                    <button class="action-btn btn-danger" onclick="rejectRequest('${req.id}')">✖ Reject</button>
                </td>
            `;
            requestsListContainer.appendChild(tr);
        });
    });
}

// ==================== 4. ADMIN ACTIONS (LOGIC SYNCED WITH APP.JS) ====================

// प्रीमियम बनाना (Plan और Limit अपडेट करना)
window.makePremium = async (shopId) => {
    const planChoice = prompt("दुकानदार को कौन सा प्लान देना है?\n1 लिखकर OK करें: Pro Plan (500 Limit)\n2 लिखकर OK करें: Max Plan (1000 Limit)", "1");
    
    let newPlan = "Pro";
    let newLimit = 500;

    if(planChoice === "2") {
        newPlan = "Max";
        newLimit = 1000;
    } else if (planChoice !== "1") {
        return; // Cancel कर दिया
    }

    if(confirm(`क्या आप सच में इस दुकानदार को ${newPlan} Plan में डालना चाहते हैं?`)) {
        await updateDoc(doc(db, "shops", shopId), { plan: newPlan, limit: newLimit });
    }
};

// वापस फ्री में डालना
window.removePremium = async (shopId) => {
    if(confirm("क्या आप इसे वापस Free Plan (100 Limit) में डालना चाहते हैं?")) {
        await updateDoc(doc(db, "shops", shopId), { plan: 'Free', limit: 100 });
    }
};

// ब्लॉक या अनब्लॉक करना
window.toggleBlock = async (shopId, newStatus) => {
    const action = newStatus === 'Blocked' ? "BLOCK" : "UNBLOCK";
    if(confirm(`क्या आप इस अकाउंट को ${action} करना चाहते हैं?`)) {
        await updateDoc(doc(db, "shops", shopId), { status: newStatus });
    }
};

// हमेशा के लिए डिलीट करना
window.deleteShop = async (shopId) => {
    if(confirm("⚠️ चेतावनी: क्या आप इस अकाउंट को हमेशा के लिए डिलीट करना चाहते हैं?")) {
        await deleteDoc(doc(db, "shops", shopId));
    }
};

// ==================== 5. REQUEST APPROVAL ACTIONS ====================

window.approveRequest = async (requestId, shopId, requestedPlan) => {
    if(confirm(`क्या पेमेंट मिल गई है और आप ${requestedPlan} एक्टिवेट करना चाहते हैं?`)) {
        let newPlan = requestedPlan.includes("Max") ? "Max" : "Pro";
        let newLimit = requestedPlan.includes("Max") ? 1000 : 500;

        // 1. Shop का प्लान अपडेट करें
        await updateDoc(doc(db, "shops", shopId), { plan: newPlan, limit: newLimit });
        
        // 2. Request का स्टेटस Approved कर दें
        await updateDoc(doc(db, "premium_requests", requestId), { status: "Approved" });
        alert("Plan Activated Successfully!");
    }
};

window.rejectRequest = async (requestId) => {
    if(confirm("क्या आप इस रिक्वेस्ट को रिजेक्ट करना चाहते हैं?")) {
        await updateDoc(doc(db, "premium_requests", requestId), { status: "Rejected" });
    }
};
