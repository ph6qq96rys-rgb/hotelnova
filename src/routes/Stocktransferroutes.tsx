import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import StockTransferCreatePage   from '../features/inventory/stock-transfers/pages/StockTransferCreatePage';
import StockTransfersPage         from '../features/inventory/stock-transfers/pages/StockTransfersPage';
import StockTransferApprovalsPage from '../features/inventory/stock-transfers/pages/StockTransferApprovalsPage';
import StockTransferEditPage      from '../features/inventory/stock-transfers/pages/StockTransferEditPage';
import StockTransferDetailPage    from '../features/inventory/stock-transfers/pages/StockTransferDetailPage';

export type AppRoute = RouteObject & {
  path?:        string;
  label?:       string;
  element?:     ReactNode;
  icon?:        ReactNode;
  nav?:         boolean;
  section?:     string;
  roles?:       string[];
  permissions?: string[];
  menu?: {
    label:       string;
    icon?:       ReactNode;
    permission?: string;
    section?:    string;
  };
};

// Plain function — not a hook. Renamed from useStockTransferRoutes to avoid
// the 'use' prefix convention that implies React hook rules apply.
//
// Static routes (/new, /approvals) are listed before the dynamic /:id segment
// so React Router doesn't match "new" or "approvals" as an :id param value.
export function stockTransferRoutes(): AppRoute[] {
  return [
    {
      path:        '/inventory/stock-transfers',
      label:       'Stock Transfers',
      element:     <StockTransfersPage />,
      icon:        <ArrowLeftRight size={18} />,
      nav:         true,
      section:     'Inventory',
      permissions: ['inventory.view'],
    },
    {
      path:    '/inventory/stock-transfers/new',
      element: <StockTransferCreatePage />,
      nav:     false,
    },
    {
      path:        '/inventory/stock-transfers/approvals',
      label:       'Transfer Approvals',
      element:     <StockTransferApprovalsPage />,
      nav:         false,
      permissions: ['inventory.view'],
    },
    {
      path:    '/inventory/stock-transfers/:id',
      element: <StockTransferDetailPage />,
      nav:     false,
    },
    {
      path:    '/inventory/stock-transfers/:id/edit',
      element: <StockTransferEditPage />,
      nav:     false,
    },
  ];
}