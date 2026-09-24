import {schedule,type Loan,type Payment} from './shared';
import {waivers,today} from './repayment';
export const manilaDate=(value=new Date().toISOString())=>/^\d{4}-\d{2}-\d{2}$/.test(value)?value:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function monthCollections(loans:Loan[],payments:Payment[],month:string,asOf=today()){
 const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10),cutoff=end<asOf?end:asOf;
 const rows=loans.filter(l=>['active','completed'].includes(l.status)&&l.start_date).flatMap(l=>{
  const history=payments.filter(p=>p.loan_id===l.id),legacy=Math.max(0,l.paid-history.reduce((s,p)=>s+p.amount-(p.interest_amount||0),0));
  const paid=legacy+history.filter(p=>p.paid_at<=cutoff).reduce((s,p)=>s+p.amount-(p.interest_amount||0),0);
  return schedule({...l,paid}).filter(s=>s.date.startsWith(month)).map(s=>({...s,loan:l,collected:s.amount-s.remaining}));
 });
 const received=payments.filter(p=>p.paid_at.startsWith(month)&&p.paid_at<=cutoff);
 return{rows,expected:rows.reduce((s,r)=>s+r.amount,0),collected:rows.reduce((s,r)=>s+r.collected,0),pending:rows.reduce((s,r)=>s+r.remaining,0),cash:received.reduce((s,p)=>s+p.amount,0),interest:received.reduce((s,p)=>s+(p.interest_amount||0),0),payroll:received.filter(p=>p.source==='payroll').reduce((s,p)=>s+p.amount,0),cutoff};
}
export function dailyActivities(loans:Loan[],payments:Payment[],approvals:any[],imports:any[],day:string){
 const events:{id:string;date:string;title:string;detail:string;loanId?:string;amount?:number}[]=[];
 for(const p of payments)events.push({id:p.id,date:p.recorded_at||p.paid_at,title:p.source==='payroll'?'Salary deduction recorded':'Payment recorded',detail:`${p.name} · ${p.loan_id} · payment date ${p.paid_at}${p.recorded_at?'':' · recording time unavailable'}`,loanId:p.loan_id,amount:p.amount});
 for(const l of loans){events.push({id:'application-'+l.id,date:l.created_at,title:'Loan application',detail:`${l.name} · ${l.type}`,loanId:l.id,amount:l.amount});for(const w of waivers(l))events.push({id:w.id,date:w.createdAt,title:'Late interest waived',detail:`${l.name} · ${w.adminName} · ${w.reason}`,loanId:l.id,amount:w.amount})}
 for(const a of approvals.filter(a=>a.decided_at))events.push({id:a.loan_id+'-'+a.position,date:a.decided_at,title:`Approval step ${a.status}`,detail:`${a.loan_id} · ${a.role_name} · ${a.reviewer_name||'Reviewer'}`,loanId:a.loan_id});
 for(const i of imports)events.push({id:i.id,date:i.created_at,title:'Payroll file imported',detail:`${i.filename} · ${i.row_count} deductions · ${i.recorded_by_name||'Administrator'}`,amount:i.total});
 return events.filter(e=>manilaDate(e.date)===day).sort((a,b)=>b.date.localeCompare(a.date));
}
