import type {Loan} from './shared';
export function approvalQueue(loans:Loan[],approvals:any[],assignments:{member_id:string;role_id:string}[],members:{id:string;name:string;email?:string}[],now=Date.now()){
 return loans.filter(l=>l.status==='pending').map(loan=>{
  const steps=approvals.filter(s=>s.loan_id===loan.id).sort((a,b)=>a.position-b.position);
  const current=steps.find(s=>s.status!=='approved');
  const previous=steps.filter(s=>s.status==='approved'&&(!current||s.position<current.position)).at(-1);
  const since=previous?.decided_at||loan.created_at;
  const elapsed=now-Date.parse(since),days=Number.isFinite(elapsed)?Math.max(0,Math.floor(elapsed/86400000)):null;
  const reviewers=current?.status==='pending'?members.filter(m=>m.id!==loan.member_id&&assignments.some(a=>a.role_id===current.role_id&&a.member_id===m.id)):[];
  const needsReviewer=!current||current.status!=='pending'||!reviewers.length;
  return{loan,current,steps:steps.length,since,days,reviewers,needsReviewer};
 }).sort((a,b)=>(b.days??-1)-(a.days??-1)||a.loan.id.localeCompare(b.loan.id));
}
