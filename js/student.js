// student.js
import {
  collection, addDoc, query, where, onSnapshot,
  doc, deleteDoc, updateDoc, writeBatch, getDocs, arrayUnion
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
// NOTE: firebase.js is assumed to initialize and export 'db'
import { db } from "./firebase.js";
// NOTE: structure.js is assumed to contain Student, attach, eget
import { Student, attach, eget } from "./structure.js";

let allStudents = [];
let teacherId = localStorage.getItem("teacherId");
let selectedStudentIds = new Set(); // To track selected items for bulk delete

// Modal Elements
const editModal = document.getElementById("edit-student-modal");
const modalNameInput = document.getElementById("modal-name-input");
const modalClassInput = document.getElementById("modal-class-input");
const modalStudentId = document.getElementById("edit-student-id");
const modalSaveBtn = document.getElementById("modal-save-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");

// NEW: Delete Modal Elements
const deleteModal = document.getElementById("delete-confirmation-modal");
const deleteModalTitle = document.getElementById("delete-modal-title");
const deleteModalText = document.getElementById("delete-modal-text");
const deleteCancelBtn = document.getElementById("delete-cancel-btn");
const deleteConfirmBtn = document.getElementById("delete-confirm-btn"); // Confirmed in init

// NEW: Bulk Action Elements
const bulkActionsDiv = document.getElementById("bulk-actions");
const bulkDeleteBtn = document.getElementById("bulk-delete-btn");
const selectedCountSpan = document.getElementById("selected-count");

const studentCountSpan = document.getElementById("student-count");

initStudentPage(teacherId);

// --- Initialization & Setup ---

function initStudentPage(userId) {
  if (!userId) {
    console.error("Teacher ID not found. Redirecting to login.");
    return;
  }

  attach("stdaddbtn", addStudent);
  attach("stdimpbtn", importStudent);

  // Modal Event Listeners
  modalCancelBtn.addEventListener("click", () => editModal.classList.add("hidden"));
  modalSaveBtn.addEventListener("click", handleModalSave);

  // NEW: Delete Modal Listeners
  deleteCancelBtn.addEventListener("click", () => deleteModal.classList.add("hidden"));

  // NEW: Bulk Delete Listener
  bulkDeleteBtn.addEventListener("click", showBulkDeleteConfirmation);


  listenToStudents(userId);
}

// --- Import Logic (Unchanged) ---
async function importStudent() {
  const sheetUrl = eget("sheetlink");
  if (!sheetUrl) return console.warn("Please enter a Google Sheet URL."); // Replaced alert
  const csvUrl = convertSheetToCSV(sheetUrl);
  if (!csvUrl) return console.error("Invalid Google Sheet link format."); // Replaced alert
  try {
    const response = await fetch(csvUrl);
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    let added = 0;
    for (const row of rows) {
      const [name, stdclass] = row;
      if (!name || !stdclass) continue;
      await saveStudent(name.trim(), stdclass.trim());
      added++;
    }
    console.log(`${added} students imported successfully!`); // Replaced alert
  } catch (err) {
    console.error("Failed to import students:", err);
    console.error("Error importing students. Please check the Sheet link."); // Replaced alert
  }
}

function convertSheetToCSV(sheetUrl) {
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return null;
  const sheetId = match[1];
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
}

function parseCSV(text) {
  // Simple CSV parser
  return text
    .split("\n")
    .map(line => line.split(",").map(v => v.replace(/"/g, "").trim()))
    .filter(row => row.length >= 2 && row[0]);
}


// --- Student List Listening & Rendering ---

function listenToStudents(teacherId) {
  const stdlistDiv = document.getElementById("stdlist");
  const q = query(collection(db, "students"), where("teacherId", "==", teacherId));
  onSnapshot(q, (snapshot) => {
    allStudents = [];
    selectedStudentIds.clear(); // Clear selections on re-render
    updateBulkActionsUI(); // Hide bulk actions on re-render
    stdlistDiv.innerHTML = "";
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const std = new Student(data.stdname, data.stdclass, teacherId, data.assignhw, data.finishedhw);
      allStudents.push({ id: docSnap.id, ...data });
      const studentDiv = createStudentElement(std, docSnap.id);
      stdlistDiv.appendChild(studentDiv);
    });

    studentCountSpan.textContent = allStudents.length;

    if (allStudents.length === 0) {
      stdlistDiv.innerHTML = '<p class="loading-text" style="color:#7f8c8d;">No students added yet. Use the cards above to add them.</p>';
    }
  });
}

function createStudentElement(std, docId) {
  const div = document.createElement("div");
  div.className = "student-row";

  // 1. Label and Custom Checkbox Structure (NEW, outside student-details)
  const checkboxLabel = document.createElement("label");
  checkboxLabel.className = "homework-checkbox-label"; // Reusing class for visual consistency

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "homework-checkbox"; // Reusing class for visual consistency
  checkbox.dataset.id = docId;
  checkbox.addEventListener('change', handleCheckboxChange);
  checkboxLabel.appendChild(checkbox);

  const customCheckbox = document.createElement("span");
  customCheckbox.className = "custom-checkbox"; // Reusing class for visual consistency
  checkboxLabel.appendChild(customCheckbox);

  div.appendChild(checkboxLabel);

  // 2. Student details
  const detailsDiv = document.createElement("div");
  detailsDiv.className = "student-details";
  detailsDiv.innerHTML = `<span class="student-name">${std.stdname}</span>
                          <span class="student-class">(${std.stdclass})</span>`;

  // 3. Action buttons
  const actionDiv = document.createElement("div");
  actionDiv.className = "row-actions";
  actionDiv.appendChild(createButton("Edit", () => showEditModal(docId, std), "edit-btn"));
  actionDiv.appendChild(createButton("Delete", () => showDeleteConfirmationModal(docId, std.stdname), "delete-btn"));

  div.appendChild(detailsDiv);
  div.appendChild(actionDiv);
  return div;
}

// Helper function for creating buttons (updated with modern classes)
function createButton(label, handler, className) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.className = className;
  btn.addEventListener("click", handler);
  return btn;
}

// --- CRUD Operations (Add MODIFIED) ---

async function addStudent() {
  const stdname = eget("stdname");
  const stdclass = eget("stdclass");
  if (!stdname || !stdclass) return console.warn("Please fill all fields.");

  await saveStudent(stdname, stdclass);

  // Clear inputs after successful save
  document.getElementById("stdname").value = "";
  document.getElementById("stdclass").value = "";
}

/**
 * Saves a new student and automatically assigns existing homework that matches the class.
 * NOTE: The logic for getting matching homework has been added here.
 */
async function saveStudent(stdname, stdclass) {
  let newStudentRef;
  try {
    // 1. Add the new student document
    newStudentRef = await addDoc(collection(db, "students"), {
      stdname,
      stdclass,
      teacherId,
      assignhw: [],
      finishedhw: []
    });
    console.log(`Student ${stdname} saved successfully with ID: ${newStudentRef.id}!`);

    // 2. Query for existing homework that matches the student's class
    const homeworkRef = collection(db, "homework");
    const q = query(
      homeworkRef,
      where("teacherId", "==", teacherId),
      where("classroom", "==", stdclass) // Match the student's class
    );
    const homeworkSnapshot = await getDocs(q);

    // 3. Collect the IDs of matching homework
    const matchingHomeworkIds = homeworkSnapshot.docs.map(doc => doc.id);

    // 4. Update the student document's 'assignhw' with the matching IDs
    if (matchingHomeworkIds.length > 0) {
      await updateDoc(doc(db, "students", newStudentRef.id), {
        // Use arrayUnion with the spread operator to add all IDs at once
        assignhw: arrayUnion(...matchingHomeworkIds)
      });
      console.log(`Assigned ${matchingHomeworkIds.length} existing homework items to ${stdname}.`);
    }

  } catch (e) {
    console.error("Failed to save or assign homework to student:", e.message);
  }
}

// --- Modal Handlers for Editing (Unchanged) ---

function showEditModal(docId, std) {
  modalStudentId.textContent = docId; // Store doc ID
  modalNameInput.value = std.stdname;
  modalClassInput.value = std.stdclass;
  editModal.classList.remove("hidden");
  modalNameInput.focus();
}

async function handleModalSave() {
  const docId = modalStudentId.textContent;
  const newName = modalNameInput.value.trim();
  const newClass = modalClassInput.value.trim();

  if (!newName || !newClass) {
    console.warn("Name and Class fields cannot be empty.");
    return;
  }

  try {
    await updateDoc(doc(db, "students", docId), {
      stdname: newName,
      stdclass: newClass
    });
    console.log("Student updated successfully!");
    editModal.classList.add("hidden");
  } catch (e) {
    console.error("Failed to update student:", e.message);
  }
}

// --- NEW Bulk Action Handlers (Unchanged) ---

function handleCheckboxChange(event) {
  const docId = event.target.dataset.id;
  if (event.target.checked) {
    selectedStudentIds.add(docId);
  } else {
    selectedStudentIds.delete(docId);
  }
  updateBulkActionsUI();
}

function updateBulkActionsUI() {
  const count = selectedStudentIds.size;
  selectedCountSpan.textContent = count;

  if (count > 0) {
    bulkActionsDiv.classList.remove("hidden");
  } else {
    bulkActionsDiv.classList.add("hidden");
  }
}

function showBulkDeleteConfirmation() {
  const count = selectedStudentIds.size;
  if (count === 0) return;

  deleteModalTitle.textContent = "Confirm Bulk Deletion";
  deleteModalText.textContent = `Are you sure you want to delete ${count} selected students? This action cannot be undone.`;

  // Set confirmation button to call the bulk handler
  deleteConfirmBtn.onclick = handleBulkDelete;
  deleteModal.classList.remove("hidden");
}

async function handleBulkDelete() {
  deleteModal.classList.add("hidden");

  if (selectedStudentIds.size === 0) return;

  console.log(`Attempting to delete ${selectedStudentIds.size} documents...`);

  try {
    const batch = writeBatch(db);

    selectedStudentIds.forEach(docId => {
      const docRef = doc(db, "students", docId);
      batch.delete(docRef);
    });

    await batch.commit();
    console.log("Bulk deletion successful!");
  } catch (e) {
    console.error("Failed to perform bulk deletion:", e.message);
  }
}


// --- Delete Modal Handler (Now for Single Delete too) (Unchanged) ---

function showDeleteConfirmationModal(docId, name) {
  deleteModalTitle.textContent = "Confirm Deletion";
  deleteModalText.textContent = `Are you sure you want to delete student: "${name}"? This action cannot be undone.`;

  // Set confirmation button to call the single delete handler
  deleteConfirmBtn.onclick = () => {
    deleteStudent(docId);
    deleteModal.classList.add("hidden");
  };

  deleteModal.classList.remove("hidden");
}

async function deleteStudent(docId) {
  try {
    await deleteDoc(doc(db, "students", docId));
    console.log("Student deleted successfully!");
  } catch (e) {
    console.error("Failed to delete student:", e.message);
  }
}