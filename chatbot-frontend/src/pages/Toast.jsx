import React, { useEffect } from "react";

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => onClose(), 2200);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  return <div className={`tts-toast ${toast.type === "success" ? "ok" : "err"}`}>{toast.text}</div>;
}
