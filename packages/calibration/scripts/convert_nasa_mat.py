#!/usr/bin/env python3
"""
One-time conversion: NASA PCoE "5. Battery Data Set" (.mat, MATLAB v5) ->
normalized capacity-fade CSV + per-cell metadata JSON.

Source (official NASA PCoE data-set repository):
  https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/
  -> "5. Battery Data Set.zip"
  -> https://phm-datasets.s3.amazonaws.com/NASA/5.+Battery+Data+Set.zip

Citation: B. Saha and K. Goebel (2007). "Battery Data Set", NASA Prognostics
Data Repository, NASA Ames Research Center, Moffett Field, CA.

Cells: 34x 18650 Li-ion (LCO/graphite, ~2Ahr rated), cycled to 20-30% capacity
fade at three ambient temperatures (4C, 24C, 43C). This is a CYCLING aging
study, not a calendar/rest-aging study — see the data card for what this
does and does not calibrate.

Not committed to git: the raw .mat files (~190MB). Run this script locally
against a manually-downloaded copy of the zip; only its CSV/JSON output is
checked in.

Usage:
    pip install scipy numpy
    python3 convert_nasa_mat.py --input-dir <dir containing B00NN.mat files> \
        --out-csv ../data/nasa-pcoe/capacity_fade.csv \
        --out-cells ../data/nasa-pcoe/cells.json
"""
import argparse
import csv
import glob
import json
import os
from datetime import datetime

import numpy as np
import scipy.io as sio

# Ambient temperature band -> batch citation, from the batch READMEs shipped
# alongside the official zip (kept for the data card, not needed at runtime).
BATCH_NOTES = {
    4: "4 deg C batches (B0041-44, B0045-48, B0049-52, B0053-56)",
    24: "24 deg C / room-temperature batches (B0005-07, B0018, B0025-28, B0033/34/36)",
    43: "43 deg C batches (B0029-32)",
}


def matlab_datevec_to_epoch_days(vec) -> float:
    """MATLAB date vector [Y M D h m s] -> days since epoch (arbitrary origin, relative use only)."""
    y, mo, d, h, mi, s = [float(x) for x in np.array(vec).flatten()[:6]]
    dt = datetime(int(y), int(mo), int(d), int(h), int(mi), int(s))
    return dt.timestamp() / 86400.0


# Physical plausibility bound. NASA's own READMEs for the 4C batches (41-56)
# flag "several discharge runs where the capacity was very low... not fully
# analyzed" and one batch (49-52) where "the experiment control software
# crashed". Rather than silently curve-fit around it, drop cycles whose
# recorded capacity is not physically plausible for one of these ~2Ahr rated
# 18650 cells, and report exactly how many were dropped per cell.
MIN_PLAUSIBLE_CAPACITY_AHR = 0.5
MAX_PLAUSIBLE_CAPACITY_AHR = 2.5


def process_cell(mat_path: str):
    cell_id = os.path.splitext(os.path.basename(mat_path))[0]  # e.g. "B0005"
    data = sio.loadmat(mat_path, simplify_cells=True)
    cycles = data[cell_id]["cycle"]
    discharge_cycles = [c for c in cycles if c["type"] == "discharge"]
    if not discharge_cycles:
        return [], None

    # Robust reference capacity: median of the first 5 valid readings, not
    # cycle[0] alone — some cells' very first recorded discharge is itself a
    # corrupted/incomplete run (e.g. B0041 cycle 0 reads 0.056 Ahr).
    early_caps = []
    for c in discharge_cycles[:5]:
        try:
            v = float(c["data"]["Capacity"])
            if MIN_PLAUSIBLE_CAPACITY_AHR <= v <= MAX_PLAUSIBLE_CAPACITY_AHR:
                early_caps.append(v)
        except (TypeError, ValueError):
            continue
    if not early_caps:
        return [], {
            "cell_id": cell_id, "excluded": True,
            "exclusion_reason": "no plausible capacity reading in first 5 discharge cycles",
        }
    initial_capacity = float(np.median(early_caps))

    t0 = matlab_datevec_to_epoch_days(discharge_cycles[0]["time"])
    ambient_temp = int(round(float(discharge_cycles[0]["ambient_temperature"])))

    rows = []
    dropped = 0
    for i, c in enumerate(discharge_cycles, start=1):
        try:
            cap = float(c["data"]["Capacity"])
        except (TypeError, ValueError):
            dropped += 1
            continue
        if not (MIN_PLAUSIBLE_CAPACITY_AHR <= cap <= MAX_PLAUSIBLE_CAPACITY_AHR):
            dropped += 1
            continue

        cur = np.array(c["data"]["Current_load"]).flatten()
        # discharge current is negative by NASA's sign convention; take the
        # median of the loaded (non-near-zero) samples as the plateau current.
        loaded = cur[np.abs(cur) > 0.05]
        discharge_current_a = float(np.median(np.abs(loaded))) if len(loaded) else float("nan")
        elapsed_days = matlab_datevec_to_epoch_days(c["time"]) - t0

        rows.append({
            "cell_id": cell_id,
            "ambient_temp_c": ambient_temp,
            "cycle_index": i,
            "elapsed_days": round(elapsed_days, 4),
            "discharge_current_a": round(discharge_current_a, 4),
            "capacity_ahr": round(cap, 6),
            "initial_capacity_ahr": round(initial_capacity, 6),
            "soh_pct": round(100.0 * cap / initial_capacity, 4),
        })

    if not rows:
        return [], {
            "cell_id": cell_id, "excluded": True,
            "exclusion_reason": "no plausible discharge cycles after filtering",
        }

    meta = {
        "cell_id": cell_id,
        "excluded": False,
        "ambient_temp_c": ambient_temp,
        "n_discharge_cycles": len(rows),
        "n_dropped_cycles": dropped,
        "initial_capacity_ahr": round(initial_capacity, 6),
        "final_capacity_ahr": rows[-1]["capacity_ahr"],
        "final_soh_pct": rows[-1]["soh_pct"],
        "total_elapsed_days": round(
            matlab_datevec_to_epoch_days(discharge_cycles[-1]["time"]) - t0, 2
        ),
        "batch_note": BATCH_NOTES.get(ambient_temp, "unknown batch"),
    }
    return rows, meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input-dir", required=True, help="dir containing B00NN.mat files")
    ap.add_argument("--out-csv", required=True)
    ap.add_argument("--out-cells", required=True)
    args = ap.parse_args()

    mat_files = sorted(glob.glob(os.path.join(args.input_dir, "B*.mat")))
    if not mat_files:
        raise SystemExit(f"no B*.mat files found under {args.input_dir}")

    all_rows = []
    all_meta = []
    for mp in mat_files:
        rows, meta = process_cell(mp)
        if meta is None:
            print(f"skip {mp}: no discharge cycles")
            continue
        all_meta.append(meta)
        if meta.get("excluded"):
            print(f"{meta['cell_id']}: EXCLUDED — {meta['exclusion_reason']}")
            continue
        all_rows.extend(rows)
        print(f"{meta['cell_id']}: {meta['n_discharge_cycles']} discharge cycles "
              f"({meta['n_dropped_cycles']} dropped as implausible), "
              f"{meta['ambient_temp_c']}C, SoH 100.0% -> {meta['final_soh_pct']:.1f}%")

    os.makedirs(os.path.dirname(args.out_csv), exist_ok=True)
    with open(args.out_csv, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(all_rows[0].keys()))
        w.writeheader()
        w.writerows(all_rows)

    with open(args.out_cells, "w") as f:
        json.dump({
            "source": "NASA PCoE Battery Data Set (official S3 mirror linked from "
                       "nasa.gov PCoE data-set repository)",
            "source_url": "https://phm-datasets.s3.amazonaws.com/NASA/5.+Battery+Data+Set.zip",
            "citation": "B. Saha and K. Goebel (2007). \"Battery Data Set\", NASA "
                        "Prognostics Data Repository, NASA Ames Research Center, "
                        "Moffett Field, CA.",
            "chemistry": "18650 Li-ion, LCO/graphite (~2Ahr rated) — NOT chemistry-matched "
                         "to VoltLedger's LFP/NMC/NCA taxonomy; see data card.",
            "cells": all_meta,
        }, f, indent=2)

    print(f"\nwrote {len(all_rows)} rows across {len(all_meta)} cells")
    print(f"  -> {args.out_csv}")
    print(f"  -> {args.out_cells}")


if __name__ == "__main__":
    main()
