import { useCallback, useEffect, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";

import { http } from "../../../../api/http";
import { Button } from "../../../../components/ui/button";
import { Checkbox } from "../../../../components/ui/checkbox";
import { StateMessage } from "../../../../components/ui/Feedback";
import { Input } from "../../../../components/ui/input";
import { useI18n } from "../../../../i18n";
import "./attendance-geofence.css";

type GeofenceDto = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  locationRequired: boolean;
  branchName: string;
};

type Notice = { tone: "info" | "success" | "error" | "loading"; text: string } | null;

const MIN_RADIUS = 25;
const MAX_RADIUS = 2000;

function apiMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string") {
    return (data as { message: string }).message;
  }
  return fallback;
}

/**
 * Where the branch is, so Telegram clock-in can check that the employee is actually there.
 * Standing at the branch and tapping "Use my current location" is the easiest way to set it.
 */
export default function AttendanceGeofencePanel({ companyId, branchId }: { companyId: string; branchId: string }) {
  const { tx } = useI18n();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("150");
  const [required, setRequired] = useState(false);
  const [saved, setSaved] = useState<GeofenceDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const url = `/companies/${companyId}/branches/${branchId}/attendance/geofence`;

  const apply = useCallback((dto: GeofenceDto) => {
    setSaved(dto);
    setLatitude(dto.latitude == null ? "" : String(dto.latitude));
    setLongitude(dto.longitude == null ? "" : String(dto.longitude));
    setRadius(String(dto.radiusMeters || 150));
    setRequired(dto.locationRequired);
  }, []);

  useEffect(() => {
    let alive = true;
    http
      .get<GeofenceDto>(url)
      .then(({ data }) => alive && apply(data))
      .catch((error) => alive && setNotice({ tone: "error", text: apiMessage(error, tx("Unable to load the branch location.")) }));
    return () => {
      alive = false;
    };
  }, [apply, tx, url]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setNotice({ tone: "error", text: tx("This browser cannot share its location.") });
      return;
    }
    setNotice({ tone: "loading", text: tx("Finding your location...") });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setNotice({
          tone: "info",
          text: tx("Location found (within {m} m). Save to use it.", { m: Math.round(position.coords.accuracy) }),
        });
      },
      () => setNotice({ tone: "error", text: tx("Location access was refused or unavailable.") }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function save() {
    const lat = latitude.trim() === "" ? null : Number(latitude);
    const lng = longitude.trim() === "" ? null : Number(longitude);
    const meters = Number(radius);

    if ((lat === null) !== (lng === null)) return setNotice({ tone: "error", text: tx("Enter both latitude and longitude, or neither.") });
    if ((lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))) {
      return setNotice({ tone: "error", text: tx("Latitude must be between -90 and 90 and longitude between -180 and 180.") });
    }
    if (!Number.isInteger(meters) || meters < MIN_RADIUS || meters > MAX_RADIUS) {
      return setNotice({ tone: "error", text: tx("The radius must be between {min} and {max} metres.", { min: MIN_RADIUS, max: MAX_RADIUS }) });
    }
    if (required && lat === null) return setNotice({ tone: "error", text: tx("Set the branch location before requiring it for clock-in.") });

    setBusy(true);
    try {
      const { data } = await http.put<GeofenceDto>(url, { latitude: lat, longitude: lng, radiusMeters: meters, locationRequired: required });
      apply(data);
      setNotice({ tone: "success", text: tx("Branch location saved.") });
    } catch (error) {
      setNotice({ tone: "error", text: apiMessage(error, tx("Unable to save the branch location.")) });
    } finally {
      setBusy(false);
    }
  }

  const hasPoint = latitude.trim() !== "" && longitude.trim() !== "";
  const mapLink = hasPoint
    ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=18/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`
    : null;

  return (
    <section className="att-geofence" aria-labelledby="att-geofence-title">
      <div className="att-geofence__head">
        <MapPin size={20} aria-hidden="true" />
        <div>
          <h2 id="att-geofence-title">{tx("Clock-in location")}</h2>
          <p>{tx("Telegram clock-in can require employees to be within this distance of the branch.")}</p>
        </div>
      </div>

      {notice ? <StateMessage tone={notice.tone}>{notice.text}</StateMessage> : null}

      <div className="att-geofence__grid">
        <label className="att-geofence__field">
          <span>{tx("Latitude")}</span>
          <Input inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="9.010793" disabled={busy} />
        </label>
        <label className="att-geofence__field">
          <span>{tx("Longitude")}</span>
          <Input inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="38.761252" disabled={busy} />
        </label>
        <label className="att-geofence__field">
          <span>{tx("Radius (metres)")}</span>
          <Input type="number" min={MIN_RADIUS} max={MAX_RADIUS} step={5} value={radius} onChange={(e) => setRadius(e.target.value)} disabled={busy} />
        </label>
      </div>

      <label className="att-geofence__toggle">
        <Checkbox checked={required} onChange={(e) => setRequired(e.target.checked)} disabled={busy} />
        <span>
          <strong>{tx("Require location for Telegram clock-in")}</strong>
          <small>{tx("Scans without a location, or farther than the radius, are refused and logged.")}</small>
        </span>
      </label>

      <div className="att-geofence__actions">
        <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={busy}>
          <LocateFixed size={16} aria-hidden="true" />
          {tx("Use my current location")}
        </Button>
        {mapLink ? (
          <a className="att-geofence__map" href={mapLink} target="_blank" rel="noreferrer">
            {tx("Check on map")}
          </a>
        ) : null}
        <Button type="button" onClick={() => void save()} disabled={busy}>
          {busy ? tx("Saving...") : tx("Save location")}
        </Button>
      </div>

      {saved && !saved.locationRequired ? (
        <p className="att-geofence__hint">{tx("Location is not required yet: Telegram scans are accepted from anywhere.")}</p>
      ) : null}
    </section>
  );
}
