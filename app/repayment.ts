import {schedule,type Loan,type Payment} from './shared';

export type LateWaiver={id:string;amount:number;date:string;reason:string;adminId:string;adminName:string;createdAt:string};
export const waivers=(loan:Loan):LateWaiver[]=>JSON.parse(loan.late_waivers||'[]');
export type LatePolicy={effective:string;rateBps:number};
export const today=()=>new Date().toISOString().slice(0,10);
const day=(date:string)=>Date.parse(date+'T00:00:00Z')/86400000;
export const nextDay=(date:string)=>new Date((day(date)+1)*86400000).toISOString().slice(0,10);
export function validDate(date:string){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(day(date))&&new Date(day(date)*86400000).toISOString().slice(0,10)===date}
export function repaymentFields(value:any){
 if(!['auto_deduct','self_pay'].includes(value.method))throw Error('Choose automatic deduction or member-paid.');
 if(value.monthlyRate===''||value.monthlyRate==null)throw Error('Enter the monthly late-interest percentage.');
 const rate=Number(value.monthlyRate),rateBps=Math.round(rate*100);
 if(!Number.isFinite(rate)||rate<0||rate>100||Math.abs(rate*100-rateBps)>.000001)throw Error('Enter a monthly percentage from 0 to 100 with at most two decimal places.');
 return {method:value.method as string,rateBps};
}
export function policies(loan:Loan):LatePolicy[]{return JSON.parse(loan.late_policy||'[]')}
export const repaymentLabel=(loan:Loan)=>loan.repayment_method==='self_pay'?'Member-paid':'Automatic deduction';
export const balanceDue=(loan:Loan)=>loan.balance_due??Math.max(0,loan.total-loan.paid);

// Simple interest on overdue installments only, using a 30-day monthly basis.
// Each day's opening balance accrues: a payment stops accrual from the next day.
// Historical rate boundaries and payments are retained; interest never compounds.
export function repaymentBalance(loan:Loan,payments:Payment[],asOf=today()){
 if(!validDate(asOf))throw Error('Invalid balance date.');
 const history=payments.filter(p=>p.loan_id===loan.id).sort((a,b)=>a.paid_at.localeCompare(b.paid_at));
 const effective=policies(loan).sort((a,b)=>a.effective.localeCompare(b.effective));
 const initialPaid=Math.max(0,loan.paid-history.reduce((sum,p)=>sum+p.amount-(p.interest_amount||0),0));
 const through=history.filter(p=>p.paid_at<=asOf);
 const basePaid=initialPaid+through.reduce((sum,p)=>sum+p.amount-(p.interest_amount||0),0);
 const interestPaid=through.reduce((sum,p)=>sum+(p.interest_amount||0),0);
 let weighted=0,preceding=0;
 for(const row of schedule(loan)){
  const from=day(row.date)+1,end=day(asOf)+1;
  if(from<end){
   const boundaries=[from,end,...effective.map(p=>day(p.effective)),...history.map(p=>day(p.paid_at)+1)].filter(n=>n>=from&&n<=end);
   const sorted=[...new Set(boundaries)].sort((a,b)=>a-b);
   for(let i=0;i<sorted.length-1;i++){
    const start=sorted[i],stop=sorted[i+1];
    const rate=[...effective].reverse().find(p=>day(p.effective)<=start)?.rateBps||0;
    const paidBefore=initialPaid+history.filter(p=>day(p.paid_at)<start).reduce((sum,p)=>sum+p.amount-(p.interest_amount||0),0);
    const unpaid=Math.max(0,row.amount-Math.max(0,paidBefore-preceding));
    weighted+=unpaid*rate*(stop-start);
   }
  }
  preceding+=row.amount;
 }
 const accrued=Math.round(weighted/300000),interestDue=Math.max(0,accrued-interestPaid-waivers(loan).filter(w=>w.date<=asOf).reduce((sum,w)=>sum+w.amount,0)),baseDue=Math.max(0,loan.total-basePaid);
 return {baseDue,interestDue,accrued,interestPaid,totalDue:baseDue+interestDue,asOf};
}
