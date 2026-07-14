# analyze_budgets.py
import pdfplumber, re, json
from pathlib import Path
from collections import OrderedDict

PDF = Path("gov.pdf")
EXTRACTED_JSON = Path("output_json_improved_full") / "all_demands_improved_full.json"
OUT_MAP = Path("ministry_department_mapping_full.json")
OUT_ANALYSIS = Path("budget_analysis_full.json")

num_tok_re = re.compile(r"^-?\d[\d,]*(?:\.\d+)?$|^\.\.\.$")
page_range_re = re.compile(r"^\d+(?:-\d+)?$")

def to_float(s):
    if not s: return None
    s = s.replace(",", "").strip()
    if s in ("", "...", "…"): return None
    try: return float(s)
    except: return None

def split_name_and_numeric_tail(tokens, max_nums=4):
    nums = []
    idx = len(tokens)
    for j in range(len(tokens)-1, -1, -1):
        if num_tok_re.match(tokens[j]):
            nums.insert(0, tokens[j])
            idx = j
            if len(nums) >= max_nums: break
        else:
            if nums: break
    return tokens[:idx], nums

def extract_summary_lines(pdf_path):
    """Extracts full SBE summary region from PDF."""
    with pdfplumber.open(pdf_path) as pdf:
        lines = []
        total_pages = len(pdf.pages)
        found_start = None
        found_end = None
        for pno in range(total_pages):
            text = pdf.pages[pno].extract_text()
            if not text: continue
            page_lines = [re.sub(r"\s+", " ", l).strip() for l in text.splitlines() if l.strip()]
            for li, L in enumerate(page_lines):
                if not found_start and ("SBE Summary" in L or "Summary of Contents" in L):
                    found_start = (pno, li)
                if "Notes on Demand" in L or L.startswith("Notes on Demand"):
                    found_end = (pno, li)
            lines.extend(page_lines)
        if not found_start:
            raise RuntimeError("Could not locate SBE Summary section.")
        if not found_end:
            found_end = (total_pages-1, len(lines))
        return lines, found_start, found_end

def parse_summary_lines(lines):
    ministries = OrderedDict()
    current_ministry = None
    current_department_header = None
    for line in lines:
        toks = line.split()
        name_tokens, numeric_tail = split_name_and_numeric_tail(toks, max_nums=5)

        # Ministry or Department headers
        if len(numeric_tail) >= 3 and (line.upper().startswith("MINISTRY") or line.upper().startswith("DEPARTMENT") or line.upper().startswith("THE PRESIDENT")):
            name = " ".join(name_tokens).strip()
            rev, cap, tot = map(to_float, numeric_tail[:3])
            current_ministry = name
            ministries.setdefault(current_ministry, {"ministry": current_ministry, "revenue": rev, "capital": cap, "total": tot, "departments": []})
            current_department_header = None
            continue

        # Numbered demand lines
        m = re.match(r"^(\d+)\.\s+(.*)$", line)
        if m:
            dno = int(m.group(1))
            rest = m.group(2).strip().split()
            page_range = None
            if rest and page_range_re.match(rest[-1]):
                page_range = rest[-1]
                rest = rest[:-1]
            name_toks, nums = split_name_and_numeric_tail(rest, max_nums=4)
            dept_name = " ".join(name_toks).strip() or current_department_header or current_ministry
            rev, cap, tot = (to_float(nums[i]) if i < len(nums) else None for i in range(3))
            if current_ministry:
                ministries[current_ministry]["departments"].append({
                    "demand_no": dno,
                    "department": dept_name,
                    "revenue": rev,
                    "capital": cap,
                    "total": tot,
                    "page_range": page_range
                })
            continue

        # Department headers
        if line.upper().startswith("DEPARTMENT") and len(numeric_tail) < 3:
            current_department_header = " ".join(name_tokens).strip()
            continue
    return ministries

def build_analysis(ministries):
    overall = sum((m["total"] or sum((d["total"] or 0) for d in m["departments"])) for m in ministries.values())
    out = {"overall_total_2025_26": overall, "ministries": []}
    for m in ministries.values():
        m_total = m["total"] or sum((d["total"] or 0) for d in m["departments"])
        min_entry = {
            "ministry": m["ministry"],
            "total_2025_26": m_total,
            "percentage_share": round((m_total / overall * 100), 2) if overall else 0,
            "departments": []
        }
        for d in m["departments"]:
            dept_total = d["total"] or 0
            min_entry["departments"].append({
                "department": d["department"],
                "total_2025_26": dept_total,
                "percentage_share_within_ministry": round((dept_total / m_total * 100), 2) if m_total else 0,
                "demands": [{
                    "demand_no": d["demand_no"],
                    "summary_total_2025_26": d.get("total")
                }]
            })
        out["ministries"].append(min_entry)
    return out

def main():
    lines, start, end = extract_summary_lines(PDF)
    ministries = parse_summary_lines(lines)
    with open(OUT_MAP, "w", encoding="utf-8") as f:
        json.dump(ministries, f, indent=4, ensure_ascii=False)
    analysis = build_analysis(ministries)
    with open(OUT_ANALYSIS, "w", encoding="utf-8") as f:
        json.dump(analysis, f, indent=4, ensure_ascii=False)
    print(f"✅ Parsed {len(analysis['ministries'])} ministries with {sum(len(m['departments']) for m in analysis['ministries'])} departments")
    print(f"✅ Overall total: {analysis['overall_total_2025_26']:,.2f} crore")
    print(f"✅ Files saved: {OUT_MAP}, {OUT_ANALYSIS}")

if __name__ == "__main__":
    main()
