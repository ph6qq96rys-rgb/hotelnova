import { Button } from "../../../components/ui/button";
import { useI18n } from "../../../i18n";
import type { CopilotReviewState } from "./RequestApprovalCopilot";

export default function CopilotDecisionReview({review,comment}:{review?:CopilotReviewState|null;comment:string}){
  const {tx}=useI18n();
  if(!review?.required||review.ready)return null;
  const canApply=!!review.outstanding?.length&&!review.blockers.length;
  return <div className="prq-alert" role="status">
    <strong>{tx("Before F&B approval")}</strong>
    <p>{tx(review.reason??"Complete the approval copilot review before approving.")}</p>
    {!!review.outstanding?.length&&<ul>{review.outstanding.map(f=><li key={f.key}><strong>{f.label}</strong>: {f.explanation}</li>)}</ul>}
    {canApply&&<>
      <p>{tx("If your decision comment explains all findings listed above, apply it as their justification. You can also enter a separate justification for each finding in the copilot panel.")}</p>
      <Button type="button" variant="outline" disabled={!comment.trim()||comment.trim().length>500} onClick={()=>review.applyComment?.(comment)}>{tx("Use decision comment for these findings")}</Button>
      {comment.trim().length>500&&<p>{tx("Keep the shared justification within 500 characters, or enter separate justifications in the copilot panel.")}</p>}
    </>}
  </div>;
}
