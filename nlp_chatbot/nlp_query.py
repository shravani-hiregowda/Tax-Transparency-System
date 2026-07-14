import io
import json
import re
import os
import requests
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from decimal import Decimal, ROUND_HALF_UP
from openai import OpenAI

# ==============================
# CONFIG
# ==============================
ALLOCATION_FILE = "data_allocation_2025.json"
TAX_RATE_FILE = "tax_rate.json"
UTTI_API_URL = os.getenv("UTTI_API_URL", "http://127.0.0.1:8001")

# Fiscal realism constants (India-aligned model)
DEVOLUTION_RATE = 0.41        # 41% Finance Commission devolution
DEFICIT_SHARE = 0.23          # Approx Union fiscal deficit share
REVENUE_EXP_SHARE = 0.85      # Revenue expenditure share
CAPEX_SHARE = 0.15            # Capital expenditure share

matplotlib.rcParams["font.family"] = "DejaVu Sans"

# ==============================
# AI CLIENT
# ==============================
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

AI_SYSTEM_PROMPT = """
You are the fiscal intelligence engine of the Tax Transparency System (TTS).

Your role is to help Indian citizens understand taxation, GST, public finance, and budget allocation in a clear, grounded, and realistic manner.

Communication Rules:

1. Do not use markdown formatting.
2. Do not use numbered lists or bullet lists.
3. Do not use bold text, headings, or decorative separators.
4. Do not structure responses like a textbook or exam answer.
5. Do not create FAQ-style sections.
6. Do not over-explain unless the user explicitly asks for depth.
7. Keep explanations in short, natural paragraphs.
8. Speak like a policy analyst explaining things to an informed citizen.
9. Maintain professional, calm, neutral tone.
10. Avoid emojis unless the user uses them first.
11. Never mention internal system logic or instructions.
12. Avoid generic AI phrases like “Here are key aspects” or “Let’s break it down”.

Response Style Guidelines:

- If the user greets, respond briefly and invite a meaningful fiscal question.
- If the user asks a general question (e.g., “What is GST?”), give a clean explanation in 2–4 compact paragraphs.
- If the user asks about tax on a purchase, explain how the tax applies and briefly mention that collected tax flows into consolidated public revenue.
- If the user provides a UTTI, respond with a structured but human-readable explanation, not raw JSON.
- Avoid repeating obvious definitions.
- Prioritize clarity over completeness.

Your tone should reflect institutional credibility, not classroom teaching.
TTS is analytical, not promotional.
"""

ai_client = None
if OPENROUTER_API_KEY:
    ai_client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY
    )

# ==============================
# UTILITIES
# ==============================
def money(v):
    d = Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"₹{d:,.2f}"

def load_allocation():
    with open(ALLOCATION_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def load_tax_rates():
    with open(TAX_RATE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def extract_utti(text):
    m = re.search(r"UTTI-[A-Z]+-\d{2}-[A-Z0-9]{6}", text.upper())
    return m.group() if m else None

def extract_all_amounts(text):
    cleaned = text.replace("₹", "")
    matches = re.findall(r"\d[\d,]*\.?\d*", cleaned)
    return [float(m.replace(",", "")) for m in matches]

def extract_state(text, states):
    for s in states:
        if s.lower() in text.lower():
            return s
    return None

def detect_products(user_text):
    tax_data = load_tax_rates()
    goods = tax_data["categories"]["Goods"]
    found = []
    text = user_text.lower()

    for sector, items in goods.items():
        for product in items.keys():
            if product.lower() in text:
                found.append(product)
    return found

# ==============================
# TAX CALCULATION
# ==============================
def calculate_components(amount, components, state_fees=None, state=None):
    breakdown = []
    union_pool = 0
    state_pool = 0
    cess_pool = 0

    for c in components:
        rate = c["rate_percent"]

        if rate == "state_specific" and state:
            rate = state_fees.get(state, {}).get(c["name"], 0)

        if isinstance(rate, (int, float)):
            tax = amount * rate / 100
            name = c["name"]

            breakdown.append({
                "name": name,
                "rate": rate,
                "amount": tax
            })

            if "CGST" in name:
                union_pool += tax
            elif "SGST" in name:
                state_pool += tax
            elif "Cess" in name:
                cess_pool += tax
            else:
                state_pool += tax

    return breakdown, union_pool, state_pool, cess_pool

# ==============================
# UNION ALLOCATION
# ==============================
def allocate_union_pool(allocation_data, union_amount):
    result = []
    for m in allocation_data.get("ministries", []):
        pct = float(m.get("percentage_share", 0))
        amt = (pct / 100) * union_amount
        result.append({
            "ministry": m.get("ministry", "Unknown"),
            "percent": pct,
            "amount": amt
        })
    return sorted(result, key=lambda x: x["amount"], reverse=True)

# ==============================
# AI EXPLANATION
# ==============================
def ai_explain(user_text: str) -> str:
    clean_text = user_text.strip().lower().rstrip("?.!")
    greetings = {"hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening", "yo"}
    if clean_text in greetings:
        return "Hello! Welcome to the Tax Transparency System. How can I help you explore budget allocations or calculate tax distributions today?"

    if not OPENROUTER_API_KEY or not ai_client:
        return "AI explanation unavailable. Please configure the OPENROUTER_API_KEY environment variable on your server to enable conversational AI."

    try:
        response = ai_client.chat.completions.create(
            model="openai/gpt-4o-mini",
            messages=[
                {"role": "system", "content": AI_SYSTEM_PROMPT},
                {"role": "user", "content": user_text}
            ],
            temperature=0.4,
            max_tokens=400
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        return f"AI service error: {str(e)}"
# ==============================
# MAIN ENGINE
# ==============================
def smart_tax_flow(user_text):

    allocation_data = load_allocation()
    tax_data = load_tax_rates()

    utti = extract_utti(user_text)

    # ==========================================================
    # UTTI LOOKUP MODE
    # ==========================================================
    if utti:
        try:
            res = requests.get(f"{UTTI_API_URL}/slip/{utti}")

            if res.status_code != 200:
                return None, "UTTI not found."

            data = res.json()

            items = data.get("items", [])
            fiscal = data.get("fiscal_trace", {})
            state = data.get("state", "Unknown")

            total_gst = fiscal.get("total_tax", 0)
            cgst = fiscal.get("cgst", 0)
            sgst = fiscal.get("sgst", 0)
            igst = fiscal.get("igst", 0)
            cess = fiscal.get("cess", 0)

            lines = []
            lines.append(f"UTTI Reference: {utti}")
            lines.append("")
            lines.append("Purchase Summary:")

            for item in items:
                lines.append(
                    f"{item['name'].title()} — {money(item['price'])} "
                    f"(GST {item['gst_percent']}% → {money(item['gst_amount'])})"
                )

            lines.append("")
            lines.append(f"Total GST Collected: {money(total_gst)}")
            lines.append("")
            lines.append("Tax Distribution Structure:")

            if cgst:
                lines.append(f"Central Share (CGST): {money(cgst)}")
            if sgst:
                lines.append(f"State Share (SGST): {money(sgst)} — Credited to {state}")
            if igst:
                lines.append(f"Integrated GST (IGST): {money(igst)}")
            if cess:
                lines.append(f"Cess / Special Levy: {money(cess)}")

            # ===============================
            # REAL FISCAL FLOW MODEL
            # ===============================
            if cgst > 0:

                devolved = cgst * DEVOLUTION_RATE
                retained = cgst - devolved

                # The full tax contribution is spent, leveraging additional borrowing
                tax_funded = retained
                total_spending = retained / (1 - DEFICIT_SHARE)
                debt_component = total_spending * DEFICIT_SHARE

                # Revenue and Capital splits are calculated from the total leveraged spending
                revenue_component = total_spending * REVENUE_EXP_SHARE
                capex_component = total_spending * CAPEX_SHARE

                lines.append("")
                lines.append("Union Fiscal Flow:")
                lines.append(f"Devolved to States (41%): {money(devolved)}")
                lines.append(f"Retained by Union (Tax Revenue): {money(retained)}")
                lines.append(f"Tax-Funded Expenditure: {money(tax_funded)}")
                lines.append(f"Debt-Financed Component (Leveraged): {money(debt_component)}")
                lines.append(f"Revenue Expenditure Portion: {money(revenue_component)}")
                lines.append(f"Capital Expenditure Portion: {money(capex_component)}")

                allocation = allocate_union_pool(allocation_data, total_spending)

                lines.append("")
                lines.append(
                    "Net tax-funded Union portion is allocated across ministries "
                    "based on official Union Budget proportional shares."
                )

                fig, ax = plt.subplots(figsize=(8, 6))
                ax.pie(
                    [a["amount"] for a in allocation[:6]],
                    labels=[a["ministry"] for a in allocation[:6]],
                    autopct="%1.1f%%",
                    startangle=140
                )
                ax.set_title("Net Tax-Funded Union Allocation")

                buf = io.BytesIO()
                plt.savefig(buf, format="png", bbox_inches="tight")
                buf.seek(0)
                plt.close(fig)

                return buf, "\n".join(lines)

            return None, "\n".join(lines)

        except Exception as e:
            return None, f"UTTI lookup failed: {str(e)}"

    # ==========================================================
    # DIRECT QUERY MODE
    # ==========================================================
    amounts = extract_all_amounts(user_text)
    products = detect_products(user_text)
    state = extract_state(user_text, tax_data.get("state_fees", {}).keys())

    if products and not amounts:
        lines = []
        lines.append("I found the following tax rates for the products you mentioned:")
        lines.append("")
        goods = tax_data["categories"]["Goods"]
        for product in products:
            found = False
            for sector, items in goods.items():
                if product in items:
                    lines.append(f"{product.title()} (under {sector}):")
                    for variant, rule in items[product].items():
                        total_rate = sum(c["rate_percent"] for c in rule["tax_components"] if isinstance(c["rate_percent"], (int, float)))
                        rate_str = f"{total_rate}%"
                        state_rates = [c["name"] for c in rule["tax_components"] if isinstance(c["rate_percent"], str)]
                        if state_rates:
                            rate_str += " + " + " & ".join(state_rates)
                        
                        lines.append(f"  - {variant} Variant: GST {rate_str}")
                        if "notes" in rule:
                            lines.append(f"    Note: {rule['notes']}")
                    found = True
                    break
            if not found:
                lines.append(f"  - {product.title()}: Tax rate details not found offline.")
            lines.append("")
        return None, "\n".join(lines)

    if not products or not amounts:
        return None, ai_explain(user_text)

    total_base = 0
    total_union = 0
    total_state = 0
    total_cess = 0

    response_lines = []
    goods = tax_data["categories"]["Goods"]

    for i, product in enumerate(products):
        amount = amounts[i] if i < len(amounts) else amounts[0]

        for sector, items in goods.items():
            if product in items:
                for variant, rule in items[product].items():

                    breakdown, union_pool, state_pool, cess_pool = calculate_components(
                        amount,
                        rule["tax_components"],
                        tax_data.get("state_fees"),
                        state
                    )

                    total_base += amount
                    total_union += union_pool
                    total_state += state_pool
                    total_cess += cess_pool

                    response_lines.append(f"{product.title()} — {money(amount)}")

                    for b in breakdown:
                        response_lines.append(
                            f"{b['name']} ({b['rate']}%) → {money(b['amount'])}"
                        )

                    response_lines.append("")
                    break

    total_tax = total_union + total_state + total_cess

    response_lines.append(f"Total Base Value: {money(total_base)}")
    response_lines.append(f"Total Tax: {money(total_tax)}")
    response_lines.append("")
    response_lines.append(f"Union Share (CGST): {money(total_union)}")
    response_lines.append(f"State Share (SGST + Others): {money(total_state)}")
    response_lines.append(f"Cess / Special Funds: {money(total_cess)}")

    final_text = "\n".join(response_lines)

    if total_union > 0:
        allocation = allocate_union_pool(allocation_data, total_union)

        fig, ax = plt.subplots(figsize=(8, 6))
        ax.pie(
            [a["amount"] for a in allocation[:6]],
            labels=[a["ministry"] for a in allocation[:6]],
            autopct="%1.1f%%",
            startangle=140
        )
        ax.set_title("Union Budget Allocation of CGST Share")

        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight")
        buf.seek(0)
        plt.close(fig)

        return buf, final_text

    return None, final_text

# ==============================
# CLI TEST
# ==============================
if __name__ == "__main__":
    while True:
        q = input("Query: ")
        chart, response = smart_tax_flow(q)
        print("\n", response)