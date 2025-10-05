import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase.js";

initAdminPage();

async function initAdminPage() {
    // Select the specific container for the list, not the whole body
    const listContainer = document.getElementById("teacher-list-container");
    
    // Check for admin status (Good practice for production apps)
    const currentTeacherId = localStorage.getItem("teacherId");
    if (!currentTeacherId) {
        listContainer.innerHTML = '<p class="loading-text" style="color:var(--delete-color);">Access Denied. Please log in.</p>';
        return;
    }

    try {
        const teachers = await fetchTeachers();
        renderTeacherList(listContainer, teachers);
    } catch (err) {
        showError(listContainer, err);
    }
}

async function fetchTeachers() {
    const teachersRef = collection(db, "teachers");
    const snapshot = await getDocs(teachersRef);
    if (snapshot.empty) return [];
    
    return snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
    }));
}

function renderTeacherList(container, teachers) {
    container.innerHTML = ""; // Clear the loading text
    
    if (teachers.length === 0) {
        container.innerHTML = '<p class="loading-text">No teachers found in the database.</p>';
        return;
    }
    
    teachers.forEach(teacher => {
        const teacherCard = createTeacherElement(teacher);
        container.appendChild(teacherCard);
    });
}

function createTeacherElement(teacher) {
    const { id, name = "Unnamed Teacher", email = "N/A", role = "teacher" } = teacher;
    
    // Card container
    const card = document.createElement("div");
    card.className = "teacher-card";
    
    // Info block
    const infoDiv = document.createElement("div");
    infoDiv.className = "teacher-info";
    infoDiv.innerHTML = `
        <span class="teacher-name">${name}</span>
        <span class="teacher-email">${email}</span>
        <span class="teacher-role">Role: ${role.toUpperCase()}</span>
    `;
    
    // Login button
    const btn = document.createElement("button");
    btn.textContent = "Login as User";
    btn.className = "login-btn";
    btn.addEventListener("click", () => handleLogin(id, name));
    
    card.appendChild(infoDiv);
    card.appendChild(btn);
    
    return card;
}

function handleLogin(teacherId, teacherName) {
    const currentAdminId = localStorage.getItem("teacherId");
    if (currentAdminId) {
        localStorage.setItem("originalAdminId", currentAdminId); 
    }
    localStorage.setItem("teacherId", teacherId);
    console.log(`Admin action: Logged in as ${teacherName} (${teacherId})`);
    window.location.href = "index.html";
}

function showError(container, err) {
    console.error("Error loading teachers:", err);
    container.innerHTML = `<p class="loading-text" style="color:var(--delete-color);">
        Failed to load teachers: ${err.message || 'Check console for details.'}
    </p>`;

}
