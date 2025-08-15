(function() {
    const fileInput = document.getElementById('csvFile');
    const generateBtn = document.getElementById('generateBtn');
    const statusEl = document.getElementById('status');
    const heatmapSection = document.getElementById('heatmapSection');
  
    // Enable generate button when file is selected
    fileInput?.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file && file.name.endsWith('.csv')) {
        generateBtn.disabled = false;
        statusEl && (statusEl.textContent = `Selected: ${file.name}`);
      } else {
        generateBtn.disabled = true;
        statusEl && (statusEl.textContent = file ? 'Please select a CSV file' : '');
      }
    });
  
    // Parse CSV function
    function parseCSV(csvText) {
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, i) => {
          row[header] = values[i] || '';
        });
        return row;
      });
    }
  
    // Exact match of your Python logic
    function generate_heatmap(rows) {
      // Make pivot table
      const pivot = new Map(); // resolution -> Map(country -> vote)
      const countriesSet = new Set();
      
      for (const row of rows) {
        const resolution = String(row.resolution || "").trim();
        const ms_name = String(row.ms_name || "").trim();
        const ms_vote = String(row.ms_vote || "").trim();
        
        if (!resolution || !ms_name) continue;
        
        countriesSet.add(ms_name);
        if (!pivot.has(resolution)) pivot.set(resolution, new Map());
        pivot.get(resolution).set(ms_name, ms_vote);
      }
  
      // Gather countries
      const countries = Array.from(countriesSet).sort();
  
      // Make lists for data storage
      let x_yn_counts = []; // how many times country x voted Y or N
      let y_match_counts = []; // how many times country y also voted on a same RES as country x
      let yn_resolutions = []; // list of resolutions country x voted Y or N
      let xy_matches = []; // how many times country y and country x voted the same way
      let shared_percentages = []; // percent of country x's votes that country y matched
  
      // Initialize outer lists
      x_yn_counts = [];           // Total X votes (Y or N)
      y_match_counts = [];        // How many times Y voted on X's resolutions
      xy_matches = [];            // How many times Y matched X
      shared_percentages = [];    // % match from Y on X's Y/N votes
  
      for (const x of countries) {
        // Get x_votes equivalent
        const x_votes = new Map();
        for (const [resolution, countryVotes] of pivot) {
          x_votes.set(resolution, countryVotes.get(x) || '');
        }
  
        // mask_x = x_votes.isin(['Y', 'N'])
        const resolutions = [];
        for (const [resolution, vote] of x_votes) {
          if (vote === 'Y' || vote === 'N') {
            resolutions.push(resolution);
          }
        }
        
        const x_yn_count = resolutions.length; // Total X Y/N votes
  
        const x_y_matches = [];
        const y_counts = [];
        const percents = [];
  
        for (const y of countries) {
          // y_votes = pivot.loc[resolutions, y]
          const y_votes_for_resolutions = [];
          for (const resolution of resolutions) {
            const vote = pivot.get(resolution)?.get(y) || '';
            y_votes_for_resolutions.push(vote);
          }
  
          // valid_mask = y_votes.isin(['Y', 'N'])
          const valid_indices = [];
          y_votes_for_resolutions.forEach((vote, idx) => {
            if (vote === 'Y' || vote === 'N') {
              valid_indices.push(idx);
            }
          });
  
          // x_valid = x_votes[resolutions][valid_mask]
          // y_valid = y_votes[valid_mask]
          const x_valid = [];
          const y_valid = [];
          for (const idx of valid_indices) {
            const resolution = resolutions[idx];
            x_valid.push(x_votes.get(resolution));
            y_valid.push(y_votes_for_resolutions[idx]);
          }
  
          // match_count = (x_valid == y_valid).sum()
          let match_count = 0;
          for (let i = 0; i < x_valid.length; i++) {
            if (x_valid[i] === y_valid[i]) {
              match_count++;
            }
          }
  
          const y_count = valid_indices.length; // valid_mask.sum()
  
          const shared_percent = x_yn_count > 0 ? (match_count * 100) / x_yn_count : 0;
  
          // Store row values
          x_y_matches.push(match_count);
          y_counts.push(y_count);
          percents.push(shared_percent);
        }
  
        // Store row after Y-loop
        x_yn_counts.push(x_yn_count);
        xy_matches.push(x_y_matches);
        y_match_counts.push(y_counts);
        shared_percentages.push(percents);
      }
  
      // Make dataframes
      const n = countries.length;
  
      // Reshape flat lists into square matrices
      const percent_matrix = shared_percentages; // Already n x n
      const x_votes_matrix = x_yn_counts.map(count => new Array(n).fill(count));
      const y_match_matrix = y_match_counts;
      const match_matrix = xy_matches;
  
      // Build hover text
      const hover_text = [];
  
      for (let i = 0; i < countries.length; i++) { // Country X (rows)
        const x = countries[i];
        const row = [];
        for (let j = 0; j < countries.length; j++) { // Country Y (columns)
          const y = countries[j];
          const matched = match_matrix[i][j];
          const total_x = x_votes_matrix[i][j];
          const percent = percent_matrix[i][j];
  
          const text = 
            `<b>Country X:</b> ${x}<br>` +
            `<b>Country Y:</b> ${y}<br>` +
            `<b>% Matched:</b> ${percent_matrix[i][j].toFixed(1)}<br>` +
            `<b>Matched Votes:</b> ${matched}<br>` +
            `<b>${x} Total Votes:</b> ${x_votes_matrix[i][j]}<br>` +
            `<b>${y} Voted Same Resolutions:</b> ${y_match_matrix[i][j]}`;
          
          row.push(text);
        }
        hover_text.push(row);
      }
  
      // z is [y][x]
      const z = percent_matrix[0].map((_, colIndex) => 
        percent_matrix.map(row => row[colIndex])
      ); // Transpose
  
      // Set diagonal to NaN equivalent (null)
      for (let k = 0; k < n; k++) {
        z[k][k] = null;
      }
  
      // Build hover text in [y][x] orientation
      const hover_text_aligned = [];
      for (let j = 0; j < n; j++) { // y index (rows)
        const row = [];
        for (let i = 0; i < n; i++) { // x index (cols)
          const x = countries[i];
          const y = countries[j];
          const matched = match_matrix[i][j]; // match_matrix is [x][y]
          const total_x = x_votes_matrix[i][j]; // [x][y]
          const percent = percent_matrix[i][j]; // [x][y]
  
          const text = 
            `<b>Country X:</b> ${x}<br>` +
            `<b>Country Y:</b> ${y}<br>` +
            `<b>% Matched:</b> ${percent.toFixed(1)}<br>` +
            `<b>Matched Votes:</b> ${matched}<br>` +
            `<b>${x} Total Votes:</b> ${total_x}<br>` +
            `<b>${y} Voted Same Resolutions:</b> ${y_match_matrix[i][j]}`;
          
          row.push(text);
        }
        hover_text_aligned.push(row);
      }
  
      // Clear diagonal hover and plot
      for (let k = 0; k < n; k++) {
        hover_text_aligned[k][k] = "";
      }
  
      return { z, countries, hover_text_aligned };
    }
  
    // Generate heatmap function
    async function generate() {
      const file = fileInput.files[0];
      if (!file) return;
  
      try {
        statusEl && (statusEl.textContent = 'Processing CSV and generating heatmap...');
        generateBtn.disabled = true;
  
        // Read and parse CSV
        const csvText = await file.text();
        const rows = parseCSV(csvText);
        
        if (rows.length === 0) {
          throw new Error('CSV file is empty or invalid');
        }
  
        // Process data using exact Python logic
        const { z, countries, hover_text_aligned } = generate_heatmap(rows);
        
        if (countries.length === 0) {
          throw new Error('No valid country data found in CSV');
        }
  
        // Create Plotly heatmap exactly like Python
        await Plotly.newPlot('heatmap', [{
          type: 'heatmap',
          z: z,
          x: countries,           // columns => X
          y: countries,           // rows => Y
          colorscale: [[0.0, 'blue'], [1.0, 'red']],
          colorbar: { title: '% Match' },
          text: hover_text_aligned,
          hoverinfo: 'text',
          hoverongaps: false
        }], {
          paper_bgcolor: 'white',
          plot_bgcolor: 'white',
          title: 'Voting Alignment Heatmap',
          xaxis: { title: 'Country X' },
          yaxis: { title: 'Country Y' },
          width: 1000,
          height: 800
        }, {
          responsive: true,
          displayModeBar: true,
          displaylogo: false
        });
  
        heatmapSection && (heatmapSection.hidden = false);
        statusEl && (statusEl.textContent = 'Heatmap generated successfully!');
  
      } catch (error) {
        console.error('Error:', error);
        statusEl && (statusEl.textContent = 'Error generating heatmap. Check console.');
        alert('Something went wrong while generating the heatmap. Check the console.');
      } finally {
        generateBtn.disabled = false;
      }
    }
  
    // Attach event listener
    generateBtn?.addEventListener('click', generate);
  })();