
import pandas as pd

# Paths are relative to the analytics folder
IN_CSV  = "../data/tech_filtered_v3.csv"
OUT_JSON = "../data/tech_filtered_v3.json"

df = pd.read_csv(IN_CSV)
df.to_json(OUT_JSON, orient="records", indent=2)
print(f"Wrote {OUT_JSON} with {len(df):,} rows")
