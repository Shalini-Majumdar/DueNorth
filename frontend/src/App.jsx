import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import BackToTop from "./components/layout/BackToTop";
import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import AuditTrailPage from "./pages/AuditTrailPage";
import DashboardPage from "./pages/DashboardPage";
import FAQPage from "./pages/FAQPage";
import HumanReviewPage from "./pages/HumanReviewPage";
import InterestPage from "./pages/InterestPage";
import LoginPage from "./pages/LoginPage";

function useEmail() {
  return localStorage.getItem("duenorth_email");
}

function Shell({ children }) {
  const email = useEmail();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const location = useLocation();

  if (!email) return <Navigate to="/login" replace state={{ from: location }} />;

  return (
    <div className="min-h-screen bg-white">
      <Header email={email} onToggleSidebar={() => setSidebarOpen((o) => !o)} />
      <div className="mx-auto flex max-w-[1400px]">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onDataChanged={() => setRefreshKey((k) => k + 1)}
        />
        <main className="min-w-0 flex-1 p-4 sm:p-6" key={refreshKey}>
          {children}
        </main>
      </div>
      <BackToTop />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard/*" element={<Shell><DashboardPage /></Shell>} />
      <Route path="/interest" element={<Shell><InterestPage /></Shell>} />
      <Route path="/human-review" element={<Shell><HumanReviewPage /></Shell>} />
      <Route path="/audit" element={<Shell><AuditTrailPage /></Shell>} />
      <Route path="/faq" element={<Shell><FAQPage /></Shell>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
