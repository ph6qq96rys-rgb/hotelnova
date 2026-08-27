import { useState } from "react";
import type { EmployeeOption, UserDto } from "../api/securityApi";
import { displayUser, employeeIdOf } from "../utils/userManagement.utils";

export function LinkEmployeeDialog({
  user,
  options,
  loading,
  busy,
  error,
  onSearch,
  onCancel,
  onSubmit,
}: {
  user: UserDto;
  options: EmployeeOption[];
  loading: boolean;
  busy: boolean;
  error?: string | null;
  onSearch: (value: string) => void;
  onCancel: () => void;
  onSubmit: (employeeId: string) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(employeeIdOf(user));

  return (
    <div className="lux-resetPw">
      <div className="lux-resetPw__title">Link user to employee</div>
      <div className="lux-resetPw__subtitle">User: <strong>{displayUser(user)}</strong></div>
      <label className="lux-label">
        Search employee
        <input
          className="lux-input"
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search by employee name or code..."
          disabled={busy}
        />
      </label>
      <label className="lux-label">
        Employee
        <select
          className="lux-input"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={busy || loading}
        >
          <option value="">{loading ? "Loading employees..." : "- Select employee -"}</option>
          {options.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.employeeCode ? `${employee.employeeCode} - ` : ""}
              {employee.fullName}
              {employee.departmentName ? ` - ${employee.departmentName}` : ""}
              {employee.branchName ? ` - ${employee.branchName}` : ""}
            </option>
          ))}
        </select>
      </label>
      {error && <div className="lux-alert lux-alert--danger">{error}</div>}
      <div className="lux-row">
        <button className="lux-btn" onClick={onCancel} disabled={busy} type="button">Cancel</button>
        <button
          className="lux-btn lux-btn--primary"
          onClick={() => void onSubmit(selectedId)}
          disabled={busy || !selectedId}
          type="button"
        >
          Link employee
        </button>
      </div>
      <div className="lux-hint">
        CompanyAdmin and SystemAdmin accounts are protected unless the action is performed by SystemAdmin.
      </div>
    </div>
  );
}
