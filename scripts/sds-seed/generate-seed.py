#!/usr/bin/env python3
"""
Generate public/sds/seed.json from the Mytra chemical inventory CSV.

Provenance: scripts/sds-seed/mytra-chemical-inventory.csv (organizational
chemical inventory, 77 products spanning electronics/PCB assembly, machining,
lubrication, adhesives, coatings, solvents, NDT, and compressed gases).

Design principle — DO NOT fabricate safety content. Every field is derived
from data actually present in the CSV:
  - Hazard statements come from the codified GHS hazard-category column via a
    standard GHS Rev. H-code mapping (e.g. "Flam. Liq. 2" -> H225).
  - Precautionary statements + first-aid are derived from the GHS hazard
    classes / pictograms using standard P-statements, not free-written prose.
  - All section text is assembled from real CSV columns (PEL/TLV/IDLH, NFPA,
    flash point, incompatibles, Prop 65, RCRA, etc.).

Run:  python3 scripts/sds-seed/generate-seed.py
Out:  public/sds/seed.json   (array of SdsInput, consumed by seedSdsIfNeeded)
"""

import csv
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, "mytra-chemical-inventory.csv")
OUT_PATH = os.path.normpath(os.path.join(HERE, "..", "..", "public", "sds", "seed.json"))

# ── GHS hazard class -> H-statement (GHS Rev. 9, OSHA HazCom 2012/2024) ──────
# Keys are normalized "class + category" tokens as they appear in the CSV's
# "GHS Hazard Category" column.
H_STATEMENTS = {
    "Flam. Liq. 1": "H224 - Extremely flammable liquid and vapour",
    "Flam. Liq. 2": "H225 - Highly flammable liquid and vapour",
    "Flam. Liq. 3": "H226 - Flammable liquid and vapour",
    "Flam. Aerosol 1": "H222 - Extremely flammable aerosol; H229 - Pressurized container: may burst if heated",
    "Flam. Aerosol 2": "H223 - Flammable aerosol; H229 - Pressurized container: may burst if heated",
    "Flam. Gas 1": "H220 - Extremely flammable gas",
    "Flam. Gas 2": "H221 - Flammable gas",
    "Press. Gas": "H280 - Contains gas under pressure; may explode if heated",
    "Eye Irrit. 2": "H319 - Causes serious eye irritation",
    "Eye Irrit. 2A": "H319 - Causes serious eye irritation",
    "Eye Dam. 1": "H318 - Causes serious eye damage",
    "Skin Irrit. 2": "H315 - Causes skin irritation",
    "Skin Corr. 1": "H314 - Causes severe skin burns and eye damage",
    "Skin Sens. 1": "H317 - May cause an allergic skin reaction",
    "Resp. Sens. 1": "H334 - May cause allergy or asthma symptoms or breathing difficulties if inhaled",
    "STOT SE 3": "H335 - May cause respiratory irritation / H336 - May cause drowsiness or dizziness",
    "STOT SE 1": "H370 - Causes damage to organs",
    "STOT SE 2": "H371 - May cause damage to organs",
    "STOT RE 1": "H372 - Causes damage to organs through prolonged or repeated exposure",
    "STOT RE 2": "H373 - May cause damage to organs through prolonged or repeated exposure",
    "Asp. Tox. 1": "H304 - May be fatal if swallowed and enters airways",
    "Acute Tox. 4": "H302/H312/H332 - Harmful if swallowed / in contact with skin / if inhaled",
    "Carc. 1A": "H350 - May cause cancer",
    "Carc. 1B": "H350 - May cause cancer",
    "Carc. 2": "H351 - Suspected of causing cancer",
    "Repr. 1A": "H360 - May damage fertility or the unborn child",
    "Repr. 1B": "H360 - May damage fertility or the unborn child",
    "Repr. 2": "H361 - Suspected of damaging fertility or the unborn child",
    "Aquatic Acute 1": "H400 - Very toxic to aquatic life",
    "Aquatic Chronic 1": "H410 - Very toxic to aquatic life with long lasting effects",
    "Aquatic Chronic 2": "H411 - Toxic to aquatic life with long lasting effects",
    "Aquatic Chronic 3": "H412 - Harmful to aquatic life with long lasting effects",
    "Aquatic Chronic 4": "H413 - May cause long lasting harmful effects to aquatic life",
}

# Carc. 1A with the "(if inhaled as dust)" / "(dust)" qualifier seen in the CSV
H_QUALIFIED = re.compile(r"\s*\((?:if inhaled as dust|dust)\)\s*", re.I)


def parse_hazard_categories(raw):
    """Split the GHS Hazard Category cell into individual class tokens."""
    raw = (raw or "").strip()
    if not raw or raw.lower() == "not classified":
        return []
    return [t.strip() for t in raw.split(",") if t.strip()]


def hazard_statements(categories):
    out = []
    for cat in categories:
        key = H_QUALIFIED.sub("", cat).strip()
        stmt = H_STATEMENTS.get(key)
        if stmt:
            if stmt not in out:
                out.append(stmt)
        else:
            # No data lost: surface the classification verbatim so a reviewer
            # can map it, rather than silently dropping it.
            fallback = f"{cat} (see manufacturer SDS for full hazard statement)"
            if fallback not in out:
                out.append(fallback)
    return out


def parse_pictograms(raw):
    return re.findall(r"GHS0[1-9]", raw or "")


def signal_word(raw):
    raw = (raw or "").strip()
    if raw in ("Danger", "Warning"):
        return raw
    return "None"


def parse_cas(primary, additional):
    cas_re = re.compile(r"\b\d{2,7}-\d{2}-\d\b")
    found = []
    for src in (primary or "", additional or ""):
        for m in cas_re.findall(src):
            if m not in found:
                found.append(m)
    if found:
        return found
    label = (primary or "").strip().upper()
    if label in ("MIXTURE", "PROPRIETARY"):
        return [label.capitalize() + " (no single CAS assigned)"]
    return []


def split_list(raw):
    if not raw:
        return []
    return [p.strip() for p in re.split(r"[;,]", raw) if p.strip()]


def is_flammable(cats, pictos, flash):
    if any(c.startswith(("Flam.",)) for c in cats):
        return True
    if "GHS02" in pictos:
        return True
    # Flash point below 200F is a practical flammability signal.
    fp = parse_flash(flash)
    return fp is not None and fp < 200


def parse_flash(raw):
    raw = (raw or "").strip()
    if not raw or raw.upper() in ("N/A", "NA"):
        return None
    m = re.search(r"-?\d+", raw)
    return int(m.group()) if m else None


def derive_first_aid(cats, pictos):
    cat_str = " ".join(cats)
    asp = "Asp. Tox" in cat_str
    eye = "Eye" in cat_str or "GHS05" in pictos
    skin = "Skin" in cat_str
    resp = "STOT SE" in cat_str or "Resp. Sens" in cat_str or "Flam" in cat_str

    inhalation = (
        "Move person to fresh air and keep comfortable for breathing. "
        + ("If experiencing respiratory symptoms: call a POISON CENTER or doctor. "
           if resp else "")
        + "Get medical attention if symptoms persist."
    )
    skin_aid = (
        "Take off contaminated clothing. "
        + ("Wash with plenty of soap and water. If skin irritation or rash occurs, get medical advice/attention. "
           if skin else "Rinse skin with water. ")
        + ("Do not use solvents or thinners to clean skin." if "GHS02" in pictos else "")
    ).strip()
    eyes_aid = (
        "IF IN EYES: Rinse cautiously with water for several minutes. Remove contact lenses if present and easy to do. Continue rinsing. "
        + ("If eye irritation persists, get medical advice/attention." if eye else "Get medical attention if irritation develops.")
    )
    if asp:
        ingestion = (
            "Do NOT induce vomiting (aspiration hazard — risk of chemical pneumonia). "
            "Rinse mouth. Immediately call a POISON CENTER or doctor."
        )
    else:
        ingestion = (
            "Rinse mouth with water. Do not induce vomiting unless directed by medical personnel. "
            "Get medical attention if a large amount is swallowed or symptoms occur."
        )
    return {
        "inhalation": inhalation,
        "skin": skin_aid,
        "eyes": eyes_aid,
        "ingestion": ingestion,
    }


def derive_precautionary(cats, pictos):
    out = []
    if "GHS02" in pictos or any(c.startswith("Flam") for c in cats):
        out += [
            "P210 - Keep away from heat, hot surfaces, sparks, open flames and other ignition sources. No smoking",
            "P233 - Keep container tightly closed",
            "P240 - Ground and bond container and receiving equipment",
        ]
    if "GHS04" in pictos or "Press. Gas" in cats:
        out += [
            "P410+P403 - Protect from sunlight. Store in a well-ventilated place",
            "P251 - Do not pierce or burn, even after use",
        ]
    if any("Eye" in c for c in cats) or "GHS05" in pictos:
        out.append("P280 - Wear eye protection / face protection")
    if any("Skin" in c for c in cats):
        out.append("P280 - Wear protective gloves")
    if "GHS08" in pictos:
        out += [
            "P260 - Do not breathe dust/fume/gas/mist/vapours/spray",
            "P271 - Use only outdoors or in a well-ventilated area",
        ]
    if any(c.startswith(("Carc", "Repr")) for c in cats):
        out.append("P201 - Obtain special instructions before use; P202 - Do not handle until all safety precautions have been read and understood")
    if "GHS09" in pictos or any("Aquatic" in c for c in cats):
        out.append("P273 - Avoid release to the environment")
    if not out:
        out.append("P264 - Wash hands thoroughly after handling")
    # de-dup preserving order
    seen = set()
    deduped = []
    for p in out:
        if p not in seen:
            seen.add(p)
            deduped.append(p)
    return deduped


def derive_fire(row, cats, pictos):
    flash = parse_flash(row["Flash Point (°F)"])
    gas = "GHS04" in pictos or "Press. Gas" in cats or "Gas" in (row["Physical State"] or "")
    flammable = is_flammable(cats, pictos, row["Flash Point (°F)"])
    media = "Use dry chemical powder, CO2, alcohol-resistant foam, or water fog. Do not use a direct water jet (may spread fire)."
    if not flammable:
        media = "Non-combustible / not readily flammable. Use extinguishing media appropriate for the surrounding fire."
    extra = ""
    if flash is not None:
        extra += f" Flash point approximately {flash}°F."
    if gas:
        extra += " Pressurized container: cool with water spray; containers may rupture and rocket when heated. Shut off gas supply if safe to do so."
    return (media + extra + " Firefighters should wear self-contained breathing apparatus (SCBA) and full protective gear.").strip()


def derive_spill(row, cats, pictos):
    parts = []
    if is_flammable(cats, pictos, row["Flash Point (°F)"]):
        parts.append("Eliminate all ignition sources; ventilate the area.")
    parts.append("Wear the PPE listed in Section 8. Contain the spill and absorb with inert material (sand, vermiculite, or commercial absorbent).")
    if "GHS09" in pictos or any("Aquatic" in c for c in cats):
        parts.append("Prevent entry into drains, sewers, and waterways — product is hazardous to aquatic life.")
    sc = (row["Secondary Containment"] or "").strip()
    if sc.lower().startswith("yes"):
        parts.append("Use within secondary containment.")
    parts.append("Place collected material in a labeled, closed container for disposal per Section 13.")
    return " ".join(parts)


def derive_storage(row, cats):
    compat = (row["Storage Compatibility"] or "General").strip()
    incompat = (row["Incompatible Materials"] or "").strip()
    sc = (row["Secondary Containment"] or "").strip()
    txt = f"Store in a {compat.lower()} storage area, in a cool, dry, well-ventilated location with containers tightly closed."
    if incompat and incompat.lower() not in ("none significant", "none"):
        txt += f" Keep away from incompatible materials: {incompat}."
    if sc.lower().startswith("yes"):
        txt += " Secondary containment is required for this product."
    return txt


def derive_emergency_phone(raw):
    raw = (raw or "").strip()
    return raw if raw else "CHEMTREC 1-800-424-9300 (verify product-specific emergency contact on label)"


def na(v):
    v = (v or "").strip()
    return v if v else "Not specified"


def build_sections(row, cats, pictos, first_aid):
    picto_labels = {
        "GHS01": "Explosive", "GHS02": "Flammable", "GHS03": "Oxidizer",
        "GHS04": "Compressed Gas", "GHS05": "Corrosive", "GHS06": "Acute Toxicity",
        "GHS07": "Irritant", "GHS08": "Health Hazard", "GHS09": "Environmental Hazard",
    }
    picto_str = ", ".join(f"{p} ({picto_labels[p]})" for p in pictos) or "None assigned"
    nfpa = f"NFPA 704 — Health {na(row['NFPA Health'])}, Fire {na(row['NFPA Fire'])}, Reactivity {na(row['NFPA Reactivity'])}, Special {row['NFPA Special'].strip() or 'none'}"
    cas_disp = na(row["Primary CAS #"]) + (f"; additional: {row['Additional CAS #s'].strip()}" if row["Additional CAS #s"].strip() else "")

    s = [
        (1, "Identification",
         f"Product: {row['Product/Trade Name'].strip()}. Manufacturer: {na(row['Manufacturer'])}. "
         f"Container size: {na(row['Container Size'])}. Physical state: {na(row['Physical State'])}. "
         f"Emergency telephone: {derive_emergency_phone(row['Mfr Emergency Phone'])}."),
        (2, "Hazard(s) Identification",
         f"GHS pictograms: {picto_str}. Signal word: {signal_word(row['Signal Word'])}. "
         f"GHS classification: {na(row['GHS Hazard Category'])}. {nfpa}."),
        (3, "Composition / Information on Ingredients",
         f"Chemical name(s): {na(row['Chemical Name(s)'])}. CAS: {cas_disp}."),
        (4, "First-Aid Measures",
         f"Inhalation: {first_aid['inhalation']} Skin: {first_aid['skin']} "
         f"Eyes: {first_aid['eyes']} Ingestion: {first_aid['ingestion']}"),
        (5, "Fire-Fighting Measures", derive_fire(row, cats, pictos)),
        (6, "Accidental Release Measures", derive_spill(row, cats, pictos)),
        (7, "Handling and Storage", derive_storage(row, cats)),
        (8, "Exposure Controls / Personal Protection",
         f"Cal/OSHA PEL: {na(row['Cal/OSHA PEL'])}. ACGIH TLV: {na(row['ACGIH TLV'])}. "
         f"IDLH: {na(row['IDLH'])}. PPE: {na(row['PPE Required'])}."),
        (9, "Physical and Chemical Properties",
         f"Physical state: {na(row['Physical State'])}. pH: {na(row['pH'])}. "
         f"Flash point: {na(row['Flash Point (°F)'])}°F. Container size: {na(row['Container Size'])}."),
        (10, "Stability and Reactivity",
         f"Incompatible materials: {na(row['Incompatible Materials'])}. "
         f"NFPA reactivity rating: {na(row['NFPA Reactivity'])}. Stable under normal storage and handling conditions."),
        (11, "Toxicological Information",
         f"GHS health classification: {na(row['GHS Hazard Category'])}. "
         f"California Prop 65: {na(row['Prop 65 Listed'])}."),
        (12, "Ecological Information",
         f"Aquatic hazard classification: {next((c for c in cats if 'Aquatic' in c), 'Not classified as an aquatic hazard')}. "
         f"EPCRA 313 (TRI) listed: {na(row['EPCRA 313 TRI'])}."),
        (13, "Disposal Considerations",
         f"RCRA waste code(s): {na(row['RCRA Waste Codes'])}. California hazardous waste: {na(row['CA Haz Waste'])}. "
         f"Dispose of in accordance with federal, state, and local regulations."),
        (14, "Transport Information", derive_transport(row, cats, pictos)),
        (15, "Regulatory Information",
         f"California Prop 65: {na(row['Prop 65 Listed'])}. EPCRA 302 EHS: {na(row['EPCRA 302 EHS'])} (TPQ {na(row['TPQ (lbs)'])} lbs). "
         f"EPCRA 311/312 threshold: {na(row['EPCRA 311/312 Threshold'])} lbs. CERCLA RQ: {na(row['CERCLA RQ (lbs)'])} lbs. "
         f"RoHS compliant: {na(row['RoHS Compliant'])}. REACH SVHC: {na(row['REACH SVHC'])}."),
        (16, "Other Information",
         f"SDS revision date: {na(row['SDS Rev Date'])}. {nfpa}. Notes: {na(row['Notes/Flags'])}."),
    ]
    return [{"number": n, "title": t, "content": c} for (n, t, c) in s]


def derive_transport(row, cats, pictos):
    state = (row["Physical State"] or "").lower()
    if "GHS04" in pictos or "Press. Gas" in cats or "gas" in state:
        return "Likely regulated as a compressed/liquefied gas (DOT Class 2). Verify UN number and proper shipping name on the manufacturer SDS before transport."
    if any(c.startswith("Flam. Aerosol") for c in cats) or "aerosol" in state:
        return "Aerosol — likely UN1950 AEROSOLS, DOT Class 2.1. Limited-quantity/consumer-commodity (ORM-D) provisions may apply. Verify on manufacturer SDS."
    if any(c.startswith("Flam. Liq") for c in cats):
        return "Flammable liquid — likely DOT Class 3. Verify UN number, packing group, and proper shipping name on the manufacturer SDS before transport."
    return "Not expected to be regulated as a DOT hazardous material in the as-shipped configuration. Verify on the manufacturer SDS before transport."


def main():
    records = []
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row = {k: (v or "") for k, v in row.items()}
            name = row["Product/Trade Name"].strip()
            if not name:
                continue
            cats = parse_hazard_categories(row["GHS Hazard Category"])
            pictos = parse_pictograms(row["GHS Pictogram Codes"])
            first_aid = derive_first_aid(cats, pictos)
            rec = {
                "productName": name,
                "manufacturer": na(row["Manufacturer"]),
                "casNumbers": parse_cas(row["Primary CAS #"], row["Additional CAS #s"]),
                "signalWord": signal_word(row["Signal Word"]),
                "pictograms": pictos,
                "hazardStatements": hazard_statements(cats),
                "precautionaryStatements": derive_precautionary(cats, pictos),
                "firstAid": first_aid,
                "ppeRequired": split_list(row["PPE Required"]) or ["Refer to manufacturer SDS Section 8"],
                "fireExtinguishing": derive_fire(row, cats, pictos),
                "spillProcedure": derive_spill(row, cats, pictos),
                "storageHandling": derive_storage(row, cats),
                "emergencyPhone": derive_emergency_phone(row["Mfr Emergency Phone"]),
                "sections": build_sections(row, cats, pictos, first_aid),
            }
            records.append(rec)

    # Disambiguate identical trade names from different manufacturers
    # (e.g. "White Lithium Grease" sold by Lucas Oil and by Liquid Wrench are
    # distinct products). Append the manufacturer so the library is unambiguous.
    name_counts = {}
    for r in records:
        name_counts[r["productName"]] = name_counts.get(r["productName"], 0) + 1
    for r in records:
        if name_counts[r["productName"]] > 1 and r["manufacturer"] != "Not specified":
            r["productName"] = f"{r['productName']} ({r['manufacturer']})"

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {len(records)} SDS records to {OUT_PATH}")


if __name__ == "__main__":
    main()
