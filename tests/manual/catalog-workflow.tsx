import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CatalogWorkflow } from "../../src/features/eventmanagment/screens/CatalogWorkflow";
import type { CateringPackage } from "../../src/features/eventmanagment/screens/PackagesScreen";
import type { CatalogItem } from "../../src/features/eventmanagment/screens/CatalogCollection";
import "../../src/styles/global.css";
import "../../src/styles/design-system.css";
import "../../src/features/eventmanagment/screens/package-catalog.css";
const items = [
  {id:"tibs",name:"Mutton tibs",code:"TIBS",itemType:"Food",isActive:true,recipeId:"recipe",inventoryItemId:null,consumptionLocationId:"kitchen",estimatedUnitCost:220,sellingPrice:400},
  {id:"wot",name:"Siga wot",code:"WOT",itemType:"Food",isActive:true,recipeId:null,inventoryItemId:null,consumptionLocationId:null,estimatedUnitCost:0,sellingPrice:0},
] as CatalogItem[];
function packageRow(id: string, name: string, overrides: Partial<CateringPackage> = {}): CateringPackage {
  return {id,name,packageNo:`MENU-${id}`,branchId:"demo",description:null,pricePerPerson:400,minimumGuests:20,maximumGuests:300,isActive:true,catalogVersion:3,approvedVersion:3,isApproved:true,sections:[],
    offering:{pricingSource:"MenuItems",category:"Lunch",serviceTier:"Gold",pricingMode:"PerPerson",fixedPrice:0,taxPercent:15,serviceChargePercent:0,approvedMarginPercent:30,effectiveDate:null,expiryDate:null,companyWide:false,archived:false,imageUrl:null,customerDescription:null,inclusions:null,exclusions:null,terms:null,notes:null,
      sections:[{name:"Main courses",rule:"All",selectCount:1,substitutionRequiresApproval:false,items:[{itemId:"tibs",quantity:1,perGuest:true,additionalCharge:0}]}]},...overrides};
}
const rows=[packageRow("01","Corporate lunch",{offering:null}),packageRow("02","Family celebration"),packageRow("03","Gold wedding menu",{isApproved:false}),packageRow("04","Weekend buffet",{isActive:false}),packageRow("05","Executive lunch")];
rows[1].offering!.sections[0].items[0].itemId="wot";
function Preview(){const [guests,setGuests]=useState(100),[action,setAction]=useState("Preview only — sample data, no live changes");return <main className="pk-workspace"><p role="status">{action}</p><CatalogWorkflow rows={rows} items={items} loading={false} busy={false} manage approve branchId="demo" guests={guests} setGuests={setGuests} onNew={kind=>setAction(`Create ${kind}`)} onEdit={id=>setAction(`Edit ${id}`)} onItem={item=>setAction(`Edit item ${item.name}`)} onAction={(row,action)=>setAction(`Preview action (not saved): ${action}: ${row.name}`)} onBrowseItems={()=>setAction("Browse menu items")} onRefresh={()=>setAction("Refreshed preview")}/></main>}
createRoot(document.getElementById("root")!).render(<Preview/>);
