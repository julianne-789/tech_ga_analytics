# Import libraries
import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
import plotly.express as px
import plotly.graph_objects as go
import plotly.io as pio
import sys
import webbrowser
from pathlib import Path

def generate_heatmap(csv_path):
    # Read the uploaded CSV
    df = pd.read_csv(csv_path)

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

    # Make dataframes

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


    # z is [y][x]
    z = percent_matrix.T.astype(float).copy()
    np.fill_diagonal(z, np.nan)

    n = len(countries)

    # Build hover text in [y][x] orientation
    hover_text_aligned = []
    for j in range(n):          # y index (rows)
        row = []
        for i in range(n):      # x index (cols)
            x = countries[i]
            y = countries[j]
            matched = match_matrix[i, j]          # match_matrix is [x][y]
            total_x = x_votes_matrix[i, j]        # [x][y]
            percent = percent_matrix[i, j]        # [x][y]

            row.append(
                f"<b>Country X:</b> {x}<br>"
                f"<b>Country Y:</b> {y}<br>"
                f"<b>% Matched:</b> {percent:.1f}<br>"
                f"<b>Matched Votes:</b> {matched}<br>"
                f"<b>{x} Total Votes:</b> {total_x}<br>"
                f"<b>{y} Voted Same Resolutions:</b> {y_match_matrix[i, j]}"
            )
        hover_text_aligned.append(row)

    # Clear diagonal hover and plot
    for k in range(n):
        hover_text_aligned[k][k] = ""

    fig = go.Figure(go.Heatmap(
        z=z,
        x=countries,           # columns => X
        y=countries,           # rows => Y
        colorscale=[[0.0, 'blue'], [1.0, 'red']],
        colorbar=dict(title='% Match'),
        text=hover_text_aligned,
        hoverinfo='text',
        hoverongaps=False
    ))

    fig.update_layout(
        paper_bgcolor='white', plot_bgcolor='white',
        title='Voting Alignment Heatmap',
        xaxis_title='Country X', yaxis_title='Country Y',
        width=5000, height=5000
    )

    # Save and automatically open in browser
    output_file = Path(__file__).parent.parent / "pages" / "heatmap_result.html"
    fig.write_html(output_file, include_plotlyjs='cdn')
        
    # Open in browser automatically
    webbrowser.open(f"file://{output_file.absolute()}", new=2)
    print(f"Heatmap opened in browser: {output_file}")

    return fig

if __name__ == "__main__":
    if len(sys.argv) > 1:
        generate_heatmap(sys.argv[1])
    else:
        print("Usage: python logic.py <path_to_csv_file>")