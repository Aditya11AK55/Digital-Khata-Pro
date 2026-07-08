// ==================== FIREBASE CONFIGURATION ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD7dprFu5MIL4EgW0lJ0EkbBZeNguF4d3c",
    authDomain: "digital-khata-64fa9.firebaseapp.com",
    projectId: "digital-khata-64fa9",
    storageBucket: "digital-khata-64fa9.firebasestorage.app",
    messagingSenderId: "942531584479",
    appId: "1:942531584479:web:571ff0eff5e0b1c266e46a"
};

// 🚀 MASTER STROKE: यहाँ "AdminApp" नाम देकर हमने दोनों का कनेक्शन हमेशा के लिए तोड़ दिया!
const app = initializeApp(firebaseConfig, "AdminApp"); 
const auth = getAuth(app);
const db = getFirestore(app);

// ==================== SUPER ADMIN CREDENTIALS ====================
// यही वह ईमेल है जिससे आपका एडमिन पैनल खुलेगा
const MASTER_ADMIN_EMAIL = "admin@khata.com"; 

// ==================== DOM ELEMENTS ====================
const loginScreen = document.getElementById('admin-login-screen');
const dashboardScreen = document.getElementById('admin-dashboard-screen');
const loginForm = document.getElementById('admin-login-form');
const shopsListContainer = document.getElementById('admin-shops-list');
const searchInput = document.getElementById('admin-search-shop');

let allShopsData = [];

// ==================== 1. SECURE AUTHENTICATION ====================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;

    // सुरक्षा चेक: अगर ईमेल admin@khata.com नहीं है, तो तुरंत बाहर निकाल दो
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
    // सिर्फ तभी अंदर जाने दो जब यूजर लॉगिन हो और उसका ईमेल एडमिन वाला हो
    if (user && user.email === MASTER_ADMIN_EMAIL) {
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        loadAllShops();
    } else {
        loginScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
    }
});

// ==================== 2. LOAD & RENDER SHOPS ====================
function loadAllShops() {
    onSnapshot(collection(db, "khata_shops"), (snapshot) => {
        allShopsData = [];
        let totalShops = 0;
        let premiumShops = 0;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            allShopsData.push({ id: docSnap.id, ...data });
            
            totalShops++;
            if (data.isPremium) premiumShops++;
        });

        document.getElementById('total-shops-count').innerText = totalShops;
        document.getElementById('premium-shops-count').innerText = premiumShops;

        renderShops(allShopsData);
    }, (error) => {
        console.error("Error loading shops:", error);
    });
}

function renderShops(shopsArray) {
    shopsListContainer.innerHTML = '';

    if (shopsArray.length === 0) {
        shopsListContainer.innerHTML = '<div class="empty-state">No shops registered yet.</div>';
        return;
    }

    shopsArray.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    shopsArray.forEach(shop => {
        const isBlocked = shop.isBlocked || false;
        const isPremium = shop.isPremium || false;

        let badgeHTML = '';
        if (isBlocked) {
            badgeHTML = `<span class="badge badge-blocked" style="background:#dc2626; color:white; padding:2px 8px; border-radius:10px; font-size:12px;">Blocked</span>`;
        } else if (isPremium) {
            badgeHTML = `<span class="badge badge-premium" style="background:#f59e0b; color:white; padding:2px 8px; border-radius:10px; font-size:12px;">Premium</span>`;
        } else {
            badgeHTML = `<span class="badge badge-free" style="background:#10b981; color:white; padding:2px 8px; border-radius:10px; font-size:12px;">Free</span>`;
        }

        const card = document.createElement('div');
        card.style.cssText = "background:white; padding:15px; margin-bottom:15px; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.05);";
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <h4 style="margin:0;">${shop.shopName}</h4>
                ${badgeHTML}
            </div>
            <div style="font-size:13px; color:#4b5563; line-height:1.6; margin-bottom:15px;">
                <p><strong>Phone:</strong> ${shop.phone}</p>
                <p><strong>Password:</strong> ${shop.password || 'Hidden'}</p>
            </div>
            <div style="display:flex; gap:10px;">
                ${!isPremium 
                    ? `<button style="flex:1; padding:8px; background:#f59e0b; color:white; border:none; border-radius:8px; cursor:pointer;" onclick="makePremium('${shop.id}')">★ Premium</button>` 
                    : `<button style="flex:1; padding:8px; background:#9ca3af; color:white; border:none; border-radius:8px; cursor:pointer;" onclick="removePremium('${shop.id}')">✖ Free</button>`}
                
                ${!isBlocked 
                    ? `<button style="flex:1; padding:8px; background:#dc2626; color:white; border:none; border-radius:8px; cursor:pointer;" onclick="toggleBlock('${shop.id}', true)">⊘ Block</button>` 
                    : `<button style="flex:1; padding:8px; background:#10b981; color:white; border:none; border-radius:8px; cursor:pointer;" onclick="toggleBlock('${shop.id}', false)">✓ Unblock</button>`}
                
                <button style="padding:8px 12px; background:#1f2937; color:white; border:none; border-radius:8px; cursor:pointer;" onclick="deleteShop('${shop.id}')">🗑</button>
            </div>
        `;
        shopsListContainer.appendChild(card);
    });
}

// ==================== 3. SEARCH FUNCTIONALITY ====================
searchInput.addEventListener('input', (e) => {
    const queryText = e.target.value.toLowerCase();
    const filteredShops = allShopsData.filter(shop => 
        (shop.shopName && shop.shopName.toLowerCase().includes(queryText)) || 
        (shop.phone && shop.phone.includes(queryText))
    );
    renderShops(filteredShops);
});

// ==================== 4. ADMIN ACTIONS ====================
window.makePremium = async (shopId) => {
    if(confirm("क्या आप सच में इस दुकानदार को Premium बनाना चाहते हैं?")) {
        await updateDoc(doc(db, "khata_shops", shopId), { isPremium: true });
    }
};

window.removePremium = async (shopId) => {
    if(confirm("क्या आप इसे वापस Free Plan में डालना चाहते हैं?")) {
        await updateDoc(doc(db, "khata_shops", shopId), { isPremium: false });
    }
};

window.toggleBlock = async (shopId, blockStatus) => {
    const action = blockStatus ? "BLOCK" : "UNBLOCK";
    if(confirm(`क्या आप इस दुकानदार का अकाउंट ${action} करना चाहते हैं?`)) {
        await updateDoc(doc(db, "khata_shops", shopId), { isBlocked: blockStatus });
    }
};

window.deleteShop = async (shopId) => {
    if(confirm("⚠️ चेतावनी: क्या आप इस अकाउंट को हमेशा के लिए डिलीट करना चाहते हैं?")) {
        await deleteDoc(doc(db, "khata_shops", shopId));
    }
};
                                                                                                                                                                     
