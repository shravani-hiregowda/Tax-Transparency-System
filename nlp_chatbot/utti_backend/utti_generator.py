import uuid
from datetime import datetime


# -------------------------------------------------
# UTTI GENERATION LOGIC
# -------------------------------------------------
def generate_utti(tax_type: str = "GST") -> str:
    year = datetime.utcnow().strftime("%y")
    random_part = uuid.uuid4().hex[:6].upper()
    return f"UTTI-{tax_type}-{year}-{random_part}"


# -------------------------------------------------
# GST CALCULATION HELPERS
# -------------------------------------------------
def calculate_item_gst(price: float, gst_percent: float) -> float:
    price = float(price or 0)
    gst_percent = float(gst_percent or 0)
    return round((price * gst_percent) / 100, 2)


def calculate_totals(items: list) -> tuple:
    total_amount = 0.0
    total_gst = 0.0

    for item in items:
        # item is a Pydantic model, not a dict
        price = float(item.price)
        gst_amount = float(item.gst_amount)

        total_amount += price
        total_gst += gst_amount

    return round(total_amount, 2), round(total_gst, 2)
# -------------------------------------------------
# 🔥 NEW: FISCAL SPLIT ENGINE (TRANSPARENCY CORE)
# -------------------------------------------------
def calculate_fiscal_split(total_gst: float, buyer_state: str, seller_state: str = None):
    """
    Realistic GST logic:
    - Same state → CGST + SGST (50/50)
    - Different state → IGST (100%)
    - Cess (optional future)
    """

    total_gst = float(total_gst or 0)

    # Demo assumption: seller in same state (can be upgraded later)
    same_state = True if seller_state is None else (buyer_state == seller_state)

    if same_state:
        cgst = round(total_gst / 2, 2)
        sgst = round(total_gst / 2, 2)
        igst = 0.0
    else:
        cgst = 0.0
        sgst = 0.0
        igst = round(total_gst, 2)

    cess = 0.0  # Can be dynamic later

    return {
        "cgst": cgst,
        "sgst": sgst,
        "igst": igst,
        "cess": cess,
        "total_tax": round(total_gst, 2)
    }
