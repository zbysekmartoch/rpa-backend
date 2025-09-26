#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import sys
import pandas as pd
import matplotlib.pyplot as plt
from dbsettings import get_connection, load_data_json  # centrální DB nastavení

# ====== KONFIGURACE ======

# Globální objekt pro data z JSON
data = {}

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
  sqrt((s.on_par*s.on_par+(min_price/mode_price)*(min_price/mode_price))/2) iB
FROM bp b
JOIN price_stat_i1 s
  ON s.product_id = b.product_id
LEFT JOIN product p2
  ON p2.id = b.product_id
WHERE b.basket_id = %s
"""

def build_sql_and_params():
    sql = BASE_SQL
    params = [data['basketId']]
    
    sql += " AND s.date >= %s"
    params.append(data['dateFrom'])
    sql += " AND s.date <= %s"
    params.append(data['dateTo'])
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
        return pd.DataFrame(columns=["product_id","product_name","date","min_price","mode_price","avg_price"])
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["iB"]  = pd.to_numeric(df["iB"], errors="coerce")
    return df.sort_values(["product_id","date"])

def plot_for_each_product(df: pd.DataFrame, output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    for (product_id, product_name), grp in df.groupby(["product_id","product_name"], dropna=False):
        if grp.empty:
            continue

        x = grp["date"]
        y_on_par  = grp["iB"]

        plt.figure()
        plt.plot(x, y_on_par,  label="iB")
        title = f"{product_name} — index sladění"
        plt.title(title)
        plt.xlabel("Datum")
        plt.ylabel("Index")
        plt.legend()
        plt.grid(True, linestyle=":", linewidth=0.5)
        plt.xticks(rotation=90)  # otočení datumů
        plt.tight_layout()

        fname = f"{sanitize_filename(str(product_id))}.png"
        out_path = os.path.join(output_dir, fname)
        plt.savefig(out_path, dpi=150)
        plt.close()
        print(f"Uloženo: {out_path}")

def main():
    global data
    
    # Vyžadujeme povinný parametr work_dir
    if len(sys.argv) != 2:
        print("Použití: python plot_index_sladeni.py <work_dir>")
        sys.exit(1)
    
    work_dir = sys.argv[1]
    json_path = os.path.join(work_dir, "data.json")
    
    # data.json musí existovat
    if not os.path.exists(json_path):
        print(f"Chyba: Soubor {json_path} neexistuje.")
        sys.exit(1)
    
    # Načteme konfiguraci z data.json (bez fallback hodnot)
    data = load_data_json(json_path, {})
    output_dir = os.path.join(work_dir, "img/index_sladeni")
    
    print("Načítám data…")
    df = fetch_dataframe()
    if df.empty:
        print("Žádná data k vykreslení.")
        return
    print(f"Načteno {len(df)} řádků pro {df['product_id'].nunique()} produktů.")
    plot_for_each_product(df, output_dir)
    print("Hotovo.")

if __name__ == "__main__":
    main()
