#!/usr/bin/env python3
"""
One-time conversion: CALCE CS2/CX2 (Arbin-tester Excel logs) -> normalized
capacity-fade CSV + per-cell metadata JSON. Second independent real-cell
source, alongside NASA PCoE (see convert_nasa_mat.py) — used as a cross-
check on the NASA-derived cycle-loss rate, not a from-scratch fit.

Source (official CALCE battery data page, openly downloadable — NOT gated
behind a request form, despite the build spec doc's characterization):
  https://calce.umd.edu/battery-data
  -> https://web.calce.umd.edu/batteries/data/<CELL_ID>.zip

Scope of this pass (deliberately narrow — see README.md / DATA_CARD.md):
  - CS2 and CX2 families only, "Type 1" (0.5C) and "Type 2" (1C) protocols
    only: simple constant-current full-depth cycling, directly comparable
    to NASA's protocol. CS2-8/21 and CX2-4/31 excluded (CADEX tester, .txt
    format, not the Arbin .xlsx format this script parses). CS2 Types 3-6
    and CX2 Types 3-6 excluded (pulsed/randomized/partial-cycling
    protocols — not comparable to a simple full-cycle loss rate without
    separate handling).
  - Chemistry: LiCoO2 (LCO) for both families — same chemistry as NASA,
    NOT chemistry-matched to VoltLedger's LFP/NMC/NCA. This ingestion adds
    a second independent LCO source for cross-validation, it does not
    close the chemistry-match gap (see README.md's Gate A status table).
  - Ambient temperature: CALCE's own page does not state a controlled
    ambient temperature for these Type 1/2 cells (unlike NASA's explicit
    4C/24C/43C chambers, or CX2-4's explicit 25-55C temperature-cycling
    protocol, which is out of scope here). Rather than assume a number,
    ambient_temp_c is left null — these cells support a room-temperature
    cycle-loss-rate cross-check only, not a thermal-sensitivity fit.

Citation: He, W., Williard, N., Osterman, M., Pecht, M. (2011). "Prognostics
of lithium-ion batteries based on Dempster-Shafer theory and the Bayesian
Monte Carlo method." Journal of Power Sources, 196(23), 10314-10321.
(CALCE's own citation for the CS2/CX2 data — see calce.umd.edu/battery-data)

Not committed to git: the raw .xlsx files (~880MB for this scope). Run this
script locally against manually-downloaded zips; only its CSV/JSON output
is checked in.

Usage:
    pip install pandas openpyxl
    python3 convert_calce_xlsx.py --input-dir <dir with CS2_NN/ CX2_NN/ subfolders> \
        --out-csv ../data/calce/capacity_fade.csv \
        --out-cells ../data/calce/cells.json
"""
import argparse
import csv
import glob
import json
import os

import pandas as pd

RATED_CAPACITY_AH = {"CS2": 1.1, "CX2": 1.35}

PROTOCOL = {
    "CS2_33": "Type1_0.5C", "CS2_34": "Type1_0.5C",
    "CS2_35": "Type2_1C", "CS2_36": "Type2_1C", "CS2_37": "Type2_1C", "CS2_38": "Type2_1C",
    "CX2_16": "Type1_0.5C", "CX2_33": "Type1_0.5C", "CX2_35": "Type1_0.5C",
    "CX2_34": "Type2_0.5C", "CX2_36": "Type2_0.5C", "CX2_37": "Type2_0.5C", "CX2_38": "Type2_0.5C",
}


def family_of(cell_id: str) -> str:
    return "CS2" if cell_id.startswith("CS2") else "CX2"


def process_cell(cell_dir: str):
    cell_id = os.path.basename(cell_dir.rstrip("/"))
    family = family_of(cell_id)
    rated = RATED_CAPACITY_AH[family]

    xlsx_files = sorted(glob.glob(os.path.join(cell_dir, "*.xlsx")))
    if not xlsx_files:
        return [], {"cell_id": cell_id, "excluded": True, "exclusion_reason": "no xlsx files found"}

    frames = []
    for fp in xlsx_files:
        try:
            xl = pd.ExcelFile(fp)
            ch_sheets = [s for s in xl.sheet_names if s.startswith("Channel")]
            if not ch_sheets:
                continue
            df = xl.parse(ch_sheets[0], usecols=["Cycle_Index", "Date_Time", "Discharge_Capacity(Ah)"])
            df["__file"] = os.path.basename(fp)
            frames.append(df)
        except Exception as e:
            print(f"  skip file {fp}: {e}")
            continue

    if not frames:
        return [], {"cell_id": cell_id, "excluded": True, "exclusion_reason": "no readable Channel sheets"}

    all_rows = pd.concat(frames, ignore_index=True)
    all_rows["Date_Time"] = pd.to_datetime(all_rows["Date_Time"])

    # Cycle_Index resets to 1 in every dated file. IMPORTANT: Discharge_Capacity(Ah)
    # in the raw Channel sheet is a CUMULATIVE counter across the whole file
    # (verified directly: cycle 1 = 1.04Ah, cycle 2 = 2.09Ah, cycle 3 = 3.13Ah for
    # a ~1.04Ah cell) — it resets only at file boundaries, not per cycle. The
    # actual per-cycle discharge capacity is the DIFFERENCE between consecutive
    # cycles' cumulative max within each file, not the max value itself.
    per_file_groups = []
    for fname, g in all_rows.groupby("__file"):
        cum = g.groupby("Cycle_Index").agg(cum_cap=("Discharge_Capacity(Ah)", "max"), ts=("Date_Time", "min"))
        cum = cum.sort_index()
        per_cycle_cap = cum["cum_cap"].diff()
        per_cycle_cap.iloc[0] = cum["cum_cap"].iloc[0]  # first cycle in file: counter started at 0
        per_file_groups.append(pd.DataFrame({
            "__file": fname,
            "Cycle_Index": cum.index,
            "capacity_ahr": per_cycle_cap.values,
            "ts": cum["ts"].values,
        }))
    grouped = pd.concat(per_file_groups, ignore_index=True).sort_values("ts")
    grouped = grouped[grouped["capacity_ahr"] > 0]  # drop rest-only / no-discharge cycles
    if grouped.empty:
        return [], {"cell_id": cell_id, "excluded": True, "exclusion_reason": "no cycles with discharge capacity"}

    min_plausible, max_plausible = 0.3 * rated, 1.5 * rated
    early = grouped.head(5)
    early_valid = early[(early["capacity_ahr"] >= min_plausible) & (early["capacity_ahr"] <= max_plausible)]
    if early_valid.empty:
        return [], {"cell_id": cell_id, "excluded": True, "exclusion_reason": "no plausible capacity in first 5 cycles"}
    initial_capacity = float(early_valid["capacity_ahr"].median())

    t0 = grouped["ts"].iloc[0]
    rows = []
    dropped = 0
    for i, (_, r) in enumerate(grouped.iterrows(), start=1):
        cap = float(r["capacity_ahr"])
        if not (min_plausible <= cap <= max_plausible):
            dropped += 1
            continue
        elapsed_days = (r["ts"] - t0).total_seconds() / 86400.0
        rows.append({
            "cell_id": cell_id,
            "family": family,
            "chemistry": "LCO",
            "protocol": PROTOCOL.get(cell_id, "unknown"),
            "cycle_index": i,
            "elapsed_days": round(elapsed_days, 4),
            "capacity_ahr": round(cap, 6),
            "initial_capacity_ahr": round(initial_capacity, 6),
            "soh_pct": round(100.0 * cap / initial_capacity, 4),
        })

    if not rows:
        return [], {"cell_id": cell_id, "excluded": True, "exclusion_reason": "no plausible cycles after filtering"}

    meta = {
        "cell_id": cell_id,
        "excluded": False,
        "family": family,
        "chemistry": "LCO",
        "protocol": PROTOCOL.get(cell_id, "unknown"),
        "rated_capacity_ah": rated,
        "n_cycles": len(rows),
        "n_dropped_cycles": dropped,
        "n_source_files": len(xlsx_files),
        "initial_capacity_ahr": round(initial_capacity, 6),
        "final_capacity_ahr": rows[-1]["capacity_ahr"],
        "final_soh_pct": rows[-1]["soh_pct"],
        "total_elapsed_days": rows[-1]["elapsed_days"],
    }
    return rows, meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-dir", required=True, help="dir with CS2_NN/ CX2_NN/ subfolders")
    ap.add_argument("--out-csv", required=True)
    ap.add_argument("--out-cells", required=True)
    args = ap.parse_args()

    cell_dirs = sorted(
        d for d in glob.glob(os.path.join(args.input_dir, "*"))
        if os.path.isdir(d) and os.path.basename(d) in PROTOCOL
    )
    if not cell_dirs:
        raise SystemExit(f"no known CS2_NN/CX2_NN cell dirs found under {args.input_dir}")

    all_rows = []
    all_meta = []
    for cd in cell_dirs:
        print(f"processing {os.path.basename(cd)}...")
        rows, meta = process_cell(cd)
        all_meta.append(meta)
        if meta.get("excluded"):
            print(f"  EXCLUDED — {meta['exclusion_reason']}")
            continue
        all_rows.extend(rows)
        print(f"  {meta['n_cycles']} cycles ({meta['n_dropped_cycles']} dropped), "
              f"SoH 100.0% -> {meta['final_soh_pct']:.1f}%, {meta['n_source_files']} source files")

    os.makedirs(os.path.dirname(args.out_csv), exist_ok=True)
    with open(args.out_csv, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(all_rows[0].keys()))
        w.writeheader()
        w.writerows(all_rows)

    with open(args.out_cells, "w") as f:
        json.dump({
            "source": "CALCE Battery Data (CS2/CX2 families, Type 1/2 protocols only)",
            "source_url": "https://calce.umd.edu/battery-data",
            "citation": "He, W., Williard, N., Osterman, M., Pecht, M. (2011). "
                        "\"Prognostics of lithium-ion batteries based on Dempster-Shafer "
                        "theory and the Bayesian Monte Carlo method.\" Journal of Power "
                        "Sources, 196(23), 10314-10321.",
            "chemistry": "LiCoO2 (LCO), both CS2 and CX2 families — same chemistry as "
                         "NASA PCoE, NOT chemistry-matched to VoltLedger's LFP/NMC/NCA.",
            "ambient_temp_c": None,
            "ambient_temp_note": "Not stated by CALCE for these Type 1/2 cells (unlike "
                                  "NASA's explicit chambers) — treat as an uncontrolled "
                                  "room-temperature cross-check, not thermal-fit input.",
            "cells": all_meta,
        }, f, indent=2)

    print(f"\nwrote {len(all_rows)} rows across {len([m for m in all_meta if not m.get('excluded')])} cells")
    print(f"  -> {args.out_csv}")
    print(f"  -> {args.out_cells}")


if __name__ == "__main__":
    main()
