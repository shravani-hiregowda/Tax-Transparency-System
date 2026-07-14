import { Link } from "react-router-dom";
import "../styles/report.css";

export default function Reports() {
  return (
    <div className="report-page">

      <main className="report-main">

        <section className="report-header">
          <h1>Official Budget Reports</h1>
          <p>
            Access and verify official data from the Government of India for the Union Budget 2025–26.
          </p>
        </section>

        <section className="report-content">

          <div className="report-card">
            <h2>🔗 Union Budget Portal</h2>
            <p>The main Ministry of Finance website hosting all budget documents.</p>
            <a
              href="https://www.indiabudget.gov.in"
              className="btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit Official Budget Website
            </a>
          </div>

          <div className="report-card">
            <h2>📘 Expenditure Profile (Volume I)</h2>
            <p>Overview of government spending, sectoral trends and allocations.</p>
            <a
              href="https://www.indiabudget.gov.in/doc/eb/vol1.pdf"
              className="btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Expenditure Profile
            </a>
          </div>

          <div className="report-card">
            <h2>📊 Expenditure Budget (Volume II)</h2>
            <p>Detailed Demands for Grants for all ministries and departments.</p>
            <a
              href="https://www.indiabudget.gov.in/doc/eb/allsbe.pdf"
              className="btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Expenditure Budget
            </a>
          </div>

          <div className="report-card">
            <h2>📄 Receipt Budget</h2>
            <p>Shows revenue receipts, tax collections and borrowing structure.</p>
            <a
              href="https://www.indiabudget.gov.in/doc/rec/allrec.pdf"
              className="btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Receipt Budget
            </a>
          </div>

        </section>

      </main>

    </div>
  );
}
