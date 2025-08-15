from flask import Flask, request, render_template, redirect, send_from_directory, flash
import tempfile
import os
from pathlib import Path
from scripts.logic import generate_heatmap

app = Flask(__name__)
app.secret_key = 'your-secret-key'  # For flash messages

# Serve static files (CSS, JS)
@app.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory('assets', filename)

@app.route('/src/<path:filename>')
def src(filename):
    return send_from_directory('src', filename)

# Serve your main page
@app.route('/')
@app.route('/3_map.html')
def map_page():
    return send_from_directory('pages', '3_map.html')

# Handle file upload and processing
@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'csvFile' not in request.files:
            flash('No file uploaded', 'error')
            return redirect('/')
        
        file = request.files['csvFile']
        if file.filename == '':
            flash('No file selected', 'error')
            return redirect('/')
        
        if not file.filename.lower().endswith('.csv'):
            flash('Please upload a CSV file', 'error')
            return redirect('/')
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as tmp:
            file.save(tmp.name)
            
            # Run your Python logic
            generate_heatmap(tmp.name)
            
            # Clean up temporary file
            os.unlink(tmp.name)
        
        # Redirect to show the heatmap
        return redirect('/heatmap_result.html')
        
    except Exception as e:
        flash(f'Error processing file: {str(e)}', 'error')
        return redirect('/')

# Serve the generated heatmap
@app.route('/heatmap_result.html')
def heatmap_result():
    heatmap_file = Path('pages/heatmap_result.html')
    if heatmap_file.exists():
        return send_from_directory('pages', 'heatmap_result.html')
    else:
        flash('Heatmap not found. Please upload a CSV file first.', 'error')
        return redirect('/')

if __name__ == '__main__':
    print("Starting Flask server...")
    print("Visit: http://127.0.0.1:5000")
    app.run(debug=True, port=5000)