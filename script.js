// ----- DOM References -----
const notesGrid = document.getElementById('notesGrid');
const searchInput = document.getElementById('searchInput');
const newNoteBtn = document.getElementById('newNoteBtn');
const themeToggle = document.getElementById('themeToggle');
const exportAllBtn = document.getElementById('exportAllBtn');
const importInput = document.getElementById('importInput');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');

const modalOverlay = document.getElementById('modalOverlay');
const noteTitleInput = document.getElementById('noteTitleInput');
const noteContentInput = document.getElementById('noteContentInput');
const colorPicker = document.getElementById('colorPicker');
const saveNoteBtn = document.getElementById('saveNoteBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const closeModalBtn = document.getElementById('closeModalBtn');

// ----- State -----
let notes = [];
let currentEditId = null; // null = creating a new note
let selectedColor = '#fff9c4';
let searchQuery = '';

// ----- Load / Save -----
function loadNotes() {
  const saved = localStorage.getItem('notesAppData');
  notes = saved ? JSON.parse(saved) : [];
}

function saveNotes() {
  localStorage.setItem('notesAppData', JSON.stringify(notes));
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 7);
}

// ----- File helper: trigger a browser download -----
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----- Export ALL notes as a re-importable JSON backup file -----
function exportAllNotes() {
  if (notes.length === 0) {
    alert('No notes to export yet.');
    return;
  }
  const json = JSON.stringify(notes, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(`notes-backup-${dateStr}.json`, json, 'application/json');
}

// ----- Import notes from a previously exported JSON backup -----
function importNotes(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid file format.');

      // Merge imported notes with existing ones, avoiding duplicate IDs
      const existingIds = new Set(notes.map(n => n.id));
      const newNotes = imported.filter(n => n.id && !existingIds.has(n.id));

      notes = [...newNotes, ...notes];
      saveNotes();
      renderNotes();
      alert(`Imported ${newNotes.length} note(s) successfully.`);
    } catch (err) {
      alert('Could not import this file. Make sure it\'s a valid notes backup (.json).');
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // reset so the same file can be re-imported later
}

// ----- Download a single note as a plain .txt file -----
function downloadCurrentNoteAsTxt() {
  const title = noteTitleInput.value.trim() || 'Untitled';
  const content = noteContentInput.value.trim();
  const textContent = `${title}\n${'='.repeat(title.length)}\n\n${content}`;

  const safeFilename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 40);
  downloadFile(`${safeFilename || 'note'}.txt`, textContent, 'text/plain');
}

// ----- Open Modal (create or edit) -----
function openModal(note = null) {
  if (note) {
    currentEditId = note.id;
    noteTitleInput.value = note.title;
    noteContentInput.value = note.content;
    selectedColor = note.color;
    deleteNoteBtn.style.display = 'block';
  } else {
    currentEditId = null;
    noteTitleInput.value = '';
    noteContentInput.value = '';
    selectedColor = '#fff9c4';
    deleteNoteBtn.style.display = 'none';
  }

  updateColorSelection();
  modalOverlay.classList.add('show');
  noteTitleInput.focus();
}

function closeModal() {
  modalOverlay.classList.remove('show');
  currentEditId = null;
}

// ----- Color Picker -----
function updateColorSelection() {
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.classList.toggle('selected', dot.dataset.color === selectedColor);
  });
}

colorPicker.addEventListener('click', (e) => {
  if (e.target.classList.contains('color-dot')) {
    selectedColor = e.target.dataset.color;
    updateColorSelection();
  }
});

// ----- CREATE / UPDATE -----
function saveNote() {
  const title = noteTitleInput.value.trim();
  const content = noteContentInput.value.trim();

  if (!title && !content) {
    closeModal();
    return;
  }

  if (currentEditId) {
    // UPDATE existing note
    notes = notes.map(note =>
      note.id === currentEditId
        ? { ...note, title, content, color: selectedColor, updatedAt: Date.now() }
        : note
    );
  } else {
    // CREATE new note
    notes.unshift({
      id: generateId(),
      title: title || 'Untitled',
      content,
      color: selectedColor,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  saveNotes();
  renderNotes();
  closeModal();
}

// ----- DELETE -----
function deleteNote() {
  if (!currentEditId) return;
  notes = notes.filter(note => note.id !== currentEditId);
  saveNotes();
  renderNotes();
  closeModal();
}

// ----- Pin / Unpin -----
function togglePin(id, event) {
  event.stopPropagation(); // don't open the modal when clicking the pin
  notes = notes.map(note =>
    note.id === id ? { ...note, pinned: !note.pinned } : note
  );
  saveNotes();
  renderNotes();
}

// ----- Search + Sort (pinned first, then newest) -----
function getFilteredNotes() {
  let result = notes;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      note =>
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q)
    );
  }

  return [...result].sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned - a.pinned;
    return b.updatedAt - a.updatedAt;
  });
}

// ----- Format date for display -----
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ' • ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ----- Render -----
function renderNotes() {
  const filtered = getFilteredNotes();
  notesGrid.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = searchQuery
      ? 'No notes match your search.'
      : 'No notes yet. Click "+ New Note" to create one!';
    notesGrid.appendChild(empty);
    return;
  }

  filtered.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.style.background = note.color;
    card.addEventListener('click', () => openModal(note));

    const pinIcon = document.createElement('span');
    pinIcon.className = 'pin-icon';
    pinIcon.textContent = note.pinned ? '📌' : '📍';
    pinIcon.style.opacity = note.pinned ? '1' : '0.3';
    pinIcon.title = note.pinned ? 'Unpin' : 'Pin to top';
    pinIcon.addEventListener('click', (e) => togglePin(note.id, e));

    const title = document.createElement('div');
    title.className = 'note-card-title';
    title.textContent = note.title;

    const content = document.createElement('div');
    content.className = 'note-card-content';
    content.textContent = note.content;

    const date = document.createElement('div');
    date.className = 'note-card-date';
    date.textContent = formatDate(note.updatedAt);

    card.appendChild(pinIcon);
    card.appendChild(title);
    card.appendChild(content);
    card.appendChild(date);
    notesGrid.appendChild(card);
  });
}

// ----- Dark Mode -----
function loadTheme() {
  const saved = localStorage.getItem('notesTheme');
  if (saved === 'dark') {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀️';
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  themeToggle.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('notesTheme', isDark ? 'dark' : 'light');
}

// ----- Search -----
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  renderNotes();
});

// ----- Event Listeners -----
newNoteBtn.addEventListener('click', () => openModal());
saveNoteBtn.addEventListener('click', saveNote);
deleteNoteBtn.addEventListener('click', deleteNote);
closeModalBtn.addEventListener('click', closeModal);
exportAllBtn.addEventListener('click', exportAllNotes);
importInput.addEventListener('change', importNotes);
downloadTxtBtn.addEventListener('click', downloadCurrentNoteAsTxt);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('show')) {
    closeModal();
  }
});

// ----- Init -----
loadTheme();
loadNotes();
renderNotes();