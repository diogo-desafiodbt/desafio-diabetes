import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { FormPage } from "./pages/FormPage";
import { FunilDetailPage } from "./pages/FunilDetailPage";
import { LoginPage } from "./pages/LoginPage";

function PrivateRoute({ children }) {
  const raw = sessionStorage.getItem("dd_user");
  if (!raw) return <Navigate to="/login" replace />;
  try {
    JSON.parse(raw);
  } catch {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route element={<Layout />}>
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/funil/:slug"
          element={
            <PrivateRoute>
              <FunilDetailPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/form/:slug"
          element={
            <PrivateRoute>
              <FormPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
