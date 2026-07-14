import Navbar from "./Navbar";

export default function Layout({ children }) {
  return (
    <div className="app-wrapper">
      <Navbar />
      <main className="page-container">
        {children}
      </main>
    </div>
  );
}
