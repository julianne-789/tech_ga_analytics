// src/map_heatmap.js

// ---------- CSV parsing ----------
function parseCSV(text) {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  
    const parseLine = (line) => {
      const out = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQ) {
          if (c === '"') {
            if (line[i + 1] === '"') { cur += '"'; i++; }
            else { inQ = false; }
          } else cur += c;
        } else {
          if (c === '"') inQ = true;
          else if (c === ",") { out.push(cur); cur = ""; }
          else cur += c;
        }
      }
      out.push(cur);
      return out;
    };
  
    if (!lines.length) return [];
    const headers = parseLine(lines[0]).map(h => h.trim());
    return lines.slice(1).map(line => {
      const cells = parseLine(line);
      const row = {};
      headers.forEach((h, i) => row[h] = (cells[i] ?? "").trim());
      return row;
    });
  }
  
  // ---------- Compute matrix (mirrors your Python logic) ----------
  function computeMatrix(rows) {
    const onlyYN = (v) => v === "Y" || v === "N";
    const pivot = new Map();
    const countriesSet = new Set();
  
    for (const r of rows) {
      const res = String(r.resolution || "").trim();
      const ms  = String(r.ms_name   || "").trim();
      const v   = String(r.ms_vote   || "").trim().toUpperCase();
      if (!res || !ms) continue;
      countriesSet.add(ms);
      if (!pivot.has(res)) pivot.set(res, new Map());
      pivot.get(res).set(ms, v);
    }
  
    const countries = Array.from(countriesSet).sort();
    const n = countries.length;
  
    const percent = Array.from({ length: n }, () => Array(n).fill(0));
    const matches = Array.from({ length: n }, () => Array(n).fill(0));
    const xTotals = Array(n).fill(0);
    const yCounts = Array.from({ length: n }, () => Array(n).fill(0));
  
    countries.forEach((x, i) => {
      const xRes = [];
      for (const [res, votes] of pivot) {
        const vx = votes.get(x);
        if (onlyYN(vx)) xRes.push([res, vx]);
      }
      const xYNcount = xRes.length;
      xTotals[i] = xYNcount;
  
      countries.forEach((y, j) => {
        let match = 0, yOnSame = 0;
        for (const [res, vx] of xRes) {
          const vy = pivot.get(res).get(y);
          if (onlyYN(vy)) {
            yOnSame++;
            if (vy === vx) match++;
          }
        }
        matches[i][j] = match;
        yCounts[i][j]  = yOnSame;
        percent[i][j]  = xYNcount ? (match * 100) / xYNcount : 0;
      });
    });
  
    return { countries, percent, matches, xTotals, yCounts };
  }
  
  function transpose2D(arr) {
    const rows = arr.length, cols = rows ? arr[0].length : 0;
    const t = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) t[j][i] = arr[i][j];
    return t;
  }
  
  function makeHover(countries, percent, matches, xTotals, yCounts) {
    const hover = [];
    for (let i = 0; i < countries.length; i++) {
      const row = [];
      for (let j = 0; j < countries.length; j++) {
        row.push(
          `<b>Country X:</b> ${countries[i]}<br>` +
          `<b>Country Y:</b> ${countries[j]}<br>` +
          `<b>% Matched:</b> ${percent[i][j].toFixed(1)}<br>` +
          `<b>Matched Votes:</b> ${matches[i][j]}<br>` +
          `<b>${countries[i]} Total Votes:</b> ${xTotals[i]}<br>` +
          `<b>${countries[j]} Voted Same Resolutions:</b> ${yCounts[i][j]}`
        );
      }
      hover.push(row);
    }
    return hover;
  }
  
  async function readFileText(file) {
    const text = await file.text();
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text; // strip BOM if present
  }
  
  // ---------- Wiring ----------
  (function setup() {
    const fileInput = document.getElementById("csvFile");
    const genBtn    = document.getElementById("generateBtn");
    const statusEl  = document.getElementById("status");
    const heatSec   = document.getElementById("heatmapSection"); // hidden by default
  
    // Enable button when a file is chosen and re-hide heat area until Generate
    fileInput?.addEventListener("change", () => {
      genBtn && (genBtn.disabled = !fileInput.files?.length);
      statusEl && (statusEl.textContent = fileInput.files?.length ? "File ready." : "");
      if (heatSec) heatSec.hidden = true;
    });
  
    async function generate() {
      try {
        if (!fileInput?.files?.length) return;
        statusEl && (statusEl.textContent = "Processing…");
  
        const file = fileInput.files[0];
        const text = await readFileText(file);
        const rows = parseCSV(text);
  
        // Validate columns
        if (!(rows.length && ["ms_name","ms_vote","resolution"].every(k => k in rows[0]))) {
          statusEl && (statusEl.textContent = "Error: CSV must include ms_name, ms_vote, resolution.");
          alert("CSV must include columns: ms_name, ms_vote, resolution");
          return;
        }
  
        const { countries, percent, matches, xTotals, yCounts } = computeMatrix(rows);
        const hover = makeHover(countries, percent, matches, xTotals, yCounts);
  
        // Match Python orientation: transpose percent and hover
        const z = transpose2D(percent);
        const hoverT = transpose2D(hover);
  
        const target = document.getElementById("heatmap");
        if (!target) {
          console.error("Missing #heatmap container");
          statusEl && (statusEl.textContent = "Error: heatmap container not found.");
          alert("Heatmap container (#heatmap) not found on this page.");
          return;
        }
  
        // Show the heatmap section now that we’re ready to render
        if (heatSec) heatSec.hidden = false;
  
        await Plotly.newPlot(target, [{
          type: "heatmap",
          z,
          x: countries,
          y: countries,
          text: hoverT,
          hoverinfo: "text",
          colorscale: [[0, "rgb(49,130,189)"], [1, "rgb(255,0,0)"]],
          colorbar: { title: "% Match" }
        }], {
          title: "Voting Alignment Heatmap",
          xaxis: { title: "Country X" },
          yaxis: { title: "Country Y", automargin: true },
          margin: { l: 120, r: 40, t: 60, b: 80 }
        }, { responsive: true });
  
        heatSec?.scrollIntoView({ behavior: "smooth", block: "start" });
        statusEl && (statusEl.textContent = "Ready.");
      } catch (err) {
        console.error(err);
        statusEl && (statusEl.textContent = "Error while generating heatmap.");
        alert("Something went wrong while generating the heatmap. Check the console.");
      }
    }
  
    genBtn?.addEventListener("click", generate);
  })();
  