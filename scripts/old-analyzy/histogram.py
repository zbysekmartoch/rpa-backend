#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Vygeneruje histogramy cen pro každý produkt z košíku (basket_id),
za dané období. Titulek = product.name (pokud existuje).

Závislosti: mysql-connector-python, pandas, matplotlib
"""

import os
import re
import sys
from collections import Counter
from statistics import median
from datetime import datetime

import mysql.connector
import pandas as pd
import matplotlib.pyplot as plt

from dbsettings import get_connection, load_data_json  # <--- tady

# ======= KONFIGURACE =======

# Globální objekt pro data z JSON
data = {}



HIST_BINS = 30        # počet intervalů (sloupců) "auto"

# Zaokrouhlit ceny na 2 desetinná místa (doporučeno, pokud máš FLOAT)
ROUND_TO_CENTS = True

# Výstupní složka (automaticky zahrne období a košík)
#OUTPUT_DIR = "img/histogram"


# ======= POMOCNÉ =======
def sanitize_filename(s: str) -> str:
    s = re.sub(r"[\\/:*?\"<>|]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def round2(x) -> float:
    try:
        return round(float(x), 2)
    except Exception:
        return None


# ======= SQL DOTAZ =======
SQL = """
SELECT
  b.product_id,
  COALESCE(p2.name, b.product_id) AS product_name,
  p.price
FROM bp b
JOIN price p
  ON p.product_id = b.product_id
  AND p.invalid = 0
  AND p.date BETWEEN %s AND %s
LEFT JOIN product p2
  ON p2.id = b.product_id
WHERE b.basket_id = %s
"""


def fetch_dataframe():
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    
    # Použijeme data z globálního objektu přímo
    cur.execute(SQL, (data['dateFrom'], data['dateTo'], data['basketId']))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        return pd.DataFrame(columns=["product_id", "product_name", "price"])

    df = pd.DataFrame(rows)
    # ceny jako float a volitelné zaokrouhlení
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    if ROUND_TO_CENTS:
        df["price"] = df["price"].map(round2)
    return df


def save_histograms(df: pd.DataFrame):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for (product_id, product_name), grp in df.groupby(["product_id", "product_name"], dropna=False):
        prices = grp["price"].dropna().to_list()
        if not prices:
            continue

        # Statistika do titulku
        n = len(prices)
        avg = sum(prices) / n if n else None
        try:
            med = median(prices)
        except Exception:
            med = None

        mode_val = mode_count = None
        if n:
            c = Counter(prices)
            max_c = max(c.values())
            # při shodě zvolíme nižší cenu
            mode_val = min([v for v, cnt in c.items() if cnt == max_c])
            mode_count = max_c

        # Kreslení histogramu (jedna figura per produkt)
        plt.figure()
        plt.hist(prices, bins=data['histBins'])  # použijeme přímo z data
        title = f"{product_name} — histogram cen ({data['dateFrom']} až {data['dateTo']})\n" \
                f"n={n}"
        if avg is not None:
            title += f", avg={avg:.2f}"
        if med is not None:
            title += f", median={med:.2f}"
        if mode_val is not None:
            title += f", mode={mode_val:.2f} (×{mode_count})"
        plt.title(title)
        plt.xlabel("Cena")
        plt.ylabel("Frekvence")
        plt.grid(True, linestyle=":", linewidth=0.5)
        plt.tight_layout()

        fname = f"{sanitize_filename(str(product_id))}.png"
        path = os.path.join(OUTPUT_DIR, fname)
        plt.savefig(path, dpi=150)
        plt.close()
        print(f"Uloženo: {path}")


def main():
    global data, OUTPUT_DIR
    
    # Vyžadujeme povinný parametr work_dir
    if len(sys.argv) != 2:
        print("Použití: python histogram.py <work_dir>")
        sys.exit(1)
    
    work_dir = sys.argv[1]
    json_path = os.path.join(work_dir, "data.json")
    
    # data.json musí existovat
    if not os.path.exists(json_path):
        print(f"Chyba: Soubor {json_path} neexistuje.")
        sys.exit(1)
    
    # Načteme konfiguraci pomocí funkce z dbsettings
    default_values = {
        'histBins': 30
    }
    data = load_data_json(json_path, default_values)
    OUTPUT_DIR = os.path.join(work_dir, "img/histogram")
    
    print(f"Načítám data z DB …")
    df = fetch_dataframe()
    if df.empty:
        print("Žádná data pro zadané období/košík.")
        return
    print(f"Načteno {len(df)} řádků pro {df['product_id'].nunique()} produktů.")
    save_histograms(df)
    print("Hotovo.")


if __name__ == "__main__":
    main()
