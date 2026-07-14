import { Link } from "react-router-dom";
import "../styles/home.css";

export default function Home() {
  return (
    <div className="home-page">

      {/* HEADER */}
      <section className="home-header">
        <h1>Welcome to Tax Transparency System</h1>
        <p className="tagline">
          Explore India's national expenditure in a transparent and simple way.
        </p>
  
      </section>

      {/* MAIN CARDS */}
      <main className="home-card-container">
        <Link to="/allocation" className="home-card">
          <div className="icon">📊</div>
          <h2>Allocation</h2>
          <p>Explore how ministries allocate India’s budget.</p>
        </Link>

        <Link to="/chat" className="home-card">
          <div className="icon">💰</div>
          <h2>Tax Calculation</h2>
          <p>Estimate your tax contribution and distribution.</p>
        </Link>

        <Link to="/report" className="home-card">
          <div className="icon">📄</div>
          <h2>Official Reports</h2>
          <p>Access all Government of India budget documents.</p>
        </Link>

        <Link to="/comparison" className="home-card">
          <div className="icon">⚖️</div>
          <h2>Comparison</h2>
          <p>Compare allocations across years & ministries.</p>
        </Link>
      </main>
     
    </div>
  );
}
