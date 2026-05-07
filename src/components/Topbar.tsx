import { useAuth } from "../auth/AuthProvider";
import "../styles/Topbar.css";

type Props = {
  onOpenSidebar: () => void;
  title?: string;
  subtitle?: string;
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="hna-ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      {children}
    </svg>
  );
}

function BellIcon() {
  return (
    <Icon>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Icon>
  );
}

function MenuIcon() {
  return (
    <Icon>
      <path d="M3 12h18" />
      <path d="M3 6h18" />
      <path d="M3 18h18" />
    </Icon>
  );
}

function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </Icon>
  );
}

export default function Topbar({
  onOpenSidebar,
  title = "Dashboard",
  subtitle = "Overview & quick actions",
}: Props) {
  const { user, logout } = useAuth();

  const displayName = user?.fullName || user?.email || "Admin";
  const email = user?.email || "";

  return (
    <header className="hna-topbar">
      <div className="hna-top-left">
        <button
          type="button"
          className="hna-btn ghost hna-mobile-btn"
          onClick={onOpenSidebar}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>

        <div className="hna-title">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="hna-search">
        <SearchIcon />
        <input placeholder="Search users, roles, permissions..." />
      </div>

      <div className="hna-actions">
        <button type="button" className="hna-btn" title="Notifications">
          <BellIcon />
        </button>

        <div className="hna-pill">
          <div className="hna-avatar" />

          <div className="hna-user-meta">
            <strong>{displayName}</strong>
            <span>{email}</span>
          </div>
        </div>

        <button type="button" className="hna-btn" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
}