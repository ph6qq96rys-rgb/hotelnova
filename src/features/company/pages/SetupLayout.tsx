import { Outlet, useLocation, useParams } from "react-router-dom";

export default function SetupLayout() {
  const loc = useLocation();
  const { companyId, branchId } = useParams();

  return (
    <div style={{ padding: 16 }}>
      <div style={{ padding: 10, border: "1px dashed #999", borderRadius: 10 }}>
        <b>SetupLayout rendered</b>
        <div>Path: {loc.pathname}</div>
        <div>companyId: {companyId}</div>
        <div>branchId: {branchId}</div>
      </div>

      {/* ALWAYS render Outlet (no early returns) */}
      <div style={{ marginTop: 12 }}>
        <Outlet />
      </div>
    </div>
  );
}
