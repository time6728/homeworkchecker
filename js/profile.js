import {
    doc,
    onSnapshot,
    updateDoc,
    collection,
    getDocs,
    query,
    where,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase.js";

const teacherId = localStorage.getItem("teacherId");
const container = document.getElementById("profile-container");

// --- Modal Elements for Editing Profile ---
const editModal = document.getElementById("edit-profile-modal");
const modalNameInput = document.getElementById("modal-name-input");
const modalEmailInput = document.getElementById("modal-email-input");
const modalSaveBtn = document.getElementById("modal-save-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");

// --- Modal Elements for Admin Actions ---
const adminActionModal = document.getElementById("admin-action-modal");
const adminModalTitle = document.getElementById("admin-modal-title");
const adminModalInstruction = document.getElementById("admin-modal-instruction");
const adminModalEmailInput = document.getElementById("admin-modal-email-input");
const adminModalConfirmBtn = document.getElementById("admin-modal-confirm-btn");
const adminModalCloseBtn = document.getElementById("admin-modal-close-btn");

let currentProfile = {}; // Store current profile data

initProfilePage();

function initProfilePage() {
    if (!teacherId) {
        // Replaced alert
        console.error("No teacher ID found. Redirecting to login.");
        window.location.href = "login.html";
        return;
    }
    loadTeacherProfile(teacherId);

    // Setup Modals
    modalCancelBtn.addEventListener("click", () => editModal.classList.add("hidden"));
    adminModalCloseBtn.addEventListener("click", () => adminActionModal.classList.add("hidden"));
}

function loadTeacherProfile(teacherId) {
    const teacherRef = doc(db, "teachers", teacherId);
    onSnapshot(teacherRef, handleProfileSnapshot);
}

function handleProfileSnapshot(docSnap) {
    if (!docSnap.exists()) {
        container.innerHTML = "<p class='loading-text'>Teacher profile not found.</p>";
        return;
    }
    const data = docSnap.data();
    currentProfile = {
        name: data.name || "Unknown",
        email: data.email || "unknown@domain.com",
        role: data.role || "teacher",
    };
    renderProfile(currentProfile);
}

function renderProfile({ name, email, role }) {
    container.innerHTML = ""; // Clear loading text
    
    const originalAdminId = localStorage.getItem("originalAdminId");
    const isAdmin = (role.toLowerCase() === "admin") || !!originalAdminId;
    
    const nameEl = createElement("div", `<span class="detail-label">Name:</span> <span class="detail-value">${name}</span>`, "profile-detail");
    const emailEl = createElement("div", `<span class="detail-label">Email:</span> <span class="detail-value">${email}</span>`, "profile-detail");
    const roleEl = createElement("div", `<span class="detail-label">Role:</span> <span class="detail-value">${role.toUpperCase()}</span>`, "profile-detail");
    
    const editBtn = createButton("Edit Profile", () => showEditModal(name, email), "primary-btn");
    container.append(nameEl, emailEl, roleEl, editBtn);
    if (isAdmin) {
        const adminActionsDiv = document.createElement("div");
        adminActionsDiv.className = "admin-actions";
        const adminBtn = createButton("Go to Admin Page", goToAdminPage, "admin-link-btn");
        adminActionsDiv.append(adminBtn);
        if (role.toLowerCase() === "admin") {
             const addAdminBtn = createButton("Promote Teacher", () => showAdminActionModal("promote"), "secondary-btn");
             const revokeAdminBtn = createButton("Revoke Admin", () => showAdminActionModal("revoke"), "delete-btn");
             adminActionsDiv.append(addAdminBtn, revokeAdminBtn);
        }
        if (originalAdminId) {
            const returnBtn = createButton("Return to Admin", returnToAdmin, "primary-btn");
            adminActionsDiv.append(returnBtn);
        }
        container.append(adminActionsDiv);
    }
}

function returnToAdmin() {
    const originalAdminId = localStorage.getItem("originalAdminId");
    if (originalAdminId) {
        localStorage.setItem("teacherId", originalAdminId); 
        localStorage.removeItem("originalAdminId"); 
        console.log("Returned to original admin account.");
        window.location.href = "admin.html";
    }
}

function createElement(tag, innerHTML, className) {
    const el = document.createElement(tag);
    if (innerHTML) el.innerHTML = innerHTML;
    if (className) el.className = className;
    return el;
}

function createButton(label, onClick, className) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className = `action-btn ${className}`;
    btn.addEventListener("click", onClick);
    return btn;
}

function goToAdminPage() {
    window.location.href = "admin.html";
}

// --- Profile Edit Modal Handlers ---

function showEditModal(currentName, currentEmail) {
    modalNameInput.value = currentName;
    modalEmailInput.value = currentEmail;
    
    // CHANGE 2: Ensure email field is read-only when the modal is shown
    modalEmailInput.readOnly = true; 
    
    editModal.classList.remove("hidden");
    modalNameInput.focus();
    
    // Re-attach event listener to ensure no duplicates
    modalSaveBtn.onclick = () => handleModalSave(currentName); // Removed currentEmail argument
}

async function handleModalSave(currentName) { // Removed currentEmail argument
    const newName = modalNameInput.value.trim();
    // const newEmail is no longer needed as we don't update it
    
    if (!newName) { // Only check for name
        console.warn("Name cannot be empty.");
        return;
    }
    
    // Only update if the name changed
    if (newName === currentName) {
        editModal.classList.add("hidden");
        return;
    }
    
    // CHANGE 3: Only pass the newName to the update function
    await updateTeacherProfile(newName); 
    editModal.classList.add("hidden");
}

async function updateTeacherProfile(name) { // Removed email argument
    try {
        const teacherRef = doc(db, "teachers", teacherId);
        // CHANGE 4: Only update the name field
        await updateDoc(teacherRef, { name }); 
        console.log("Profile updated successfully!"); // Replaced alert
    } catch (err) {
        console.error("Error updating profile:", err);
        // Replaced alert
    }
}

// --- Admin Action Modal Handlers (No Changes Needed) ---

function showAdminActionModal(action) {
    adminModalEmailInput.value = ""; // Clear input
    adminActionModal.classList.remove("hidden");
    adminModalEmailInput.focus();

    if (action === "promote") {
        adminModalTitle.textContent = "Promote Teacher to Admin";
        adminModalInstruction.textContent = "Enter the email of the teacher you wish to promote.";
        adminModalConfirmBtn.textContent = "Promote";
        adminModalConfirmBtn.className = "action-btn secondary-btn";
        adminModalConfirmBtn.onclick = handlePromoteAdmin;
    } else if (action === "revoke") {
        adminModalTitle.textContent = "Revoke Admin Rights";
        adminModalInstruction.textContent = "Enter the email of the admin you wish to demote.";
        adminModalConfirmBtn.textContent = "Revoke";
        adminModalConfirmBtn.className = "action-btn delete-btn";
        adminModalConfirmBtn.onclick = handleRevokeAdmin;
    }
}

async function handlePromoteAdmin() {
    const targetEmail = adminModalEmailInput.value.trim();
    if (!targetEmail) return console.warn("No email entered.");
    
    try {
        const targetDoc = await findTeacherByEmail(targetEmail);
        if (!targetDoc) {
            console.error("No teacher found with that email.");
            return;
        }
        await updateDoc(doc(db, "teachers", targetDoc.id), { role: "admin" });
        console.log(`Teacher ${targetEmail} is now an admin.`);
        adminActionModal.classList.add("hidden");
    } catch (err) {
        console.error("Error promoting teacher:", err);
    }
}

async function handleRevokeAdmin() {
    const targetEmail = adminModalEmailInput.value.trim();
    if (!targetEmail) return console.warn("No email entered.");
    
    // Prevent revoking your own admin rights in a more robust app
    if (targetEmail === currentProfile.email) {
        console.error("Cannot revoke your own admin rights via this interface.");
        return;
    }

    try {
        const targetDoc = await findTeacherByEmail(targetEmail);
        if (!targetDoc) {
            console.error("No teacher found with that email.");
            return;
        }
        const data = targetDoc.data();
        if (data.role !== "admin") {
            console.warn(`${targetEmail} is not an admin.`);
            return;
        }
        await updateDoc(doc(db, "teachers", targetDoc.id), { role: "teacher" });
        console.log(`Admin rights revoked for ${targetEmail}.`);
        adminActionModal.classList.add("hidden");
    } catch (err) {
        console.error("Error revoking admin:", err);
    }
}

async function findTeacherByEmail(email) {
    const teachersRef = collection(db, "teachers");
    const q = query(teachersRef, where("email", "==", email));
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : snapshot.docs[0];
}
