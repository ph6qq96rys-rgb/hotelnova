// src/modules/company/onboarding/state/onboarding.constants.ts

import { Building2, CircleDashed, MapPin, ShieldCheck, Store, Users } from "lucide-react";
import type {
  CompanySettingsDto,
  CreateBranchDto,
  CreateBranchUserFormValue,
  CreateCompanyDto,
} from "../../types/company.types";
import type { CostingMethod, StepDefinition, StoreType } from "./onboarding.types";

// ── Wizard step definitions ───────────────────────────────────────────────────

export const ONBOARDING_STEPS: StepDefinition[] = [
  {
    key:      "company",
    title:    "Company",
    subtitle: "Tenant identity and fiscal defaults",
    icon:     Building2,
    required: true,
  },
  {
    key:      "branch",
    title:    "Branch",
    subtitle: "Operational branch profile",
    icon:     MapPin,
    required: true,
  },
  {
    key:      "locations",
    title:    "Stock locations",
    subtitle: "Warehouse, kitchen, bar, WIP",
    icon:     CircleDashed,
    required: true,
  },
  {
    key:      "stores",
    title:    "Stores",
    subtitle: "POS / sales units and issue mapping",
    icon:     Store,
    required: false,
  },
  {
    key:      "users",
    title:    "Users",
    subtitle: "Branch admins and staff",
    icon:     Users,
    required: true,
  },
  {
    key:      "review",
    title:    "Review",
    subtitle: "Readiness checklist and activation",
    icon:     ShieldCheck,
    required: true,
  },
];

// ── Default form values ───────────────────────────────────────────────────────

// Cast required: CreateCompanyDto may have required fields (tinNumber, phone,
// etc.) that are intentionally empty at form initialisation time.
export const DEFAULT_COMPANY_FORM = {
  legalName:       "",
  tradeName:       null,
  tinNumber:       null,
  vatNumber:       null,
  phone:           null,
  email:           null,
  country:         "Ethiopia",
  city:            "Addis Ababa",
  addressLine:     null,
  defaultCurrency: "ETB",
  timezone:        "Africa/Addis_Ababa",
} as CreateCompanyDto;

/**
 * Default company settings applied when creating a new company.
 *
 * vatRate is stored as a decimal fraction (0.15 = 15%).
 * Display layers should multiply by 100 for the % UI field.
 */
export const DEFAULT_SETTINGS: CompanySettingsDto = {
  vatEnabled:           true,
  vatRate:              0.15,   // 15% — decimal fraction, NOT a percentage integer
  pricesIncludeVat:     false,
  fiscalYearStartMonth: 1,
  allowNegativeStock:   false,
  costingMethod:        "FIFO" as CostingMethod,
} as unknown as CompanySettingsDto;

export const DEFAULT_BRANCH_FORM: CreateBranchDto = {
  code:        "",
  name:        "",
  region:      null,
  city:        null,
  addressLine: null,
  isMain:      true,
};

export const DEFAULT_USER_FORM: CreateBranchUserFormValue = {
  userName:  "",
  email:     "",
  password:  "",
  firstName: "",
  lastName:  "",
  role:      "BranchAdmin",
};

// ── Lookup option lists ───────────────────────────────────────────────────────

export const LOCATION_TYPES: { value: string; label: string }[] = [
  { value: "Warehouse",  label: "Warehouse"  },
  { value: "Kitchen",    label: "Kitchen"    },
  { value: "Bar",        label: "Bar"        },
  { value: "Store",      label: "Store"      },
  { value: "Production", label: "Production" },
  { value: "WIP",        label: "WIP"        },
  { value: "Transit",    label: "Transit"    },
];

export const STORE_TYPES: StoreType[] = [
  "DineIn",
  "Takeaway",
  "Delivery",
  "Bar",
  "Retail",
];

export const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "ETB", label: "ETB — Ethiopian Birr"  },
  { value: "USD", label: "USD — US Dollar"       },
  { value: "EUR", label: "EUR — Euro"            },
  { value: "GBP", label: "GBP — British Pound"   },
  { value: "AED", label: "AED — UAE Dirham"      },
  { value: "KES", label: "KES — Kenyan Shilling" },
];

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Africa/Addis_Ababa",   label: "Africa/Addis Ababa (UTC+3)"    },
  { value: "Africa/Nairobi",       label: "Africa/Nairobi (UTC+3)"        },
  { value: "Africa/Lagos",         label: "Africa/Lagos (UTC+1)"          },
  { value: "Africa/Johannesburg",  label: "Africa/Johannesburg (UTC+2)"   },
  { value: "Europe/London",        label: "Europe/London (UTC+0/+1)"      },
  { value: "America/New_York",     label: "America/New_York (UTC-5/-4)"   },
  { value: "Asia/Dubai",           label: "Asia/Dubai (UTC+4)"            },
  { value: "Europe/Paris",         label: "Europe/Paris (UTC+1/+2)"       },
];

export const COSTING_OPTIONS: { value: string; label: string }[] = [
  { value: "FIFO",            label: "FIFO"             },
  { value: "WeightedAverage", label: "Weighted Average" },
];