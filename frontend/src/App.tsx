import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Setup } from "@/pages/Setup";
import { Dashboard } from "@/pages/Dashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
