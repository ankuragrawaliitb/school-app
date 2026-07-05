import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";

import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Classes from "@/pages/Classes";
import Students from "@/pages/Students";
import StudentDetail from "@/pages/StudentDetail";
import FeeComponents from "@/pages/FeeComponents";
import Discounts from "@/pages/Discounts";
import Invoices from "@/pages/Invoices";
import Receipts from "@/pages/Receipts";
import ReceiptPrint from "@/pages/ReceiptPrint";
import Users from "@/pages/Users";
import Permissions from "@/pages/Permissions";
import Settings from "@/pages/Settings";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null)
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500 num" data-testid="loading-splash">
        loading…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function LoginRedirect() {
  const { user } = useAuth();
  if (user === null) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRedirect />} />
            <Route path="/receipts/:id/print" element={<Protected><ReceiptPrint /></Protected>} />
            <Route
              path="/"
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="classes" element={<Classes />} />
              <Route path="students" element={<Students />} />
              <Route path="students/:id" element={<StudentDetail />} />
              <Route path="fee-components" element={<FeeComponents />} />
              <Route path="discounts" element={<Discounts />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="receipts" element={<Receipts />} />
              <Route path="users" element={<Users />} />
              <Route path="permissions" element={<Permissions />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </div>
  );
}

export default App;
