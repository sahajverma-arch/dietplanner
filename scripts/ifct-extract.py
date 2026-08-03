"""
Extracts the ICMR-NIN Indian Food Composition Tables 2017 proximate table
(Table 1 — Proximate Principles and Dietary Fibre) into a CSV shaped like the
`foods` table in supabase/migrations/0002_foods.sql.

Why this table and not the rest of the book: `foods` grounds the plan's macros,
so what it needs is energy, protein, carbohydrate, fat and fibre per 100 g.
IFCT's other twelve tables (vitamins, minerals, amino acids, fatty acids,
polyphenols) belong in `micros` if we ever want them, and each has its own
column layout — this script covers one table properly rather than all thirteen
badly.

Three things the source does that the parser has to respect:

  * Energy is published in kilojoules. It is converted here, because every
    other row in `foods` is kcal and a mixed-unit column is a silent 4x error.
  * The columns are not constant and not even constant within a page. Cereals
    carry nine values; fish and shellfish carry five, with no fibre or
    carbohydrate; juices and milk sit on a nine-column page but leave the three
    fibre columns empty. So values are assigned to columns by their x position
    against that page's own header — reading them in order silently files
    lemon juice's carbohydrate as its fibre.
  * A food that reports no value gets an empty cell, never a zero. "Not
    measured" and "measured as zero" must not look the same to whatever reads
    this next.

Values are published as mean±SD over n regional samples; the mean is taken and
the SD dropped. Nothing is inferred: a row that does not parse cleanly is
reported and left out rather than guessed at.

Run: python scripts/ifct-extract.py [path-to-IFCT2017.pdf]
Out: scripts/data/ifct2017_foods.csv
"""

import csv
import os
import re
import sys
import fitz  # PyMuPDF

DEFAULT_PDF = os.path.expanduser(r"~\Downloads\IFCT2017.pdf")
OUT = os.path.join(os.path.dirname(__file__), "data", "ifct2017_foods.csv")

# Table 1 spans these PDF pages (1-indexed), from the document's own outline:
# "6.1. Proximate Principles and Dietary Fibre" starts at 39 and
# "6.2. Water Soluble Vitamins" starts at 69.
FIRST_PAGE, LAST_PAGE = 39, 68

KJ_PER_KCAL = 4.184

# IFCT's INFOODS tagnames, and where each lands in the CSV.
COLUMNS = {
    "WATER": "water_g",
    "PROTCNT": "protein_g",
    "ASH": "ash_g",
    "FATCE": "fat_g",
    "FIBTG": "fiber_g",
    "FIBINS": "fiber_insoluble_g",
    "FIBSOL": "fiber_soluble_g",
    "CHOAVLDF": "carbs_g",
    "ENERC": "energy_kj",
}

# Page geometry, in PDF points. The food code, the food name and the regional
# sample count sit left of the first nutrient column on every page of the table.
# MARGIN_X excludes the running footer, which is set sideways up the left edge
# and therefore shares a row band with whatever food happens to sit beside it —
# reading the leftmost word as the food code silently drops those foods.
MARGIN_X, NAME_X, COUNT_X, VALUES_X = 40, 75, 270, 300
ROW_TOLERANCE = 4  # words within this many points of each other are one row

FOOD_CODE = re.compile(r"^[A-Z]\d{3}$")
GROUP_CODE = re.compile(r"^[A-Z]$")
# "80.68±0.66", "449±9", "9.89", "1278±61" — the ± usually survives extraction
# as a replacement character, so anything non-numeric ends the mean.
VALUE = re.compile(r"^(-?\d+(?:\.\d+)?)(?:[^\d].*)?$")


def rows_of(page):
    """
    Page words grouped into visual rows, each sorted left to right.

    Rows are clustered against the first word's baseline rather than binned by
    rounded y: several rows in the book are typeset a point or two off level
    (Paneer's fat and energy sit 1.7pt above its name), and a fixed bin splits
    those across two rows, orphaning half the nutrients.
    """
    words = sorted(
        (w[1], w[0], w[4]) for w in page.get_text("words") if w[0] >= MARGIN_X
    )
    rows, current, baseline = [], [], None
    for y, x, text in words:
        if baseline is not None and y - baseline > ROW_TOLERANCE:
            rows.append((baseline, sorted(current)))
            current, baseline = [], None
        if baseline is None:
            baseline = y
        current.append((x, text))
    if current:
        rows.append((baseline, sorted(current)))
    return rows


def header_columns(rows):
    """
    This page's nutrient columns as [(x, csv_field)], read from the row that
    carries the INFOODS tagnames. Returns None if the page has no such row.
    """
    for _y, words in rows:
        tags = [(x, COLUMNS[t]) for x, t in words if t in COLUMNS]
        if len(tags) >= 4:  # the legend row, not a stray word
            return tags
    return None


def nearest(x, columns):
    return min(columns, key=lambda c: abs(c[0] - x))[1]


def parse_page(rows, columns, group):
    """Yields (code, name, group, values), rows that failed, and the group."""
    foods, failures = [], []

    # A name too long for its cell wraps AROUND its own code row — first line
    # above it, remainder below — so a name-only row cannot be attributed by
    # position alone. Each is attached to the vertically nearest code row, and
    # the pieces are reassembled top to bottom.
    code_rows = [
        (y, words) for y, words in rows
        if any(x < NAME_X and FOOD_CODE.match(t) for x, t in words)
    ]
    extra_name_lines = {}
    for y, words in rows:
        if any(x >= COUNT_X for x, _t in words) or not words:
            continue
        if not all(x >= NAME_X for x, _t in words):
            continue  # a code or a group letter sits in this row, not just name
        if not code_rows:
            continue
        owner = min(code_rows, key=lambda r: abs(r[0] - y))[0]
        extra_name_lines.setdefault(owner, []).append((y, " ".join(t for _x, t in words)))

    for y, words in rows:
        left = [(x, t) for x, t in words if x < COUNT_X]
        if not left:
            continue
        code = left[0][1]

        # "L" alone in the code column with capitalised words beside it is a
        # group heading — "L  MILK AND MILK PRODUCTS".
        if GROUP_CODE.match(code) and all(t.isupper() for _x, t in left[1:]) and len(left) > 1:
            group = " ".join(t for _x, t in left[1:])
            continue

        if not FOOD_CODE.match(code):
            continue

        own = [(y, " ".join(t for x, t in left[1:] if x >= NAME_X))]
        parts = sorted(own + extra_name_lines.get(y, []))
        name = " ".join(part for _y, part in parts if part)
        count = next((t for x, t in words if COUNT_X <= x < VALUES_X), "")

        values = {}
        unreadable = []
        for x, t in words:
            if x < VALUES_X:
                continue
            m = VALUE.match(t)
            if m:
                values[nearest(x, columns)] = m.group(1)
            else:
                unreadable.append(t)

        if unreadable:
            failures.append((code, f"unreadable value(s): {', '.join(unreadable)}"))
            continue
        # Energy and protein are the two the plan cannot do without.
        if "energy_kj" not in values or "protein_g" not in values:
            failures.append((code, "no energy or no protein value on the row"))
            continue

        foods.append([code, name, group, count, values])
    return foods, failures, group


def main():
    pdf = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF
    doc = fitz.open(pdf)

    all_foods, all_failures = [], []
    columns, group = None, None
    for page_no in range(FIRST_PAGE, LAST_PAGE + 1):
        rows = rows_of(doc[page_no - 1])
        columns = header_columns(rows) or columns  # carry over a missing legend
        if not columns:
            continue
        # A group runs across pages and is only named on the page it starts on.
        foods, failures, group = parse_page(rows, columns, group)
        all_foods.extend(foods)
        all_failures.extend((page_no, *f) for f in failures)

    fields = [
        "source", "source_id", "name", "food_group",
        "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g",
        "fiber_insoluble_g", "fiber_soluble_g", "water_g", "ash_g",
        "energy_kj", "n_regions",
    ]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    seen, written = set(), 0
    with open(OUT, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for code, name, group, count, values in all_foods:
            if code in seen:
                continue
            seen.add(code)
            kj = values.get("energy_kj")
            w.writerow({
                "source": "IFCT",
                "source_id": code,
                "name": " ".join(name.split()),
                "food_group": group or "",
                "kcal": round(float(kj) / KJ_PER_KCAL, 1) if kj else "",
                "n_regions": count,
                **{f: values.get(f, "") for f in fields[5:14]},
            })
            written += 1

    groups = sorted({f[2] for f in all_foods if f[2]})
    print(f"{written} foods -> {OUT}")
    print(f"{len(groups)} food groups:")
    for g in groups:
        print(f"  {sum(1 for f in all_foods if f[2] == g):>4}  {g}")
    if all_failures:
        print(f"\n{len(all_failures)} rows did not parse and were LEFT OUT:")
        for page_no, code, why in all_failures:
            print(f"  p{page_no} {code}: {why}")


if __name__ == "__main__":
    main()
