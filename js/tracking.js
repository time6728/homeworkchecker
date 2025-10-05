import {
  collection, query, where, onSnapshot,
  doc, updateDoc, arrayUnion, arrayRemove, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { db } from "./firebase.js";
import { Student } from "./structure.js"; 

let teacherId = localStorage.getItem("teacherId");
let homeworkId = localStorage.getItem("homeworkId");
let className = localStorage.getItem("className");

let allStudents = [];
let homeworkName = "Loading...";

const hwNameElement = document.getElementById("hw-name");
const hwClassElement = document.getElementById("hw-class");
const statusSummaryElement = document.getElementById("status-summary");

initTrackingPage();

// --- Initialization & Setup ---

function initTrackingPage() {
    if (!teacherId || !homeworkId || !className) {
        console.error("Missing tracking context. Redirecting back.");
        window.location.href = "homework.html";
        return;
    }

    // FIX: Display basic context immediately AND remove the placeholder class
    hwClassElement.textContent = className;
    hwClassElement.classList.remove("loading-placeholder"); // <--- THIS IS THE FIX

    // Fetch and display homework details (name)
    fetchHomeworkDetails(homeworkId);

    const trackingDiv = document.getElementById("trackinglist");
    attachStudentListener(trackingDiv);
}

// --- Data Fetching ---

// Fetches the name of the assignment being tracked for context
async function fetchHomeworkDetails(id) {
    try {
        const hwRef = doc(db, "homework", id);
        const docSnap = await getDoc(hwRef);
        if (docSnap.exists()) {
            homeworkName = docSnap.data().name;
            hwNameElement.textContent = homeworkName;
            hwNameElement.classList.remove("loading-placeholder");
        } else {
            hwNameElement.textContent = "Unknown Assignment";
            hwNameElement.classList.remove("loading-placeholder");
        }
    } catch (e) {
        console.error("Error fetching homework details:", e);
        hwNameElement.textContent = "Error Loading";
    }
}

function attachStudentListener(trackingDiv) {
    // Queries for students belonging to this teacher and this class
    const q = query(
      collection(db, "students"),
      where("teacherId", "==", teacherId),
      where("stdclass", "==", className)
    );
    onSnapshot(q, (snapshot) => handleSnapshot(snapshot, trackingDiv));
}

// --- Data Handling & Rendering ---

function handleSnapshot(snapshot, trackingDiv) {
  allStudents = [];
  trackingDiv.innerHTML = "";
  let sentCount = 0;
  let totalCount = 0;

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const std = new Student(
      data.stdname,
      data.stdclass,
      teacherId,
      data.assignhw || [],
      data.finishedhw || []
    );
    
    // Only process students who have been assigned this homework
    if (!std.assignhw.includes(homeworkId)) return;
    
    allStudents.push({ id: docSnap.id, ...data });
    const studentDiv = createStudentTrackingElement(std, docSnap.id);
    trackingDiv.appendChild(studentDiv);
    
    // Update counts for summary
    totalCount++;
    if (std.finishedhw.includes(homeworkId)) {
        sentCount++;
    }
  });
  
  // Update the summary in the header
  statusSummaryElement.textContent = `${sentCount} Sent / ${totalCount} Total`;

  if (allStudents.length === 0) {
    trackingDiv.innerHTML = '<p class="loading-text" style="color:#7f8c8d;">No students found in this class with this assignment.</p>';
  }
}

function createStudentTrackingElement(std, docId) {
  const div = document.createElement("div");
  const isFinished = std.finishedhw.includes(homeworkId);
  
  // Apply visual styling based on status
  div.className = `student-tracking-row ${isFinished ? 'status-sent' : ''}`;

  // 1. Student Name and Class details
  const detailsDiv = document.createElement("div");
  detailsDiv.className = "student-details";
  detailsDiv.innerHTML = `
    ${std.stdname} 
    <span class="student-class-label">(${std.stdclass})</span>
  `;

  // 2. Status Badge
  const statusBadge = document.createElement("span");
  statusBadge.textContent = isFinished ? "SENT" : "PENDING";
  statusBadge.className = `status-badge ${isFinished ? 'badge-sent' : 'badge-pending'}`;

  // 3. Toggle Button
  const toggleBtn = createButton(
    isFinished ? "Mark Not Sent" : "Mark Sent", 
    () => toggleStudentStatus(docId, std, isFinished),
    isFinished ? "toggle-btn btn-mark-not-sent" : "toggle-btn btn-mark-sent"
  );
  
  div.append(detailsDiv, statusBadge, toggleBtn);
  return div;
}

function createButton(label, onClick, className) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.className = className;
  btn.addEventListener("click", onClick);
  return btn;
}

// --- Update Logic ---

async function toggleStudentStatus(docId, std, isFinished) {
  const ref = doc(db, "students", docId);
  try {
    if (isFinished) {
      await updateDoc(ref, { finishedhw: arrayRemove(homeworkId) });
      console.log(`STATUS UPDATED: ${std.stdname} marked as NOT sent`);
    } else {
      await updateDoc(ref, { finishedhw: arrayUnion(homeworkId) });
      console.log(`STATUS UPDATED: ${std.stdname} marked as SENT`);
    }
    // NOTE: Real-time listener handles the visual update automatically.
  } catch (e) {
    console.error("Error updating student:", e.message);
  }
}