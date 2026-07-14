from pymongo import MongoClient
from typing import Optional
from datetime import datetime, date, time

# -------------------------------------------------
# MONGODB CONNECTION
# -------------------------------------------------

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "utti_db"
COLLECTION_NAME = "purchase_slips"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
purchase_slips_collection = db[COLLECTION_NAME]

# -------------------------------------------------
# INTERNAL HELPER (MongoDB-safe conversion)
# -------------------------------------------------

def _serialize_for_mongo(data):
    """
    Recursively converts date and time objects
    into MongoDB-compatible formats.
    """
    if isinstance(data, dict):
        return {k: _serialize_for_mongo(v) for k, v in data.items()}

    if isinstance(data, list):
        return [_serialize_for_mongo(item) for item in data]

    # Convert date -> datetime
    if isinstance(data, date) and not isinstance(data, datetime):
        return datetime.combine(data, time.min)

    # Convert time -> string HH:MM
    if isinstance(data, time):
        return data.strftime("%H:%M")

    return data

# -------------------------------------------------
# DATABASE OPERATIONS
# -------------------------------------------------

def insert_purchase_slip(slip_data: dict) -> str:
    """
    Inserts a purchase slip into MongoDB
    after converting unsupported types.
    Returns inserted document ID.
    """
    safe_data = _serialize_for_mongo(slip_data)
    safe_data["created_at"] = datetime.utcnow()

    result = purchase_slips_collection.insert_one(safe_data)
    return str(result.inserted_id)


def get_slip_by_utti(utti: str) -> Optional[dict]:
    """
    Fetch purchase slip using UTTI
    """
    return purchase_slips_collection.find_one(
        {"utti": utti},
        {"_id": 0}  # hide internal Mongo ID
    )


def utti_exists(utti: str) -> bool:
    """
    Checks whether a UTTI already exists
    """
    return purchase_slips_collection.count_documents({"utti": utti}) > 0
