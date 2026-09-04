import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { motion } from "motion/react";

import BackToTop from "@/components/layout/BackToTop";
import Header from "@/components/layout/Header";
import { DUR, EASE } from "@/ui/motion";
import AnalyticsPage from "@/pages/AnalyticsPage";
import AuditTrailPage from "@/pages/AuditTrailPage";
import ChaseListPage from "@/pages/ChaseListPage";
import CommandCenterPage from "@/pages/CommandCenterPage";
import FAQPage from "@/pages/FAQPage";
import HumanReviewPage from "@/pages/HumanReviewPage";
import InterestPage from "@/pages/InterestPage";
import LoginPage from "@/pages/LoginPage";
import SettingsPage from "@/pages/SettingsPage";

function useEmail() {
  return localStorage.getItem("duenorth_email");
}

function Shell() {
  const email = useEmail();
  const location = useLocation();
  const [ranAt, setRanAt] = useState(0);

  if (!email) return <Navigate to="/login" replace state={{ from: location }} />;

  const routeKey = location.pathname.split("/").slice(0, 3).join("/");

  return (
    <div className="min-h-screen bg-canvas">
      <Header email={email} />
      <main className="mx-auto max-w-[1400px] px-5 py-7 lg:px-7 lg:py-9">
        <motion.div
          key={routeKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.md, ease: EASE }}
        >
          <Routes location={location}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<CommandCenterPage onAgentRun={() => setRanAt(Date.now())} ranAt={ranAt} />} />
            <Route path="/dashboard/chase" element={<ChaseListPage onAgentRun={() => setRanAt(Date.now())} ranAt={ranAt} />} />
            <Route path="/dashboard/lift" element={<AnalyticsPage />} />
            <Route path="/human-review" element={<HumanReviewPage />} />
            <Route path="/interest" element={<InterestPage />} />
            <Route path="/audit" element={<AuditTrailPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </motion.div>
      </main>
      <BackToTop />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<Shell />} />
    </Routes>
  );
}
