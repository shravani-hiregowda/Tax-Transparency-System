import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";
import { jsPDF } from "jspdf";

import "../styles/navbar.css";
import "../styles/ministry.css";

export default function Ministry() {

  const FIN_YEAR = "2026_27";     // data key format
  const FIN_YEAR_LABEL = "2026–27"; // UI format

  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const queryName = params.get("name") || "";
  const [ministryName, setMinistryName] = useState(queryName);
  const [foundDemands, setFoundDemands] = useState([]);
  const [totalAllocation, setTotalAllocation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const demandChartRef = useRef(null);
  const chartCanvasRef = useRef(null);
  const dropdownRef = useRef(null);
  const downloadBtnRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);


  const DEMANDS_PATH = "/data/output_json_improved_full/";

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

  document.addEventListener("mousedown", handleClickOutside);
  document.addEventListener("keydown", handleEsc);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleEsc);
  };
}, []);


  useEffect(() => {
    if (!ministryName && queryName) setMinistryName(queryName);
    loadDemands();
    return () => {
      if (demandChartRef.current) {
        demandChartRef.current.destroy();
        demandChartRef.current = null;
      }
    };
  }, [ministryName]);

  async function loadDemands() {
    if (!ministryName) {
      setError("No ministry specified.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const found = [];

      for (let num = 1; num <= 120; num++) {
        const file = `${DEMANDS_PATH}DEMAND_${num}.json`;
        try {
          const res = await fetch(file);
          if (!res.ok) continue;
          const d = await res.json();
          const rawMin = (d.ministry || d.ministry_name || "").toLowerCase();

          if (rawMin.includes(ministryName.toLowerCase())) {
            const total = extractTotal(d);
            const dept = d.department || d.department_name || "Directly under Ministry";
            found.push({
              no: d.demand_no || num,
              dept,
              total,
              raw: d
            });
          }
        } catch (e) {
          continue;
        }
      }

      if (found.length === 0) {
        setFoundDemands([]);
        setTotalAllocation(0);
        setLoading(false);
        return;
      }

      found.sort((a, b) => b.total - a.total);
      const tot = found.reduce((s, it) => s + (it.total || 0), 0);

      setFoundDemands(found);
      setTotalAllocation(tot);

      setTimeout(() => {
        renderDemandDonut(found);
      }, 180);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Error loading ministry demands.");
      setLoading(false);
    }
  }

function extractTotal(demand) {
  const yearKey = `total_${FIN_YEAR}`;

  // 1. Direct hit
  if (demand?.values?.[yearKey] && !isNaN(demand.values[yearKey])) {
    return Number(demand.values[yearKey]);
  }

  // 2. Fallback: scan sections (this is what saved you earlier)
  let total = 0;

  if (Array.isArray(demand.sections)) {
    for (const section of demand.sections) {
      for (const item of section.items || []) {
        if (/total|grand|net/i.test(item.name || "")) {
          const val = getValue(item.values);
          if (val) total += val;
        }
      }
    }
  }

  return total;
}



  function getValue(values) {
    if (!values) return 0;

    const yearKeys = [
      `total_${FIN_YEAR}`,
      `budget_${FIN_YEAR}`,
      `total_${Number(FIN_YEAR.split("_")[0]) - 1}_${Number(FIN_YEAR.split("_")[1]) - 1}`
    ];

    for (const k of yearKeys) {
      if (values[k] && !isNaN(values[k])) {
        return Number(values[k]);
      }
    }
    return 0;
  }


  function generateColors(n) {
    return Array.from({ length: n }, (_, i) => `hsl(${(i * 35) % 360}, 75%, 55%)`);
  }

  function renderDemandDonut(demands) {
    try {
      const ctx = chartCanvasRef.current?.getContext("2d");
      if (!ctx) return;

      const labels = demands.map(d => d.dept);
      const values = demands.map(d => d.total);
      const colors = generateColors(values.length);
      const totalSum = values.reduce((a, b) => a + b, 0);

      if (demandChartRef.current) {
        demandChartRef.current.destroy();
        demandChartRef.current = null;
      }

      demandChartRef.current = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: colors,
              borderColor: "#fff",
              borderWidth: 2,
              hoverOffset: 10
            }
          ]
        },
        options: {
          cutout: "65%",
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#ffffff",
              titleColor: "#004aad",
              bodyColor: "#0b4f6c",
              borderColor: "#e2e8f0",
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: ctx => {
                  const val = ctx.parsed;
                  const pct = ((val / totalSum) * 100).toFixed(2);
                  return `${ctx.label}: ₹${val.toLocaleString()} Cr (${pct}%)`;
                }
              }
            }
          },
          animation: {
            duration: 900,
            easing: "easeOutQuart"
          }
        }
      });
    } catch (err) {
      console.error("Chart render failed:", err);
    }
  }

  function renderLegendJSX() {
    if (!foundDemands || foundDemands.length === 0) return null;

    const labels = foundDemands.map(d => d.dept);
    const values = foundDemands.map(d => d.total);
    const totalSum = values.reduce((a, b) => a + b, 0);
    const colors = generateColors(labels.length);

    return (
      <>
        {labels.map((lbl, i) => (
          <div className="legend-item" key={i}>
            <span className="legend-swatch" style={{ background: colors[i] }} />
            <div className="legend-text">
              <div className="legend-title">{lbl}</div>
              <div className="legend-sub">
                ₹{values[i].toLocaleString()} Cr • {((values[i] / totalSum) * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

 async function downloadChart(format = "png") {
  try {
    if (!chartCanvasRef.current || !demandChartRef.current) return;

    await new Promise((r) => setTimeout(r, 100));

    const exportW = 1300;
    const exportH = 900;
    const headerH = 120;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;

    const ctx = exportCanvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportW, exportH);

    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Header text
    ctx.fillStyle = "#004aad";
    ctx.font = "bold 30px Inter";
    ctx.fillText(`${ministryName} — Department Report`, 40, 50);

    ctx.fillStyle = "#0b4f6c";
    ctx.font = "600 20px Inter";
    ctx.fillText(`"Department-wise Allocation (${FIN_YEAR_LABEL})"`, 40, 90);

    ctx.fillStyle = "#475569";
    ctx.font = "16px Inter";
    ctx.fillText(`Generated on: ${dateStr}`, 40, 118);

    // Chart image
    const img = new Image();
    img.src = chartCanvasRef.current.toDataURL("image/png");

    img.onload = () => {
      ctx.drawImage(img, 40, headerH, 600, 600);

      drawLegend();
      finalize();
    };

    function drawLegend() {
      const labels = demandChartRef.current.data.labels;
      const values = demandChartRef.current.data.datasets[0].data;
      const colors = demandChartRef.current.data.datasets[0].backgroundColor;

      const total = values.reduce((a, b) => a + b, 0);

      ctx.fillStyle = "#004aad";
      ctx.font = "bold 20px Inter";
      ctx.fillText("Top Departments", 700, 160);

      let y = 210;
      const limit = Math.min(labels.length, 12);

      for (let i = 0; i < limit; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(700, y - 12, 14, 14);

        ctx.fillStyle = "#0b4f6c";
        ctx.font = "16px Inter";
        ctx.fillText(labels[i], 720, y);

        ctx.fillStyle = "#64748b";
        ctx.font = "14px Inter";
        ctx.fillText(
          `₹${values[i].toLocaleString()} • ${((values[i] / total) * 100).toFixed(2)}%`,
          720,
          y + 18
        );

        y += 40;
      }
    }

    function finalize() {
      const file = `Ministry_${ministryName.replace(/\s+/g, "_")}_${dateStr}`;

      // PNG
      if (format === "png") {
        const link = document.createElement("a");
        link.download = `${file}.png`;
        link.href = exportCanvas.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

      // PDF
      if (format === "pdf") {
        const pdf = new jsPDF("l", "mm", "a3");
        pdf.addImage(exportCanvas.toDataURL("image/png"), "PNG", 0, 0, 420, 297);
        pdf.save(`${file}.pdf`);
        return;
      }

      // SVG
      if (format === "svg") {
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${exportW}" height="${exportH}">
            <image href="${exportCanvas.toDataURL("image/png")}" width="1300" height="900"/>
          </svg>
        `;

        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.download = `${file}.svg`;
        link.href = url;
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
          link.remove();
          URL.revokeObjectURL(url);
        }, 300);
      }
    }
  } catch (e) {
    console.error("Ministry export error:", e);
  }
}


  return (
    <div>

      {/* PAGE */}
      <main className="main ministry-main">

        <div className="breadcrumb">
          <a href="/allocation">All Ministries</a> → <strong>{ministryName}</strong>
        </div>

        <section className="header-section">
          <h1 className="page-title">{ministryName}</h1>
          <div className="insight-bar">
            {loading
              ? "Fetching ministry data..."
              : totalAllocation > 0
                ? <span><b>{ministryName}</b> — displaying departments contributing to ₹{totalAllocation.toLocaleString()} Cr.</span>
                : <span>No data to display.</span>}
          </div>

          <div className="compare-ministry">
            <button onClick={() => {
              const m = encodeURIComponent(ministryName || "");
              window.location.href = `/comparison?type=ministry&min1=${m}`;
            }}>
              <i className="fas fa-balance-scale"></i> Compare with Other Ministries
            </button>
          </div>
        </section>

        {/* ===================== NEW STRUCTURE (matches allocation) ===================== */}
        <section className="viz-container">

          {/* LEFT = CHART */}
          <div className="chart-section">

            <div className="chart-header">
              <h2>Department-wise Expenditure ({FIN_YEAR_LABEL})</h2>

              <div className="download-menu" ref={downloadBtnRef}>
              <button
                className="download-chart-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen((s) => !s);
                }}
              >
                <i className="fas fa-download"></i> Download
                <i className="fas fa-chevron-down"></i>
              </button>

              <div
                className={`dropdown-options ${dropdownOpen ? "show" : ""}`}
                ref={dropdownRef}
              >
                <button onClick={() => downloadChart("png")}><i className="fas fa-image"></i> PNG</button>
                <button onClick={() => downloadChart("pdf")}><i className="fas fa-file-pdf"></i> PDF</button>
                <button onClick={() => downloadChart("svg")}><i className="fas fa-draw-polygon"></i> SVG</button>
              </div>
            </div>

            </div>

            <canvas id="demandChart" ref={chartCanvasRef} />
          </div>

          {/* RIGHT = LEGEND */}
          <div className="legend-scroll">
            {renderLegendJSX()}
          </div>

        </section>

        {/* DEMANDS GRID */}
        <section className="demand-section">
          <h2 className="section-title">Demands & Departments</h2>

          <div className="demand-list">
            {loading && <div>Loading ministry data...</div>}
            {!loading && error && <div style={{ color: "red" }}>{error}</div>}
            {!loading && !error && foundDemands.length === 0 && <div>No demands found.</div>}

            {!loading && foundDemands.length > 0 && foundDemands.map((d, idx) => (
              <a
                key={idx}
                className="demand-card"
                href={`/projects?ministry=${encodeURIComponent(ministryName)}&department=${encodeURIComponent(d.dept)}`}
              >
                <h3>Demand No. {d.no}</h3>
                <p><b>Department:</b> {d.dept}</p>
                <p><b>Expenditure ({FIN_YEAR_LABEL}):</b> ₹{d.total.toLocaleString()} Cr</p>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

