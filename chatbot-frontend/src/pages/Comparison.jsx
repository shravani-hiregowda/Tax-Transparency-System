import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";

import "../styles/navbar.css";
import "../styles/home.css";
import "../styles/comparison.css";

export default function Comparison() {
  const navigate = useNavigate();

  // chart refs
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  // backend data
  const [allData, setAllData] = useState([]); // array of demand objects
  const [ministryDeptMap, setMinistryDeptMap] = useState({}); // optional mapping file
  const [taxData, setTaxData] = useState(null);

  // UI state
  const [comparisonType, setComparisonType] = useState("ministry");
  const [ministriesList, setMinistriesList] = useState([]);
  const [selectedMin1, setSelectedMin1] = useState("");
  const [selectedMin2, setSelectedMin2] = useState("");
  const [selectedMinForYear, setSelectedMinForYear] = useState("");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedMinForDept, setSelectedMinForDept] = useState("");
  const [chartType, setChartType] = useState("bar"); // bar | line | doughnut
  const [insightHtml, setInsightHtml] = useState("Choose your options and click Compare.");
  const [isLoading, setIsLoading] = useState(true);

  // Derived lists
  const [departmentsForSelectedMin, setDepartmentsForSelectedMin] = useState([]);

  // ------------------- DATA LOADING -------------------
  useEffect(() => {
    (async function load() {
      setIsLoading(true);
      try {
        // 1) Try to fetch consolidated all_demands_improved_full.json (fast)
        try {
          const res = await fetch("/data/output_json_improved_full/all_demands_improved_full.json");
          if (res.ok) {
            const json = await res.json();
            setAllData(json);
          } else {
            // fallback: attempt to fetch DEMAND_x files (if you have them individually).
            await fetchDemandsFallback();
          }
        } catch (err) {
          // fallback
          await fetchDemandsFallback();
        }

        // 2) ministry_department.json (optional but useful)
        try {
          const res2 = await fetch("/data/ministry_department.json");
          if (res2.ok) {
            const md = await res2.json();
            setMinistryDeptMap(md);
          }
        } catch (err) {
          // ignore if missing
        }

        // 3) tax.json (optional)
        try {
          const res3 = await fetch("/data/tax.json");
          if (res3.ok) {
            const t = await res3.json();
            setTaxData(t);
          }
        } catch (err) {
          // ignore
        }
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fallback to individually named demand files (DEMAND_1.json...)
  async function fetchDemandsFallback() {
    const results = [];
    for (let i = 1; i <= 120; i++) {
      try {
        const r = await fetch(`/data/output_json_improved_full/DEMAND_${i}.json`);
        if (!r.ok) continue;
        const d = await r.json();
        results.push(d);
      } catch (err) {
        // skip
      }
    }
    setAllData(results);
  }

  // build ministries list when allData loads
  useEffect(() => {
    if (!allData || !allData.length) return;
    const setM = new Set();
    allData.forEach((d) => {
      const nm = d.ministry || d.ministry_name || d["Ministry/Demand Revenue Capital Total Page No"] || null;
      if (nm) setM.add(nm);
    });
    const arr = Array.from(setM).sort((a, b) => a.localeCompare(b));
    setMinistriesList(arr);
  }, [allData]);

  // when selectedMinForDept changes, compute departments list
  useEffect(() => {
    if (!selectedMinForDept) {
      setDepartmentsForSelectedMin([]);
      return;
    }

    // prefer ministryDeptMap if available
    const fromMap = ministryDeptMap[selectedMinForDept];
    if (Array.isArray(fromMap) && fromMap.length > 0) {
      setDepartmentsForSelectedMin(fromMap);
      return;
    }

    // otherwise, derive from allData
    const deps = new Set();
    allData.forEach((d) => {
      const minName = (d.ministry || d.ministry_name || "").toString().toLowerCase();
      if (minName && minName.includes(selectedMinForDept.toLowerCase())) {
        const dept = d.department || d.department_name || "Directly under Ministry";
        if (dept) deps.add(dept);
      }
    });
    setDepartmentsForSelectedMin(Array.from(deps));
  }, [ministryDeptMap, selectedMinForDept, allData]);

  // ------------------- DATA EXTRACTION HELPERS -------------------
  // extract numeric 2025 value or nested totals - recursive-like logic
  function extractTotal(d) {
    // Check top-level .values keys first (prefer 2025)
    if (d && d.values) {
      for (const key of ["total_2025_26", "budget_2025_26", "total_2024_25", "budget_2024_25"]) {
        const v = d.values[key];
        if (v !== undefined && v !== null && !isNaN(v)) {
          return Number(v);
        }
      }
      // also check any numeric values directly present
      // (some parsed objects might have "total" or similar)
      if (d.values.total && !isNaN(d.values.total)) return Number(d.values.total);
    }

    // If sections exist, look for items with "total|net|grand" names
    if (Array.isArray(d.sections)) {
      for (const s of d.sections) {
        if (!s || !Array.isArray(s.items)) continue;
        for (const item of s.items) {
          if (!item) continue;
          // If this item is a 'total' row, try to extract its values
          if (/total|grand|net/i.test((item.name || "").toString())) {
            const v = extractTotal({ values: item.values });
            if (v && v !== 0) return v;
          }
        }
      }
    }

    // If nothing found, attempt to look deeper: sum of items (less precise, fallback)
    if (Array.isArray(d.sections)) {
      let sum = 0;
      let any = false;
      for (const s of d.sections) {
        for (const item of s.items || []) {
          const v = extractTotal({ values: item.values });
          if (v && !isNaN(v)) {
            sum += Number(v);
            any = true;
          }
        }
      }
      if (any) return sum;
    }

    return 0;
  }

  // builds a map of year -> total for a ministry (from allData items that match ministry)
  function extractYearlyTotals(ministryName) {
    const yearMap = {};

    if (!allData || !allData.length) return {};

    allData.forEach((d) => {
      const minCandidate = (d.ministry || d.ministry_name || "").toString();
      if (!minCandidate) return;
      if (!minCandidate.toLowerCase().includes(ministryName.toLowerCase())) return;

      // 1) top-level values keys containing year-like patterns
      if (d.values) {
        for (const [k, v] of Object.entries(d.values)) {
          const m = k.match(/20\d{2}/);
          if (m && !isNaN(v)) {
            const yr = m[0];
            yearMap[yr] = (yearMap[yr] || 0) + Number(v);
          }
        }
      }

      // 2) nested sections -> item.values keys with years (for total rows)
      if (Array.isArray(d.sections)) {
        for (const s of d.sections) {
          for (const item of s.items || []) {
            if (!item) continue;
            if (item.values) {
              for (const [k, v] of Object.entries(item.values)) {
                const m = k.match(/20\d{2}/);
                if (m && !isNaN(v)) {
                  const yr = m[0];
                  yearMap[yr] = (yearMap[yr] || 0) + Number(v);
                }
              }
            }
          }
        }
      }
    });

    // sort by year ascending
    const sortedKeys = Object.keys(yearMap).sort((a, b) => Number(a) - Number(b));
    const result = {};
    sortedKeys.forEach((k) => (result[k] = yearMap[k]));
    return result;
  }

  // get total allocation (2025 priority) for an entire ministry
  function getMinistryTotal(ministryName) {
    if (!allData || !allData.length) return 0;
    let total = 0;
    allData.forEach((d) => {
      const candidate = (d.ministry || d.ministry_name || "").toString();
      if (!candidate) return;
      if (candidate.toLowerCase().includes(ministryName.toLowerCase())) {
        total += extractTotal(d);
      }
    });
    return total;
  }

  // get total for a department (exact department match)
  function getDepartmentTotal(departmentName) {
    if (!allData || !allData.length) return 0;
    let total = 0;
    allData.forEach((d) => {
      const dept = (d.department || d.department_name || "Directly under Ministry").toString();
      if (!dept) return;
      if (dept.toLowerCase() === departmentName.toLowerCase()) {
        total += extractTotal(d);
      }
    });
    return total;
  }

  // ------------------- CHART HELPERS -------------------
  function destroyChart() {
    if (chartRef.current) {
      try {
        chartRef.current.destroy();
      } catch (e) {
        // ignore
      }
      chartRef.current = null;
    }
  }

  function renderChart(labels = [], data = [], type = "bar", yLabel = "₹ Allocation (Cr)") {
    destroyChart();
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");

    // ensure colors length >= data length
    const colors = labels.map((_, i) => `hsl(${(i * 37) % 360}, 70%, 55%)`);

    chartRef.current = new Chart(ctx, {
      type,
      data: {
        labels,
        datasets: [
          {
            label: yLabel,
            data,
            backgroundColor: type === "doughnut" ? colors : colors,
            borderColor: "#fff",
            borderWidth: type === "doughnut" ? 1 : 0,
            tension: 0.3,
          },
        ],
      },
      options: {
  responsive: true,
  maintainAspectRatio: false,

  plugins: {
    legend: {
      display: type === "doughnut",
      labels: {
        font: {
          size: isMobile() ? 10 : 12,
        },
      },
    },
    tooltip: {
      backgroundColor: "rgba(255,255,255,0.98)",
      titleColor: "#0b4f6c",
      bodyColor: "#0b4f6c",
      borderColor: "#e6eefb",
      borderWidth: 1,
      bodyFont: {
        size: isMobile() ? 10 : 12,
      },
      callbacks: {
        label: (ctx) => {
          const val = ctx.parsed?.y ?? ctx.parsed;
          return `₹${Number(val).toLocaleString("en-IN")} Cr`;
        },
      },
    },
  },

  scales:
    type === "bar" || type === "line"
      ? {
          x: {
            ticks: {
              font: {
                size: isMobile() ? 9 : 12,   // ✅ X-axis labels
              },
              maxRotation: isMobile() ? 35 : 0,
              minRotation: isMobile() ? 35 : 0,
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: yLabel,
              font: {
                size: isMobile() ? 10 : 13, // ✅ Y-axis title
              },
            },
            ticks: {
              font: {
                size: isMobile() ? 9 : 12,  // ✅ Y-axis numbers
              },
            },
          },
        }
      : {},

  animation: {
    duration: 900,
    easing: "easeOutQuart",
  },
}

    });
  }

  function isMobile() {
  return window.innerWidth <= 768;
}


  // ------------------- ACTIONS (COMPARED TO ORIGINAL JS) -------------------

  // ministry vs ministry (accepts two ministry names)
  function handleCompareMinistries(m1, m2) {
    if (!m1 || !m2) {
      setInsightHtml("Select two ministries.");
      return;
    }
    const t1 = getMinistryTotal(m1);
    const t2 = getMinistryTotal(m2);

    renderChart([m1, m2], [t1, t2], "bar", "₹ Allocation (Cr)");

    const diff = Math.abs(t1 - t2);
    const higher = t1 > t2 ? m1 : m2;
    setInsightHtml(
      `<b>${m1}</b>: ₹${t1.toLocaleString()} Cr<br/><b>${m2}</b>: ₹${t2.toLocaleString()} Cr<br/><br/>📌 <b>${higher}</b> spends ₹${diff.toLocaleString()} Cr more than the other.`
    );
  }

  // year vs year (trend) using full-year extraction
  function handleCompareYears(ministry) {
    if (!ministry) {
      setInsightHtml("Select a ministry for year comparison.");
      return;
    }

    const yearly = extractYearlyTotals(ministry);
    if (!yearly || Object.keys(yearly).length === 0) {
      setInsightHtml(
        `⚠️ No year-wise data available for <b>${ministry}</b>. Some demands only have current-year values.`
      );
      destroyChart();
      return;
    }

    const years = Object.keys(yearly);
    const values = Object.values(yearly);

    renderChart(years, values, "line", "₹ Allocation (Cr)");

    // Build YoY analysis similar to original
    let analysis = `<b>${ministry}</b> — Year-wise allocation (${years.join(" → ")}):<br/><br/>`;
    for (let i = 1; i < years.length; i++) {
      const prev = values[i - 1];
      const curr = values[i];
      const diff = curr - prev;
      const pct = prev ? ((diff / prev) * 100).toFixed(2) : "—";

      const arrow =
        diff > 0
          ? `<span style="color:#16a34a;">🔼 +${pct}%</span>`
          : diff < 0
          ? `<span style="color:#dc2626;">🔽 ${pct}%</span>`
          : `<span style="color:#64748b;">—</span>`;

      analysis += `<div style="margin-bottom:6px;"><b>${years[i - 1]} → ${years[i]}:</b> ₹${curr.toLocaleString()} Cr ${arrow}</div>`;
    }
    setInsightHtml(analysis);
  }

  // department vs department for a ministry
  function handleCompareDepartments(ministry) {
    if (!ministry) {
      setInsightHtml("Select a ministry for department comparison.");
      return;
    }

    // use ministryDeptMap if available else derive departments
    let depts = ministryDeptMap[ministry];
    if (!Array.isArray(depts) || depts.length === 0) {
      const setDeps = new Set();
      allData.forEach((d) => {
        const minCandidate = (d.ministry || d.ministry_name || "").toString();
        if (!minCandidate) return;
        if (!minCandidate.toLowerCase().includes(ministry.toLowerCase())) return;
        const dept = d.department || d.department_name || "Directly under Ministry";
        setDeps.add(dept);
      });
      depts = Array.from(setDeps);
    }

    // compute totals per department
    const labels = [];
    const vals = [];
    depts.forEach((dep) => {
      const v = getDepartmentTotal(dep);
      labels.push(dep);
      vals.push(v);
    });

    renderChart(labels, vals, "doughnut", "₹ Allocation (Cr)");
    setInsightHtml(`<b>${ministry}</b> — Department-wise expenditure distribution.`);
  }

  // ------------------- UI event handlers -------------------
  function onCompareClick() {
    if (comparisonType === "ministry") {
      handleCompareMinistries(selectedMin1, selectedMin2);
    } else if (comparisonType === "year") {
      handleCompareYears(selectedMinForYear);
    } else if (comparisonType === "department") {
      handleCompareDepartments(selectedMinForDept);
    }
  }

  // ------------------- RENDER -------------------
  return (
    <div className="comparison-page">

      <main className="comparison-main">
        <h1>📊 Unified Comparison Dashboard</h1>
        <p>Select the type of comparison you want to explore.</p>

        <div className="selector-section">
          <select
            id="comparisonType"
            value={comparisonType}
            onChange={(e) => {
              setComparisonType(e.target.value);
              // reset insights and chart
              setInsightHtml("Choose your options and click Compare.");
              destroyChart();
            }}
          >
            <option value="ministry">🏛️ Ministry vs Ministry</option>
            <option value="year">📅 Year vs Year (Same Ministry)</option>
            <option value="department">🏢 Department vs Department (Within a Ministry)</option>
          </select>
        </div>

        <div className="control-area">
          {comparisonType === "ministry" && (
            <div className="compare-box">
              <select
                value={selectedMin1}
                onChange={(e) => setSelectedMin1(e.target.value)}
              >
                <option value="">Select Ministry 1</option>
                {ministriesList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedMin2}
                onChange={(e) => setSelectedMin2(e.target.value)}
              >
                <option value="">Select Ministry 2</option>
                {ministriesList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <button onClick={onCompareClick}>Compare</button>
            </div>
          )}

          {comparisonType === "year" && (
            <div className="compare-box">
              <select
                value={selectedMinForYear}
                onChange={(e) => setSelectedMinForYear(e.target.value)}
              >
                <option value="">Select Ministry</option>
                {ministriesList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="2023">2023</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
              </select>

              <button onClick={onCompareClick}>Show Trend</button>
            </div>
          )}

          {comparisonType === "department" && (
            <div className="compare-box">
              <select
                value={selectedMinForDept}
                onChange={(e) => setSelectedMinForDept(e.target.value)}
              >
                <option value="">Select Ministry</option>
                {ministriesList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <button onClick={onCompareClick}>Compare Departments</button>
            </div>
          )}
        </div>

        <div className="chart-container">
          {isLoading ? (
            <div style={{ padding: 40 }}>Loading data...</div>
          ) : (
            <canvas id="comparisonChart" ref={canvasRef} />
          )}
        </div>

        <div id="insightBox" className="insight-box" dangerouslySetInnerHTML={{ __html: insightHtml }} />
      </main>
    </div>
  );
}
