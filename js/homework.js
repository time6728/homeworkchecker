import { 
  collection, addDoc, query, where, onSnapshot,
  doc, updateDoc, deleteDoc, getDocs, arrayUnion, writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase.js";
// NOTE: structure.js is assumed to contain Homework, attach, eget
import { Homework, attach, eget } from "./structure.js"; 

let allHomework = [];
let teacherId = localStorage.getItem("teacherId");
let selectedHomeworkIds = new Set(); // To track selected items for bulk delete

// --- Element Declarations ---

// Edit Modal Elements
const editModal = document.getElementById("edit-homework-modal");
const modalNameInput = document.getElementById("modal-name-input");
const modalDateInput = document.getElementById("modal-date-input");
const modalClassInput = document.getElementById("modal-class-input");
const modalHomeworkId = document.getElementById("edit-homework-id");
const modalSaveBtn = document.getElementById("modal-save-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");

// Delete Modal Elements
const deleteModal = document.getElementById("delete-confirmation-modal");
const deleteModalTitle = document.getElementById("delete-modal-title");
const deleteModalText = document.getElementById("delete-modal-text");
const deleteHomeworkId = document.getElementById("delete-homework-id");
const deleteConfirmBtn = document.getElementById("delete-confirm-btn");
const deleteCancelBtn = document.getElementById("delete-cancel-btn");

// Bulk Action Elements
const bulkActionsDiv = document.getElementById("bulk-actions");
const bulkDeleteBtn = document.getElementById("bulk-delete-btn");
const selectedCountSpan = document.getElementById("selected-count");

const homeworkCountSpan = document.getElementById("homework-count");

initHomeworkPage(teacherId);

// --- Initialization & Setup ---

function initHomeworkPage(userId) {
  if (!userId) {
    console.error("Teacher ID not found. Redirecting to login.");
    // window.location.href = "login.html"; // Uncomment for real app
    return;
  }
  
  attach("hwaddbtn", addHomework);
  
  // Modal Event Listeners
  modalCancelBtn.addEventListener("click", () => editModal.classList.add("hidden"));
  modalSaveBtn.addEventListener("click", handleModalSave);

  // Delete Modal Listeners
  deleteCancelBtn.addEventListener("click", () => deleteModal.classList.add("hidden"));
  
  // Bulk Delete Listener
  bulkDeleteBtn.addEventListener("click", showBulkDeleteConfirmation);

  setupHomeworkListener(userId);
}

function setupHomeworkListener(teacherId) {
  const homeworkListDiv = document.getElementById("homeworkList");
  const q = query(collection(db, "homework"), where("teacherId", "==", teacherId));
  onSnapshot(q, (snapshot) => renderHomeworkList(snapshot, homeworkListDiv));
}

// --- List Rendering ---

function renderHomeworkList(snapshot, container) {
  allHomework = [];
  selectedHomeworkIds.clear(); // Clear selections on re-render
  updateBulkActionsUI(); // Hide bulk actions on re-render
  container.innerHTML = "";
  
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const hw = new Homework(data.name, data.dueDate, data.classroom, data.teacherId);
    allHomework.push({ id: docSnap.id, ...data });
    const hwElement = createHomeworkElement(hw, docSnap.id);
    container.appendChild(hwElement);
  });

  homeworkCountSpan.textContent = allHomework.length;
  
  if (allHomework.length === 0) {
    container.innerHTML = '<p class="loading-text" style="color:#7f8c8d;">No assignments currently active. Use the form above to create one.</p>';
  }
}

function createHomeworkElement(hw, docId) {
  const div = document.createElement("div");
  
  // Determine if due date is within 3 days
  const today = new Date();
  const dueDate = new Date(hw.dueDate);
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  div.className = `homework-row ${diffDays <= 3 && diffDays >= 0 ? 'due-soon' : ''}`;
  
  // 1. Label and Custom Checkbox Structure (Moved to be a direct child of 'homework-row')
  const checkboxLabel = document.createElement("label");
  checkboxLabel.className = "homework-checkbox-label"; // This will now sit directly inside homework-row

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "homework-checkbox";
  checkbox.dataset.id = docId;
  checkbox.addEventListener('change', handleCheckboxChange);
  checkboxLabel.appendChild(checkbox);

  const customCheckbox = document.createElement("span");
  customCheckbox.className = "custom-checkbox";
  checkboxLabel.appendChild(customCheckbox);

  // Append the checkbox label directly to the homework-row div (the main 'div' for this element)
  div.appendChild(checkboxLabel); 

  // 2. Homework details wrapper (Will now only contain the text content)
  const detailsDiv = document.createElement("div");
  detailsDiv.className = "homework-details";

  // Wrap text in a new container for alignment
  const textContentWrapper = document.createElement("div");
  textContentWrapper.className = "homework-text-content";

  // Details content (now inner HTML for the wrapper)
  textContentWrapper.innerHTML = `
    <span class="homework-name">${hw.name}</span>
    <span class="homework-meta">
      Due: ${hw.dueDate} | Class: ${hw.classroom}
    </span>
    `;
  detailsDiv.appendChild(textContentWrapper); 

  // 3. Action buttons
  const actionDiv = document.createElement("div");
  actionDiv.className = "row-actions";
  
  actionDiv.appendChild(createButton("Track", () => showHomeworkDetail(docId, hw), "detail-btn"));
  actionDiv.appendChild(createButton("Edit", () => showEditModal(docId, hw), "edit-btn"));
  actionDiv.appendChild(createButton("Delete", () => showDeleteConfirmationModal(docId, hw.name), "delete-btn"));

  div.appendChild(detailsDiv);
  div.appendChild(actionDiv);
  return div;
}

// Helper function for creating buttons
function createButton(label, onClick, className) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.className = className;
  btn.addEventListener("click", onClick);
  return btn;
}

// --- Add Homework Logic ---

async function addHomework() {
  const name = eget("hwname");
  const dueDate = eget("hwdate");
  const classroom = eget("hwclass");
  if (!name || !dueDate || !classroom) {
    console.warn("Please fill all fields to add homework.");
    return;
  }
  await saveHomework(name, dueDate, classroom, teacherId);

  // Clear inputs after successful save
  document.getElementById("hwname").value = "";
  document.getElementById("hwdate").value = "";
  document.getElementById("hwclass").value = "";
}

async function saveHomework(name, dueDate, classroom, teacherId) {
  try {
    const hwRef = await addDoc(collection(db, "homework"), {
      name,
      dueDate,
      classroom,
      teacherId
    });
    const hwId = hwRef.id;
    console.log("Homework saved with ID:", hwId);
    
    // Assign to students in the specified class
    const studentsRef = collection(db, "students");
    const q = query(studentsRef, where("stdclass", "==", classroom));
    const snapshot = await getDocs(q);
    for (const studentDoc of snapshot.docs) {
      // Assuming students collection exists and has 'assignhw' array
      await updateDoc(doc(db, "students", studentDoc.id), {
        assignhw: arrayUnion(hwId)
      });
    }
    console.log(`Homework assigned to ${snapshot.size} matching students!`);
  } catch (e) {
    console.error("Failed to save homework info:", e.message);
  }
}

// --- Detail & Tracking Navigation ---

function showHomeworkDetail(docId, hw) {
  console.log("Navigating to tracking page for HW ID:", docId);
  localStorage.setItem("homeworkId", docId);
  localStorage.setItem("className", hw.classroom);
  window.location.href = "tracking.html";
}

// --- Modal Handlers for Editing ---

function showEditModal(docId, hw) {
    modalHomeworkId.textContent = docId; 
    modalNameInput.value = hw.name;
    modalDateInput.value = hw.dueDate;
    modalClassInput.value = hw.classroom;
    editModal.classList.remove("hidden");
    modalNameInput.focus();
}

async function handleModalSave() {
    const docId = modalHomeworkId.textContent;
    const newName = modalNameInput.value.trim();
    const newDueDate = modalDateInput.value.trim();
    const newClass = modalClassInput.value.trim();

    if (!newName || !newDueDate || !newClass) {
        console.warn("All fields must be filled to update homework.");
        return;
    }

    try {
        await updateDoc(doc(db, "homework", docId), {
            name: newName,
            dueDate: newDueDate,
            classroom: newClass
        });
        console.log("Homework updated successfully!");
        editModal.classList.add("hidden");
    } catch (e) {
        console.error("Failed to update homework:", e.message);
    }
}

// --- Bulk Action Handlers ---

function handleCheckboxChange(event) {
  const docId = event.target.dataset.id;
  if (event.target.checked) {
    selectedHomeworkIds.add(docId);
  } else {
    selectedHomeworkIds.delete(docId);
  }
  updateBulkActionsUI();
}

function updateBulkActionsUI() {
  const count = selectedHomeworkIds.size;
  selectedCountSpan.textContent = count;
  
  if (count > 0) {
    bulkActionsDiv.classList.remove("hidden");
  } else {
    bulkActionsDiv.classList.add("hidden");
  }
}

function showBulkDeleteConfirmation() {
  const count = selectedHomeworkIds.size;
  if (count === 0) return;

  deleteModalTitle.textContent = "Confirm Bulk Deletion";
  deleteModalText.textContent = `Are you sure you want to delete ${count} selected assignments? This action cannot be undone.`;
  
  // Set confirmation button to call the bulk handler
  deleteConfirmBtn.onclick = handleBulkDelete; 
  deleteModal.classList.remove("hidden");
}

async function handleBulkDelete() {
  deleteModal.classList.add("hidden"); 
  
  if (selectedHomeworkIds.size === 0) return;
  
  console.log(`Attempting to delete ${selectedHomeworkIds.size} documents...`);
  
  try {
    const batch = writeBatch(db);
    
    selectedHomeworkIds.forEach(docId => {
      const docRef = doc(db, "homework", docId);
      batch.delete(docRef);
    });
    
    await batch.commit();
    console.log("Bulk deletion successful!");
  } catch (e) {
    console.error("Failed to perform bulk deletion:", e.message);
  }
}

// --- Single Delete Modal Handler ---

function showDeleteConfirmationModal(docId, hwName) {
    deleteModalTitle.textContent = "Confirm Deletion";
    deleteModalText.textContent = `Are you sure you want to delete assignment: "${hwName}"? This action cannot be undone.`;
    
    // Set confirmation button to call the single delete handler
    deleteConfirmBtn.onclick = () => {
      deleteHomework(docId);
      deleteModal.classList.add("hidden");
    };
    
    deleteModal.classList.remove("hidden");
}

async function deleteHomework(docId) {
  try {
    await deleteDoc(doc(db, "homework", docId));
    console.log("Homework deleted successfully!");
  } catch (e) {
    console.error("Failed to delete homework:", e.message);
  }
}