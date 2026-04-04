import { Outlet } from "react-router-dom";

/** Layout mínimo: páginas trazem o próprio header com estilos inline. */
export function Layout() {
  return <Outlet />;
}
