from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    PurchaseSlipCreate,
    PurchaseSlipDB,
    UTTIResponse
)

from utti_generator import (
    generate_utti,
    calculate_item_gst,
    calculate_totals,
    calculate_fiscal_split
)

from database import (
    insert_purchase_slip,
    get_slip_by_utti,
    utti_exists
)

# =====================================================
# FASTAPI APP INITIALIZATION
# =====================================================

app = FastAPI(title="UTTI Slip Generation Service")

# =====================================================
# CORS CONFIGURATION
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# HEALTH CHECK
# =====================================================

@app.get("/")
def root():
    return {"message": "UTTI Backend Service is running"}

# =====================================================
# CREATE SLIP & GENERATE UTTI
# =====================================================

@app.post("/create-slip", response_model=UTTIResponse)
def create_purchase_slip(payload: PurchaseSlipCreate):
    """
    Accepts purchase slip data,
    calculates GST,
    generates a unique UTTI,
    stores fiscal trace,
    and returns UTTI response.
    """

    # 1️⃣ Calculate GST per item
    processed_items = []
    for item in payload.items:
        gst_amount = calculate_item_gst(item.price, item.gst_percent)
        item.gst_amount = gst_amount
        processed_items.append(item)

    # 2️⃣ Calculate totals
    total_amount, total_gst = calculate_totals(processed_items)

    # 3️⃣ Fiscal Transparency Split
    fiscal_trace = calculate_fiscal_split(
        total_gst=total_gst,
        buyer_state=payload.state
    )

    # 4️⃣ Generate Unique UTTI
    utti = generate_utti("GST")
    while utti_exists(utti):
        utti = generate_utti("GST")

    # 5️⃣ Build DB Record
    slip_record = PurchaseSlipDB(
        utti=utti,
        invoice_number=payload.invoice_number,
        purchase_date=payload.purchase_date,
        purchase_time=payload.purchase_time,
        state=payload.state,
        items=processed_items,
        total_amount=total_amount,
        total_gst=total_gst,
        fiscal_trace=fiscal_trace
    )

    # 6️⃣ Insert into Database
    insert_purchase_slip(slip_record.dict())

    # 7️⃣ Return Response
    return UTTIResponse(
        message="UTTI generated with fiscal trace",
        utti=utti,
        total_items=len(processed_items),
        total_gst=total_gst,
        state=payload.state
    )

# =====================================================
# FETCH SLIP BY UTTI
# =====================================================

@app.get("/slip/{utti}")
def fetch_slip_by_utti(utti: str):
    """
    Fetch stored slip data using UTTI.
    Used by chatbot and transparency system.
    """

    slip = get_slip_by_utti(utti)

    if not slip:
        raise HTTPException(status_code=404, detail="UTTI not found")

    return slip