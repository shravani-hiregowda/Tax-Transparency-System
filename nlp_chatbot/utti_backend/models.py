from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import date, time, datetime


# -------------------------------------------------
# ITEM MODEL (each product in the slip)
# -------------------------------------------------
class Item(BaseModel):
    name: str = Field(..., example="Laptop")
    price: float = Field(..., example=80000)
    gst_percent: float = Field(..., example=18)
    gst_amount: float = Field(0, example=14400)


# -------------------------------------------------
# PURCHASE SLIP INPUT MODEL (from frontend)
# -------------------------------------------------
class PurchaseSlipCreate(BaseModel):
    invoice_number: str = Field(..., example="INV-2026-001")
    purchase_date: date
    purchase_time: time

    # 🔥 NEW (MANDATORY FOR REAL GST SYSTEM)
    state: str = Field(..., example="Karnataka")

    items: List[Item]


# -------------------------------------------------
# FISCAL TRACE MODEL (TRANSPARENCY LEDGER)
# -------------------------------------------------
class FiscalTrace(BaseModel):
    cgst: float
    sgst: float
    igst: float
    cess: float
    total_tax: float


# -------------------------------------------------
# PURCHASE SLIP STORED MODEL (DATABASE SCHEMA)
# -------------------------------------------------
class PurchaseSlipDB(BaseModel):
    utti: str
    invoice_number: str
    purchase_date: date
    purchase_time: time
    state: str  # 🔥 NEW

    items: List[Item]

    total_amount: float
    total_gst: float

    # 🔥 REAL TAX BREAKDOWN (Policy Grade)
    fiscal_trace: FiscalTrace

    created_at: datetime = Field(default_factory=datetime.utcnow)


# -------------------------------------------------
# RESPONSE MODEL
# -------------------------------------------------
class UTTIResponse(BaseModel):
    message: str
    utti: str
    total_items: int
    total_gst: float
    state: str
