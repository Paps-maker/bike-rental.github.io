
 // main.js

const firebaseConfig = {
  apiKey: "AIzaSyDS83HjWpOSH6BCd3_0w8Lv7_3MgQzw_h0",
  authDomain: "liquor-b1ef2.firebaseapp.com",
  projectId: "liquor-b1ef2",
  storageBucket: "liquor-b1ef2.appspot.com",
  messagingSenderId: "6903039541",
  appId: "1:6903039541:web:d552a2b11b6aca8ff8937c",
  measurementId: "G-F1M9JJT5B4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Attach core services to window for global access
window.auth = firebase.auth();
window.db = firebase.firestore();
function toFraction(val) {
    const decimal = parseFloat(val);
    if (isNaN(decimal)) return "0";
    if (decimal % 1 === 0) return decimal.toString();
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const len = decimal.toString().split('.')[1]?.length || 0;
    const denominator = Math.pow(10, len);
    const numerator = decimal * denominator;
    const divisor = gcd(numerator, denominator);
    return `${numerator / divisor}/${denominator / divisor}`;
}

// --- GLOBAL VARIABLES ---
window.productsCache = [];
window.requisitionItems = [];
window.currentExpectedSales = 0;
window.currentRole = "staff"; // Attached to window for easier access

/* --- AUTH ELEMENTS --- */
const loginSection = document.getElementById("loginSection");
const dashboard = document.getElementById("dashboard");
const loginBtn = document.getElementById("loginBtn");
const loginEmail = document.getElementById("loginEmail");
const loginPass = document.getElementById("loginPass");
const loginMsg = document.getElementById("loginMsg");
const logoutBtn = document.getElementById("logoutBtn");
const roleBadge = document.getElementById("roleBadge");

/**
 * Updates UI visibility based on user role.
 */
function updateUIByRole(role) {
    window.currentRole = role || "staff";
    if (roleBadge) roleBadge.textContent = window.currentRole.toUpperCase();
    
    document.querySelectorAll(".admin-only").forEach(el => {
        el.classList.toggle("d-none", window.currentRole !== "admin");
    });
}

/* --- AUTH LOGIC --- */
loginBtn.onclick = async () => {
  try {
    const userCredential = await window.auth.signInWithEmailAndPassword(loginEmail.value, loginPass.value);
    const token = await userCredential.user.getIdTokenResult(true);
    updateUIByRole(token.claims.role);
    
    loginSection.classList.add("d-none");
    dashboard.classList.remove("d-none");
    if (typeof initDashboard === 'function') initDashboard();
  } catch(e) { 
    if (loginMsg) loginMsg.textContent = e.message; 
  }
};

logoutBtn.onclick = () => {
  window.auth.signOut();
};

/* Auth State Observer */
window.auth.onAuthStateChanged(async (user) => {
  if (user) {
    const token = await user.getIdTokenResult(true);
    updateUIByRole(token.claims.role);
    
    loginSection.classList.add("d-none");
    dashboard.classList.remove("d-none");
    if (typeof initDashboard === 'function') initDashboard();
  } else {
    dashboard.classList.add("d-none");
    loginSection.classList.remove("d-none");
  }
});
/* Initialize Dashboard */
function initDashboard() {
 /* --- Products Management & Quick Restock --- */

const prodName = document.getElementById("prodName");
const todaysSalesEl = document.getElementById("todaysSales");
    const monthlySalesEl = document.getElementById("monthlySales");
const prodBuyPrice = document.getElementById("prodBuyPrice");
const prodPrice = document.getElementById("prodPrice");
const prodStock = document.getElementById("prodStock");
const prodMin = document.getElementById("prodMin");
const addProductBtn = document.getElementById("addProductBtn");
const productsTable = document.getElementById("productsTable");
let editProductId = null;

/* --- GLOBAL HELPERS --- */
window.toFraction = function(val) {
    const decimal = parseFloat(val);
    if (isNaN(decimal)) return "0";
    if (decimal % 1 === 0) return decimal.toString();
    
    // Round to handle floating point noise
    const rounded = Math.round(decimal * 1000) / 1000;
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    
    const denominator = 1000;
    const numerator = Math.round(rounded * denominator);
    const divisor = gcd(numerator, denominator);
    
    return `${numerator / divisor}/${denominator / divisor}`;
};

window.toMixedFraction = function(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return "0";
    const whole = Math.floor(num);
    const fraction = num - whole;
    
    if (fraction === 0) return whole.toString();
    
    // Use the existing toFraction helper for the decimal part
    const fracStr = window.toFraction(fraction);
    return whole > 0 ? `${whole} ${fracStr}` : fracStr;
};

/* --- PRODUCT MANAGEMENT (Updated for Fractions) --- */

// 1. Add Product
addProductBtn.onclick = async () => {
    if (currentRole !== "admin") return Swal.fire("Access Denied", "Admins only", "error");
    if (!prodName.value || !prodPrice.value || !prodStock.value) return;

    await db.collection("products").add({
        name: prodName.value,
        buyPrice: parseFloat(prodBuyPrice.value) || 0,
        price: parseFloat(prodPrice.value) || 0,
        stock: parseFloat(prodStock.value) || 0, // Using parseFloat
        min: parseFloat(prodMin.value) || 0      // Using parseFloat
    });
    Swal.fire("Success!", "Product added", "success");
    prodName.value = prodPrice.value = prodBuyPrice.value = prodStock.value = prodMin.value = "";
};

// 2. Quick Restock
window.quickRestock = async (productId, productName) => {
    const inputEl = document.getElementById(`restockInput-${productId}`);
    const amountToAdd = parseFloat(inputEl.value); 

    if (!amountToAdd || amountToAdd <= 0) return Swal.fire("Invalid", "Enter valid quantity", "warning");

    await db.collection("products").doc(productId).update({
        stock: firebase.firestore.FieldValue.increment(amountToAdd)
    });
    
    inputEl.value = ""; 
    Swal.fire("Restocked!", `Added to ${productName}`, "success");
};

// 3. Save Edit
document.getElementById("saveEditBtn").onclick = async () => {
    if (!editProductId) return;
    await db.collection("products").doc(editProductId).update({
        name: document.getElementById("editProdName").value,
        buyPrice: parseFloat(document.getElementById("editProdBuyingPrice").value) || 0,
        price: parseFloat(document.getElementById("editProdPrice").value),
        stock: parseFloat(document.getElementById("editProdStock").value), 
        min: parseFloat(document.getElementById("editProdMin").value) || 0
    });
    Swal.fire("Updated!", "Product details saved.", "success");
};
// First render function: Includes Inventory Adjustment and Reason Input
function renderProducts(docs) {
    const productsHead = document.getElementById("productsHead");
    const productsTable = document.getElementById("productsTable");
    const lowStockBadge = document.getElementById("lowStockBadge");
    const lowStockWrapper = document.getElementById("lowStockWrapper");
    
    productsTable.innerHTML = "";
    let lowStockItems = [];

    // 1. Build Header
    let headerHTML = `<tr><th>Name</th>`;
    if (currentRole === "admin") headerHTML += `<th>Buy</th>`;
    headerHTML += `<th>Sell</th><th>Stock</th><th>Min</th>`;
    if (currentRole === "admin") headerHTML += `<th>Inventory Adjustment</th><th>Actions</th>`;
    headerHTML += `</tr>`;
    productsHead.innerHTML = headerHTML;

    // 2. Sort and Build Body
    const sortedDocs = [...docs].sort((a, b) => a.data().name.localeCompare(b.data().name));

    sortedDocs.forEach(doc => {
        const p = doc.data();
        if (p.stock <= p.min) lowStockItems.push(p);
        
        let row = `<tr><td>${p.name}</td>`;
        if (currentRole === "admin") row += `<td>KSh ${p.buyPrice || 0}</td>`;
        row += `<td>KSh ${p.price}</td><td>${p.stock}</td><td>${p.min}</td>`;
        
        if (currentRole === "admin") {
            row += `
            <td>
                <div class="input-group input-group-sm" style="width: 250px;">
                    <input type="number" id="restockInput-${doc.id}" class="form-control" placeholder="Qty" style="max-width: 60px;">
                    <input type="text" id="reasonInput-${doc.id}" class="form-control" placeholder="Reason (e.g. Sale/Stock In)" style="max-width: 100px;">
                    <button class="btn btn-sm btn-success" onclick="window.adjustStock('${doc.id}', '${p.name}', 'add')">+</button>
                    <button class="btn btn-sm btn-danger" onclick="window.adjustStock('${doc.id}', '${p.name}', 'reduce')">-</button>
                </div>
            </td>
            <td>
                <button class="btn btn-sm btn-warning editBtn" data-id="${doc.id}">Edit</button>
                <button class="btn btn-sm btn-danger delBtn" data-id="${doc.id}">Delete</button>
            </td>`;
        }
        row += `</tr>`;
        productsTable.innerHTML += row;
    });

    if (lowStockBadge && lowStockWrapper) {
        lowStockBadge.textContent = lowStockItems.length;
        lowStockWrapper.style.display = lowStockItems.length > 0 ? "" : "none";
    }
}

// 5. Initialize
db.collection("products").onSnapshot(snap => {
    productsCache = snap.docs;
    renderProducts(productsCache);
    document.getElementById("productCount").textContent = snap.size;

   // --- CALCULATION LOGIC ---
let totalCost = 0;
let totalExpected = 0;

snap.docs.forEach(doc => {
    const p = doc.data();
    // Changed parseInt to parseFloat to support fractional stock
    const stock = parseFloat(p.stock) || 0;
    totalCost += (parseFloat(p.buyPrice) || 0) * stock;
    totalExpected += (parseFloat(p.price) || 0) * stock;
});

document.getElementById("totalBuyValue").textContent = `KSh ${totalCost.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
document.getElementById("totalSellValue").textContent = `KSh ${totalExpected.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    // 1. Add Search Input listener
    const searchInput = document.getElementById("searchInput");
    searchInput.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = productsCache.filter(doc => {
            const name = doc.data().name || "";
            return name.toLowerCase().includes(term);
        });
        renderProducts(filtered);
    });
    
    // Update the UI
    document.getElementById("totalBuyValue").textContent = `KSh ${totalCost.toLocaleString()}`;
    document.getElementById("totalSellValue").textContent = `KSh ${totalExpected.toLocaleString()}`;

    // --- CRITICAL UPDATE: Set the dynamic target for the Sales listener ---
    currentExpectedSales = totalExpected * 0.5; 

    // --- UPDATE POS DROPDOWN ---
    const posProduct = document.getElementById("posProduct");
    if (posProduct) {
        posProduct.innerHTML = "";
        snap.docs.forEach(doc => {
            const p = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = `${p.name} - KSh ${p.price}`;
            option.dataset.price = p.price;
            posProduct.appendChild(option);
        });
    }

    // --- UPDATE REQUISITION DROPDOWN ---
    const stockProductSelect = document.getElementById("stockProductSelect");
    if (stockProductSelect) {
        stockProductSelect.innerHTML = snap.docs.map(doc => 
            `<option value="${doc.id}">${doc.data().name}</option>`
        ).join('');
    }
});

// Second render function: Includes Quick Restock logic
function renderProducts(docs) {
    const productsHead = document.getElementById("productsHead");
    const productsTable = document.getElementById("productsTable");
    const lowStockBadge = document.getElementById("lowStockBadge");
    const lowStockWrapper = document.getElementById("lowStockWrapper");
    
    productsTable.innerHTML = "";
    let lowStockItems = [];

    // 1. Build Header Dynamically
    let headerHTML = `<tr><th>Name</th>`;
    if (currentRole === "admin") headerHTML += `<th>Buy</th>`;
    headerHTML += `<th>Sell</th><th>Stock</th><th>Min</th>`;
    
    // Add Restock column for Admins
    if (currentRole === "admin") headerHTML += `<th>Quick Restock</th><th>Actions</th>`;
    headerHTML += `</tr>`;
    productsHead.innerHTML = headerHTML;

    // 2. Sort and Build Body
    const sortedDocs = [...docs].sort((a, b) => 
      a.data().name.localeCompare(b.data().name)
    );

    sortedDocs.forEach(doc => {
      const p = doc.data();
      if (p.stock <= p.min) lowStockItems.push(p);
      
      let row = `<tr><td>${p.name}</td>`;
      
      if (currentRole === "admin") {
        row += `<td>KSh ${p.buyPrice || 0}</td>`;
      }
      
      row += `<td>KSh ${p.price}</td>
        <td>${toMixedFraction(p.stock)}</td>
        <td>${toMixedFraction(p.min)}</td>`;
      
      // Admin: Add Restock input + Edit/Delete buttons
      if (currentRole === "admin") {
        row += `
          <td>
            <div class="input-group input-group-sm" style="width: 130px;">
                <input type="number" id="restockInput-${doc.id}" class="form-control" placeholder="Qty">
                <button class="btn btn-sm btn-success" onclick="window.quickRestock('${doc.id}', '${p.name}')">+</button>
            </div>
          </td>
          <td>
            <button class="btn btn-sm btn-warning editBtn" data-id="${doc.id}">Edit</button>
            <button class="btn btn-sm btn-danger delBtn" data-id="${doc.id}">Delete</button>
          </td>`;
      }
      row += `</tr>`;
      productsTable.innerHTML += row;
    });

    // 3. Update Low Stock Badge and Modal Logic
    if (lowStockBadge) lowStockBadge.textContent = lowStockItems.length;

    if (lowStockWrapper) {
      lowStockWrapper.style.display = lowStockItems.length > 0 ? "" : "none";
      lowStockWrapper.style.cursor = "pointer";
      lowStockWrapper.onclick = () => {
        const modalBody = document.querySelector("#lowStockModal .modal-body");
        if (modalBody) {
          modalBody.innerHTML = lowStockItems.length > 0 
            ? lowStockItems.map(p => `<p><strong>${p.name}</strong>: ${p.stock} remaining</p>`).join('')
            : "<p>All stock levels are healthy.</p>";
          new bootstrap.Modal(document.getElementById("lowStockModal")).show();
        }
      };
    }

 // 3. Attach Listeners ONLY if Admin
if (currentRole === "admin") {
  document.querySelectorAll(".delBtn").forEach(btn => {
    btn.onclick = async () => { 
      const id = btn.dataset.id;
      const docRef = db.collection("products").doc(id);
      
      // Get the product name from your existing 'docs' array
      const product = docs.find(d => d.id === id).data();
      const productName = product.name || "this product";

      // Using SweetAlert2 for a custom popup
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: `You are about to delete "${productName}". This cannot be undone!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
      });

      if (result.isConfirmed) {
        // Capture data before deleting
        const productData = product;
        
        await docRef.delete(); 

        // Show Undo toast/popup with product name
        const toast = await Swal.fire({
          title: 'Deleted!',
          text: `"${productName}" has been deleted.`,
          icon: 'success',
          showCancelButton: true,
          cancelButtonText: 'Undo',
          confirmButtonText: 'OK'
        });

        // If they click "Undo"
        if (toast.dismiss === Swal.DismissReason.cancel) {
          await docRef.set(productData);
          Swal.fire('Restored!', `"${productName}" has been restored.`, 'success');
        }
      }
    };
  });

  document.querySelectorAll(".editBtn").forEach(btn => {
    btn.onclick = () => {
      editProductId = btn.dataset.id;
      const p = docs.find(d => d.id === editProductId).data();
        // Ensure these IDs match your HTML exactly
        document.getElementById("editProdName").value = p.name;
        document.getElementById("editProdBuyingPrice").value = p.buyPrice || 0; // Updated ID
        document.getElementById("editProdPrice").value = p.price;
        document.getElementById("editProdStock").value = p.stock;
        document.getElementById("editProdMin").value = p.min;
        
        // Use Bootstrap's instance manager to show the modal
        const editModal = new bootstrap.Modal(document.getElementById("editProductModal"));
        editModal.show();
    };
});
  }
 }

  /* Customers */
  const custName=document.getElementById("custName");
  const custPhone=document.getElementById("custPhone");
  const addCustomerBtn=document.getElementById("addCustomerBtn");
  const customersTable=document.getElementById("customersTable");
  const posCustomer=document.getElementById("posCustomer");

  addCustomerBtn.onclick=async()=>{
    if(!custName.value||!custPhone.value) return;
    await db.collection("customers").add({name:custName.value, phone:custPhone.value});
    custName.value=custPhone.value="";
  };

  /* Customers Listener */
db.collection("customers").onSnapshot(snap => {
    customersTable.innerHTML = "";
    
    // 1. Reset dropdown to Guest FIRST
    posCustomer.innerHTML = '<option value="">Guest</option>';
    
    snap.forEach(doc => {
        const c = doc.data();
        
        // Populate Table
        let actions = "";
        if(currentRole === "admin") {
            actions = `<button class="btn btn-sm btn-danger delCustBtn" data-id="${doc.id}">Delete</button>`;
        }
        customersTable.innerHTML += `<tr>
            <td>${c.name}</td><td>${c.phone}</td><td>${actions}</td>
        </tr>`;

        // 2. Add customer to dropdown
        const option = document.createElement("option");
        option.value = doc.id; 
        option.textContent = c.name;
        posCustomer.appendChild(option);
    });

    if(currentRole === "admin"){
        document.querySelectorAll(".delCustBtn").forEach(btn => {
            btn.onclick = async() => { await db.collection("customers").doc(btn.dataset.id).delete(); };
        });
    }
    document.getElementById("customerCount").textContent = snap.size;
});
 /* POS */
const posProductEl = document.getElementById("posProduct");
const posQty = document.getElementById("posQty");
const addToCartBtn = document.getElementById("addToCartBtn");
const cartList = document.getElementById("cartList");
const checkoutBtn = document.getElementById("checkoutBtn");
const clearCartBtn = document.getElementById("clearCartBtn");
const paymentSection = document.getElementById("paymentSection");
const paymentCompleteBtn = document.getElementById("paymentCompleteBtn");
const cancelPaymentBtn = document.getElementById("cancelPaymentBtn");
const transCode = document.getElementById("transCode");
const paymentMethod = document.getElementById("paymentMethod");

// Added elements for UI enhancements
const productSearch = document.getElementById("productSearch");
const productResults = document.getElementById("productResults");
const cartTotalDisplay = document.getElementById("cartTotalDisplay");
const saveCustomerBtn = document.getElementById("saveCustomerBtn");
let selectedProduct = null;
let cart = [];

function renderCart() {
  cartList.innerHTML = "";
  let runningTotal = 0;
  cart.forEach((c, i) => {
    runningTotal += (c.price * c.qty);
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";
    li.textContent = `${c.name} x${c.qty} = KSh ${(c.price * c.qty).toFixed(2)}`;
    const rmBtn = document.createElement("button");
    rmBtn.className = "btn btn-sm btn-danger"; rmBtn.textContent = "x";
    rmBtn.onclick = () => { cart.splice(i, 1); renderCart(); };
    li.appendChild(rmBtn);
    cartList.appendChild(li);
  });
  if (cartTotalDisplay) cartTotalDisplay.textContent = `KSh ${runningTotal.toFixed(2)}`;
}

// Search Logic
productSearch.oninput = (e) => {
  const val = e.target.value.toLowerCase();
  if (!val) { productResults.style.display = "none"; return; }
  
  const matches = window.productsCache.filter(p => p.data().name.toLowerCase().includes(val));
  productResults.innerHTML = matches.map(m => {
    const p = m.data();
    const isOutOfStock = parseInt(p.stock) <= 0;
    return `
      <a class="dropdown-item ${isOutOfStock ? 'text-muted' : ''}" href="#" 
         onclick="event.preventDefault(); ${isOutOfStock ? "alert('Item is out of stock!')" : `window.selectProd('${m.id}', '${p.name}', ${p.price})`}">
        ${p.name} - <strong>KSh ${p.price}</strong> ${isOutOfStock ? "(Out of Stock)" : ""}
      </a>
    `;
  }).join('');
  productResults.style.display = matches.length ? "block" : "none";
};

window.selectProd = (id, name, price) => {
  productSearch.value = name;
  selectedProduct = { id, name, price };
  productResults.style.display = "none";
};

// Add to Cart Logic
addToCartBtn.onclick = () => {
  const prodData = selectedProduct 
    ? window.productsCache.find(p => p.id === selectedProduct.id)?.data() 
    : window.productsCache.find(p => p.id === posProductEl.value)?.data();

  if (!prodData) return alert("Please select a product");

  // Helper function to handle fractions like "1/2" or "3/4"
  const parseQty = (val) => {
    if (typeof val === 'string' && val.includes('/')) {
      const parts = val.split('/');
      // Ensure we have two parts to avoid division by zero or NaN
      if (parts.length === 2) {
        return parseFloat(parts[0]) / parseFloat(parts[1]);
      }
    }
    return parseFloat(val);
  };

  const currentStock = parseFloat(prodData.stock) || 0;
  const requestedQty = parseQty(posQty.value);

  // Validation checks
  if (isNaN(requestedQty) || requestedQty <= 0) return alert("Invalid quantity");
  if (currentStock <= 0) return alert(`Sorry, ${prodData.name} is out of stock!`);
  if (requestedQty > currentStock) return alert(`Insufficient stock! Only ${currentStock} available.`);
  
  cart.push({ 
    id: prodData.id || (selectedProduct ? selectedProduct.id : posProductEl.value), 
    name: prodData.name, 
    price: parseFloat(prodData.price), 
    qty: requestedQty 
  });
  
  new Audio("https://actions.google.com/sounds/v1/ui/beep_short.ogg").play();
  renderCart();
  
  // Reset UI
  selectedProduct = null;
  productSearch.value = "";
  posQty.value = "1";
};

// Quick-Add Customer Logic
saveCustomerBtn.onclick = async () => {
  const name = document.getElementById("newCustName").value;
  const phone = document.getElementById("newCustPhone").value;
  if (!name) return alert("Enter a name");
  try {
    const docRef = await db.collection("customers").add({ name, phone });
    const select = document.getElementById("posCustomer");
    const opt = document.createElement("option");
    opt.value = docRef.id;
    opt.textContent = name;
    select.appendChild(opt);
    select.value = docRef.id;
    bootstrap.Modal.getInstance(document.getElementById('addCustomerModal')).hide();
    alert("Customer saved!");
  } catch (e) { alert("Error: " + e.message); }
};

clearCartBtn.onclick = () => { cart = []; renderCart(); };
checkoutBtn.onclick = () => { if (cart.length === 0) return alert("Cart empty"); paymentSection.classList.remove("d-none"); };
cancelPaymentBtn.onclick = () => { paymentSection.classList.add("d-none"); };

function showToast(title, message, type = 'loading') {
    document.getElementById("toastTitle").textContent = title;
    const body = document.getElementById("toastBody");

    if (type === 'loading') {
        body.innerHTML = `<div class="spinner-loader"></div><div>${message}</div>`;
    } else if (type === 'success') {
        body.innerHTML = `
            <svg class="checkmark-circle" viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="25" fill="none"/>
                <path class="checkmark" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
            <div>${message}</div>`;
    } else {
        body.innerHTML = `<div style="font-size:40px; color:#e74c3c;">✕</div><div>${message}</div>`;
    }

    const toastEl = document.getElementById('liveToast');
    // Don't auto-hide if it's still loading
    const toast = new bootstrap.Toast(toastEl, { autohide: type !== 'loading' });
    toast.show();
}
/* PAYMENT COMPLETED */
paymentCompleteBtn.onclick = async () => {
    if (cart.length === 0) return showToast("Warning", "Cart is empty", "error");

    const posCustomer = document.getElementById("posCustomer");
    const customerName = (posCustomer.value && posCustomer.value !== "") 
                        ? posCustomer.selectedOptions[0].text 
                        : "Guest";

    // 1. Immediate UI Feedback
    paymentSection.classList.add("d-none");
    showToast("Processing", "Finalizing your sale...", "loading");

    // 2. Background Processing
    (async () => {
        try {
            const processedItems = [];
            let totalAmount = 0;
            
            for (const c of cart) {
                const snap = await db.collection("products").doc(c.id).get();
                const pData = snap.data();
                
                if (!pData) throw new Error(`Product ${c.name} not found.`);
                
                // Use parseFloat for stock validation to support fractions
                const currentStock = parseFloat(pData.stock) || 0;
                if (currentStock < c.qty) throw new Error(`${c.name} has insufficient stock.`);
                
                const sellPrice = parseFloat(c.price) || 0;
                const qty = parseFloat(c.qty) || 0;
                
                totalAmount += (sellPrice * qty);
                
                // Save the cost at the time of sale
                processedItems.push({ 
                    name: c.name, 
                    price: sellPrice, 
                    qty: qty, // This is now a float (e.g., 0.5)
                    cost: parseFloat(pData.buyPrice) || 0 
                });
            }

            // Add Sale
            await db.collection("sales").add({ 
                customer: customerName, 
                items: processedItems, 
                total: totalAmount, 
                payment: paymentMethod.value, 
                transaction: transCode.value, 
                date: new Date() 
            });

            // Update Stock
            for (const c of cart) {
                const prodRef = db.collection("products").doc(c.id);
                await db.runTransaction(async (t) => {
                    const snap = await t.get(prodRef);
                    const currentStock = parseFloat(snap.data().stock) || 0;
                    // Subtract fractional quantity accurately
                    t.update(prodRef, { stock: Math.max(currentStock - c.qty, 0) });
                });
            }

            // Reset UI
            cart = []; 
            renderCart(); 
            transCode.value = "";
            posCustomer.value = "";
            
            showToast("Success", "Sale completed and stock updated!", "success");

        } catch (e) {
            showToast("Error", e.message, "error");
            paymentSection.classList.remove("d-none");
        }
    })();
};
/* --- SECURED ATTENDANCE LOGIC --- */
const OFFICE_LAT = -1.27805; // REPLACE with your office Latitude
const OFFICE_LON = 36.78965; // REPLACE with your office Longitude
const MAX_DISTANCE = 0.005;    // Max distance in degrees (approx 50m)

// 1. Global Live Listener
db.collection("attendance").orderBy("clockIn", "desc").onSnapshot(snap => {
    const attendanceTable = document.getElementById("attendanceTable");
    if (!attendanceTable) return;
    
    attendanceTable.innerHTML = ""; 
    snap.forEach(doc => {
        const a = doc.data();
        if (!a.clockIn) return; 

        const isStaff = currentRole !== 'admin';
        if (isStaff && a.staffEmail !== auth.currentUser?.email) return;

        const isAdmin = currentRole === 'admin';
        attendanceTable.innerHTML += `<tr>
            <td>${a.date}</td>
            ${isAdmin ? `<td>${a.staffEmail}</td>` : ''}
            <td>${a.clockIn.toDate().toLocaleTimeString()}</td>
            <td>${a.clockOut ? a.clockOut.toDate().toLocaleTimeString() : 'Ongoing'}</td>
            ${isAdmin ? `<td><button class="btn btn-sm btn-danger" onclick="window.deleteAttendanceRecord('${doc.id}')">Delete</button></td>` : ''}
        </tr>`;
    });
});

// 2. Secured Clock In
window.clockIn = async () => {
    if (!auth.currentUser) return;

    // Check Geolocation
    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const distance = Math.sqrt(Math.pow(latitude - OFFICE_LAT, 2) + Math.pow(longitude - OFFICE_LON, 2));

        if (distance > MAX_DISTANCE) {
            return Swal.fire("Access Denied", "You are too far from the working location please arrive at your work location for you to clock in.", "error");
        }

        const today = new Date().toLocaleDateString();
        const check = await db.collection("attendance")
            .where("staffEmail", "==", auth.currentUser.email)
            .where("date", "==", today).get();

        if (!check.empty) return Swal.fire("Already Checked In", "You have already clocked in today.", "warning");

        await db.collection("attendance").add({
            staffEmail: auth.currentUser.email,
            date: today,
            clockIn: firebase.firestore.FieldValue.serverTimestamp(),
            clockOut: null,
            location: { lat: latitude, lon: longitude } // Storing for audit
        });
        Swal.fire("Clocked In", "Verified location recorded.", "success");

    }, (err) => {
        Swal.fire("Location Required", "Please enable location services to clock in.", "warning");
    }, { enableHighAccuracy: true });
};

// 3. Clock Out (No location requirement, or repeat logic above if needed)
window.clockOut = async () => {
    if (!auth.currentUser) return;
    const today = new Date().toLocaleDateString();
    const query = await db.collection("attendance")
        .where("staffEmail", "==", auth.currentUser.email)
        .where("date", "==", today)
        .where("clockOut", "==", null).get();

    if (query.empty) return Swal.fire("Error", "No active shift found.", "error");

    await query.docs[0].ref.update({ clockOut: firebase.firestore.FieldValue.serverTimestamp() });
    Swal.fire("Clocked Out", "Shift ended successfully", "info");
};

// 4. Delete & Export (Keep your existing functions)
window.deleteAttendanceRecord = async (id) => {
    const result = await Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true });
    if (result.isConfirmed) await db.collection("attendance").doc(id).delete();
};

window.exportAttendance = async () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let query = db.collection("attendance").orderBy("clockIn", "desc");
    if (currentRole !== 'admin') query = query.where("staffEmail", "==", auth.currentUser.email);
    const snap = await query.get();
    let tableData = snap.docs.map(d => {
        const a = d.data();
        return [a.date, a.staffEmail, a.clockIn?.toDate().toLocaleTimeString(), a.clockOut?.toDate().toLocaleTimeString() || 'Ongoing'];
    });
    doc.text("Staff Attendance Report", 14, 10);
    doc.autoTable({ head: [['Date', 'Staff', 'Clock In', 'Clock Out']], body: tableData });
    doc.save("Attendance_Report.pdf");
};
/* Sales Table & Reporting */
const salesTable = document.getElementById("salesTable");

// 1. Main Sales Listener
db.collection("sales").orderBy("date", "desc").onSnapshot(snap => {
    let allSales = [];
    let todayTotal = 0;
    let monthlyTotal = 0;
    let dailyProfit = 0;
    let totalProfit = 0;
    
    const itemCounts = {}; 
    const now = new Date();
    const today = now.toDateString();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const costMap = {};
    window.productsCache.forEach(doc => {
        const p = doc.data();
        costMap[p.name.trim().toLowerCase()] = parseFloat(p.buyPrice) || 0;
    });
    
    if (salesTable) salesTable.innerHTML = "";

    snap.docs.forEach(doc => {
        const s = doc.data();
        allSales.push({ id: doc.id, ...s });
        const saleDate = s.date.toDate();
        let saleCost = 0;

        s.items.forEach(item => {
            const normalizedItemName = item.name.trim().toLowerCase();
            const qty = parseFloat(item.qty) || 0; 
            const costPerItem = (item.cost !== undefined) ? parseFloat(item.cost) : (costMap[normalizedItemName] || 0);
            saleCost += (costPerItem * qty);
            itemCounts[item.name] = (itemCounts[item.name] || 0) + qty;
        });

        const profit = parseFloat(s.total) - saleCost;
        totalProfit += profit;
        if (saleDate.toDateString() === today) { todayTotal += parseFloat(s.total); dailyProfit += profit; }
        if (saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear) { monthlyTotal += parseFloat(s.total); }
        
        // Render Table (with fraction display)
        if (salesTable) {
            salesTable.innerHTML += `<tr>
                <td>${saleDate.toLocaleDateString()}</td>
                <td>${s.customer}</td>
                <td>${s.items.map(i => `${i.name} x${toFraction(i.qty)}`).join(", ")}</td>
                <td>KSh ${parseFloat(s.total).toLocaleString()}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="downloadSale('${doc.id}')">📄</button>
                    ${window.currentRole === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteSale('${doc.id}')">🗑️</button>` : ''}
                </td>
            </tr>`;
        }
    });
// Make sure this is in your main.js file
window.deleteSale = async (id) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
        try {
            await db.collection("sales").doc(id).delete();
            alert("Transaction deleted successfully.");
        } catch (error) {
            console.error("Error deleting document: ", error);
            alert("Failed to delete transaction.");
        }
    }
};
    // Update Cards & Progress
    document.getElementById("todaysSales").textContent = "KSh " + todayTotal.toLocaleString();
    document.getElementById("monthlySales").textContent = "KSh " + monthlyTotal.toLocaleString();
    document.getElementById("dailyProfit").textContent = "KSh " + dailyProfit.toLocaleString();
    document.getElementById("totalProfit").textContent = "KSh " + totalProfit.toLocaleString();

    const topItemsList = document.getElementById("topItemsList");
    if (topItemsList) {
        const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]); 
        topItemsList.innerHTML = sortedItems.map(item => `<div class="d-flex justify-content-between mb-2"><span>${item[0]}</span><span class="fw-bold text-primary">${toFraction(item[1])} sold</span></div>`).join("");
    }

    renderGroupedSales(allSales); // Call logic to render grouped list
    window.allSales = allSales;   // Make globally available for PDF functions


// --- HELPER FUNCTIONS (Outside the Listener) ---



// [Include your existing renderGroupedSales, downloadDailyReport, 
// deleteSale, deleteDay, downloadSale, and downloadAllPDF functions here. 
// Since they are now outside the onSnapshot, they will work perfectly.]
   // --- DYNAMIC PROGRESS BAR UPDATE ---
const progressBar = document.getElementById("salesProgressBar");
const targetLabel = document.getElementById("targetLabel");

if (progressBar && targetLabel) {
    // Now dynamically pulls from the global variable
    const target = (typeof currentExpectedSales !== 'undefined') ? currentExpectedSales : 0;
    
    // Switch from todayTotal to monthlyTotal
    const progressValue = monthlyTotal; 
    
    // Prevent division by zero if target is 0
    const percentage = target > 0 ? Math.min((progressValue / target) * 100, 100) : 0;
    
    progressBar.style.width = percentage + "%";
    progressBar.textContent = Math.round(percentage) + "%";
    targetLabel.textContent = `KSh ${progressValue.toLocaleString()} / KSh ${target.toLocaleString()}`;
    
    // Update color logic if needed; here it marks completion at 100%
    progressBar.className = percentage >= 100 ? "progress-bar bg-warning" : "progress-bar bg-success";
}

renderGroupedSales(allSales);
});
// 2. Grouped View Renderer with Professional Download Button
function renderGroupedSales(sales) {
    const container = document.getElementById("dailySalesContainer");
    if (!container) return;
    container.innerHTML = "";

    const grouped = sales.reduce((acc, sale) => {
        const dateKey = sale.date.toDate().toLocaleDateString();
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(sale);
        return acc;
    }, {});

    Object.keys(grouped).sort((a,b) => new Date(b) - new Date(a)).forEach(date => {
        const dailySales = grouped[date];
        let dayTotal = 0;
        let productSummary = {};

        dailySales.forEach(s => {
            dayTotal += s.total;
            s.items.forEach(item => {
                if (!productSummary[item.name]) productSummary[item.name] = { qty: 0, total: 0 };
                // Ensure qty is parsed as a float for accurate arithmetic
                productSummary[item.name].qty += parseFloat(item.qty) || 0;
                productSummary[item.name].total += (item.price * item.qty);
            });
        });

       // Use the global toFraction helper to display quantities as fractions
        let tableRows = Object.keys(productSummary).map(name => `
            <tr>
                <td>${name}</td>
                <td>${toFraction(productSummary[name].qty)}</td>
                <td>KSh ${productSummary[name].total.toLocaleString()}</td>
            </tr>
        `).join('');

        container.innerHTML += `
            <div class="card mb-3 p-3">
                <div class="d-flex justify-content-between align-items-center">
                    <h6>Date: ${date} | Total: KSh ${dayTotal.toLocaleString()}</h6>
                    <div>
                        <button class="btn btn-sm btn-info" onclick="window.downloadDailyReport('${date}')">📄 PDF Report</button>
                        ${currentRole === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="window.deleteDay('${date}')">Delete</button>` : ''}
                    </div>
                </div>
                <table class="table table-sm">
                    <thead><tr><th>Product</th><th>Qty</th><th>Subtotal</th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>`;
    });
}
/* --- GLOBAL DELETE HANDLER FOR DAILY REPORTS --- */
window.deleteDay = async (dateStr) => {
    // 1. Ask for confirmation
    if (!confirm(`Are you sure you want to delete ALL sales records for ${dateStr}?`)) {
        return;
    }

    try {
        // 2. Create a batch to perform multiple deletions efficiently
        const batch = db.batch();
        
        // 3. Filter sales that match the selected date
        const salesToDelete = allSales.filter(s => s.date.toDate().toLocaleDateString() === dateStr);
        
        if (salesToDelete.length === 0) {
            alert("No sales found for this date.");
            return;
        }

        // 4. Add each deletion to the batch
        salesToDelete.forEach(s => {
            const docRef = db.collection("sales").doc(s.id);
            batch.delete(docRef);
        });

        // 5. Commit the batch
        await batch.commit();
        alert(`Successfully deleted ${salesToDelete.length} records for ${dateStr}.`);
        
    } catch (error) {
        console.error("Error deleting daily sales: ", error);
        alert("Failed to delete records. Please check your permissions.");
    }
};

window.downloadDailyReport = (dateStr) => {
    const dailySales = allSales.filter(s => s.date.toDate().toLocaleDateString() === dateStr);
    if (dailySales.length === 0) return;

    // 1. Aggregate Products
    let productSummary = {};
    let grandTotal = 0;

    dailySales.forEach(s => {
        grandTotal += s.total;
        s.items.forEach(item => {
            if (!productSummary[item.name]) {
                productSummary[item.name] = { qty: 0, total: 0 };
            }
            // Use parseFloat to ensure numerical addition
            productSummary[item.name].qty += parseFloat(item.qty) || 0;
            productSummary[item.name].total += (item.price * item.qty);
        });
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 2. Professional Header
    doc.setFontSize(20);
    doc.setTextColor(41, 128, 185);
    doc.text("MADOLLAR LIQUOR PUB", 105, 15, null, null, "center");
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Daily Sales Summary Report", 105, 22, null, null, "center");
    doc.setFontSize(12);
    doc.text(`Date: ${dateStr}`, 105, 29, null, null, "center");

    // 3. Grand Total Header
    doc.setFontSize(14);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, 35, 182, 10, 'F');
    doc.text(`Total Daily Sales: KSh ${grandTotal.toLocaleString()}`, 20, 42);

    // 4. Products Table
    doc.autoTable({
        startY: 50,
        head: [['Product Name', 'Total Quantity Sold', 'Total Sales (KSh)']],
        body: Object.keys(productSummary).map(name => [
            name, 
            toFraction(productSummary[name].qty), // Converts 0.5 to '1/2'
            productSummary[name].total.toLocaleString()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }
    });

    // 5. Footer
    doc.setFontSize(10);
    doc.text("Generated by MADOLLAR System", 105, 285, null, null, "center");

    doc.save(`Daily_Report_${dateStr.replace(/\//g, '-')}.pdf`);
};
window.downloadSale = async (id) => {
    const s = allSales.find(sale => sale.id === id);
    if (!s) return;
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dateStr = s.date.toDate().toLocaleString();

    // 1. Header Section
    doc.setFontSize(22);
    doc.setTextColor(41, 128, 185); 
    doc.text("MADOLLAR LIQUOR PUB", 105, 20, null, null, "center");
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("P.O. Box , Nairobi, Kenya", 105, 26, null, null, "center");
    doc.line(10, 32, 200, 32);

    // 2. Transaction Details
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`Customer: ${s.customer}`, 14, 42);
    doc.text(`Date: ${dateStr}`, 14, 48);
    doc.text(`Transaction: ${s.transaction}`, 14, 54);

    // 3. Items Table - Updated to use toFraction(i.qty)
    doc.autoTable({
        startY: 65,
        head: [['Item', 'Qty', 'Price', 'Subtotal']],
        body: s.items.map(i => [
            i.name, 
            toFraction(i.qty), // Converts decimal 0.5 to fractional '1/2'
            `KSh ${Number(i.price).toLocaleString()}`, 
            `KSh ${(i.price * i.qty).toLocaleString()}`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }
    });

    // 4. Totals and M-Pesa Section
    let currentY = doc.lastAutoTable.finalY + 10;
    
    doc.setFontSize(14);
    doc.text(`TOTAL AMOUNT: KSh ${s.total.toLocaleString()}`, 196, currentY, null, null, "right");
    
    // M-Pesa Design Box
    currentY += 15;
    doc.setDrawColor(41, 128, 185);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(14, currentY, 182, 35, 3, 3, 'FD'); 
    
    doc.setFontSize(12);
    doc.setTextColor(0, 150, 0); 
    doc.text("PAY VIA M-PESA", 105, currentY + 8, null, null, "center");
    
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Lipa na M-PESA , Buy Goods & Services", 105, currentY + 15, null, null, "center");
    doc.setFontSize(14);
    doc.text(`TILL NUMBER: 3234719`, 105, currentY + 23, null, null, "center");
    doc.setFontSize(10);
    doc.text(`Account Name: MADOLLA`, 105, currentY + 30, null, null, "center");

    // Professional Thank You Footer
    doc.setFontSize(16);
    doc.setTextColor(41, 128, 185);
    doc.text("THANK YOU FOR YOUR PURCHASE!", 105, 245, null, null, "center");

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("We appreciate.", 105, 252, null, null, "center");

    // Developer Branding
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("System Developed by Stones Web & System Solutions", 105, 260, null, "center");
    doc.text("Tel: 0790427109 , Email: livingstoneoduor21@gmail.com", 105, 265, null, "center");

    doc.save(`Receipt_${s.customer.replace(/\s+/g, '_')}_${id.substring(0,5)}.pdf`);
};
document.getElementById("downloadAllPDF").onclick = () => {
    if (allSales.length === 0) return alert("No sales data available.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // 1. Professional Header
    doc.setFontSize(22);
    doc.setTextColor(41, 128, 185);
    doc.text("MADOLLAR LIQUOR PUB", 105, 15, null, null, "center");
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Complete Sales History Report", 105, 25, null, null, "center");
    
    // 2. Calculate Grand Total
    const grandTotal = allSales.reduce((sum, s) => sum + s.total, 0);
    
    // 3. Summary Box
    doc.setFontSize(12);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, 35, 182, 10, 'F');
    doc.text(`Total Revenue to Date: KSh ${grandTotal.toLocaleString()}`, 20, 42);

    // 4. Detailed History Table
    doc.autoTable({
        startY: 50,
        head: [['Date', 'Customer', 'Items', 'Total (KSh)']],
        body: allSales.map(s => [
            s.date.toDate().toLocaleDateString(),
            s.customer,
            s.items.map(i => `${i.name} x${i.qty}`).join(", "),
            s.total.toLocaleString()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }
    });

    // 5. Footer
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 285, null, null, "center");

    doc.save("Full_Sales_History_Report.pdf");
};
}
/* --- Requisition Logic --- */
window.requisitionItems = window.requisitionItems || [];

// 1. Open Selection Modal
window.openProductSelector = () => {
    const list = document.getElementById("modalProductList");
    list.innerHTML = "";
    
    window.productsCache.forEach(doc => {
        const p = doc.data();
        list.innerHTML += `<tr>
            <td><input type="checkbox" class="prod-checkbox" value="${doc.id}"></td>
            <td>${p.name}</td>
            <td>${toMixedFraction(p.stock)}</td>
        </tr>`;
    });
    
    const modal = new bootstrap.Modal(document.getElementById("productSelectorModal"));
    modal.show();
};

// Select All / Search Logic
document.getElementById("selectAll").onclick = (e) => {
    document.querySelectorAll(".prod-checkbox").forEach(cb => cb.checked = e.target.checked);
};
document.getElementById('searchProd').oninput = (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#modalProductList tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
};

// 2. Add Selected items
window.addSelectedToRequisition = () => {
    const priceType = document.getElementById("priceTypeSelect").value;
    const selected = document.querySelectorAll(".prod-checkbox:checked");
    
    selected.forEach(cb => {
        const prodDoc = window.productsCache.find(p => p.id === cb.value);
        if (prodDoc) {
            const prod = prodDoc.data();
            // Use parseFloat for fractional stock
            const defaultQty = (priceType === "sellPrice") ? (parseFloat(prod.stock) || 0) : 1;
            const price = (priceType === "buyPrice") ? (parseFloat(prod.buyPrice) || 0) : (parseFloat(prod.price) || 0);
            
            if (!window.requisitionItems.find(item => item.id === prodDoc.id)) {
                window.requisitionItems.push({ id: prodDoc.id, name: prod.name, qty: defaultQty, priceType, price });
            }
        }
    });
    window.renderRequisitionTable();
    bootstrap.Modal.getInstance(document.getElementById("productSelectorModal")).hide();
};

// 3. Render Table
window.renderRequisitionTable = () => {
    const tbody = document.getElementById("requisitionTableBody");
    const totalDisplay = document.getElementById("grandTotalValue");
    if (!tbody) return;
    
    tbody.innerHTML = ""; 
    let buyPriceTotal = 0;

    window.requisitionItems.sort((a, b) => a.name.localeCompare(b.name));

    window.requisitionItems.forEach((item, index) => {
        const subtotal = item.priceType === 'buyPrice' ? (item.price * item.qty) : 0;
        buyPriceTotal += subtotal;
        
        const subtotalDisplay = item.priceType === 'buyPrice' ? `KSh ${subtotal.toLocaleString()}` : "-";
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${item.name}</td>
            <td>
                <select class="form-control form-control-sm" onchange="window.updatePriceType(${index}, this.value)" style="width: 100px;">
                    <option value="sellPrice" ${item.priceType === 'sellPrice' ? 'selected' : ''}>Sell</option>
                    <option value="buyPrice" ${item.priceType === 'buyPrice' ? 'selected' : ''}>Buy</option>
                </select>
            </td>
            <td>KSh ${item.price.toLocaleString()}</td>
            <td>
                <div class="d-flex align-items-center">
                    <input type="number" step="any" class="form-control form-control-sm" value="${item.qty}" min="0.1" 
                           onchange="window.updateQty(${index}, this.value)" style="width: 60px;">
                    ${(item.qty % 1 !== 0) ? `<span class="ms-2 badge bg-secondary">${toMixedFraction(item.qty)}</span>` : ''}
                </div>
            </td>
            <td class="fw-bold">${subtotalDisplay}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="window.confirmRemove(${index})">Remove</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    if (totalDisplay) {
        totalDisplay.innerText = buyPriceTotal > 0 ? `KSh ${buyPriceTotal.toLocaleString()}` : "KSh 0";
    }
};

// 4. Updates
window.updatePriceType = (index, newType) => {
    const item = window.requisitionItems[index];
    const prodDoc = window.productsCache.find(p => p.id === item.id);
    const prod = prodDoc.data();
    item.priceType = newType;
    item.price = newType === "buyPrice" ? (parseFloat(prod.buyPrice) || 0) : (parseFloat(prod.price) || 0);
    window.renderRequisitionTable();
};

window.updateQty = (index, newQty) => {
    const qty = parseFloat(newQty);
    if (!isNaN(qty) && qty > 0) window.requisitionItems[index].qty = qty;
    window.renderRequisitionTable();
};

window.confirmRemove = async (index) => {
    const result = await Swal.fire({ title: 'Remove item?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' });
    if (result.isConfirmed) {
        window.requisitionItems.splice(index, 1);
        window.renderRequisitionTable();
    }
};

// 5. Download PDF (Now uses toMixedFraction for Qty)
window.downloadRequisitionPDF = () => {
    if (window.requisitionItems.length === 0) return Swal.fire("Empty", "List is empty", "warning");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("MADOLLAR PUB STOCK REQUISITION", 105, 15, null, null, "center");
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 22, null, null, "center");
    
    const tableData = window.requisitionItems.map((i, index) => [
        index + 1,
        i.name, 
        i.priceType === 'buyPrice' ? 'Buy Price' : 'Sell Price', 
        i.price.toLocaleString(), 
        toMixedFraction(i.qty), // Used the helper here for PDF display
        i.priceType === 'buyPrice' ? (i.price * i.qty).toLocaleString() : '-'
    ]);
    
    const buyPriceTotal = window.requisitionItems
        .filter(i => i.priceType === 'buyPrice')
        .reduce((sum, i) => sum + (i.price * i.qty), 0);

    if (buyPriceTotal > 0) {
        tableData.push(['', '', '', '', 'TOTAL', buyPriceTotal.toLocaleString()]);
    }

    doc.autoTable({
        startY: 30,
        head: [['No.', 'Product Name', 'Price Type', 'Price (KSh)', 'Qty', 'Subtotal']],
        body: tableData,
        columnStyles: { 0: { cellWidth: 10 } }
    });
    doc.save(`Requisition_${new Date().toLocaleDateString()}.pdf`);
};
