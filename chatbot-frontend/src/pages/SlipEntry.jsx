import { useState, useEffect } from "react";
import axios from "axios";
import { UTTI_API_URL } from "../config";
import "../styles/SlipEntry.css";

/* -----------------------------------------
   Helper: normalize time to 24-hour HH:MM
------------------------------------------ */
const normalizeTime = (timeStr) => {
  if (!timeStr) return "";

  // Handles formats like "06:08 PM"
  if (timeStr.includes("AM") || timeStr.includes("PM")) {
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":");

    if (modifier === "PM" && hours !== "12") {
      hours = String(Number(hours) + 12);
    }
    if (modifier === "AM" && hours === "12") {
      hours = "00";
    }

    return `${hours.padStart(2, "0")}:${minutes}`;
  }

  // Already in HH:MM
  return timeStr;
};

function SlipEntry() {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseTime, setPurchaseTime] = useState("");
  
  // 🔥 NEW: STATE SELECTION (REALISTIC TAX SYSTEM)
  const [stateName, setStateName] = useState("Karnataka");

  const [items, setItems] = useState([
    { name: "", price: "", gst_percent: "" }
  ]);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
  if (result) {
    document.body.classList.add("modal-open");
  } else {
    document.body.classList.remove("modal-open");
  }

  return () => {
    document.body.classList.remove("modal-open");
  };
}, [result]);

  /* ---------------- Item Handlers ---------------- */

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { name: "", price: "", gst_percent: "" }]);
  };

  const removeItem = (index) => {
    if (items.length === 1) return;
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  /* ---------------- Submit Slip ---------------- */

  const submitSlip = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Validation
      if (!invoiceNumber || !purchaseDate || !purchaseTime || !stateName) {
        alert("Please fill all slip details including state.");
        return;
      }

      if (items.length === 0) {
        alert("Add at least one item.");
        return;
      }

      // Validate items
      for (let item of items) {
        if (!item.name || !item.price || !item.gst_percent) {
          alert("Please complete all item fields.");
          return;
        }
      }

      const payload = {
        invoice_number: invoiceNumber.trim(),
        purchase_date: purchaseDate,
        purchase_time: normalizeTime(purchaseTime),

        // 🔥 CRITICAL FOR FISCAL TRACE SYSTEM
        state: stateName,

        items: items.map((item) => ({
          name: item.name.trim(),
          price: Number(item.price) || 0,
          gst_percent: Number(item.gst_percent) || 0,
          gst_amount: 0
        }))
      };

      console.log("Sending Slip Payload:", payload);

      // UTTI Backend (Port 8001)
      const res = await axios.post(
        `${UTTI_API_URL}/create-slip`,
        payload
      );

      setResult(res.data);
    } catch (err) {
      console.error("❌ Backend error:", err.response?.data || err);
      alert(
        err.response?.data?.detail ||
        "Failed to generate UTTI. Check backend service."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="slip-container">

      <form onSubmit={submitSlip}>
        {/* Invoice */}
        <input
          className="slip-input"
          placeholder="Invoice Number"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          required
        />

        {/* Purchase Date */}
        <input
          className="slip-input"
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          required
        />

        {/* Purchase Time */}
        <input
          className="slip-input"
          type="time"
          value={purchaseTime}
          onChange={(e) => setPurchaseTime(e.target.value)}
          required
        />

        {/* 🔥 NEW: STATE DROPDOWN (POLICY-GRADE FEATURE) */}
        <h3>Purchase State</h3>
        <select
          className="slip-input"
          value={stateName}
          onChange={(e) => setStateName(e.target.value)}
          required
        >
          <option value="">Select State</option>
          <option value="Karnataka">Karnataka</option>
          <option value="Maharashtra">Maharashtra</option>
          <option value="Delhi">Delhi</option>
          <option value="Tamil Nadu">Tamil Nadu</option>
          <option value="Gujarat">Gujarat</option>
          <option value="Telangana">Telangana</option>
          <option value="Kerala">Kerala</option>
          <option value="Uttar Pradesh">Uttar Pradesh</option>
        </select>

        <h3>Items</h3>

        {items.map((item, index) => (
          <div key={index} className="item-row">
            <input
              className="slip-input"
              placeholder="Item Name (e.g. Laptop, Car)"
              value={item.name}
              onChange={(e) =>
                handleItemChange(index, "name", e.target.value)
              }
              required
            />

            <input
              className="slip-input"
              type="number"
              placeholder="Price (₹)"
              min="0"
              value={item.price}
              onChange={(e) =>
                handleItemChange(index, "price", e.target.value)
              }
              required
            />

            <input
              className="slip-input"
              type="number"
              placeholder="GST %"
              min="0"
              max="100"
              value={item.gst_percent}
              onChange={(e) =>
                handleItemChange(index, "gst_percent", e.target.value)
              }
              required
            />

            {items.length > 1 && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => removeItem(index)}
              >
                Remove
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          className="secondary-btn"
          onClick={addItem}
        >
          + Add Item
        </button>

        <br /><br />

        <button
          type="submit"
          className="primary-btn"
          disabled={loading}
        >
          {loading ? "Generating UTTI..." : "Generate UTTI"}
        </button>
      </form>

{result && (
  <div className="utti-modal-overlay" onClick={() => setResult(null)}>
    <div
      className="utti-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <h3>UTTI Generated ✅</h3>

      <p><b>UTTI:</b> {result.utti}</p>
      <p><b>State:</b> {result.state}</p>
      <p><b>Total Items:</b> {result.total_items}</p>
      <p><b>Total GST:</b> ₹{result.total_gst}</p>

      <button
        className="copy-btn"
        onClick={() => navigator.clipboard.writeText(result.utti)}
      >
        Copy UTTI
      </button>

      <button
        className="secondary-btn"
        style={{ marginTop: "12px" }}
        onClick={() => setResult(null)}
      >
        Close
      </button>
    </div>
  </div>
)}
    </div>
  );
}

export default SlipEntry;
