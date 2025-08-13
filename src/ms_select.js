
// Member States selector mirroring res_select.js, with UX tweaks:
// • Typeahead MS search
// • Category input where ONLY "Geographic Regions" has a caret to expand subregions
// • Other categories (G7, G77, NATO, BRICS, Global South, Global Superpowers) are single-click adds
// • Chips for selected MS and for chosen categories/subcategories
// • Sort toggle: Selection Order ↔ A→Z (display-only, persists in localStorage as "msSortMode")
// • Resolver returns exact dataset labels (e.g., “Türkiye”) from friendly inputs
// • Duplicates across categories are ignored (first one kept), thanks to Set()

const DATA_URL = "../data/tech_filtered_v3.json";
const $ = (s) => document.querySelector(s);

const els = {
  // MS search
  input: $("#selectedSearch"),
  results: $("#searchResults"),
  chips: $("#chips"),

  // Bulk actions
  selectAll: $("#selectAll"),
  clearAll: $("#clearAll"),

  // Sort toggle
  sortToggle: $("#sortToggle"),
  sortModeText: $("#sortModeText"),

  // Category input + results (Step 2 uses region* IDs)
  catInput: $("#regionInput"),
  catResults: $("#regionResults"),

  // Chips for chosen categories & subcategories
  catAgChips: $("#catAgChips"),
  downloadBtn: $("#downloadCsvBtn")
};

// Store the full dataset for CSV filtering
let FULL_DATA = [];

let ITEMS = [];    // [{ id:name, full }]
let ALL_MS = [];   // canonical names from dataset

function readJSON(key, fallback) {
  try { 
    return JSON.parse(localStorage.getItem(key) || fallback); 
  } catch { 
    return JSON.parse(fallback); 
  }
}

function getSelectedMS() {
  return new Set(readJSON("selectedMS", "[]"));
}

function getSelectedRes() {
  return new Set(readJSON("selectedRes", "[]"));
}

// Initialize selections
let SELECTED = getSelectedMS();      // Member States
let SELECTED_RES = getSelectedRes(); // Resolutions

  

let currentList = [];               // active list in MS dropdown
let renderIndex = 0;
const CHUNK_SIZE = 120;

let currentCats = [];               // active list in categories dropdown

// Sort mode: "selection" | "alpha" (persisted only for MS)
let SORT_MODE = localStorage.getItem("msSortMode") || "selection";
function updateSortToggleLabel() {
  if (!els.sortToggle) return;
  const isAlpha = SORT_MODE === "alpha";
  if (els.sortModeText) {
    els.sortModeText.textContent = isAlpha ? "A → Z" : "Selection Order";
  }
  els.sortToggle.setAttribute("aria-pressed", String(isAlpha));
  els.sortToggle.setAttribute("data-mode", SORT_MODE); // for CSS styling hooks
}
function toggleSortMode() {
  SORT_MODE = SORT_MODE === "selection" ? "alpha" : "selection";
  localStorage.setItem("msSortMode", SORT_MODE);
  updateSortToggleLabel();
  renderSelected();
}

// Top-level categories (ONLY "Geographic Regions" expands)
const TOP_CATEGORIES = [
  "Geographic Regions",
  "G7",
  "G77",
  "NATO",
  "BRICS",
  "Global South",
  "Global Superpowers",
];

// All region options live INSIDE "Geographic Regions"
const REGION_SUBCATS = [
  // Africa
  "North Africa","West Africa","Central Africa","East Africa","Southern Africa",
  // Americas
  "North America","Central America","Caribbean","South America","Latin America",
  // Asia
  "Middle East","Central Asia","South Asia","Southeast Asia","East Asia","Caucasus",
  // Europe
  "Western Europe","Eastern Europe","Balkans","Baltics",
  // Oceania
  "Pacific Islands"
];

// Category definitions
const GROUPS = {
  // The only expandable category
  "Geographic Regions": {
    children: REGION_SUBCATS.slice(),
    members: {
      "North Africa": ["ALGERIA","EGYPT","LIBYA","MOROCCO","SUDAN","TUNISIA"],
      "West Africa": [
        "BENIN","BURKINA FASO","CABO VERDE","CÔTE D'IVOIRE","GAMBIA","GHANA","GUINEA",
        "GUINEA-BISSAU","LIBERIA","MALI","MAURITANIA","NIGER","NIGERIA","SENEGAL",
        "SIERRA LEONE","TOGO"
      ],
      "Central Africa": [
        "ANGOLA","CAMEROON","CENTRAL AFRICAN REPUBLIC","CHAD","CONGO",
        "DEMOCRATIC REPUBLIC OF THE CONGO","EQUATORIAL GUINEA","GABON",
        "SAO TOME AND PRINCIPE"
      ],
      "East Africa": [
        "BURUNDI","COMOROS","DJIBOUTI","ERITREA","ETHIOPIA","KENYA","MADAGASCAR",
        "MALAWI","MAURITIUS","MOZAMBIQUE","RWANDA","SEYCHELLES","SOMALIA",
        "SOUTH SUDAN","UGANDA","UNITED REPUBLIC OF TANZANIA","ZAMBIA","ZIMBABWE"
      ],
      "Southern Africa": ["BOTSWANA","ESWATINI","LESOTHO","NAMIBIA","SOUTH AFRICA"],

      "North America": ["CANADA","MEXICO","UNITED STATES"],
      "Central America": ["BELIZE","COSTA RICA","EL SALVADOR","GUATEMALA","HONDURAS","NICARAGUA","PANAMA"],
      "Caribbean": [
        "ANTIGUA AND BARBUDA","BAHAMAS","BARBADOS","CUBA","DOMINICA","DOMINICAN REPUBLIC",
        "GRENADA","HAITI","JAMAICA","SAINT KITTS AND NEVIS","SAINT LUCIA",
        "SAINT VINCENT AND THE GRENADINES","TRINIDAD AND TOBAGO"
      ],
      "South America": [
        "ARGENTINA","BOLIVIA (PLURINATIONAL STATE OF)","BRAZIL","CHILE","COLOMBIA",
        "ECUADOR","GUYANA","PARAGUAY","PERU","SURINAME","URUGUAY",
        "VENEZUELA (BOLIVARIAN REPUBLIC OF)"
      ],
      "Latin America": [
        "MEXICO","BELIZE","COSTA RICA","EL SALVADOR","GUATEMALA","HONDURAS","NICARAGUA","PANAMA",
        "ARGENTINA","BOLIVIA (PLURINATIONAL STATE OF)","BRAZIL","CHILE","COLOMBIA","ECUADOR",
        "PARAGUAY","PERU","URUGUAY","VENEZUELA (BOLIVARIAN REPUBLIC OF)","CUBA","DOMINICAN REPUBLIC"
      ],

      "Middle East": [
        "BAHRAIN","CYPRUS","EGYPT","IRAN (ISLAMIC REPUBLIC OF)","IRAQ","ISRAEL","JORDAN",
        "KUWAIT","LEBANON","OMAN","QATAR","SAUDI ARABIA","STATE OF PALESTINE",
        "SYRIAN ARAB REPUBLIC","TURKEY","UNITED ARAB EMIRATES","YEMEN"
      ],
      "Central Asia": ["KAZAKHSTAN","KYRGYZSTAN","TAJIKISTAN","TURKMENISTAN","UZBEKISTAN"],
      "South Asia": ["AFGHANISTAN","BANGLADESH","BHUTAN","INDIA","MALDIVES","NEPAL","PAKISTAN","SRI LANKA"],
      "Southeast Asia": [
        "BRUNEI DARUSSALAM","CAMBODIA","INDONESIA","LAO PEOPLE'S DEMOCRATIC REPUBLIC",
        "MALAYSIA","MYANMAR","PHILIPPINES","SINGAPORE","THAILAND","TIMOR-LESTE","VIET NAM"
      ],
      "East Asia": [
        "CHINA","JAPAN","MONGOLIA",
        "KOREA, DEMOCRATIC PEOPLE'S REPUBLIC OF","KOREA, REPUBLIC OF"
      ],
      "Caucasus": ["ARMENIA","AZERBAIJAN","GEORGIA"],

      "Western Europe": [
        "AUSTRIA","BELGIUM","FRANCE","GERMANY","LIECHTENSTEIN","LUXEMBOURG","MONACO",
        "NETHERLANDS","SWITZERLAND"
      ],
      "Eastern Europe": [
        "BELARUS","BULGARIA","CZECH REPUBLIC","HUNGARY","POLAND","REPUBLIC OF MOLDOVA",
        "ROMANIA","RUSSIAN FEDERATION","SLOVAKIA","UKRAINE"
      ],
      "Balkans": [
        "ALBANIA","BOSNIA AND HERZEGOVINA","BULGARIA","CROATIA","GREECE",
        "MONTENEGRO","NORTH MACEDONIA","ROMANIA","SERBIA","SLOVENIA"
      ],
      "Baltics": ["ESTONIA","LATVIA","LITHUANIA"],

      "Pacific Islands": [
        "FIJI","KIRIBATI","MARSHALL ISLANDS","MICRONESIA (FEDERATED STATES OF)","NAURU",
        "PALAU","PAPUA NEW GUINEA","SAMOA","SOLOMON ISLANDS","TONGA","TUVALU","VANUATU","TIMOR-LESTE"
      ],
    }
  },

  // Single-click categories (no caret)
  "G7": {
    children: ["G7"],
    members: {
      "G7": ["CANADA","FRANCE","GERMANY","ITALY","JAPAN","UNITED KINGDOM","UNITED STATES"]
    }
  },

  "G77": {
    children: ["G77"],
    members: {
      "G77": [
        "AFGHANISTAN","ALGERIA","ANGOLA","ANTIGUA AND BARBUDA","ARGENTINA","AZERBAIJAN",
        "BAHAMAS","BAHRAIN","BANGLADESH","BARBADOS","BELIZE","BENIN","BHUTAN",
        "BOLIVIA (PLURINATIONAL STATE OF)","BOTSWANA","BRAZIL","BRUNEI DARUSSALAM",
        "BURKINA FASO","BURUNDI","CABO VERDE","CAMBODIA","CAMEROON",
        "CENTRAL AFRICAN REPUBLIC","CHAD","CHILE","CHINA","COLOMBIA","COMOROS","CONGO",
        "COSTA RICA","CÔTE D'IVOIRE","CUBA","DEMOCRATIC PEOPLE'S REPUBLIC OF KOREA",
        "DEMOCRATIC REPUBLIC OF THE CONGO","DJIBOUTI","DOMINICA","DOMINICAN REPUBLIC",
        "ECUADOR","EGYPT","EL SALVADOR","EQUATORIAL GUINEA","ERITREA","ESWATINI",
        "ETHIOPIA","FIJI","GABON","GAMBIA","GHANA","GRENADA","GUATEMALA","GUINEA",
        "GUINEA-BISSAU","GUYANA","HAITI","HONDURAS","INDIA","INDONESIA",
        "IRAN (ISLAMIC REPUBLIC OF)","IRAQ","JAMAICA","JORDAN","KENYA","KIRIBATI",
        "KUWAIT","LAO PEOPLE'S DEMOCRATIC REPUBLIC","LEBANON","LESOTHO","LIBERIA",
        "LIBYA","MADAGASCAR","MALAWI","MALAYSIA","MALDIVES","MALI","MARSHALL ISLANDS",
        "MAURITANIA","MAURITIUS","MICRONESIA (FEDERATED STATES OF)","MONGOLIA",
        "MOROCCO","MOZAMBIQUE","MYANMAR","NAMIBIA","NAURU","NEPAL","NICARAGUA","NIGER",
        "NIGERIA","OMAN","PAKISTAN","PANAMA","PAPUA NEW GUINEA","PARAGUAY","PERU",
        "PHILIPPINES","QATAR","RWANDA","SAINT KITTS AND NEVIS","SAINT LUCIA",
        "SAINT VINCENT AND THE GRENADINES","SAMOA","SAO TOME AND PRINCIPE",
        "SAUDI ARABIA","SENEGAL","SEYCHELLES","SIERRA LEONE","SINGAPORE",
        "SOLOMON ISLANDS","SOMALIA","SOUTH AFRICA","SOUTH SUDAN","SRI LANKA",
        "STATE OF PALESTINE","SUDAN","SURINAME","SYRIAN ARAB REPUBLIC","TAJIKISTAN",
        "THAILAND","TIMOR-LESTE","TOGO","TONGA","TRINIDAD AND TOBAGO","TUNISIA",
        "TURKMENISTAN","UGANDA","UNITED ARAB EMIRATES","UNITED REPUBLIC OF TANZANIA",
        "URUGUAY","VANUATU","VENEZUELA (BOLIVARIAN REPUBLIC OF)","VIET NAM","YEMEN",
        "ZAMBIA","ZIMBABWE"
      ]
    }
  },

  "NATO": {
    children: ["NATO"],
    members: {
      "NATO": [
        "ALBANIA","BELGIUM","BULGARIA","CANADA","CROATIA","CZECH REPUBLIC","DENMARK",
        "ESTONIA","FINLAND","FRANCE","GERMANY","GREECE","HUNGARY","ICELAND","ITALY",
        "LATVIA","LITHUANIA","LUXEMBOURG","MONTENEGRO","NETHERLANDS","NORTH MACEDONIA",
        "NORWAY","POLAND","PORTUGAL","ROMANIA","SLOVAKIA","SLOVENIA","SPAIN",
        "SWEDEN","TURKEY","UNITED KINGDOM","UNITED STATES"
      ]
    }
  },

  "BRICS": {
    children: ["BRICS"],
    members: {
      "BRICS": [
        "BRAZIL","RUSSIAN FEDERATION","INDIA","CHINA","SOUTH AFRICA",
        "EGYPT","ETHIOPIA","IRAN (ISLAMIC REPUBLIC OF)","SAUDI ARABIA",
        "UNITED ARAB EMIRATES","INDONESIA"
      ]
    }
  },

  "Global South": {
    children: ["Global South"],     // built at runtime from G77 + CHINA (fallback: BRICS)
    members: { "Global South": [] }
  },

  "Global Superpowers": {
    children: ["Global Superpowers"],
    // India removed as requested
    members: { "Global Superpowers": ["UNITED STATES","CHINA","RUSSIAN FEDERATION"] }
  }
};

// Chips for categories and subcategories (explicit picks)
let SELECTED_CATS = new Set(JSON.parse(localStorage.getItem("selectedCatsMS") || "[]"));
let SELECTED_SUBCATS = new Set(JSON.parse(localStorage.getItem("selectedSubcatsMS") || "[]"));

// Maps like agendasByCat / resByAgenda
let subcatsByCat = new Map();   // cat -> Set(subcategory)
let msBySubcat   = new Map();   // subcategory -> Set(member state)
let msByCat      = new Map();   // cat -> Set(member state)

/* ===== Helpers (canonical-name resolver tuned to your dataset) ===== */
let CANON_BY_KEY = new Map();  // normalized key -> exact dataset label (with accents/casing)

// Normalize for LOOKUPS only (always RETURN the dataset's original string)
const normalize = (s) => s == null ? "" : String(s)
  .normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .replace(/[,().]/g, " ")
  .replace(/[\u2019'’`]/g, "")
  .replace(/[\u2013\u2014-]/g, " ")
  .replace(/&/g, " AND ")
  .replace(/\s+/g, " ")
  .trim()
  .toUpperCase();

// Common aliases → your dataset's canonical name
const ALIAS_TO_CANON = {
  // Official renames / long forms
  "TURKEY": "Türkiye",
  "TURKIYE": "Türkiye",
  "CZECHIA": "CZECH REPUBLIC",
  "SWAZILAND": "ESWATINI",
  "MACEDONIA": "NORTH MACEDONIA",
  "PALESTINE": "STATE OF PALESTINE",
  "LAOS": "LAO PEOPLE'S DEMOCRATIC REPUBLIC",
  "VIETNAM": "VIET NAM",
  "MOLDOVA": "REPUBLIC OF MOLDOVA",
  "BOLIVIA": "BOLIVIA (PLURINATIONAL STATE OF)",
  "VENEZUELA": "VENEZUELA (BOLIVARIAN REPUBLIC OF)",
  "TANZANIA": "UNITED REPUBLIC OF TANZANIA",
  "IRAN": "IRAN (ISLAMIC REPUBLIC OF)",
  "RUSSIA": "RUSSIAN FEDERATION",
  "CAPE VERDE": "CABO VERDE",
  "UAE": "UNITED ARAB EMIRATES",
  "UK": "UNITED KINGDOM",
  "USA": "UNITED STATES",
  "UNITED STATES OF AMERICA": "UNITED STATES",

  // Koreas
  "SOUTH KOREA": "KOREA, REPUBLIC OF",
  "REPUBLIC OF KOREA": "KOREA, REPUBLIC OF",
  "NORTH KOREA": "KOREA, DEMOCRATIC PEOPLE'S REPUBLIC OF",
  "DPRK": "KOREA, DEMOCRATIC PEOPLE'S REPUBLIC OF",
  "DEMOCRATIC PEOPLE'S REPUBLIC OF KOREA": "KOREA, DEMOCRATIC PEOPLE'S REPUBLIC OF",

  // Congo variants
  "DRC": "DEMOCRATIC REPUBLIC OF THE CONGO",
  "CONGO KINSHASA": "DEMOCRATIC REPUBLIC OF THE CONGO",
  "REPUBLIC OF THE CONGO": "CONGO",
  "CONGO BRAZZAVILLE": "CONGO",

  // Timor
  "EAST TIMOR": "TIMOR-LESTE",
  "TIMOR LESTE": "TIMOR-LESTE",

  // Côte d’Ivoire
  "COTE D IVOIRE": "CÔTE D'IVOIRE",

  // Misc short forms
  "SYRIA": "SYRIAN ARAB REPUBLIC",
  "MICRONESIA": "MICRONESIA (FEDERATED STATES OF)",
};

// Find the exact dataset label for a given (possibly accented) canonical string
function canonFromDataset(label) {
  const want = normalize(label);
  return ALL_MS.find(ms => normalize(ms) === want) || null;
}

// Build the lookup index from your dataset + aliases
function indexCanonNames() {
  CANON_BY_KEY.clear();

  // 1) Index every dataset name to itself
  for (const ms of ALL_MS) {
    CANON_BY_KEY.set(normalize(ms), ms);
  }

  // 2) Index friendly aliases to the dataset's exact label
  for (const [alias, target] of Object.entries(ALIAS_TO_CANON)) {
    const canon = canonFromDataset(target);
    if (canon) {
      CANON_BY_KEY.set(normalize(alias), canon);
    }
  }
}

// Resolve any input string to the dataset's exact label (or null)
function resolveToDatasetName(name) {
  const key = normalize(name);

  // Direct hit
  const direct = CANON_BY_KEY.get(key);
  if (direct) return direct;

  // Heuristics (still return dataset strings)
  const starts = ALL_MS.find(ms => normalize(ms).startsWith(key));
  if (starts) return starts;

  const incl = ALL_MS.find(ms => normalize(ms).includes(key));
  if (incl) return incl;

  return null;
}

// Derived: Global South from G77 (+ China). If G77 empty, fallback to BRICS.
function buildDerivedGroups() {
  const g77 = GROUPS["G77"]?.members?.["G77"] || [];
  const brics = GROUPS["BRICS"]?.members?.["BRICS"] || [];
  const out = new Set();
  if (g77.length) { g77.forEach(ms => out.add(ms)); out.add("CHINA"); }
  else { brics.forEach(ms => out.add(ms)); }
  GROUPS["Global South"].members["Global South"] = Array.from(out);
}

function buildMSMapsFromGroups() {
  subcatsByCat.clear();
  msBySubcat.clear();
  msByCat.clear();

  for (const [cat, cfg] of Object.entries(GROUPS)) {
    const kids = (cfg.children || []).filter(Boolean);
    if (kids.length) subcatsByCat.set(cat, new Set(kids));
    const catSet = new Set();
    for (const sub of kids) {
      const raw = (cfg.members?.[sub] || []);
      const canon = raw.map(resolveToDatasetName).filter(Boolean);
      if (!msBySubcat.has(sub)) msBySubcat.set(sub, new Set());
      const subSet = msBySubcat.get(sub);
      for (const ms of canon) { subSet.add(ms); catSet.add(ms); }
    }
    if (catSet.size) msByCat.set(cat, catSet);
  }
}

function escapeCsv(v) {
    // Always stringify, then escape quotes and wrap if needed
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
  
  function rowsToCsv(rows) {
    // Keep the column order you’ve used throughout the project
    const headers = ["ms_name", "ms_vote", "resolution", "agenda_title", "subjects"];
    const head = headers.join(",");
    const body = rows.map(row =>
      headers.map(h => escapeCsv(row[h])).join(",")
    );
    return [head, ...body].join("\n");
  }
  
  function filterRowsForDownload() {
    if (!FULL_DATA.length) return [];
  
    const selectedMS = Array.from(SELECTED);
    const selectedRes = Array.from(SELECTED_RES);
  
    if (!selectedMS.length || !selectedRes.length) {
      // Return empty to signal missing selections
      return [];
    }
  
    // Filter dataset by both MS and Resolution selections
    const msSet = new Set(selectedMS);
    const resSet = new Set(selectedRes);
  
    return FULL_DATA.filter(r =>
      msSet.has(r.ms_name) && resSet.has(r.resolution)
    );
  }
  
  function onDownloadCsv() {
    const rows = filterRowsForDownload();
  
    if (!SELECTED.size) {
      alert("Please select at least one Member State first.");
      return;
    }
    if (!SELECTED_RES.size) {
      alert("Please select at least one Resolution on Step 1.");
      return;
    }
    if (!rows.length) {
      alert("No matching rows found for your selections.");
      return;
    }
  
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "selection_ms_res.csv";
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }
  
// Init
init().catch(console.error);

async function init() {
  const r = await fetch(DATA_URL);
  if (!r.ok) throw new Error(`Failed to load ${DATA_URL} (${r.status})`);
  const data = await r.json();
  FULL_DATA = Array.isArray(data) ? data : [];


  const msSet = new Set();
  for (const row of data) {
    const v = row.ms_name ? String(row.ms_name).trim() : "";
    if (v) msSet.add(v);
  }
  ALL_MS = Array.from(msSet).sort();
  ITEMS = ALL_MS.map(name => ({ id: name, full: name.toLowerCase() }));

  // Build resolver index so we return exact dataset labels (e.g., “Türkiye”)
  indexCanonNames();

  buildDerivedGroups();
  buildMSMapsFromGroups();

  // MS search
  els.input.addEventListener("focus", onFocusShowAllMS);
  els.input.addEventListener("input", onTypeMS);
  els.input.addEventListener("keydown", onKeyMS);
  els.results.addEventListener("scroll", onDropdownScrollMS);

  // Categories
  els.catInput.addEventListener("focus", onFocusShowAllCats);
  els.catInput.addEventListener("input", onTypeCats);
  els.catInput.addEventListener("keydown", onKeyCat);

  // Bulk
  els.selectAll?.addEventListener("click", () => {
    for (const it of ITEMS) if (!SELECTED.has(it.id)) SELECTED.add(it.id);
    persist(); renderSelected(); refreshDropdownSelectionState();
  });
  els.clearAll?.addEventListener("click", () => {
    SELECTED.clear();
    SELECTED_CATS.clear();
    SELECTED_SUBCATS.clear();
    persist(); renderSelected(); renderCatAgChips(); refreshDropdownSelectionState();
  });

  // Sort toggle for MS only
  if (els.sortToggle) {
    els.sortToggle.addEventListener("click", toggleSortMode);
    updateSortToggleLabel();
  }

// Download CSV
if (els.downloadBtn) {
    els.downloadBtn.addEventListener("click", onDownloadCsv);
}
  

  // Outside click
  document.addEventListener("click", (e) => {
    if (!els.results.contains(e.target) && e.target !== els.input) hideMSDropdown();
    if (!els.catResults.contains(e.target) && e.target !== els.catInput) hideCatDropdown();
  });

  renderSelected();
  renderCatAgChips();
}

/* =========================
   Member States dropdown
   ========================= */
function onFocusShowAllMS() {
  if (!els.input.value.trim()) openMSDropdown(ITEMS);
}
function onTypeMS() {
  const q = els.input.value.trim().toLowerCase();
  if (!q) { openMSDropdown(ITEMS); return; }
  openMSDropdown(ITEMS.filter(it => it.full.includes(q)));
}
function onKeyMS(e) {
  if (e.key === "Enter") { e.preventDefault(); els.results.querySelector(".dropdown-item")?.click(); }
  if (e.key === "Escape") hideMSDropdown();
}
function openMSDropdown(list) {
  currentList = list;
  renderIndex = 0;
  els.results.innerHTML = "";
  if (!currentList.length) { hideMSDropdown(); return; }
  appendMSChunk();
  els.results.style.display = "block";
  refreshDropdownSelectionState();
}
function onDropdownScrollMS() {
  const { scrollTop, clientHeight, scrollHeight } = els.results;
  if (scrollTop + clientHeight >= scrollHeight - 40) appendMSChunk();
}
function appendMSChunk() {
  const slice = currentList.slice(renderIndex, renderIndex + CHUNK_SIZE);
  slice.forEach((it) => {
    const row = document.createElement("div");
    row.className = "dropdown-item";
    row.dataset.id = it.id;
    row.textContent = it.id;
    if (SELECTED.has(it.id)) row.classList.add("selected-result");
    row.addEventListener("click", () => {
      if (SELECTED.has(it.id)) return; // keep first occurrence
      SELECTED.add(it.id); persist(); renderSelected();
      row.classList.add("selected-result"); els.input.focus();
    });
    els.results.appendChild(row);
  });
  renderIndex += slice.length;
}
function hideMSDropdown() {
  els.results.style.display = "none";
  els.results.innerHTML = "";
  currentList = []; renderIndex = 0;
}

/* =========================
   Categories dropdown
   ========================= */
function onFocusShowAllCats() {
  if (!els.catInput.value.trim()) openCatDropdown(TOP_CATEGORIES);
}
function onTypeCats() {
  const q = els.catInput.value.trim().toLowerCase();
  if (!q) { openCatDropdown(TOP_CATEGORIES); return; }
  openCatDropdown(TOP_CATEGORIES.filter(c => c.toLowerCase().includes(q)));
}
function onKeyCat(e) {
  if (e.key === "Enter") { e.preventDefault(); els.catResults.querySelector(".cat-row, .agenda-row")?.click(); }
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

    // Category name
    const name = document.createElement("span");
    name.className = "cat-name";
    name.textContent = cat;

    // Only highlight explicit picks
    if (SELECTED_CATS.has(cat)) {
      row.classList.add("selected-result");
    }

    // Submenu (only for Geographic Regions)
    let submenu = null;
    let caret = null;

    if (cat === "Geographic Regions") {
      caret = document.createElement("span");
      caret.className = "caret";
      caret.textContent = "›";

      submenu = document.createElement("div");
      submenu.className = "submenu";

      const subs = Array.from(subcatsByCat.get(cat) || []);
      subs.sort((a,b) => a.localeCompare(b)).forEach((sub) => {
        const aRow = document.createElement("div");
        aRow.className = "agenda-row";
        aRow.dataset.agenda = sub;   // reuse class/attr for styling
        aRow.dataset.cat = cat;
        aRow.textContent = sub;

        // Only highlight explicit subcategory picks
        if (SELECTED_SUBCATS.has(sub)) {
          aRow.classList.add("selected-result");
        }

        aRow.addEventListener("click", (e) => {
          e.stopPropagation();
          addSubcategoryMembers(cat, sub);
          markSubcatPicked(sub);
          refreshDropdownSelectionState();
        });

        submenu.appendChild(aRow);
      });

      // caret toggle
      caret.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = submenu.style.display === "block";
        submenu.style.display = open ? "none" : "block";
        caret.classList.toggle("open", !open);
      });
    }

    // Clicking the category name:
    // - For Geographic Regions: add ALL regions
    // - For single-click categories: add their full membership
    name.addEventListener("click", (e) => {
      e.stopPropagation();
      addCategoryMembers(cat);
      markCategoryPicked(cat);
      refreshDropdownSelectionState();
    });

    row.appendChild(name);
    if (caret) row.appendChild(caret);
    els.catResults.appendChild(row);
    if (submenu) els.catResults.appendChild(submenu);
  });

  els.catResults.style.display = "block";
}

function hideCatDropdown() {
  els.catResults.style.display = "none";
  els.catResults.innerHTML = "";
  currentCats = [];
}

/* =========================
   Add via Category / Subcategory
   ========================= */
function getAllMembers(cat) {
  return Array.from(msByCat.get(cat) || []);
}
function addCategoryMembers(cat) {
  addMembers(getAllMembers(cat));
}
function addSubcategoryMembers(cat, sub) {
  addMembers(Array.from(msBySubcat.get(sub) || []));
}
function addMembers(list) {
  // Keep first only: Set prevents duplicates and preserves initial insertion order
  let changed = false;
  for (const ms of list) { if (!SELECTED.has(ms)) { SELECTED.add(ms); changed = true; } }
  if (changed) { persist(); renderSelected(); }
}

/* =========================
   Category/Subcategory "picked" chips
   ========================= */
function markCategoryPicked(cat) {
  if (SELECTED_CATS.has(cat)) SELECTED_CATS.delete(cat);
  SELECTED_CATS.add(cat);
  persist();
  renderCatAgChips();
}
function markSubcatPicked(sub) {
  if (SELECTED_SUBCATS.has(sub)) SELECTED_SUBCATS.delete(sub);
  SELECTED_SUBCATS.add(sub);
  persist();
  renderCatAgChips();
}

function renderCatAgChips() {
  if (!els.catAgChips) return;

  const label = document.getElementById("catAgLabel");
  const hasAny = SELECTED_CATS.size > 0 || SELECTED_SUBCATS.size > 0;
  if (label) label.style.display = hasAny ? "block" : "none";

  els.catAgChips.innerHTML = "";
  if (!hasAny) return;

  for (const cat of SELECTED_CATS) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = cat;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.setAttribute("aria-label", `Remove category ${cat}`);
    close.textContent = "×";
    close.addEventListener("click", () => removeCategory(cat));

    chip.appendChild(close);
    els.catAgChips.appendChild(chip);
  }

  for (const sub of SELECTED_SUBCATS) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = sub;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.setAttribute("aria-label", `Remove subcategory ${sub}`);
    close.textContent = "×";
    close.addEventListener("click", () => removeSubcategory(sub));

    chip.appendChild(close);
    els.catAgChips.appendChild(chip);
  }
}

function removeCategory(cat) {
  for (const id of getAllMembers(cat)) SELECTED.delete(id);
  for (const s of Array.from(subcatsByCat.get(cat) || [])) SELECTED_SUBCATS.delete(s);
  SELECTED_CATS.delete(cat);
  persist(); renderSelected(); renderCatAgChips(); refreshDropdownSelectionState();
}

function removeSubcategory(sub) {
  for (const id of Array.from(msBySubcat.get(sub) || [])) SELECTED.delete(id);
  SELECTED_SUBCATS.delete(sub);
  persist(); renderSelected(); renderCatAgChips(); refreshDropdownSelectionState();
}

/* =========================
   Paint selection state
   ========================= */
function refreshDropdownSelectionState() {
  if (els.results.style.display === "block") {
    els.results.querySelectorAll(".dropdown-item").forEach((row) => {
      row.classList.toggle("selected-result", SELECTED.has(row.dataset.id));
    });
  }
  if (els.catResults && els.catResults.style.display === "block") {
    // Use explicit picks only
    els.catResults.querySelectorAll(".cat-row").forEach((row) => {
      const cat = row.dataset.cat;
      row.classList.toggle("selected-result", SELECTED_CATS.has(cat));
    });
    els.catResults.querySelectorAll(".agenda-row").forEach((row) => {
      const sub = row.dataset.agenda;
      row.classList.toggle("selected-result", SELECTED_SUBCATS.has(sub));
    });
  }
}

/* =========================
   Chips (selected MS)
   ========================= */
function renderSelected() {
  els.chips.innerHTML = "";

  // Turn Set into an array; sort only if user chose A→Z (display-only)
  let ids = Array.from(SELECTED);
  if (SORT_MODE === "alpha") {
    ids.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
  }

  for (const id of ids) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = id;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.textContent = "×";
    close.setAttribute("aria-label", `Remove ${id}`);
    close.addEventListener("click", () => {
      SELECTED.delete(id); persist(); renderSelected(); refreshDropdownSelectionState();
    });

    chip.appendChild(close);
    els.chips.appendChild(chip);
  }
}

/* =========================
   Persistence
   ========================= */
function persist() {
  localStorage.setItem("selectedMS", JSON.stringify(Array.from(SELECTED)));
  localStorage.setItem("selectedCatsMS", JSON.stringify(Array.from(SELECTED_CATS)));
  localStorage.setItem("selectedSubcatsMS", JSON.stringify(Array.from(SELECTED_SUBCATS)));
}

window.addEventListener("beforeunload", () => persist());