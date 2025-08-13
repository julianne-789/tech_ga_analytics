
// Search dropdown for resolutions + Category dropdown with caret and agendas.
// Selected resolutions persist, display as chips with hover ×, and highlight in dropdowns.
// NEW: Category/Agenda chips under the category field; removing them also removes their resolutions.

const DATA_URL = "../data/tech_filtered_v3.json"; // Path to resolutions data
const $ = (s) => document.querySelector(s);

const els = {
  // Resolutions search
  input: $("#selectedSearch"),
  results: $("#searchResults"),
  chips: $("#chips"),               // resolutions chips (top row)

  // Bulk actions
  selectAll: $("#selectAll"),
  clearAll: $("#clearAll"),

  // Category add (caret + agendas)
  catInput: $("#categoryInput"),
  catResults: $("#categoryResults"),

  // NEW: chips for chosen categories & agendas
  catAgChips: $("#catAgChips"),
};

let ITEMS = [];                    // [{id,title,agenda,subjects,full}]
let CATEGORIES = [];               // ["category A", ...] unique subjects
let SELECTED = new Set(JSON.parse(localStorage.getItem("selectedRes") || "[]"));

let currentList = [];              // active list in resolutions dropdown
let renderIndex = 0;
const CHUNK_SIZE = 120;

let currentCats = [];              // active list in categories dropdown

// Maps for category -> agendas and agenda -> resolution IDs
let agendasByCat = new Map();      // cat -> Set(agenda)
let resByAgenda  = new Map();      // agenda -> Set(resolution IDs)

// NEW: Track which categories/agendas the user explicitly added (for chips)
let SELECTED_CATS = new Set(JSON.parse(localStorage.getItem("selectedCats") || "[]"));
let SELECTED_AGENDAS = new Set(JSON.parse(localStorage.getItem("selectedAgendas") || "[]"));

init().catch(console.error);

async function init() {
  // Load + normalize + dedupe resolutions
  const r = await fetch(DATA_URL);
  if (!r.ok) throw new Error(`Failed to load ${DATA_URL} (${r.status})`);
  const data = await r.json();

  const byId = new Map();
  for (const row of data) {
    const id = norm(row.resolution);
    if (!id) continue;
    if (!byId.has(id)) {
      const title = norm(row.res_title || row.title || "");
      const agenda = norm(row.agenda_title);
      const subjects = norm(row.subjects);
      byId.set(id, {
        id,
        title,
        agenda,
        subjects,
        full: `${id} ${title} ${agenda} ${subjects}`.toLowerCase(),
      });
    }
  }
  ITEMS = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));

  // Categories
  CATEGORIES = Array.from(new Set(ITEMS.map(i => i.subjects).filter(Boolean))).sort();

  // Build maps (normalized, unique, complete)
  agendasByCat = new Map();  // cat -> Set(agenda)
  resByAgenda  = new Map();  // agenda -> Set(resolution IDs)

  const clean = (s) => (s == null ? "" : String(s).trim());

  for (const it of ITEMS) {
    const catRaw = clean(it.subjects);
    const agRaw  = clean(it.agenda);

    if (catRaw && agRaw) {
      // init cat -> agendas
      if (!agendasByCat.has(catRaw)) agendasByCat.set(catRaw, new Set());
      agendasByCat.get(catRaw).add(agRaw);
    }

    if (agRaw) {
      // init agenda -> res IDs
      if (!resByAgenda.has(agRaw)) resByAgenda.set(agRaw, new Set());
      resByAgenda.get(agRaw).add(it.id);
    }
  }


  // Events: resolutions search
  els.input.addEventListener("focus", onFocusShowAllRes);
  els.input.addEventListener("input", onTypeRes);
  els.input.addEventListener("keydown", onKeyRes);
  els.results.addEventListener("scroll", onDropdownScrollRes);

  // Events: categories (caret + agendas)
  els.catInput.addEventListener("focus", onFocusShowAllCats);
  els.catInput.addEventListener("input", onTypeCats);
  els.catInput.addEventListener("keydown", onKeyCat);

  // Bulk actions
  els.selectAll.addEventListener("click", () => {
    for (const it of ITEMS) SELECTED.add(it.id);
    persist();
    renderSelected();
    refreshDropdownSelectionState();
  });
  els.clearAll.addEventListener("click", () => {
    SELECTED.clear();
    // NEW: clear cat/agenda picks visually too, since nothing remains selected
    SELECTED_CATS.clear();
    SELECTED_AGENDAS.clear();
    persist();
    renderSelected();
    renderCatAgChips();
    refreshDropdownSelectionState();
  });

  // Dismiss dropdowns on outside click
  document.addEventListener("click", (e) => {
    if (!els.results.contains(e.target) && e.target !== els.input) hideResDropdown();
    if (!els.catResults.contains(e.target) && e.target !== els.catInput) hideCatDropdown();
  });

  // Initial renders
  renderSelected();
  renderCatAgChips(); // NEW
}

/* =========================
   Resolutions dropdown
   ========================= */
function onFocusShowAllRes() {
  if (!els.input.value.trim()) openResDropdown(ITEMS);
}
function onTypeRes() {
  const q = els.input.value.trim().toLowerCase();
  if (!q) { openResDropdown(ITEMS); return; }
  const hits = ITEMS.filter(it => it.full.includes(q));
  openResDropdown(hits);
}
function onKeyRes(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const first = els.results.querySelector(".dropdown-item");
    if (first) first.click();
  }
  if (e.key === "Escape") hideResDropdown();
}
function openResDropdown(list) {
  currentList = list;
  renderIndex = 0;
  els.results.innerHTML = "";
  if (!currentList.length) { hideResDropdown(); return; }
  appendResChunk();
  els.results.style.display = "block";
  refreshDropdownSelectionState();
}
function onDropdownScrollRes() {
  const { scrollTop, clientHeight, scrollHeight } = els.results;
  if (scrollTop + clientHeight >= scrollHeight - 40) appendResChunk();
}
function appendResChunk() {
  const slice = currentList.slice(renderIndex, renderIndex + CHUNK_SIZE);
  slice.forEach((it) => {
    const row = document.createElement("div");
    row.className = "dropdown-item";
    row.dataset.id = it.id;
    row.innerHTML =
      `<strong>${esc(it.id)}</strong>${it.title ? ` — ${esc(it.title)}` : ""}<br>` +
      `<span class="meta">${esc(it.subjects)}${it.agenda ? " | " + esc(it.agenda) : ""}</span>`;
    if (SELECTED.has(it.id)) row.classList.add("selected-result");
    row.addEventListener("click", () => {
      if (SELECTED.has(it.id)) return;   // add-only
      SELECTED.add(it.id);
      persist();
      renderSelected();
      row.classList.add("selected-result");
      els.input.focus();                 // keep it open for rapid adds
    });
    els.results.appendChild(row);
  });
  renderIndex += slice.length;
}
function hideResDropdown() {
  els.results.style.display = "none";
  els.results.innerHTML = "";
  currentList = [];
  renderIndex = 0;
}

/* Paint selection state in open dropdowns (resolutions + categories/agendas) */
function refreshDropdownSelectionState() {
  // Resolutions
  if (els.results.style.display === "block") {
    els.results.querySelectorAll(".dropdown-item").forEach((row) => {
      const id = row.dataset.id;
      if (SELECTED.has(id)) row.classList.add("selected-result");
      else row.classList.remove("selected-result");
    });
  }
  // Categories + agendas
  if (els.catResults.style.display === "block") {
    // Category rows
    els.catResults.querySelectorAll(".cat-row").forEach((row) => {
      const cat = row.dataset.cat;
      const anyInCat = ITEMS.some(i => i.subjects === cat && SELECTED.has(i.id));
      if (anyInCat) row.classList.add("selected-result");
      else row.classList.remove("selected-result");
    });
    // Agenda rows
    els.catResults.querySelectorAll(".agenda-row").forEach((row) => {
      const ag = row.dataset.agenda;
      const anyInAgenda = Array.from(resByAgenda.get(ag) || []).some(id => SELECTED.has(id));
      if (anyInAgenda) row.classList.add("selected-result");
      else row.classList.remove("selected-result");
    });
  }
}

/* =========================
   Categories dropdown (caret + agendas)
   ========================= */
function onFocusShowAllCats() {
  if (!els.catInput.value.trim()) openCatDropdown(CATEGORIES);
}
function onTypeCats() {
  const q = els.catInput.value.trim().toLowerCase();
  if (!q) { openCatDropdown(CATEGORIES); return; }
  const hits = CATEGORIES.filter(c => c.toLowerCase().includes(q));
  openCatDropdown(hits);
}
function onKeyCat(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const first = els.catResults.querySelector(".cat-row, .agenda-row");
    if (first) first.click();
  }
  if (e.key === "Escape") hideCatDropdown();
}

function openCatDropdown(list) {
  currentCats = list;
  els.catResults.innerHTML = "";
  if (!currentCats.length) { hideCatDropdown(); return; }

  currentCats.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "cat-row";
    row.dataset.cat = cat;

    // caret (click to expand/collapse agendas)
    const caret = document.createElement("span");
    caret.className = "caret";
    caret.textContent = "›";

    // category name (click to add entire category)
    const name = document.createElement("span");
    name.className = "cat-name";
    name.textContent = cat;

    // mark category blue if any resolution in cat is selected
    if (ITEMS.some(i => (i.subjects && i.subjects.trim()) === cat && SELECTED.has(i.id))) {
      row.classList.add("selected-result");
    }

    // nested agendas submenu (ALL agendas for this category)
    const submenu = document.createElement("div");
    submenu.className = "submenu";
    const agendasSet = agendasByCat.get(cat) || new Set();
    const agendas = Array.from(agendasSet).filter(Boolean).sort((a, b) => a.localeCompare(b));

    agendas.forEach((ag) => {
      const aRow = document.createElement("div");
      aRow.className = "agenda-row";
      aRow.dataset.agenda = ag;
      aRow.textContent = ag;

      // highlight agenda if any of its resolutions is selected
      const ids = Array.from(resByAgenda.get(ag) || []);
      const anyInAgenda = ids.some(id => SELECTED.has(id));
      if (anyInAgenda) aRow.classList.add("selected-result");

      // click agenda -> add all resolutions under this agenda (append-only)
      aRow.addEventListener("click", (e) => {
        e.stopPropagation();
        addAgendaResolutions(ag);
        markAgendaPicked(ag);           // keep your chips in sync
        refreshDropdownSelectionState();
      });

      submenu.appendChild(aRow);
    });

    // click caret -> toggle submenu (no add)
    caret.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = submenu.style.display === "block";
      submenu.style.display = isOpen ? "none" : "block";
      caret.classList.toggle("open", !isOpen);
    });

    // click name -> add entire category (append-only)
    name.addEventListener("click", (e) => {
      e.stopPropagation();
      addCategoryResolutions(cat);
      markCategoryPicked(cat);          // keep your chips in sync
      refreshDropdownSelectionState();
    });

    row.appendChild(name);
    row.appendChild(caret);

    // Append the category row, then its submenu with ALL agendas
    els.catResults.appendChild(row);
    els.catResults.appendChild(submenu);
  });

  els.catResults.style.display = "block";
}


function hideCatDropdown() {
  els.catResults.style.display = "none";
  els.catResults.innerHTML = "";
  currentCats = [];
}

/* =========================
   Add via Category / Agenda (append-only)
   ========================= */
function addCategoryResolutions(cat) {
  const matches = ITEMS.filter(i => i.subjects === cat);
  for (const it of matches) {
    if (SELECTED.has(it.id)) {
      SELECTED.delete(it.id); // move to end (most recent)
      SELECTED.add(it.id);
    } else {
      SELECTED.add(it.id);
    }
  }
  persist();
  renderSelected();
}

function addAgendaResolutions(agenda) {
  const ids = Array.from(resByAgenda.get(agenda) || []);
  for (const id of ids) {
    if (SELECTED.has(id)) {
      SELECTED.delete(id);
      SELECTED.add(id);
    } else {
      SELECTED.add(id);
    }
  }
  persist();
  renderSelected();
}

/* =========================
   Category/Agenda "picked" chips (NEW)
   ========================= */
function markCategoryPicked(cat) {
  if (SELECTED_CATS.has(cat)) {
    // move to "most recent"
    SELECTED_CATS.delete(cat);
  }
  SELECTED_CATS.add(cat);
  persist();
  renderCatAgChips();
}

function markAgendaPicked(agenda) {
  if (SELECTED_AGENDAS.has(agenda)) {
    SELECTED_AGENDAS.delete(agenda);
  }
  SELECTED_AGENDAS.add(agenda);
  persist();
  renderCatAgChips();
}

function renderCatAgChips() {
  if (!els.catAgChips) return;

  const label = document.getElementById("catAgLabel");
  const hasAny = SELECTED_CATS.size > 0 || SELECTED_AGENDAS.size > 0;

  // Show/hide the "Chosen categories / agendas" label
  if (label) label.style.display = hasAny ? "block" : "none";

  // Render chips
  els.catAgChips.innerHTML = "";
  if (!hasAny) return;

  // Categories
  for (const cat of SELECTED_CATS) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = cat;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.setAttribute("aria-label", `Remove category ${cat}`);
    close.textContent = "×";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      removeCategory(cat);
    });

    chip.appendChild(close);
    els.catAgChips.appendChild(chip);
  }

  // Agendas
  for (const ag of SELECTED_AGENDAS) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = ag;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.setAttribute("aria-label", `Remove agenda ${ag}`);
    close.textContent = "×";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      removeAgenda(ag);
    });

    chip.appendChild(close);
    els.catAgChips.appendChild(chip);
  }
}


function removeCategory(cat) {
  // Remove its resolutions from SELECTED
  const ids = ITEMS.filter(i => i.subjects === cat).map(i => i.id);
  for (const id of ids) SELECTED.delete(id);

  // Also remove any agenda chips that belong to this category
  const agendas = Array.from(agendasByCat.get(cat) || []);
  for (const ag of agendas) SELECTED_AGENDAS.delete(ag);

  // Finally remove the category chip
  SELECTED_CATS.delete(cat);

  persist();
  renderSelected();
  renderCatAgChips();
  refreshDropdownSelectionState();
}

function removeAgenda(agenda) {
  const ids = Array.from(resByAgenda.get(agenda) || []);
  for (const id of ids) SELECTED.delete(id);

  SELECTED_AGENDAS.delete(agenda);

  persist();
  renderSelected();
  renderCatAgChips();
  refreshDropdownSelectionState();
}

/* =========================
   Chips (for resolutions)
   ========================= */
function renderSelected() {
  els.chips.innerHTML = "";
  // Keep insertion order (most recent at the end)
  for (const id of SELECTED) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = id;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.setAttribute("aria-label", `Remove ${id}`);
    close.textContent = "×";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      SELECTED.delete(id);
      persist();
      renderSelected();
      refreshDropdownSelectionState();
    });

    chip.appendChild(close);
    els.chips.appendChild(chip);
  }
}

/* =========================
   Persistence & utils
   ========================= */
function persist() {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("selectedRes", JSON.stringify(Array.from(SELECTED)));
    localStorage.setItem("selectedCats", JSON.stringify(Array.from(SELECTED_CATS)));
    localStorage.setItem("selectedAgendas", JSON.stringify(Array.from(SELECTED_AGENDAS)));
  } else {
    console.warn("localStorage is not available.");
  }
}
function norm(v) { return v == null ? "" : String(v).trim(); }
function esc(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

window.addEventListener("beforeunload", () => {
  console.log("Persisting data before unload...");
  persist();
});