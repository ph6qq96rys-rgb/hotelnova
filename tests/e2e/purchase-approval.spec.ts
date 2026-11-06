import { expect, test, type Page } from "@playwright/test";
import { seedWorkspaceAuth, TEST_COMPANY_ID } from "../fixtures/auth";

for (const status of [200, 400, 403]) {
  test(`approval rejection is visible and focused for HTTP ${status}`, async ({ page }) => {
    await setup(page);
    const error = "Segregation of duties violation. The same user cannot perform Request purchase requisition and Approve purchase requisition by F&B on the same transaction.";
    await page.route("**/fnb-approval", route => route.fulfill({
      status, contentType: "application/json", body: JSON.stringify({ success: false, error, docStatus: "draft" }),
    }));
    await page.getByRole("button", { name: "F&B approve", exact: true }).click();
    const alert = page.getByRole("alert").filter({ hasText: error });
    await expect(alert).toBeVisible();
    await expect(alert).toBeInViewport();
    await expect(alert).toBeFocused();
    await expect(page.getByRole("button", { name: "F&B approve", exact: true })).toBeEnabled();
  });
}

async function setup(page:Page, invalid=false){
  await seedWorkspaceAuth(page,["purchasing.view","purchasing.fnbapprove"],[]);
  const findings=[{code:invalid?"RequestDataInvalid":"NoConsumption",action:invalid?"Block":"Review",explanation:invalid?"Select a destination stock location.":"No recorded consumption history."},{code:"TransferAvailable",action:"Review",explanation:"Stock can be transferred."}];
  const doc={id:"pr-review",requisitionNo:"PR-REVIEW",status:"PendingFnbApproval",version:"v1",priority:"Normal",requiredByDateUtc:"2026-11-05T00:00:00Z",estimatedTotal:28000,businessJustification:"Catering",lines:[{id:"line1",lineNo:1,lineType:"InventoryItem",itemName:"Water",quantity:100,approvedQuantity:0,estimatedUnitPrice:280,estimatedLineTotal:28000,uomName:"PACK"}],decisions:[]};
  const analysis={id:"analysis1",requisitionVersion:"v1",analyzedAtUtc:"2026-11-04T19:47:00Z",status:"Current",isStale:false,requireReviewAtApproval:true,atFnbStage:true,assistantAvailable:false,snapshot:{request:{...doc,currency:"ETB",missingPrices:0,requester:"Storekeeper",branch:"4-KILLO",destination:"Main Warehouse"},recommendation:"ReviewRequired",summary:"Review required",lines:[{lines:"1",lineIds:["line1"],itemName:"Water",baseUnit:"PACK",requestUnit:"PACK",requestedQuantity:100,recommendation:"ReviewRequired",summary:"Review supply",findings,evidence:[],assumptions:[]}],requestFindings:[{code:"Unbudgeted",action:"Review",explanation:"Finance budget review required."}],areas:[],limitations:[],settings:{},calculationNote:""}};
  const approvals:Record<string,unknown>[]=[];
  await page.route("**/api/**",async route=>{
    const path=new URL(route.request().url()).pathname;
    let body:unknown=[];
    if(path.endsWith("/approval-route"))body=null;
    else if(path.endsWith("/copilot")||path.endsWith("/copilot/analyze"))body=analysis;
    else if(path.endsWith("/fnb-approval")){approvals.push(route.request().postDataJSON());body={success:true,id:doc.id};doc.status="PendingFinanceApproval";}
    else if(path.endsWith("/requisitions/pr-review"))body=doc;
    await route.fulfill({contentType:"application/json",body:JSON.stringify(body)});
  });
  await page.goto(`/companies/${TEST_COMPANY_ID}/procurement/requisitions/pr-review`);
  return approvals;
}

test("copilot findings are advice only: F&B approval is not held back",async({page})=>{
  const approvals=await setup(page);
  const approve=page.getByRole("button",{name:"F&B approve",exact:true});
  await expect(approve).toBeEnabled();
  await expect(page.getByText("Before F&B approval",{exact:true})).toHaveCount(0);
  await approve.click();
  await expect.poll(()=>approvals.length).toBe(1);
  expect(approvals[0]).toMatchObject({version:"v1",copilot:{analysisId:"analysis1",overrides:{}}});
});

test("an optional note on a finding is saved with the decision",async({page})=>{
  const approvals=await setup(page);
  await expect(page.getByPlaceholder("Optional: how you considered this finding").first()).toBeVisible();
  await page.getByPlaceholder("Optional: how you considered this finding").first().fill("Catering demand confirmed.");
  await page.getByRole("button",{name:"F&B approve",exact:true}).click();
  await expect.poll(()=>approvals.length).toBe(1);
  expect(approvals[0]).toMatchObject({copilot:{overrides:{"1:NoConsumption":"Catering demand confirmed."}}});
});

test("invalid request data still stops F&B approval",async({page})=>{
  const approvals=await setup(page,true);
  await expect(page.getByRole("button",{name:"F&B approve",exact:true})).toBeDisabled();
  expect(approvals).toHaveLength(0);
});
