import { http } from "../../../api/http";
export type ApprovalStage={name:string;approverIds:string[];dueHours:number;escalationUserIds:string[]};
export type ProcurementRule={name:string;kind:string;branchId?:string;itemId?:string;category?:string;priority?:string;minimumAmount?:number;maximumAmount?:number;budgetStatus?:string;precedence:number;action:string;preventSelfApproval:boolean;stages:ApprovalStage[];lookbackDays:number;priceIncreasePercent?:number;costImpact?:number;thresholdMode:string;minimumQuotations:number;notifyUserIds:string[];allowedSupplierStatuses?:string[];requireSupplierItem?:boolean};
export type RuleVersion={id:string;policyId:string;revision:number;isActive:boolean;createdAtUtc:string;definition:ProcurementRule};
export type ApprovalRoute={id:string;version:string;status:string;currentStage:number;dueAtUtc:string;policy:ProcurementRule;userNames:Record<string,string>;canDecide:boolean;history:{id:string;stage:number;actorId:string;delegatedForId?:string;decision:string;reason:string;atUtc:string}[]};
const root=(company:string)=>`/companies/${company}/procurement`;
export const approvalsApi={
  rules:async(c:string)=>(await http.get<RuleVersion[]>(`${root(c)}/rules`)).data,
  users:async(c:string)=>(await http.get<{id:string;name:string}[]>(`${root(c)}/rules/users`)).data,
  save:async(c:string,definition:ProcurementRule,policyId?:string,expectedRevision=0)=>http.post(`${root(c)}/rules`,{definition,policyId,expectedRevision}),
  route:async(c:string,id:string)=>(await http.get<ApprovalRoute|null>(`${root(c)}/requisitions/${id}/approval-route`)).data||null,
  decide:async(c:string,id:string,version:string,decision:string,reason:string)=>http.post(`${root(c)}/requisitions/${id}/approval-route/decide`,{version,decision,reason}),
  preview:async(c:string,facts:{branchId?:string;itemId?:string;category:string;priority:string;amount:number;budgetStatus:string})=>(await http.post<{policyId:string;revision:number;definition:ProcurementRule}[]>(`${root(c)}/rules/preview`,facts)).data,
};
