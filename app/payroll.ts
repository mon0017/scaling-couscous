import {repaymentBalance,today,validDate,waivers} from './repayment';
import type {Loan,Payment} from './shared';
export type DeductionRow={row:number;loanId:string;email:string;amount:string;date:string;reference:string};
export type DeductionResult=DeductionRow & {status:'ready'|'duplicate'|'error';message:string;name:string;amountCents:number;interestCents:number;revision:number;remaining:number};
export function validateDeductions(rows:DeductionRow[],loans:Loan[],members:{id:string;email:string;name:string}[],payments:Payment[]){
 if(!Array.isArray(rows)||!rows.length||rows.length>100)throw Error('Upload between 1 and 100 deductions. Split larger payroll files into batches.');
 const refs=new Map<string,number>(),ids=new Map<string,number>();
 for(const r of rows){refs.set(String(r.reference).trim(),(refs.get(String(r.reference).trim())||0)+1);ids.set(String(r.loanId).trim(),(ids.get(String(r.loanId).trim())||0)+1)}
 return rows.map((raw,index):DeductionResult=>{
  const r={row:index+2,loanId:String(raw.loanId||'').trim(),email:String(raw.email||'').trim().toLowerCase(),amount:String(raw.amount??'').trim(),date:String(raw.date||'').trim(),reference:String(raw.reference||'').trim()};
  const l=loans.find(l=>l.id===r.loanId),member=members.find(m=>m.id===l?.member_id);
  const result:DeductionResult={...r,name:member?.name||'',status:'error',message:'',amountCents:0,interestCents:0,revision:l?.repayment_revision||0,remaining:0};
  try{
   if(!l||!member)throw Error('Loan ID not found. Match using the exact loan ID.');
   if(r.email!==member.email.trim().toLowerCase())throw Error('Member email does not match this loan.');
   if(!/^\d+(\.\d{1,2})?$/.test(r.amount))throw Error('Amount must be a positive PHP number with at most two decimals.');
   const amount=Math.round(Number(r.amount)*100);if(!Number.isSafeInteger(amount)||amount<1||amount>100000000)throw Error('Invalid deduction amount.');result.amountCents=amount;
   if(!validDate(r.date)||r.date>today())throw Error('Use a valid payment date, YYYY-MM-DD, no later than today.');
   if(!r.reference||r.reference.length>100||/[\x00-\x1f]/.test(r.reference))throw Error('Provide a unique payroll reference of 1–100 characters.');
   if((refs.get(r.reference)||0)>1)throw Error('Duplicate reference within this file.');
   if((ids.get(r.loanId)||0)>1)throw Error('Use one deduction per loan in each file.');
   const previous=payments.find(p=>p.reference===r.reference);
   if(previous){if(previous.loan_id!==l.id||previous.amount!==amount||previous.paid_at!==r.date)throw Error('Reference already used for a different payment.');return{...result,status:'duplicate',message:'Already recorded — will be skipped.'}}
   if(l.status!=='active')throw Error('Only active loans accept deductions.');
   if(l.repayment_method==='self_pay')throw Error('This loan is member-paid. Change its collection method before importing payroll.');
   if(r.date<l.created_at.slice(0,10)||payments.some(p=>p.loan_id===l.id&&p.paid_at>r.date)||waivers(l).some(w=>w.date>r.date))throw Error('Date precedes the application, latest payment or waiver.');
   const balance=repaymentBalance(l,payments,r.date);if(amount>balance.totalDue)throw Error('Deduction exceeds the balance on this payment date.');
   return{...result,status:'ready',message:amount===balance.totalDue?'Loan will be fully paid.':'Payment will reduce the loan balance.',interestCents:Math.max(0,amount-balance.baseDue),remaining:balance.totalDue-amount};
  }catch(e:any){return{...result,message:e.message}}
 });
}
