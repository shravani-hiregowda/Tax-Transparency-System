// src/pages/Allocation.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";
import { jsPDF } from "jspdf";

import "../styles/allocation.css";
import "../styles/home.css";

const DATA_PATH = "/data/output_json_improved_full/all_demands_improved_full.json";
const PER_DEMAND_PATH_PREFIX = "/data/output_json_improved_full/DEMAND_";

const TOP_MINISTRIES = [
  "defence","road transport","railway","education","health",
  "home affairs","rural development","agriculture","finance","housing and urban"
];

export default function Allocation() {
  const navigate = useNavigate();

  const canvasRef = useRef(null);
  const chartInstance = useRef(null);
  const dropdownRef = useRef(null);
  const downloadBtnRef = useRef(null);

  const [rawData, setRawData] = useState([]);
  const [levels, setLevels] = useState({ 1: [], 2: [], 3: [] });

  const [currentLevel, setCurrentLevel] = useState(1);
  const [levelTitle, setLevelTitle] = useState("Level 1 — Most Important Demands");
  const [labels, setLabels] = useState([]);
  const [values, setValues] = useState([]);
  const [colors, setColors] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ---------------- Load data ----------------
  useEffect(() => {
    (async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(DATA_PATH);
        if (res.ok) {
          setRawData(await res.json());
        } else {
          const arr = [];
          for (let i = 1; i <= 120; i++) {
            try {
              const r = await fetch(`${PER_DEMAND_PATH_PREFIX}${i}.json`);
              if (r.ok) arr.push(await r.json());
            } catch {}
          }
          setRawData(arr);
        }
      } catch {
        setRawData([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ---------------- Dropdown close ----------------
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current?.contains(e.target) ||
        downloadBtnRef.current?.contains(e.target)
      ) return;
      setDropdownOpen(false);
    }

    function handleEsc(e) {
      if (e.key === "Escape") setDropdownOpen(false);
    }

    function handleScroll() {
      setDropdownOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  // ---------------- Normalize & classify ----------------
  useEffect(() => {
    if (!rawData.length) return;

    const map = new Map();
    rawData.forEach((d) => {
      const name =
        d.ministry || d.ministry_name || d["Ministry/Demand Revenue Capital Total Page No"];
      const ministry = normalize(name);
      const total = getValue(d.values) || getFromSections(d.sections) || 0;
      map.set(ministry, (map.get(ministry) || 0) + total);
    });

    const all = [...map.entries()]
      .map(([ministry, total]) => ({ ministry, total }))
      .sort((a, b) => b.total - a.total);

    const level1 = all.filter((d) =>
      TOP_MINISTRIES.some((k) => normalize(d.ministry).includes(k))
    );

    const rem = all.filter(
      (d) => !TOP_MINISTRIES.some((k) => normalize(d.ministry).includes(k))
    );

    const mid = Math.ceil(rem.length * 0.5);
    setLevels({ 1: level1, 2: rem.slice(0, mid), 3: rem.slice(mid) });

    renderForLevel(1, { 1: level1, 2: rem.slice(0, mid), 3: rem.slice(mid) });
  }, [rawData]);

  // ---------------- Chart render ----------------
  useEffect(() => {
    if (!canvasRef.current || !labels.length) return;

    if (chartInstance.current) chartInstance.current.destroy();

    const ctx = canvasRef.current.getContext("2d");

    chartInstance.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: "#fff",
            borderWidth: 2,
            hoverOffset: 10,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        cutout: "60%",
        plugins: {
          legend: { display: false },
        },
        onClick: (evt, elements) => {
          if (elements && elements.length > 0) {
            const idx = elements[0].index;
            const selectedMinistry = labels[idx];
            navigate(`/ministry?name=${encodeURIComponent(selectedMinistry)}`);
          }
        },
      },
    });

    return () => chartInstance.current?.destroy();
  }, [labels, values, colors]);

  // ---------------- Helpers ----------------
  const normalize = (n) =>
    n?.toString()?.toLowerCase()?.replace(/\(.*?\)/g, "")?.trim() || "unknown";

  const titleCase = (str) =>
    str?.replace(/\b\w/g, (ch) => ch.toUpperCase()) || "";

  function getValue(values) {
    if (!values) return null;
    for (const k of [
      "total_2025_26",
      "budget_2025_26",
      "total_2024_25",
      "budget_2024_25",
    ]) {
      if (values[k] !== undefined && !isNaN(values[k])) return +values[k];
    }
    return null;
  }

  function getFromSections(sections) {
    if (!sections) return null;
    for (const s of sections)
      for (const it of s.items || [])
        if (/total|grand|net/i.test(it.name || ""))
          return getValue(it.values);
    return null;
  }

  const generateColors = (n) =>
    Array.from({ length: n }, (_, i) => `hsl(${(i * 35) % 360},75%,55%)`);

  function renderForLevel(level, LS = levels) {
    const arr = LS[level] || [];
    setLabels(arr.map((d) => titleCase(d.ministry)));
    setValues(arr.map((d) => d.total));
    setColors(generateColors(arr.length));

    setLevelTitle(
      level === 1
        ? "Level 1 — Top 10 Ministries by Expenditure"
        : level === 2
        ? "Level 2 — Medium-Scale Ministries"
        : "Level 3 — Smaller Allocations"
    );

    setCurrentLevel(level);
  }

  // ---------------- Legend ----------------
  function Legend() {
    const total = values.reduce((a, b) => a + b, 0);
    return (
      <div className="sticky-legend">
        {labels.map((lbl, i) => (
          <div className="legend-item" key={i}>
            <span className="legend-swatch" style={{ background: colors[i] }} />
            <div className="legend-text">
              <div className="legend-title">{lbl}</div>
              <div className="legend-sub">
                ₹{values[i].toLocaleString()} • {((values[i] / total) * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="allocation-wrapper">
      <main className="main">
        <section className="viz-container">
          <div className="chart-section">
            <div className="chart-header">
              <h2 id="levelTitle">{levelTitle}</h2>

              <div className="download-menu" ref={downloadBtnRef}>
                <button
                  type="button"
                  className="download-chart-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen((s) => !s);
                  }}
                >
                  Download
                </button>

                <div
                  className={`dropdown-options ${dropdownOpen ? "show" : ""}`}
                  ref={dropdownRef}
                >
                  <button type="button" onClick={() => downloadChart("png")}>PNG</button>
                  <button type="button" onClick={() => downloadChart("pdf")}>PDF</button>
                  <button type="button" onClick={() => downloadChart("svg")}>SVG</button>
                </div>
              </div>
            </div>

            <div className="chart-area-wrapper">
              {isLoading ? (
                <div style={{ padding: 40 }}>Loading data...</div>
              ) : (
                <>
                  <canvas id="mainChart" ref={canvasRef} />
                  <Legend />
                </>
              )}
            </div>
          </div>

          <aside className="level-selector">
            <h3>Select Level</h3>
            {[1, 2, 3].map((lvl) => (
              <button
                key={lvl}
                className={`level-btn ${lvl === currentLevel ? "active" : ""}`}
                onClick={() => renderForLevel(lvl)}
              >
                Level {lvl}
              </button>
            ))}
          </aside>
        </section>
      </main>
    </div>
  );
}
