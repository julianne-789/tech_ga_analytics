# Import libraries
import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
import plotly.io as pio

# Make pivot table
pivot = df.pivot_table(
    index = 'resolution',
    columns = 'ms_name',
    values = 'ms_vote',
    aggfunc = 'first'
)

# Gather countries
countries = pivot.columns

# Make lists for data storage
x_yn_counts = [] # how many times country x voted Y or N
y_match_counts = [] # how many times country y also voted on a same RES as country x
yn_resolutions = [] # list of resolutions country x voted Y or N
xy_matches = [] # how many times country y and country x voted the same way
shared_percentages = [] # percent of country x's votes that country y matched

countries = pivot.columns

# Initialize outer lists
x_yn_counts = []           # Total X votes (Y or N)
y_match_counts = []        # How many times Y voted on X's resolutions
xy_matches = []            # How many times Y matched X
shared_percentages = []    # % match from Y on X's Y/N votes

for x in countries:
    x_votes = pivot[x]
    mask_x = x_votes.isin(['Y', 'N'])  # Country X's Y/N votes
    resolutions = pivot.index[mask_x]  # Resolutions X voted on
    x_yn_count = len(resolutions)      # Total X Y/N votes

    x_y_matches = []
    y_counts = []
    percents = []

    for y in countries:
        y_votes = pivot.loc[resolutions, y]
        valid_mask = y_votes.isin(['Y', 'N'])  # Y must have voted Y/N

        x_valid = x_votes[resolutions][valid_mask]
        y_valid = y_votes[valid_mask]

        match_count = (x_valid == y_valid).sum()
        y_count = valid_mask.sum()

        shared_percent = (match_count * 100) / x_yn_count if x_yn_count > 0 else 0

        # Store row values
        x_y_matches.append(match_count)
        y_counts.append(y_count)
        percents.append(shared_percent)


    # Store row after Y-loop
    x_yn_counts.append(x_yn_count)
    xy_matches.append(x_y_matches)
    y_match_counts.append(y_counts)
    shared_percentages.append(percents)

    # Make dataframe

n = len(countries)

# Reshape flat lists into square matrices
percent_matrix = np.array(shared_percentages).reshape(n, n)
x_votes_matrix = np.array(x_yn_counts).reshape(n, 1).repeat(n, axis=1)
y_match_matrix = np.array(y_match_counts).reshape(n, n)
match_matrix = np.array(xy_matches)


# Wrap in DataFrames
df_percent = pd.DataFrame(percent_matrix, index=countries, columns=countries)
df_x_votes = pd.DataFrame(x_votes_matrix, index=countries, columns=countries)
df_y_match = pd.DataFrame(y_match_matrix, index=countries, columns=countries)

# Build hover text

hover_text = []

for i, x in enumerate(countries):         # Country X (rows)
    row = []
    for j, y in enumerate(countries):     # Country Y (columns)
        matched = match_matrix[i, j]
        total_x = x_votes_matrix[i, j]
        percent = percent_matrix[i, j]

        text = (
            f"<b>Country X:</b> {x}<br>"
            f"<b>Country Y:</b> {y}<br>"
            f"<b>% Matched:</b> {percent_matrix[i, j]:.1f}<br>"
            f"<b>Matched Votes:</b> {matched}<br>"
            f"<b>{x} Total Votes:</b> {x_votes_matrix[i, j]}<br>"
            f"<b>{y} Voted Same Resolutions:</b> {y_match_matrix[i, j]}"
        )
        row.append(text)
    hover_text.append(row)

"""     # Make heatmap

# Transpose hover text matrix
hover_text = np.array(hover_text).T.tolist()

# Make heatmap
fig = go.Figure(data=go.Heatmap(
    z=percent_matrix.T,
    x=countries,
    y=countries,
    colorscale=[[0.0, 'blue'], [1.0, 'red']],
    colorbar=dict(title='% Match'),
    text=hover_text,
    hoverinfo='text'
))

fig.update_layout(
    title='Voting Alignment Heatmap',
    xaxis_title="Country X",
    yaxis_title="Country Y",
    width=5000,
    height=5000
)
 """

# --- Make heatmap with white diagonal ---

# Base matrix (transpose matches your axes); hide diagonal in base layer
z_main = percent_matrix.T.copy()
np.fill_diagonal(z_main, np.nan)

# Diagonal overlay: a matrix that has values only on the diagonal
z_diag = np.full_like(z_main, np.nan, dtype=float)
np.fill_diagonal(z_diag, 0)  # any constant works since we force white

# Keep hover on diagonal cells
diag_text = [['' for _ in countries] for _ in countries]
for i in range(len(countries)):
    diag_text[i][i] = hover_text[i][i]

fig = go.Figure()

# Base heatmap (everything except diagonal)
fig.add_trace(go.Heatmap(
    z=z_main,
    x=countries,
    y=countries,
    colorscale=[[0.0, 'blue'], [1.0, 'red']],
    colorbar=dict(title='% Match'),
    text=hover_text,
    hoverinfo='text'
))

# Diagonal overlay (white tiles)
fig.add_trace(go.Heatmap(
    z=z_diag,
    x=countries,
    y=countries,
    colorscale=[[0, 'white'], [1, 'white']],
    showscale=False,
    text=diag_text,
    hoverinfo='text'
))

fig.update_layout(
    title='Voting Alignment Heatmap',
    xaxis_title="Country X",
    yaxis_title="Country Y",
    width=5000,
    height=5000
)

fig.show()
# Project root (one level up from /scripts)
root = Path(__file__).resolve().parents[1]
out_dir = root / "plots"
out_dir.mkdir(parents=True, exist_ok=True)

out_file = out_dir / "heatmap.html"

# Save a self-contained HTML (loads Plotly from CDN)
pio.write_html(
    fig,
    file=str(out_file),
    full_html=True,
    include_plotlyjs="cdn",
    default_width="100%",
    default_height="100%"
)

print(f"Wrote heatmap to {out_file}")

# This is a test comment to force Git to detect changes