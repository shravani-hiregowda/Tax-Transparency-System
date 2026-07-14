import React, { useEffect, useRef, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";

import "../styles/navbar.css";
import "../styles/allocation.css";
import "../styles/projects.css";

export default function Projects() {
  const location = useLocation();
  const navigate = useNavigate();

  const qs = new URLSearchParams(location.search);
  const ministry = qs.get("ministry") || "";
  const department = qs.get("department") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [totalAllocation, setTotalAllocation] = useState(0);

  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const dropdownRef = useRef(null);
  const downloadBtnRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);


  const DEMANDS_PATH = "/data/output_json_improved_full/";

  /* ============================== DATA LOAD ============================== */
  useEffect(() => {
    setLoading(true);
    setError(null);
    setSchemes([]);
    setTotalAllocation(0);

    let mounted = true;

    (async () => {
      try {
        const collected = [];

        for (let i = 1; i <= 120; i++) {
          const file = `${DEMANDS_PATH}DEMAND_${i}.json`;
          try {
            const res = await fetch(file);
            if (!res.ok) continue;

            const data = await res.json();

            const matchesMinistry =
              data.ministry?.toLowerCase().includes(ministry.toLowerCase());
            const matchesDept =
              (data.department || data.department_name || "")
                .toLowerCase()
                .includes(department.toLowerCase());

            if (matchesMinistry && matchesDept) {
              for (const section of data.sections || []) {
                for (const item of section.items || []) {
                  if (/total|grand|net/i.test(item.name || "")) continue;

                  const value = extractValue(item.values);
                  if (value > 0) {
                    collected.push({ name: item.name.trim(), value });
                  }
                }
              }
            }
          } catch {
            continue;
          }
        }

        if (!mounted) return;

        if (collected.length === 0) {
          setSchemes([]);
          setTotalAllocation(0);
          setLoading(false);
          return;
        }

        const agg = collected.reduce((acc, s) => {
          acc[s.name] = (acc[s.name] || 0) + s.value;
          return acc;
        }, {});

        const aggregatedArr = Object.entries(agg).map(([name, value]) => ({
          name,
          value
        }));

        aggregatedArr.sort((a, b) => b.value - a.value);

        const total = aggregatedArr.reduce((a, b) => a + b.value, 0);

        setSchemes(aggregatedArr);
        setTotalAllocation(total);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        setError("Failed to load project data.");
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [ministry, department]);

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


  /* ============================== VALUE EXTRACTOR ============================== */
  function extractValue(values) {
    if (!values) return 0;
    for (const key of [
      "total_2025_26",
      "budget_2025_26",
      "revised_2024_25",
      "total_2024_25"
    ]) {
      if (values[key] && !isNaN(values[key])) return Number(values[key]);
    }
    if (typeof values === "number") return values;
    return 0;
  }

  /* ============================== CHART RENDER ============================== */
  useEffect(() => {
    if (!chartRef.current) return;

    if (!schemes || schemes.length === 0) {
      destroyChart();
      return;
    }

    const labels = schemes.map(s => s.name);
    const values = schemes.map(s => s.value);
    const colors = labels.map((_, i) => `hsl(${(i * 37) % 360}, 70%, 55%)`);

    destroyChart();

    const ctx = chartRef.current.getContext("2d");

    chartInstanceRef.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: "#fff",
            borderWidth: 2
          }
        ]
      },
      options: {
        cutout: "65%",
        plugins: {
          legend: { display: false }
        }
      }
    });

    return destroyChart;
  }, [schemes]);

  function destroyChart() {
    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.destroy();
      } catch (_) {}
      chartInstanceRef.current = null;
    }
  }

  /* ============================== LEGEND ============================== */
  function renderLegend() {
    if (!schemes || schemes.length === 0) return null;

    const colors = schemes.map((_, i) => `hsl(${(i * 37) % 360}, 70%, 55%)`);
    const total = schemes.reduce((s, x) => s + x.value, 0);

    return (
      <>
        {schemes.slice(0, 20).map((s, i) => (
          <div className="legend-item" key={i}>
            <span className="legend-swatch" style={{ background: colors[i] }} />
            <div className="legend-text">
              <div className="legend-title">{s.name}</div>
              <div className="legend-sub">
                ₹{s.value.toLocaleString("en-IN")} •{" "}
                {((s.value / total) * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  /* ============================== DOWNLOAD HANDLER ============================== */
 async function handleDownload(format = "png") {
  try {
    if (!chartRef.current || !chartInstanceRef.current) return;

    // Close dropdown
    setDropdownOpen(false);
    await new Promise((res) => setTimeout(res, 150));

    const exportW = 1300;
    const exportH = 900;
    const headerH = 120;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    const ctx = exportCanvas.getContext("2d");

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportW, exportH);

    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Header text
    ctx.fillStyle = "#004aad";
    ctx.font = "bold 28px Inter";
    ctx.fillText(`${department} — Scheme Breakdown`, 40, 50);

    ctx.fillStyle = "#475569";
    ctx.font = "16px Inter";
    ctx.fillText(`Ministry: ${ministry}`, 40, 85);
    ctx.fillText(`Generated: ${dateStr}`, 40, 115);

    // Chart image
    const img = new Image();
    img.src = chartRef.current.toDataURL("image/png");

    img.onload = () => {
      ctx.drawImage(img, 40, headerH, 600, 600);
      drawLegend();
      finalize();
    };

    function drawLegend() {
      const labels = chartInstanceRef.current.data.labels;
      const values = chartInstanceRef.current.data.datasets[0].data;
      const colors = chartInstanceRef.current.data.datasets[0].backgroundColor;
      const total = values.reduce((a, b) => a + b, 0);

      ctx.fillStyle = "#004aad";
      ctx.font = "bold 20px Inter";
      ctx.fillText("Top Schemes", 700, 160);

      let y = 210;
      const limit = Math.min(labels.length, 15);

      for (let i = 0; i < limit; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(700, y - 12, 14, 14);

        ctx.fillStyle = "#0b4f6c";
        ctx.font = "16px Inter";
        ctx.fillText(labels[i], 720, y);

        ctx.fillStyle = "#64748b";
        ctx.font = "14px Inter";
        ctx.fillText(
          `₹${values[i].toLocaleString()} Cr • ${((values[i] / total) * 100).toFixed(2)}%`,
          720,
          y + 18
        );

        y += 40;
      }
    }

    function finalize() {
      const file = `Projects_${department}_${dateStr}`.replace(/\s+/g, "_");

      if (format === "png") {
        const link = document.createElement("a");
        link.download = `${file}.png`;
        link.href = exportCanvas.toDataURL("image/png");
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

      if (format === "pdf") {
        const pdf = new jsPDF("l", "mm", "a3");
        pdf.addImage(exportCanvas.toDataURL("image/png"), "PNG", 0, 0, 420, 297);
        pdf.save(`${file}.pdf`);
        return;
      }

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
    console.error("PROJECT DOWNLOAD ERROR:", e);
  }
}


  /* ============================== RETURN (ALLOCATION-STYLE LAYOUT) ============================== */
  return (
    <div>
      {/* PAGE */}
      <main className="project-main">

        <div className="breadcrumb" style={{ marginBottom: 12 }}>
          <Link to="/allocation">Allocation</Link> ›{" "}
          <Link to={`/ministry?name=${encodeURIComponent(ministry)}`}>{ministry}</Link> ›{" "}
          <b>{department}</b>
        </div>

        <header className="page-header">
          <h1>{department}</h1>
          <p className="subtitle">Under {ministry}</p>
        </header>

        {/* ======================= ALLOCATION-LIKE CONTAINER ======================= */}
        <section className="viz-container">

          {/* LEFT — CHART */}
          <div className="chart-section">
            <div className="chart-header">
              <h2>Department Schemes Overview</h2>

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
    <button onClick={() => handleDownload("png")}><i className="fas fa-image"></i> PNG</button>
    <button onClick={() => handleDownload("pdf")}><i className="fas fa-file-pdf"></i> PDF</button>
    <button onClick={() => handleDownload("svg")}><i className="fas fa-draw-polygon"></i> SVG</button>
  </div>
              </div>

            </div>

            <canvas id="projectChart" ref={chartRef} />
          </div>

          {/* RIGHT — LEGEND */}
          <div className="legend-scroll">
            {renderLegend()}
          </div>

        </section>

        {/* ======================= SCHEMES ======================= */}
        <section className="scheme-section">
          <h2>List of Schemes / Projects</h2>

          <div className="scheme-list">
            {loading ? (
              <p>Loading...</p>
            ) : schemes.length === 0 ? (
              <p>No data found.</p>
            ) : (
              schemes.map((s, i) => (
                <div className="scheme-card" key={i}>
                  <h3>{s.name}</h3>
                  <p>
                    <b>Allocation:</b> ₹{s.value.toLocaleString("en-IN")} Cr
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
        
      </main>
    </div>
  );
}
