import "../styles/about.css";

export default function About() {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "calc(100vh - 72px)",
        overflowY: "auto",
        paddingTop: "40px",
        paddingBottom: "100px",
        boxSizing: "border-box"
      }}
    >
      <div className="about-page">

        <h1>Tax Transparency System (TTS)</h1>

        <p>
          The Tax Transparency System (TTS) is a citizen-centric fiscal
          intelligence platform designed to introduce a structured transparency
          layer above publicly available government finance data.
          It seeks to reduce the interpretational gap between taxation,
          budget allocation, and citizen understanding.
        </p>

        <h2>Policy Context</h2>
        <p>
          While Union Budget documents and fiscal reports are publicly released,
          their technical structure makes them difficult for the average citizen
          to meaningfully interpret. Taxation is mandatory and centralized,
          yet its integration into national expenditure frameworks remains abstract
          to most contributors. TTS addresses this structural disconnect by
          transforming static fiscal documentation into interactive,
          proportional models of public finance.
        </p>

        <h2>System Architecture</h2>
        <p>
          TTS is structured across four integrated layers:
        </p>
        <ul>
          <li>Allocation Modeling Engine – converts ministry-level expenditure data into structured visual frameworks</li>
          <li>Proportional Tax Simulation Module – models how tax components integrate into pooled revenue systems</li>
          <li>UTTI Conceptual Reference Layer – introduces a structured digital identifier for tax event simulation</li>
          <li>AI Explanation Interface – enables contextual interpretation of fiscal data through natural language queries</li>
        </ul>

        <h2>Introducing UTTI</h2>
        <p>
          The Universal Tax Trace Identifier (UTTI) is a conceptual framework
          proposed within TTS to simulate how structured referencing of tax events
          could enhance transparency. UTTI does not alter existing taxation systems
          and does not track individual tax payments. Instead, it demonstrates how
          tax events could be represented through traceable digital identifiers
          within a pooled public finance model.
        </p>

        <h2>Transparency Model</h2>
        <p>
          TTS operates strictly on proportional modeling principles.
          Individual tax contributions are pooled nationally, as per
          existing fiscal frameworks. The system simulates how tax components
          could be proportionally distributed across ministries and departments
          based on officially documented budget shares.
        </p>

        <h2>Data Integrity</h2>
        <p>
          All fiscal modeling within TTS is derived from publicly released
          Government of India budget documents and official expenditure data.
          The platform does not introduce speculative financial estimates.
          All allocation representations reflect documented proportional shares.
        </p>

        <h2>Institutional Scope</h2>
        <p>
          TTS is an independent analytical platform and conceptual policy prototype.
          It is not affiliated with any government institution.
          The system is designed to explore how digital infrastructure and AI-enabled
          interpretation layers can enhance fiscal transparency within democratic systems.
        </p>

      </div>
    </div>
  );
}