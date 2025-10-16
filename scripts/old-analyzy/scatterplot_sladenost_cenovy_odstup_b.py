#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import pandas as pd
import matplotlib.pyplot as plt
from dbsettings import get_connection  # tvoje centrální DB nastavení

# ====== PARAMETRY ======
BASKET_ID = 7
DATE_FROM =  "2025-05-01" #nebo None
DATE_TO   = "2025-06-30"
OUTPUT_DIR = "img/scatter_sladenost_odstup_b"

# ====== POMOCNÉ ======
def sanitize_filename(s: str) -> str:
    s = re.sub(r"[\\/:*?\"<>|]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

# ====== SQL ======
BASE_SQL = """
SELECT
  b.product_id,
  COALESCE(p2.name, b.product_id) AS product_name,
  s.date,
  s.on_par,
  s.min_price,
  s.mode_price
FROM bp b
JOIN price_stat_i1 s
  ON s.product_id = b.product_id
LEFT JOIN product p2
  ON p2.id = b.product_id
WHERE b.basket_id = %s
"""

def build_sql_and_params():
    sql = BASE_SQL
    params = [BASKET_ID]
    if DATE_FROM is not None:
        sql += " AND s.date >= %s"
        params.append(DATE_FROM)
    if DATE_TO is not None:
        sql += " AND s.date <= %s"
        params.append(DATE_TO)
    sql += " ORDER BY b.product_id, s.date"
    return sql, tuple(params)

def fetch_dataframe():
    sql, params = build_sql_and_params()
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(sql, params)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        return pd.DataFrame(columns=["product_id","product_name","date","on_par","min_price","mode_price"])

    df = pd.DataFrame(rows)
    df["date"]       = pd.to_datetime(df["date"], errors="coerce")
    df["on_par"]     = pd.to_numeric(df["on_par"], errors="coerce")
    df["min_price"]  = pd.to_numeric(df["min_price"], errors="coerce")
    df["mode_price"] = pd.to_numeric(df["mode_price"], errors="coerce")

    # vypočítáme podíl min/mode (pokud mode_price > 0)
    df["min_mode_ratio"] = df.apply(
        lambda r: r["min_price"]/r["mode_price"] if (pd.notna(r["min_price"]) and pd.notna(r["mode_price"]) and r["mode_price"] != 0) else None,
        axis=1
    )

    return df

def plot_for_each_product(df: pd.DataFrame):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for (product_id, product_name), grp in df.groupby(["product_id","product_name"], dropna=False):
        if grp.empty:
            continue

        x = grp["on_par"]
        y = grp["min_mode_ratio"]

        if y.dropna().empty:
            continue

        plt.figure()
        plt.scatter(x, y, alpha=0.7)
        title = f"{product_name} — scatter on_par vs. min/mode"
        if DATE_FROM or DATE_TO:
            title += f" ({DATE_FROM or '...'} až {DATE_TO or '...'})"
        plt.title(title)
        plt.xlabel("podil sladenosti")
        plt.ylabel("cenový odstup B")
        plt.grid(True, linestyle=":", linewidth=0.5)
        plt.tight_layout()

        fname = f"{sanitize_filename(str(product_id))}.png"
        out_path = os.path.join(OUTPUT_DIR, fname)
        plt.savefig(out_path, dpi=150)
        plt.close()
        print(f"Uloženo: {out_path}")

def main():
    print("Načítám data…")
    df = fetch_dataframe()
    if df.empty:
        print("Žádná data k vykreslení.")
        return
    print(f"Načteno {len(df)} řádků pro {df['product_id'].nunique()} produktů.")
    plot_for_each_product(df)
    print("Hotovo.")

if __name__ == "__main__":
    main()
