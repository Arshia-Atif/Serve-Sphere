import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, push, onValue, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBoYED8Q_AiKUNaqKgeBGcwuGWSIiPtyeE",
    authDomain: "challenge-d567c.firebaseapp.com",
    databaseURL: "https://challenge-d567c-default-rtdb.firebaseio.com",
    projectId: "challenge-d567c",
    storageBucket: "challenge-d567c.firebasestorage.app",
    messagingSenderId: "905465134732",
    appId: "1:905465134732:web:2055d172baa53d1e0d05a9",
    measurementId: "G-38CY3C26FK"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentUser = null;
let userProfile = null;
let allProviders = [];
let bookingsCache = {};

// DOM Elements
const navActions = document.getElementById("nav-actions");
const providerGrid = document.getElementById("provider-grid");
const categoryFilter = document.getElementById("category-filter");
const searchInput = document.getElementById("search-input");
const bookingModal = document.getElementById("booking-modal");
const bookingForm = document.getElementById("booking-form");

// AUTH REDIRECTION & PROFILE SYNC
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  const userSnap = await get(ref(db, `users/${user.uid}`));
  userProfile = userSnap.val();
  
  renderNavbar();
  renderProviders();
  listenToBookings();
});

function renderNavbar() {
  let links = `<button id="nav-dir" onclick="switchView('directory-view')">Browse Services</button>`;
  if (userProfile?.role === "customer") {
    links += `<button id="nav-cust" onclick="switchView('customer-view')">My Bookings</button>`;
  } else if (userProfile?.role === "provider") {
    links += `<button id="nav-prov" onclick="switchView('provider-view')">Incoming Requests</button>`;
  }

  links += `<button class="btn-secondary" onclick="handleSignOut()">Sign Out</button>`;
  navActions.innerHTML = links;
}

window.handleSignOut = () => signOut(auth).then(() => window.location.href = "index.html");

window.switchView = (viewId) => {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(viewId);
  if (target) target.classList.add("active");
};

// REALTIME DIRECTORY
onValue(ref(db, 'users'), (snapshot) => {
  const users = snapshot.val() || {};
  allProviders = Object.values(users).filter(u => u.role === "provider");
  renderProviders();
});

function renderProviders() {
  const query = searchInput.value.toLowerCase();
  const cat = categoryFilter.value;

  const filtered = allProviders.filter(p => 
    (cat === "All" || p.service === cat) && 
    (p.email.toLowerCase().includes(query) || (p.location && p.location.toLowerCase().includes(query)))
  );

  if (!filtered.length) {
    providerGrid.innerHTML = "<p>No active service providers match your criteria.</p>";
    return;
  }

  providerGrid.innerHTML = filtered.map(p => `
    <div class="card">
      <div class="card-header">
        <h3>${p.email.split('@')[0]}</h3>
        <span class="badge">${p.service}</span>
      </div>
      <p><strong>Location:</strong> ${p.location}</p>
      <p><strong>Rating:</strong> ⭐ ${p.rating || 5.0}</p>
      <div class="price">$${p.price} / hr</div>
      <button class="btn-primary" onclick="openBookingModal('${p.uid}', '${p.email.split('@')[0]}', '${p.service}')">Book Service</button>
    </div>
  `).join('');
}

// BOOKING FLOW
window.openBookingModal = (providerId, providerName, service) => {
  if (userProfile?.role === "provider") {
    alert("Provider accounts cannot place bookings.");
    return;
  }
  document.getElementById("booking-provider-id").value = providerId;
  document.getElementById("modal-provider-name").innerText = `Provider: ${providerName} (${service})`;
  bookingModal.classList.remove("hidden");
};

document.getElementById("close-booking-modal").onclick = () => bookingModal.classList.add("hidden");

bookingForm.onsubmit = async (e) => {
  e.preventDefault();
  const providerId = document.getElementById("booking-provider-id").value;
  const providerObj = allProviders.find(p => p.uid === providerId);

  const newBookingRef = push(ref(db, 'bookings'));
  const bookingData = {
    id: newBookingRef.key,
    customerId: currentUser.uid,
    customerEmail: currentUser.email,
    providerId: providerId,
    providerEmail: providerObj.email,
    service: providerObj.service,
    date: document.getElementById("booking-date").value,
    time: document.getElementById("booking-time").value,
    location: document.getElementById("booking-location").value,
    description: document.getElementById("booking-desc").value,
    status: "Pending",
    review: null,
    createdAt: Date.now()
  };

  await set(newBookingRef, bookingData);
  bookingModal.classList.add("hidden");
  bookingForm.reset();
  switchView("customer-view");
};

function listenToBookings() {
  onValue(ref(db, 'bookings'), (snapshot) => {
    bookingsCache = snapshot.val() || {};
    renderCustomerDashboard();
    renderProviderDashboard();
  });
}

function renderCustomerDashboard() {
  const container = document.getElementById("customer-bookings-list");
  if (!currentUser) return;

  const myBookings = Object.values(bookingsCache).filter(b => b.customerId === currentUser.uid);

  if (!myBookings.length) {
    container.innerHTML = "<p>You have no active or completed bookings.</p>";
    return;
  }

  container.innerHTML = myBookings.map(b => `
    <div class="booking-item glow-box">
      <h3>${b.service} - Provider: ${b.providerEmail}</h3>
      <p><strong>Booking ID:</strong> ${b.id}</p>
      <p><strong>Date & Time:</strong> ${b.date} at ${b.time}</p>
      <p><strong>Status:</strong> <span class="status-tag status-${b.status.toLowerCase().replace(' ', '-')}">${b.status}</span></p>
      ${b.status === "Completed" && !b.review ? `
        <div style="margin-top: 0.5rem;">
          <select id="rating-${b.id}" class="rating-select">
            <option value="5">⭐⭐⭐⭐⭐ (5)</option>
            <option value="4">⭐⭐⭐⭐ (4)</option>
            <option value="3">⭐⭐⭐ (3)</option>
            <option value="2">⭐⭐ (2)</option>
            <option value="1">⭐ (1)</option>
          </select>
          <button class="btn-primary" onclick="submitReview('${b.id}')">Submit Review</button>
        </div>
      ` : ''}
      ${b.review ? `<p><strong>Your Review:</strong> ${'⭐'.repeat(b.review.rating)} (${b.review.rating}/5)</p>` : ''}
    </div>
  `).join('');
}

function renderProviderDashboard() {
  const container = document.getElementById("provider-bookings-list");
  if (!currentUser) return;

  const myRequests = Object.values(bookingsCache).filter(b => b.providerId === currentUser.uid);

  if (!myRequests.length) {
    container.innerHTML = "<p>No incoming requests assigned to your profile.</p>";
    return;
  }

  container.innerHTML = myRequests.map(b => `
    <div class="booking-item glow-box">
      <h3>Request from ${b.customerEmail}</h3>
      <p><strong>Service:</strong> ${b.service}</p>
      <p><strong>Location:</strong> ${b.location}</p>
      <p><strong>Description:</strong> ${b.description}</p>
      <p><strong>Status:</strong> <span class="status-tag status-${b.status.toLowerCase().replace(' ', '-')}">${b.status}</span></p>
      <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
        ${b.status === "Pending" ? `
          <button class="btn-primary" onclick="updateStatus('${b.id}', 'Accepted')">Accept</button>
          <button class="btn-danger" onclick="updateStatus('${b.id}', 'Rejected')">Reject</button>
        ` : ''}
        ${b.status === "Accepted" ? `
          <button class="btn-primary" onclick="updateStatus('${b.id}', 'In Progress')">Start Work</button>
        ` : ''}
        ${b.status === "In Progress" ? `
          <button class="btn-primary" onclick="updateStatus('${b.id}', 'Completed')">Mark Completed</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

window.updateStatus = async (bookingId, newStatus) => {
  const currentStatus = bookingsCache[bookingId]?.status;
  if (currentStatus === "Rejected" && newStatus === "In Progress") return;
  if (currentStatus === "Completed") return;

  await update(ref(db, `bookings/${bookingId}`), { status: newStatus });
};

window.submitReview = async (bookingId) => {
  const ratingVal = parseInt(document.getElementById(`rating-${bookingId}`).value);
  const booking = bookingsCache[bookingId];

  if (booking.status !== "Completed" || booking.review) return;

  await update(ref(db, `bookings/${bookingId}`), {
    review: { rating: ratingVal, submittedAt: Date.now() }
  });
};

categoryFilter.onchange = renderProviders;
searchInput.oninput = renderProviders;