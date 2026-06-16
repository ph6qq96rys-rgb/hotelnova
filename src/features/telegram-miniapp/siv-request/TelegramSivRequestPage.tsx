// src/features/telegram-miniapp/siv-request/TelegramSivRequestPage.tsx

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

type AuthResult = {
  success: boolean;
  message: string;
  companyId?: string;
  userId?: string;
  branchId?: string;
  employeeName?: string;
};

type LocationDto = {
  id: string;
  name: string;
  branchId: string;
};

type CategoryDto = {
  categoryId: string;
  categoryName: string;
};

type ItemDto = {
  itemId: string;
  itemCode: string;
  itemName: string;
  barcode?: string;
  requestUomId?: string;
  requestUomCode?: string;
  requestUomName?: string;
  baseUomId?: string;
  baseUomCode?: string;
};

type SivLine = {
  itemId: string;
  itemName: string;
  quantity: number;
  requestUomCode?: string;
  requestUomName?: string;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        themeParams?: Record<string, string>;
        ready: () => void;
        expand: () => void;
        close: () => void;
      };
    };
  }
}

export default function TelegramSivRequestPage() {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData ?? "";
  const theme = tg?.themeParams ?? {};

  const [auth, setAuth] = useState<AuthResult | null>(null);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const [term, setTerm] = useState("");
  const [items, setItems] = useState<ItemDto[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemDto | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [lines, setLines] = useState<SivLine[]>([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const headers = useMemo(
    () => ({
      "X-Telegram-InitData": initData
    }),
    [initData]
  );

  const pageStyle: React.CSSProperties = {
    padding: 16,
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    background: theme.bg_color ?? "#ffffff",
    color: theme.text_color ?? "#111111",
    minHeight: "100vh",
    boxSizing: "border-box"
  };

  const cardStyle: React.CSSProperties = {
    padding: 12,
    marginBottom: 12,
    border: `1px solid ${theme.hint_color ?? "#dddddd"}`,
    borderRadius: 12,
    background: theme.secondary_bg_color ?? "#ffffff"
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 12,
    marginBottom: 12,
    borderRadius: 10,
    border: `1px solid ${theme.hint_color ?? "#dddddd"}`,
    background: theme.secondary_bg_color ?? "#ffffff",
    color: theme.text_color ?? "#111111",
    boxSizing: "border-box"
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "none",
    background: theme.button_color ?? "#2481cc",
    color: theme.button_text_color ?? "#ffffff",
    marginBottom: 8,
    fontWeight: 600
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: theme.secondary_bg_color ?? "#f2f2f2",
    color: theme.text_color ?? "#111111",
    border: `1px solid ${theme.hint_color ?? "#dddddd"}`
  };

  const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: "#b00020"
  };

  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, [tg]);

  useEffect(() => {
    async function boot() {
      try {
        setLoading(true);
        setMessage("");

        const authRes = await axios.post<AuthResult>(
          "/api/telegram/miniapp/auth",
          { initData }
        );

        setAuth(authRes.data);

        const [locRes, catRes] = await Promise.all([
          axios.get<LocationDto[]>("/api/telegram/miniapp/inventory/locations", {
            headers
          }),
          axios.get<CategoryDto[]>(
            "/api/telegram/miniapp/inventory/categories",
            { headers }
          )
        ]);

        setLocations(locRes.data);
        setCategories(catRes.data);

        if (locRes.data.length === 1) {
          setSelectedLocationId(locRes.data[0].id);
        }
      } catch {
        setMessage(
          "Unable to open Telegram Mini App. Please relink your Telegram account."
        );
      } finally {
        setLoading(false);
      }
    }

    if (initData) {
      void boot();
    } else {
      setMessage("This page must be opened from Telegram.");
    }
  }, [initData, headers]);

  async function searchItems(value: string) {
    setTerm(value);
    setSelectedCategoryId("");
    setSelectedItem(null);
    setMessage("");

    if (!selectedLocationId) {
      setMessage("Please select request location first.");
      setItems([]);
      return;
    }

    if (value.trim().length < 2) {
      setItems([]);
      return;
    }

    try {
      const res = await axios.get<ItemDto[]>(
        "/api/telegram/miniapp/inventory/search",
        {
          headers,
          params: {
            term: value,
            stockLocationId: selectedLocationId
          }
        }
      );

      setItems(res.data);
    } catch {
      setMessage("Unable to search items.");
    }
  }

  async function loadCategoryItems(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setSelectedItem(null);
    setTerm("");
    setMessage("");

    if (!selectedLocationId) {
      setMessage("Please select request location first.");
      setItems([]);
      return;
    }

    if (!categoryId) {
      setItems([]);
      return;
    }

    try {
      const res = await axios.get<ItemDto[]>(
        `/api/telegram/miniapp/inventory/categories/${categoryId}/items`,
        { headers }
      );

      setItems(res.data);
    } catch {
      setMessage("Unable to load category items.");
    }
  }

  function handleLocationChange(locationId: string) {
    setSelectedLocationId(locationId);
    setSelectedCategoryId("");
    setSelectedItem(null);
    setTerm("");
    setItems([]);
    setLines([]);
    setMessage("");
  }

  function selectItem(item: ItemDto) {
    setSelectedItem(item);
    setTerm(item.itemName);
    setItems([]);
    setQty(1);
    setMessage("");
  }

  function addLine() {
    if (!selectedItem) {
      setMessage("Please select an item.");
      return;
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage("Quantity must be greater than zero.");
      return;
    }

    setLines(prev => {
      const existing = prev.find(x => x.itemId === selectedItem.itemId);

      if (existing) {
        return prev.map(x =>
          x.itemId === selectedItem.itemId
            ? { ...x, quantity: roundQty(x.quantity + qty) }
            : x
        );
      }

      return [
        ...prev,
        {
          itemId: selectedItem.itemId,
          itemName: selectedItem.itemName,
          quantity: roundQty(qty),
          requestUomCode: selectedItem.requestUomCode,
          requestUomName: selectedItem.requestUomName
        }
      ];
    });

    setSelectedItem(null);
    setTerm("");
    setItems([]);
    setQty(1);
    setMessage("");
  }

  function removeLine(itemId: string) {
    setLines(prev => prev.filter(x => x.itemId !== itemId));
  }

  async function submit() {
    if (!selectedLocationId) {
      setMessage("Please select request location.");
      return;
    }

    if (lines.length === 0) {
      setMessage("Please add at least one item.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const res = await axios.post(
        "/api/telegram/miniapp/siv-requests",
        {
          initData,
          requestingLocationId: selectedLocationId,
          lines: lines.map(x => ({
            itemId: x.itemId,
            quantity: x.quantity
          }))
        }
      );

      setMessage(res.data?.message ?? "SIV submitted successfully.");
      setLines([]);

      setTimeout(() => {
        tg?.close();
      }, 1200);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiMessage =
          typeof error.response?.data === "string"
            ? error.response.data
            : error.response?.data?.message;

        setMessage(apiMessage ?? "Unable to submit SIV request.");
      } else {
        setMessage("Unable to submit SIV request.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading && !auth) {
    return <div style={pageStyle}>Loading...</div>;
  }

  return (
    <div style={pageStyle}>
      <h2>📝 New Store Request</h2>

      {auth?.employeeName && (
        <p>
          Welcome, <strong>{auth.employeeName}</strong>
        </p>
      )}

      {message && <div style={cardStyle}>{message}</div>}

      <label>Request Location</label>
      <select
        value={selectedLocationId}
        onChange={e => handleLocationChange(e.target.value)}
        style={inputStyle}
      >
        <option value="">Select location</option>
        {locations.map(location => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>

      <label>Browse Category</label>
      <select
        value={selectedCategoryId}
        onChange={e => loadCategoryItems(e.target.value)}
        style={inputStyle}
      >
        <option value="">All categories</option>
        {categories.map(category => (
          <option key={category.categoryId} value={category.categoryId}>
            {category.categoryName}
          </option>
        ))}
      </select>

      <label>Search Item</label>
      <input
        value={term}
        onChange={e => searchItems(e.target.value)}
        placeholder="Type item name, e.g. rice"
        style={inputStyle}
      />

      {items.map(item => (
        <button
          key={item.itemId}
          onClick={() => selectItem(item)}
          style={secondaryButtonStyle}
          type="button"
        >
          {item.itemName}
          {item.requestUomCode ? ` (${item.requestUomCode})` : ""}
        </button>
      ))}

      {selectedItem && (
        <div style={cardStyle}>
          <strong>{selectedItem.itemName}</strong>

          {selectedItem.requestUomCode && (
            <div
              style={{
                color: theme.hint_color ?? "#888888",
                marginTop: 6,
                marginBottom: 10
              }}
            >
              Request Unit: <strong>{selectedItem.requestUomCode}</strong>
            </div>
          )}

          <label>
            Quantity
            {selectedItem.requestUomCode
              ? ` (${selectedItem.requestUomCode})`
              : ""}
          </label>

          <input
            type="number"
            value={qty}
            min={0.01}
            step={0.01}
            onChange={e => setQty(Number(e.target.value))}
            style={inputStyle}
          />

          <button onClick={addLine} style={buttonStyle} type="button">
            ➕ Add Item
          </button>
        </div>
      )}

      <h3>Items ({lines.length})</h3>

      {lines.length === 0 ? (
        <p>No items added.</p>
      ) : (
        lines.map(line => (
          <div key={line.itemId} style={cardStyle}>
            <strong>{line.itemName}</strong>
            <div>
              Qty:{" "}
              <strong>
                {line.quantity}
                {line.requestUomCode ? ` ${line.requestUomCode}` : ""}
              </strong>
            </div>

            <button
              onClick={() => removeLine(line.itemId)}
              style={dangerButtonStyle}
              type="button"
            >
              Remove
            </button>
          </div>
        ))
      )}

      <button
        onClick={submit}
        disabled={loading || lines.length === 0}
        style={{
          ...buttonStyle,
          opacity: loading || lines.length === 0 ? 0.6 : 1,
          marginTop: 12
        }}
        type="button"
      >
        {loading ? "Submitting..." : "✅ Submit Request"}
      </button>
    </div>
  );
}

function roundQty(value: number) {
  return Math.round(value * 1000) / 1000;
}