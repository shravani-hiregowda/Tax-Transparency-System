# extract_budget_improved.py
import pdfplumber, re, os, json
from pathlib import Path

pdf_file = "gov.pdf"  # place your gov.pdf in the same folder
output_dir = "output_json_improved_full"
os.makedirs(output_dir, exist_ok=True)

demand_re = re.compile(r"(?:DEMAND\s*NO\.?|No\.)\s*(\d+)", re.IGNORECASE)
ministry_re = re.compile(r"MINISTRY OF [A-Z &']+", re.IGNORECASE)
department_re = re.compile(r"DEPARTMENT (?:OF )?[A-Z &']+", re.IGNORECASE)
num_re = re.compile(r"-?\d[\d,]*(?:\.\d+)?|\.{3}")
code_re = re.compile(r"^\d+(\.\d+)*\.?$")

def is_numeric_token(tok: str) -> bool:
    return bool(num_re.fullmatch(tok.strip()))

def parse_numbers(parts):
    out = []
    for p in parts:
        p = p.replace(",", "").strip()
        if p in ("...", "", "-", "…"):
            out.append(None)
        else:
            try:
                out.append(float(p))
            except:
                out.append(None)
    return out

def split_name_and_numeric_tail(tokens, max_nums=12):
    nums = []
    idx = len(tokens)
    for j in range(len(tokens)-1, -1, -1):
        if num_re.fullmatch(tokens[j]):
            nums.insert(0, tokens[j])
            idx = j
            if len(nums) >= max_nums:
                break
        else:
            if len(nums) > 0:
                break
            else:
                continue
    name_tokens = tokens[:idx]
    return name_tokens, nums

def values_dict_from_list(values):
    keys = [
        "actual_2024_25","capital_2024_25","total_2024_25",
        "budget_2025_26","capital_2025_26","total_2025_26",
        "revised_2024_25","capital_revised_2024_25","total_revised_2024_25",
        "budget_2026_27","capital_2026_27","total_2026_27"
    ]
    d = {}
    for i,k in enumerate(keys):
        d[k] = values[i] if i < len(values) else None
    return d

data = []
demand_index = {}
current_demand = None
current_section = None

with pdfplumber.open(pdf_file) as pdf:
    total_pages = len(pdf.pages)
    print(f"Processing {total_pages} pages...")
    for pageno in range(total_pages):
        page = pdf.pages[pageno]
        text = page.extract_text()
        if not text:
            continue
        lines = text.split("\n")
        for i, raw_line in enumerate(lines):
            line = raw_line.strip()
            line_clean = re.sub(r"\s+", " ", line)

            dem = demand_re.search(line_clean)
            if dem:
                demand_no = int(dem.group(1))
                if demand_no in demand_index:
                    current_demand = demand_index[demand_no]
                else:
                    window_start = max(0, i-6)
                    window_end = min(len(lines), i+8)
                    ministry_val = None
                    department_val = None
                    for w in range(window_start, window_end):
                        wline = re.sub(r"\s+", " ", lines[w].strip())
                        mm = ministry_re.search(wline)
                        if mm:
                            ministry_val = mm.group(0).title().strip()
                        dd = department_re.search(wline)
                        if dd:
                            department_val = dd.group(0).title().strip()
                    new_d = {"demand_no": demand_no, "ministry": ministry_val, "department": department_val, "sections": []}
                    data.append(new_d)
                    demand_index[demand_no] = new_d
                    current_demand = new_d
                current_section = None
                continue

            if current_demand is None:
                continue

            mm = ministry_re.search(line_clean)
            if mm and not current_demand.get("ministry"):
                current_demand["ministry"] = mm.group(0).title().strip()
                continue
            dd = department_re.search(line_clean)
            if dd and not current_demand.get("department"):
                current_demand["department"] = dd.group(0).title().strip()
                continue

            if re.match(r"^(Grand\s+Total|Total\b|Net\b|Total-)", line_clean, re.IGNORECASE):
                parts = line_clean.split()
                name_tokens, nums = split_name_and_numeric_tail(parts)
                if not nums:
                    for k in (1,2):
                        if i+k < len(lines):
                            nxt = re.sub(r"\s+", " ", lines[i+k].strip())
                            _, nxt_nums = split_name_and_numeric_tail(nxt.split())
                            if nxt_nums:
                                nums = nxt_nums
                                break
                values = parse_numbers(nums)
                if current_section is None:
                    current_section = {"heading": "Totals", "items": []}
                    current_demand["sections"].append(current_section)
                name = " ".join(name_tokens) if name_tokens else parts[0]
                item = {"code": None, "name": name, "values": values_dict_from_list(values),
                        "type": "grand_total" if re.match(r"^Grand\s+Total", line_clean, re.IGNORECASE) else "total"}
                if not any(it.get("name")==item["name"] and it.get("values")==item["values"] for it in current_section["items"]):
                    current_section["items"].append(item)
                continue

            if "Total-" in line_clean and any(num_re.search(tok) for tok in line_clean.split()):
                parts = line_clean.split()
                name_tokens, nums = split_name_and_numeric_tail(parts)
                values = parse_numbers(nums)
                if current_section is None:
                    current_section = {"heading": "Totals", "items": []}
                    current_demand["sections"].append(current_section)
                name = " ".join(name_tokens) if name_tokens else line_clean
                item = {"code": None, "name": name, "values": values_dict_from_list(values), "type":"total"}
                if not any(it.get("name")==item["name"] and it.get("values")==item["values"] for it in current_section["items"]):
                    current_section["items"].append(item)
                continue

            tokens = line_clean.split()
            contains_numbers = any(num_re.fullmatch(tok) for tok in tokens)
            is_letter_dot = re.match(r"^[A-Z]\.", line_clean)
            has_keywords = any(kw.lower() in line_clean.lower() for kw in ["expenditure", "schemes", "projects", "allocations", "heads", "developmental", "centre's", "transfers", "welfare", "autonomous", "centrally"])
            is_upper = line_clean.isupper() and len(tokens) > 1

            if (is_upper or is_letter_dot or has_keywords) and not contains_numbers:
                current_section = {"heading": line_clean, "items": []}
                current_demand["sections"].append(current_section)
                continue

            if tokens and code_re.fullmatch(tokens[0]):
                second_tok = tokens[1] if len(tokens) > 1 else ""
                if not is_numeric_token(second_tok):
                    name_tokens, nums = split_name_and_numeric_tail(tokens)
                    if name_tokens and name_tokens[0] == tokens[0]:
                        name_tokens = name_tokens[1:]
                    if not nums:
                        for k in (1,2):
                            if i+k < len(lines):
                                nxt = re.sub(r"\s+", " ", lines[i+k].strip())
                                _, nxt_nums = split_name_and_numeric_tail(nxt.split())
                                if nxt_nums:
                                    nums = nxt_nums
                                    break
                    values = parse_numbers(nums)
                    code = tokens[0].rstrip(".")
                    name = " ".join(name_tokens).strip() if name_tokens else " ".join(tokens[1:]).strip()
                    item = {"code": code, "name": name, "values": values_dict_from_list(values)}
                    if current_section is None:
                        current_section = {"heading": "Miscellaneous", "items": []}
                        current_demand["sections"].append(current_section)
                    if not any(it.get("code")==item["code"] and it.get("name")==item["name"] and it.get("values")==item["values"] for it in current_section["items"]):
                        current_section["items"].append(item)
                    continue
                else:
                    continue

            if tokens and is_numeric_token(tokens[0]) and sum(1 for t in tokens if is_numeric_token(t)) >= 3:
                name_tokens, nums = split_name_and_numeric_tail(tokens)
                values = parse_numbers(nums)
                if current_section is None:
                    current_section = {"heading": "Totals", "items": []}
                    current_demand["sections"].append(current_section)
                item = {"code": None, "name": "Totals (line)", "values": values_dict_from_list(values), "type":"total"}
                if not any(it.get("name")==item["name"] and it.get("values")==item["values"] for it in current_section["items"]):
                    current_section["items"].append(item)
                continue

# Save per-demand and master file
for dno, demand in demand_index.items():
    with open(Path(output_dir)/f"DEMAND_{dno}.json", "w", encoding="utf-8") as f:
        json.dump(demand, f, indent=4, ensure_ascii=False)
with open(Path(output_dir)/"all_demands_improved_full.json", "w", encoding="utf-8") as f:
    json.dump(list(demand_index.values()), f, indent=4, ensure_ascii=False)

print("Done. Output saved to", output_dir)
