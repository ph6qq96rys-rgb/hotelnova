// src/features/hr/pages/performance/KpiLibraryPage.tsx
// Company KPI library used to build goals consistently (unit, direction, measurement, default target).

import { useCallback, useEffect, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { EmptyState, StateMessage } from "../../../../components/ui/Feedback";
import { Input } from "../../../../components/ui/input";
import { Select } from "../../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { performanceWorkflowApi, resultError, type KpiDefinition, type KpiDefinitionInput } from "../../api/hrWorkflowApi";
import { getApiError } from "../../utils/hrUtils";

const blank: KpiDefinitionInput = {
  code: "", name: "", description: "", unit: "", direction: "HigherIsBetter", measurementMethod: "",
  defaultCategory: "Individual", defaultTarget: null, isActive: true,
};

const EXAMPLES = "Examples: sales per labour hour, food cost %, waste value, average ticket time, guest rating, punctuality.";

export default function KpiLibraryPage() {
  const { companyId } = useAppScope();
  const [rows, setRows] = useState<KpiDefinition[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; value: KpiDefinitionInput } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      setRows(await performanceWorkflowApi.kpis(companyId, true));
    } catch (e) {
      setError(getApiError(e, "Failed to load KPIs."));
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!companyId || !editing) return;
    setWorking(true);
    setError(null);
    try {
      const body = { ...editing.value, defaultTarget: editing.value.defaultTarget ?? null };
      const result = editing.id
        ? await performanceWorkflowApi.updateKpi(companyId, editing.id, body)
        : await performanceWorkflowApi.createKpi(companyId, body);
      const failed = resultError(result, "Save failed.");
      if (failed) { setError(failed); return; }
      setEditing(null);
      await load();
    } catch (e) {
      setError(getApiError(e, "Save failed."));
    } finally {
      setWorking(false);
    }
  };

  const set = <K extends keyof KpiDefinitionInput>(key: K, value: KpiDefinitionInput[K]) =>
    editing && setEditing({ ...editing, value: { ...editing.value, [key]: value } });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">HR | Performance</div>
          <div className="page-title">KPI Library</div>
          <div className="page-sub">Define each KPI once, then pick it when setting goals. {EXAMPLES}</div>
        </div>
        <Button onClick={() => setEditing({ id: null, value: blank })}>New KPI</Button>
      </div>

      {error && <div style={{ marginBottom: 12 }}><StateMessage tone="error">{error}</StateMessage></div>}

      {editing && (
        <Card style={{ marginBottom: 16 }}>
          <CardHeader><CardTitle>{editing.id ? "Edit KPI" : "New KPI"}</CardTitle></CardHeader>
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>Code<Input maxLength={40} value={editing.value.code} onChange={(e) => set("code", e.target.value)} /></label>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>Name<Input maxLength={160} value={editing.value.name} onChange={(e) => set("name", e.target.value)} /></label>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>Unit<Input maxLength={20} value={editing.value.unit ?? ""} onChange={(e) => set("unit", e.target.value)} /></label>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                Direction
                <Select value={editing.value.direction} onChange={(e) => set("direction", e.target.value as KpiDefinition["direction"])}>
                  <option value="HigherIsBetter">Higher is better</option>
                  <option value="LowerIsBetter">Lower is better</option>
                </Select>
              </label>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                Default category
                <Select value={editing.value.defaultCategory} onChange={(e) => set("defaultCategory", e.target.value as KpiDefinition["defaultCategory"])}>
                  {["Individual", "Team", "Department", "Company"].map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </label>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                Default target
                <Input type="number" value={editing.value.defaultTarget ?? ""} onChange={(e) => set("defaultTarget", e.target.value === "" ? null : Number(e.target.value))} />
              </label>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>How it is measured<Input maxLength={300} value={editing.value.measurementMethod ?? ""} onChange={(e) => set("measurementMethod", e.target.value)} /></label>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>Description<Input maxLength={500} value={editing.value.description ?? ""} onChange={(e) => set("description", e.target.value)} /></label>
              <label style={{ fontSize: 13, display: "grid", gap: 4 }}>
                Status
                <Select value={editing.value.isActive ? "active" : "inactive"} onChange={(e) => set("isActive", e.target.value === "active")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button onClick={save} disabled={working}>{working ? "Saving..." : "Save KPI"}</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Close</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          {rows.length === 0
            ? <EmptyState title="No KPIs yet" detail="Add the KPIs your managers use to set goals." />
            : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Measured by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell>{k.code}</TableCell>
                      <TableCell>{k.name}</TableCell>
                      <TableCell>{k.unit ?? "-"}</TableCell>
                      <TableCell>{k.direction === "LowerIsBetter" ? "Lower is better" : "Higher is better"}</TableCell>
                      <TableCell>{k.measurementMethod ?? "-"}</TableCell>
                      <TableCell>{k.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setEditing({ id: k.id, value: {
                          code: k.code, name: k.name, description: k.description ?? "", unit: k.unit ?? "", direction: k.direction,
                          measurementMethod: k.measurementMethod ?? "", defaultCategory: k.defaultCategory, defaultTarget: k.defaultTarget ?? null,
                          isActive: k.isActive,
                        } })}>Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
