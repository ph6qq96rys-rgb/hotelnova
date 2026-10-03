import type { LanguageCode } from "./i18n.types";

const uiPhrasesAm: Record<string, string> = {
  "Show on QR menu": "በQR ምናሌ ላይ አሳይ",
  "Items below 1 birr and Management (MGT) items are always hidden from the QR menu.": "ከ1 ብር በታች የሆኑ እና የማኔጅመንት (MGT) ምርቶች ሁልጊዜ ከQR ምናሌ ይደበቃሉ።",
  "Dashboard": "ዳሽቦርድ",
  "Hotel Nova workspace": "የሆቴል ኖቫ የስራ ቦታ",
  "Search...": "ፈልግ...",
  "Sign out": "ውጣ",
  "Refresh": "አድስ",
  "Save": "አስቀምጥ",
  "Save Draft": "ረቂቅ አስቀምጥ",
  "Save settings": "ቅንብሮችን አስቀምጥ",
  "Cancel": "ሰርዝ",
  "Clear": "አጽዳ",
  "Back": "ተመለስ",
  "Continue": "ቀጥል",
  "Next": "ቀጣይ",
  "Previous": "ቀዳሚ",
  "Submit": "አስገባ",
  "Submit Request": "ጥያቄ አስገባ",
  "Submit for Approval": "ለማጽደቅ አስገባ",
  "Approve": "አጽድቅ",
  "Reject": "ውድቅ አድርግ",
  "Return": "መልስ",
  "Return for correction": "ለማስተካከያ መልስ",
  "Post": "ፖስት አድርግ",
  "Reverse": "ቀልብስ",
  "Edit": "አርትዕ",
  "Delete": "ሰርዝ",
  "Remove": "አስወግድ",
  "Add": "ጨምር",
  "+ Add": "+ ጨምር",
  "+ Add line": "+ መስመር ጨምር",
  "+ Add item": "+ እቃ ጨምር",
  "Add item": "እቃ ጨምር",
  "Add Line": "መስመር ጨምር",
  "Add document": "ሰነድ ጨምር",
  "Open": "ክፈት",
  "Open Workspace": "የስራ ቦታ ክፈት",
  "View": "ተመልከት",
  "View only": "ለእይታ ብቻ",
  "Create": "ፍጠር",
  "Create Category": "ምድብ ፍጠር",
  "Update Category": "ምድብ አዘምን",
  "Create Batch": "ባች ፍጠር",
  "Apply Recipe": "ሬሲፒ ተግብር",
  "Save Inputs": "ግብዓቶችን አስቀምጥ",
  "Create Production Batch": "የምርት ባች ፍጠር",
  "Review & Submit": "ገምግም እና አስገባ",
  "Validate": "አረጋግጥ",
  "Generate link code": "የሊንክ ኮድ ፍጠር",
  "Choose File": "ፋይል ምረጥ",
  "No file chosen": "ፋይል አልተመረጠም",

  "Active company": "ንቁ ኩባንያ",
  "No company selected": "ኩባንያ አልተመረጠም",
  "No branch selected": "ቅርንጫፍ አልተመረጠም",
  "Select a company to load ERP modules.": "የERP ሞጁሎችን ለመጫን ኩባንያ ይምረጡ።",
  "Company Administrator - All branches": "የኩባንያ አስተዳዳሪ - ሁሉም ቅርንጫፎች",
  "All branches": "ሁሉም ቅርንጫፎች",
  "Branch": "ቅርንጫፍ",
  "Company": "ኩባንያ",
  "Department": "ዲፓርትመንት",
  "Position": "የስራ መደብ",
  "Status": "ሁኔታ",
  "Action": "እርምጃ",
  "Actions": "እርምጃዎች",
  "Name": "ስም",
  "Code": "ኮድ",
  "Description": "መግለጫ",
  "Notes": "ማስታወሻዎች",
  "Optional": "አማራጭ",
  "Required": "ያስፈልጋል",
  "Active": "ንቁ",
  "Inactive": "ንቁ ያልሆነ",
  "Draft": "ረቂቅ",
  "Submitted": "ቀርቧል",
  "Approved": "ጸድቋል",
  "Rejected": "ውድቅ ተደርጓል",
  "Returned": "ተመልሷል",
  "Posted": "ፖስት ተደርጓል",
  "Issued": "ወጥቷል",
  "Processed": "ተከናውኗል",
  "Pending": "በመጠባበቅ ላይ",
  "Ready": "ዝግጁ",
  "Blocked": "ታግዷል",
  "Missing": "ጎድሏል",
  "Configured": "ተዋቅሯል",
  "Enabled": "ነቅቷል",
  "Disabled": "ተሰናክሏል",
  "Complete": "ተጠናቋል",
  "Incomplete": "ያልተጠናቀቀ",
  "Recommended": "የሚመከር",

  "General": "አጠቃላይ",
  "Setup": "ማዋቀር",
  "Administration": "አስተዳደር",
  "Security": "ደህንነት",
  "Sales": "ሽያጭ",
  "Inventory": "ኢንቬንቶሪ",
  "Procurement": "ግዢ",
  "Production": "ምርት",
  "Finance": "ፋይናንስ",
  "Human Resources": "የሰው ሀብት",
  "Operations": "ኦፕሬሽን",
  "Reports": "ሪፖርቶች",
  "Settings": "ቅንብሮች",
  "Company Settings": "የኩባንያ ቅንብሮች",
  "Goods Receipts": "የእቃ መቀበያዎች",
  "Stock Issue Vouchers": "የእቃ ማውጫ ቫውቸሮች",
  "Purchase Requisitions": "የግዢ ጥያቄዎች",
  "Menu Categories": "የምናሌ ምድቦች",
  "Create Menu Item": "የምናሌ ንጥል ፍጠር",
  "Create New Menu": "አዲስ የምናሌ ንጥል ፍጠር",
  "Create New Menu Item": "አዲስ የምናሌ ንጥል ፍጠር",
  "Recipe Management": "የሬሲፒ አስተዳደር",
  "Production Batches": "የምርት ባችዎች",
  "Menu Engineering": "ምናሌ ኢንጂነሪንግ",
  "Menu Items": "የምናሌ እቃዎች",
  "Employees": "ሰራተኞች",
  "Payroll": "ደመወዝ",
  "Leave": "ፈቃድ",
  "Attendance": "መገኘት",
  "Users": "ተጠቃሚዎች",
  "Roles & Permissions": "ሚናዎች እና ፈቃዶች",
  "Organization": "ድርጅት",
  "Company Onboarding": "የኩባንያ መጀመሪያ ማዋቀር",
  "Branch Onboarding": "የቅርንጫፍ መጀመሪያ ማዋቀር",
  "Stock Transfers": "የእቃ ማዘዋወሪያዎች",
  "Adjustments": "ማስተካከያዎች",
  "Events": "ኢቨንቶች",
  "Event Management": "የኢቨንት አስተዳደር",
  "Fixed Assets": "ቋሚ ንብረቶች",

  "Sign in": "ግባ",
  "Email address": "የኢሜይል አድራሻ",
  "Password": "የይለፍ ቃል",
  "Forgot password?": "የይለፍ ቃል ረሱ?",
  "Remember me for 30 days": "ለ30 ቀናት አስታውሰኝ",
  "Invalid email, password, or workspace.": "ኢሜይል፣ የይለፍ ቃል ወይም የስራ ቦታ ትክክል አይደለም።",
  "Request failed with status code 502": "ጥያቄው አልተሳካም። የሰርቨር ስህተት 502።",
  "Request failed with status code 504": "ጥያቄው ጊዜው አልፏል። እባክዎ እንደገና ይሞክሩ።",
  "Something went wrong while processing your request. Please try again or contact your administrator.": "ጥያቄዎን በማስኬድ ላይ ስህተት ተፈጥሯል። እባክዎ እንደገና ይሞክሩ ወይም አስተዳዳሪዎን ያነጋግሩ።",
  "You do not have permission to perform this action.": "ይህን እርምጃ ለመፈጸም ፈቃድ የለዎትም።",
  "You do not have permission to view or change this area. Ask your Company Administrator to update your role or branch assignment.": "ይህን ክፍል ለማየት ወይም ለመቀየር ፈቃድ የለዎትም። ሚናዎን ወይም የቅርንጫፍ ምደባዎን እንዲያዘምን የኩባንያ አስተዳዳሪዎን ይጠይቁ።",
  "The requested record was not found. Refresh the page and try again.": "የተጠየቀው መዝገብ አልተገኘም። ገጹን አድሰው እንደገና ይሞክሩ።",
  "Some information is missing or invalid. Please review the form and try again.": "አንዳንድ መረጃ ጎድሏል ወይም ትክክል አይደለም። ቅጹን ይገምግሙና እንደገና ይሞክሩ።",
  "Please fix the following before submitting:": "ከማስገባትዎ በፊት የሚከተሉትን ያስተካክሉ፦",
  "Action required": "እርምጃ ያስፈልጋል",
  "Error": "ስህተት",
  "Saved": "ተቀምጧል",
  "Loading...": "በመጫን ላይ...",
  "Saving...": "በማስቀመጥ ላይ...",
  "No records found.": "መዝገቦች አልተገኙም።",
  "No data available.": "ውሂብ የለም።",

  "Tax": "ታክስ",
  "Fiscal defaults": "የፋይናንስ ነባሪዎች",
  "Document numbering": "የሰነድ ቁጥር አሰጣጥ",
  "Inventory workflow": "የኢንቬንቶሪ የስራ ፍሰት",
  "HR and attendance": "HR እና መገኘት",
  "Telegram": "ቴሌግራም",
  "Audit": "ኦዲት",
  "Base currency": "መሰረታዊ ምንዛሬ",
  "Default language": "ነባሪ ቋንቋ",
  "Fiscal year start month": "የበጀት ዓመት መጀመሪያ ወር",
  "Costing method": "የወጪ ስሌት ዘዴ",
  "Allow negative stock": "ኔጌቲቭ ስቶክ ፍቀድ",
  "Require SIV approval": "የSIV ማጽደቅ ያስፈልጋል",
  "Attendance enabled": "መገኘት ነቅቷል",
  "Overtime enabled": "ትርፍ ሰዓት ነቅቷል",
  "Telegram enabled": "ቴሌግራም ነቅቷል",

  "Employee Master": "የሰራተኛ መዝገብ",
  "Edit Employee Master": "የሰራተኛ መዝገብ አርትዕ",
  "New employee": "አዲስ ሰራተኛ",
  "General Information": "አጠቃላይ መረጃ",
  "First name": "ስም",
  "Father's name": "የአባት ስም",
  "Grandfather's name": "የአያት ስም",
  "Gender": "ፆታ",
  "Date of birth": "የትውልድ ቀን",
  "Phone number": "ስልክ ቁጥር",
  "Work email": "የስራ ኢሜይል",
  "Employment": "ቅጥር",
  "Statutory": "ሕጋዊ",
  "Workflow": "የስራ ፍሰት",
  "Identity": "መታወቂያ",
  "Assignment": "ምደባ",
  "Review": "ግምገማ",
  "Ready to save": "ለማስቀመጥ ዝግጁ",
  "Legal identity ready": "ሕጋዊ መታወቂያ ዝግጁ",
  "Organization ready": "ድርጅት ዝግጁ",
  "Payroll ready": "ደመወዝ ዝግጁ",
  "Operational Snapshot": "የኦፕሬሽን ማጠቃለያ",
  "Business Rules": "የንግድ ህጎች",
  "Missing Information": "የጎደለ መረጃ",
  "Recent Activity": "የቅርብ ጊዜ እንቅስቃሴ",
  "Manager": "አስተዳዳሪ",
  "No manager assigned": "አስተዳዳሪ አልተመደበም",
  "Documents": "ሰነዶች",
  "Document Register": "የሰነድ መዝገብ",
  "Document name": "የሰነድ ስም",
  "File": "ፋይል",
  "Expiry": "ጊዜ ማብቂያ",
  "Uploaded": "ተጭኗል",
  "Uploaded By": "የጫነው",
  "National ID": "ብሔራዊ መታወቂያ",
  "Employment Contract": "የቅጥር ውል",
  "Medical Certificate": "የሕክምና ማረጋገጫ",
  "Training Certificate": "የስልጠና ማረጋገጫ",
  "System Access": "የስርዓት መዳረሻ",
  "System User": "የስርዓት ተጠቃሚ",
  "ERP Role": "የERP ሚና",
  "POS Role": "የPOS ሚና",
  "Last Login": "የመጨረሻ መግቢያ",
  "Approval Limit": "የማጽደቅ ገደብ",

  "Attendance Command Center": "የመገኘት መቆጣጠሪያ ማዕከል",
  "Present": "ተገኝቷል",
  "Absent": "ቀርቷል",
  "Attendance Rate": "የመገኘት መጠን",
  "Overtime Hours": "የትርፍ ሰዓት ሰዓቶች",
  "Payroll Readiness": "የደመወዝ ዝግጁነት",
  "Manager Action Queue": "የአስተዳዳሪ እርምጃ ወረፋ",
  "Payroll Control": "የደመወዝ ቁጥጥር",
  "Compliance Watch": "የተገዢነት ክትትል",
  "Clock In": "መግቢያ ሰዓት",
  "Clock Out": "መውጫ ሰዓት",
  "Worked Hrs": "የተሰሩ ሰዓቶች",
  "Overtime": "ትርፍ ሰዓት",
  "Overtime Approval": "የትርፍ ሰዓት ማጽደቅ",
  "KPI / Output": "KPI / ውጤት",
  "Late (min)": "መዘግየት (ደቂቃ)",

  "Goods Receipt": "የእቃ መቀበያ",
  "New Goods Receipt": "አዲስ የእቃ መቀበያ",
  "Edit Goods Receipt": "የእቃ መቀበያ አርትዕ",
  "Post Receipt": "መቀበያ ፖስት አድርግ",
  "Document Total": "የሰነድ ጠቅላላ",
  "Receiving Location": "የመቀበያ ቦታ",
  "Received Date": "የተቀበለበት ቀን",
  "Supplier": "አቅራቢ",
  "Line Items": "የመስመር እቃዎች",
  "Item": "እቃ",
  "Qty": "ብዛት",
  "UOM": "መለኪያ",
  "Unit Cost": "የአንዱ ዋጋ",
  "Batch": "ባች",
  "Total": "ጠቅላላ",
  "No expiry": "ማብቂያ የለውም",

  "New Stock Issue Request": "አዲስ የእቃ ማውጫ ጥያቄ",
  "Requisition Details": "የጥያቄ ዝርዝሮች",
  "Request From Warehouse": "ከመጋዘን ጠይቅ",
  "Deliver To Location": "ወደ ቦታ አድርስ",
  "Required By Date": "የሚፈለግበት ቀን",
  "Purpose / Remarks": "ዓላማ / አስተያየት",
  "Requested Items": "የተጠየቁ እቃዎች",
  "Requested qty cannot exceed available warehouse stock.": "የተጠየቀው ብዛት ካለው የመጋዘን ስቶክ መብለጥ አይችልም።",
  "Select a warehouse and destination location above before adding items.": "እቃዎችን ከማከልዎ በፊት ከላይ መጋዘን እና መድረሻ ቦታ ይምረጡ።",
  "Select warehouse": "መጋዘን ይምረጡ",
  "Select destination": "መድረሻ ይምረጡ",
  "Issue SIV": "SIV አውጣ",
  "Confirm Issue": "ማውጣትን አረጋግጥ",
  "Issue notes": "የማውጫ ማስታወሻዎች",
  "Approved Qty": "የጸደቀ ብዛት",
  "Issued Qty": "የወጣ ብዛት",
  "Available": "ያለ",

  "Purchase Requisition": "የግዢ ጥያቄ",
  "New Purchase Requisition": "አዲስ የግዢ ጥያቄ",
  "Requested Lines": "የተጠየቁ መስመሮች",
  "Estimated requisition total": "የተገመተ የጥያቄ ጠቅላላ",
  "F&B Approval": "የF&B ማጽደቅ",
  "Finance Approval": "የፋይናንስ ማጽደቅ",

  "Menu Configuration": "የምናሌ ማዋቀር",
  "Edit Category": "ምድብ አርትዕ",
  "Configured Categories": "የተዋቀሩ ምድቦች",
  "Category Name": "የምድብ ስም",
  "Amharic Name": "የአማርኛ ስም",
  "Categories": "ምድቦች",
  "Default Consumption Location": "ነባሪ የፍጆታ ቦታ",
  "No default location": "ነባሪ ቦታ የለም",
  "Loading categories...": "ምድቦች በመጫን ላይ...",
  "No categories configured yet.": "እስካሁን የተዋቀሩ ምድቦች የሉም።",
  "Production output": "የምርት ውጤት",
  "Select a company and branch to continue.": "ለመቀጠል ኩባንያ እና ቅርንጫፍ ይምረጡ።",
  "Select a branch first.": "መጀመሪያ ቅርንጫፍ ይምረጡ።",
  "Company scope is required to continue.": "ለመቀጠል የኩባንያ ወሰን ያስፈልጋል።",
  "Category name is required.": "የምድብ ስም ያስፈልጋል።",
  "Menu category updated.": "የምናሌ ምድብ ተዘምኗል።",
  "Menu category created.": "የምናሌ ምድብ ተፈጥሯል።",
  "Failed to load menu categories.": "የምናሌ ምድቦችን መጫን አልተሳካም።",
  "Failed to save menu category.": "የምናሌ ምድብን ማስቀመጥ አልተሳካም።",
  "Configure category defaults such as Kitchen, Bar, Coffee Bar, or Bakery consumption locations. Menu items inherit these defaults unless individually overridden.": "እንደ ኪችን፣ ባር፣ ኮፊ ባር ወይም ቤከሪ ያሉ የፍጆታ ቦታ ነባሪዎችን ያዋቅሩ። የምናሌ ንጥሎች በተናጠል ካልተቀየሩ እነዚህን ነባሪዎች ይወርሳሉ።",
  "Assign the branch consumption location used for POS COGS.": "ለPOS COGS የሚጠቀመውን የቅርንጫፍ ፍጆታ ቦታ ይመድቡ።",
  "Category default locations are inherited by menu items and used by POS COGS posting.": "የምድብ ነባሪ ቦታዎች በምናሌ ንጥሎች ይወረሳሉ እና በPOS COGS ፖስቲንግ ይጠቀማሉ።",
  "ERP rule: configure branch-level consumption defaults at the category level first. Use item-level override only when a specific menu item consumes from a different branch stock location.": "የERP መመሪያ፦ መጀመሪያ የቅርንጫፍ የፍጆታ ነባሪዎችን በምድብ ደረጃ ያዋቅሩ። የንጥል ደረጃ ማሻሻያን የተወሰነ የምናሌ ንጥል ከተለየ የቅርንጫፍ ስቶክ ቦታ ሲፈጅ ብቻ ይጠቀሙ።",
  "Production Outputs": "የምርት ውጤቶች",
  "Recipe Editor": "ሬሲፒ አርታዒ",
  "Recipe Mode": "የሬሲፒ ሁነታ",
  "Direct Sale / Made-to-Order": "ቀጥታ ሽያጭ / በትዕዛዝ የሚዘጋጅ",
  "Production / Stocked Output": "ምርት / ወደ ስቶክ የሚገባ ውጤት",
  "Output - Stock received into inventory": "ውጤት - ወደ ኢንቬንቶሪ የሚገባ ስቶክ",
  "Inputs - Ingredients consumed from stock": "ግብዓቶች - ከስቶክ የሚፈጁ እቃዎች",
  "Finished / Semi-Finished Item": "የተጠናቀቀ / ከፊል የተጠናቀቀ እቃ",
  "Output UOM": "የውጤት መለኪያ",
  "Ingredient": "ግብዓት",
  "Ingredients": "ግብዓቶች",
  "Search ingredients...": "ግብዓቶችን ፈልግ...",
  "Select Menu Item": "የምናሌ እቃ ይምረጡ",
  "Menu Item": "የምናሌ እቃ",
  "Current": "አሁን ያለው",
  "Output": "ውጤት",
  "Input Lines / Auditable Consumption": "የግብዓት መስመሮች / ኦዲት የሚደረግ ፍጆታ",

  "Daily Operational Control Center": "የዕለታዊ ኦፕሬሽን መቆጣጠሪያ ማዕከል",
  "Opening Checklist": "የመክፈቻ ቼክሊስት",
  "Pre-shift Briefing": "የቅድመ-ሺፍት መግለጫ",
  "Operational Readiness": "የኦፕሬሽን ዝግጁነት",
  "Expected Covers": "የሚጠበቁ እንግዶች",
  "Expected Sales": "የሚጠበቅ ሽያጭ",
  "Critical Inventory": "ወሳኝ ኢንቬንቶሪ",
  "Open Issues": "ክፍት ጉዳዮች",

  "User Management": "የተጠቃሚ አስተዳደር",
  "Create User": "ተጠቃሚ ፍጠር",
  "Edit User": "ተጠቃሚ አርትዕ",
  "User account": "የተጠቃሚ መለያ",
  "Role": "ሚና",
  "Permission": "ፈቃድ",
  "Permissions": "ፈቃዶች",
  "Assign": "መድብ",
  "Assigned": "ተመድቧል",
  "Unassigned": "አልተመደበም",
  "Password policy": "የይለፍ ቃል ፖሊሲ",

  "Revenue & food cost": "ገቢ እና የምግብ ወጪ",
  "Today revenue": "የዛሬ ገቢ",
  "Gross profit": "ጠቅላላ ትርፍ",
  "Food cost": "የምግብ ወጪ",
  "Avg order": "አማካይ ትዕዛዝ",
  "Margin": "ማርጅን",
  "Live": "ቀጥታ"
};

const textOriginals = new WeakMap<Text, string>();
const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label", "aria-valuetext"] as const;
let observer: MutationObserver | null = null;
let scheduled = 0;
let activeLanguage: LanguageCode = "en";

function normalizePhrase(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function translatePhrase(value: string): string | null {
  const normalized = normalizePhrase(value);
  return uiPhrasesAm[normalized] ?? null;
}

function isSkippableElement(element: Element | null): boolean {
  if (!element) return true;
  return Boolean(
    element.closest("script, style, noscript, textarea, input, [contenteditable='true'], [data-no-translate], [data-business-data]")
  );
}

function translateTextNode(node: Text) {
  const parent = node.parentElement;
  if (isSkippableElement(parent)) return;

  const original = textOriginals.get(node) ?? node.nodeValue ?? "";
  const translated = translatePhrase(original);
  if (!translated) return;

  if (!textOriginals.has(node)) textOriginals.set(node, original);
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  node.nodeValue = `${leading}${translated}${trailing}`;
}

function restoreTextNodes(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const original = textOriginals.get(node);
    if (original !== undefined) {
      node.nodeValue = original;
      textOriginals.delete(node);
    }
    node = walker.nextNode() as Text | null;
  }
}

function translateElementAttributes(root: ParentNode) {
  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll("*"))] : Array.from(root.querySelectorAll("*"));

  for (const element of elements) {
    if (isSkippableElement(element)) continue;
    for (const attr of TRANSLATABLE_ATTRS) {
      const value = element.getAttribute(attr);
      if (!value) continue;

      const dataKey = `hnI18nOriginal${attr.replace(/(^|-)([a-z])/g, (_, _sep, letter: string) => letter.toUpperCase())}`;
      const original = (element as HTMLElement).dataset[dataKey] ?? value;
      const translated = translatePhrase(original);
      if (!translated) continue;

      (element as HTMLElement).dataset[dataKey] = original;
      element.setAttribute(attr, translated);
    }
  }
}

function restoreElementAttributes(root: ParentNode) {
  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll("*"))] : Array.from(root.querySelectorAll("*"));

  for (const element of elements) {
    for (const attr of TRANSLATABLE_ATTRS) {
      const dataKey = `hnI18nOriginal${attr.replace(/(^|-)([a-z])/g, (_, _sep, letter: string) => letter.toUpperCase())}`;
      const original = (element as HTMLElement).dataset[dataKey];
      if (!original) continue;
      element.setAttribute(attr, original);
      delete (element as HTMLElement).dataset[dataKey];
    }
  }
}

function translateTree(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    translateTextNode(node);
    node = walker.nextNode() as Text | null;
  }
  translateElementAttributes(root);
}

function scheduleTranslate() {
  window.clearTimeout(scheduled);
  scheduled = window.setTimeout(() => {
    if (activeLanguage === "am") translateTree(document.body);
  }, 40);
}

export function applyRuntimeUiLanguage(language: LanguageCode) {
  activeLanguage = language;

  if (observer) {
    observer.disconnect();
    observer = null;
  }

  if (language === "en") {
    restoreTextNodes(document.body);
    restoreElementAttributes(document.body);
    return;
  }

  translateTree(document.body);
  observer = new MutationObserver(scheduleTranslate);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRS],
  });
}
