#!/usr/bin/env python3
"""Build data/geo/markets.json from NASA POWER and WRI Aqueduct 4.0.

Run from the repo root:  scripts/geo/.venv/bin/python scripts/geo/build_geo.py
Inputs : data/geo/candidates.json
Raw    : data/geo/raw/ (git-ignored)
           power/{iso3}.json                          cached NASA POWER responses
           aqueduct/aq.zip, aqueduct/cr.zip           downloaded automatically if missing (public, no registration)
Output : data/geo/markets.json
"""
from __future__ import annotations

import datetime as dt
import glob
import json
import sys
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio
import requests
import socket
import urllib3.util.connection as _urllib3_conn
from shapely.geometry import Point

# Some networks advertise IPv6 for NASA/WRI hosts but do not route it, and requests then hangs until timeout.
# Prefer IPv4.
_urllib3_conn.allowed_gai_family = lambda: socket.AF_INET

ROOT = Path(__file__).resolve().parents[2]
GEO = ROOT / "data" / "geo"
RAW = GEO / "raw"
POWER_DIR = RAW / "power"
AQ_DIR = RAW / "aqueduct"

AQ_ZIP_URL = "https://files.wri.org/aqueduct/aqueduct-4-0-water-risk-data.zip"
CR_ZIP_URL = "https://files.wri.org/aqueduct/aqueduct-4-0-country-rankings.zip"
POWER_URL = (
    "https://power.larc.nasa.gov/api/temporal/climatology/point"
    "?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude={lon}&latitude={lat}&format=JSON"
)
TODAY = dt.date.today().isoformat()

# Canonical sentence-case labels keyed by normalised category.
CANON = {
    "low": "Low (<10%)",
    "low-medium": "Low-medium (10-20%)",
    "medium-high": "Medium-high (20-40%)",
    "high": "High (40-80%)",
    "extremely high": "Extremely high (>80%)",
    "arid and low water use": "Arid and low water use",
}


def canon_label(label: str | None) -> str | None:
    if not label or not isinstance(label, str):
        return None
    import re

    key = re.sub(r"\(.*?\)", "", label)
    key = re.sub(r"\s*-\s*", "-", key)
    key = re.sub(r"\s+", " ", key).strip().lower()
    return CANON.get(key)


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 1_000_000:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading {url}", file=sys.stderr)
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)


def ensure_aqueduct() -> tuple[Path, Path, Path, Path]:
    """Return (gdb, future_csv, rankings_xlsx, ...) extracting the public downloads if needed."""
    aq_zip = AQ_DIR / "aq.zip"
    cr_zip = AQ_DIR / "cr.zip"
    if not glob.glob(str(AQ_DIR / "Aqueduct40_waterrisk_download_*" / "GDB" / "*.gdb")):
        download(AQ_ZIP_URL, aq_zip)
        zipfile.ZipFile(aq_zip).extractall(AQ_DIR)
    if not glob.glob(str(AQ_DIR / "cr" / "*" / "*.xlsx")):
        download(CR_ZIP_URL, cr_zip)
        zipfile.ZipFile(cr_zip).extractall(AQ_DIR / "cr")
    gdb = Path(glob.glob(str(AQ_DIR / "Aqueduct40_waterrisk_download_*" / "GDB" / "*.gdb"))[0])
    fut = Path(glob.glob(str(AQ_DIR / "Aqueduct40_waterrisk_download_*" / "CVS" / "Aqueduct40_future_annual_*.csv"))[0])
    xlsx = Path(glob.glob(str(AQ_DIR / "cr" / "*" / "*.xlsx"))[0])
    return gdb, fut, xlsx, aq_zip


def fetch_power(iso3: str, lat: float, lon: float) -> dict:
    POWER_DIR.mkdir(parents=True, exist_ok=True)
    cache = POWER_DIR / f"{iso3}.json"
    if cache.exists():
        data = json.loads(cache.read_text())
    else:
        r = requests.get(POWER_URL.format(lat=lat, lon=lon), timeout=60)
        r.raise_for_status()
        data = r.json()
        cache.write_text(json.dumps(data))
    ann = data["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]["ANN"]
    units = data["parameters"]["ALLSKY_SFC_SW_DWN"]["units"]
    fill = data.get("header", {}).get("fill_value", -999.0)
    if ann is None or ann == fill:
        raise ValueError(f"{iso3}: NASA POWER returned fill value")
    u = units.lower().replace(" ", "")
    if u.startswith("kw-hr") or u.startswith("kwh"):
        kwh = float(ann)
    elif u.startswith("mj"):
        kwh = float(ann) / 3.6
    else:
        raise ValueError(f"{iso3}: unexpected units {units!r}")
    return {"kwh": round(kwh, 2), "units_raw": units, "ann_raw": ann}


def basin_lookup(gdb: Path, lat: float, lon: float) -> tuple[pd.Series | None, str, float]:
    """Point-in-polygon against baseline_annual; fall back to nearest valid polygon (<=100 km)."""
    cols = ["pfaf_id", "gid_0", "name_0", "name_1", "bws_score", "bws_label", "bws_cat"]
    pad = 1.5
    gdf = pyogrio.read_dataframe(gdb, layer="baseline_annual", columns=cols, bbox=(lon - pad, lat - pad, lon + pad, lat + pad))
    if gdf.empty:
        return None, "none", 0.0
    gdf = gdf.set_crs(4326, allow_override=True)
    pt = Point(lon, lat)
    inside = gdf[gdf.geometry.contains(pt)]
    inside = inside[inside.bws_label.map(lambda x: canon_label(x) is not None)]
    if not inside.empty:
        # several basin x province polygons may overlap a point; take the most stressed (highest score) deterministically
        row = inside.sort_values(["bws_score", "pfaf_id"], ascending=[False, True]).iloc[0]
        return row, "within", 0.0
    valid = gdf[gdf.bws_label.map(lambda x: canon_label(x) is not None)].to_crs(3857)
    if valid.empty:
        return None, "none", 0.0
    pt3857 = gpd.GeoSeries([pt], crs=4326).to_crs(3857).iloc[0]
    d = valid.geometry.distance(pt3857)
    i = d.idxmin()
    # EPSG:3857 distances are inflated away from the equator; correct by cos(lat) for an approximate km figure.
    import math

    km = float(d.loc[i]) * math.cos(math.radians(lat)) / 1000
    if km > 100:
        return None, "none", km
    return valid.loc[i], "nearest", round(km, 1)


def main() -> None:
    cand = json.loads((GEO / "candidates.json").read_text())
    gdb, fut_csv, xlsx, _ = ensure_aqueduct()

    ctry = pd.read_excel(xlsx, "country_baseline")
    ctry = ctry[(ctry.indicator_name == "bws") & (ctry.weight == "Tot")].set_index("gid_0")
    fut = pd.read_csv(fut_csv, usecols=["pfaf_id", "bau30_ws_x_l"]).drop_duplicates("pfaf_id").set_index("pfaf_id")

    markets = []
    for c in cand["candidates"]:
        iso, site = c["iso3"], c["site"]
        solar = fetch_power(iso, site["lat"], site["lon"])
        row, how, km = basin_lookup(gdb, site["lat"], site["lon"])
        cr = ctry.loc[iso] if iso in ctry.index else None
        ws: dict
        if row is not None:
            proj = None
            if int(row.pfaf_id) in fut.index:
                proj = canon_label(fut.loc[int(row.pfaf_id), "bau30_ws_x_l"])
            ws = {
                "basin_score": round(float(row.bws_score), 2),
                "basin_label": canon_label(row.bws_label),
                "country_score": round(float(cr.score), 2) if cr is not None else None,
                "country_label": canon_label(cr.label) if cr is not None else None,
                "projected_2030_label": proj,
                "basin_match": how,
                "provenance": "aqueduct",
            }
            if how == "nearest":
                ws["basin_match_km"] = km
        elif cr is not None:
            ws = {
                "basin_score": round(float(cr.score), 2),
                "basin_label": canon_label(cr.label),
                "country_score": round(float(cr.score), 2),
                "country_label": canon_label(cr.label),
                "projected_2030_label": None,
                "basin_from_country": True,
                "provenance": "aqueduct",
            }
        else:
            raise SystemExit(f"{iso}: no Aqueduct value could be sourced")
        if ws["country_score"] is None:
            ws["country_score"] = ws["basin_score"]
            ws["country_label"] = ws["basin_label"]
            ws["country_note"] = "country ranking missing; basin value shown"
        markets.append(
            {
                "iso3": iso,
                "country": c["country"],
                "site": site,
                "water_stress": ws,
                "solar_kwh_m2_day": solar["kwh"],
                "presence": c["presence"],
                "rypples_coverage": c["rypples_coverage"],
            }
        )
        print(f"{iso} {site['name']:<28} solar {solar['kwh']:.2f}  basin {ws['basin_score']} {ws['basin_label']} ({how}{'' if how!='nearest' else f' {km} km'})  country {ws['country_score']} proj30 {ws['projected_2030_label']}")

    out = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "datasets": [
            {
                "id": "aqueduct40",
                "accessed_at": TODAY,
                "attribution": (
                    "Source: WRI Aqueduct 4.0 (CC BY 4.0), accessed on " + TODAY + ". Basin value: baseline water stress "
                    "(bws) of the sub-basin polygon (HydroBASINS level 6 by province) containing each site point; where a coastal "
                    "point fell outside every polygon the nearest polygon with data within 100 km was used (flagged per market). "
                    "Country context: country rankings, baseline water stress, total-withdrawal weighting. Projection: "
                    "business-as-usual 2030 water stress category for the same basin."
                ),
                "url": "https://www.wri.org/aqueduct",
            },
            {
                "id": "nasa_power",
                "accessed_at": TODAY,
                "attribution": (
                    "Source: NASA POWER climatology, ALLSKY_SFC_SW_DWN annual mean at the site point (community RE), "
                    "converted to kWh/m²/day where needed."
                ),
                "url": "https://power.larc.nasa.gov/",
            },
            {
                "id": "natural_earth",
                "accessed_at": TODAY,
                "attribution": "Boundaries: Natural Earth 1:110m (public domain), via the world-atlas topojson.",
                "url": "https://www.naturalearthdata.com/",
            },
        ],
        "markets": markets,
        "pins": cand["pins"],
    }
    (GEO / "markets.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {GEO / 'markets.json'} ({len(markets)} markets)")


if __name__ == "__main__":
    main()
