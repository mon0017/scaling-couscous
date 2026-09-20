import {schedule,type Loan} from './shared';
import {balanceDue} from './repayment';
export type DirectoryMember={id:string;name:string;email:string;department?:string;phone?:string};
export function borrowerGroups(members:DirectoryMember[],loans:Loan[]){
 const groups=new Map(members.map(member=>[member.id,{...member,loans:[] as Loan[],balance:0,overdue:0,pending:0,active:0}]));
 for(const loan of loans){
  if(!groups.has(loan.member_id))groups.set(loan.member_id,{id:loan.member_id,name:loan.name||'Member',email:'',loans:[],balance:0,overdue:0,pending:0,active:0});
  const group=groups.get(loan.member_id)!;group.loans.push(loan);
  if(loan.status==='pending')group.pending++;
  if(loan.status==='active'){group.active++;group.balance+=balanceDue(loan);group.overdue+=schedule(loan).filter(row=>row.status==='Overdue').reduce((sum,row)=>sum+row.remaining,0)+(loan.late_interest_due||0)}
 }
 return [...groups.values()];
}
export function filterBorrowers(groups:ReturnType<typeof borrowerGroups>,query:string,status:string,sort:string){
 const q=query.trim().toLowerCase();
 return groups.filter(g=>(!q||[g.name,g.email,g.department,g.id,...g.loans.map(l=>l.id+' '+l.type)].join(' ').toLowerCase().includes(q))&&(status==='all'||status==='borrowers'&&g.loans.length>0||status==='active'&&g.active>0||status==='pending'&&g.pending>0||status==='overdue'&&g.overdue>0||status==='completed'&&g.loans.some(l=>l.status==='completed')||status==='none'&&!g.loans.length)).sort((a,b)=>sort==='balance'?b.balance-a.balance||a.name.localeCompare(b.name):sort==='overdue'?b.overdue-a.overdue||a.name.localeCompare(b.name):a.name.localeCompare(b.name));
}
