import {auditStatement} from './audit';
import {db,json,string,notice} from './server';
import {repaymentFields,repaymentBalance,policies,nextDay,today,validDate,waivers} from './repayment';
import type {Loan,Payment} from './shared';

export async function waiveInterest(u:any,b:any){
 if(u.role!=='admin')return json({error:'Administrator access required.'},403);
 const d=db(),l=await d.prepare('SELECT * FROM loans WHERE id=?').bind(string(b.loanId)).first<Loan>();
 if(!l)return json({error:'Loan not found.'},404);
 if(l.status!=='active')throw Error('Only active loans can receive a late-interest waiver.');
 if(b.revision!==l.repayment_revision)return json({error:'Loan changed. Refresh before waiving interest.'},409);
 const value=Number(b.amount),amount=Math.round(value*100),reason=string(b.reason,5,500);
 if(!Number.isFinite(value)||!Number.isSafeInteger(amount)||amount<1||Math.abs(value*100-amount)>.00001)throw Error('Enter a positive amount with at most two decimal places.');
 const payments=(await d.prepare('SELECT * FROM payments WHERE loan_id=? ORDER BY paid_at').bind(l.id).all<Payment>()).results;
 const balance=repaymentBalance(l,payments),date=today();
 if(amount>balance.interestDue)throw Error('Waiver exceeds the unpaid late interest. Refresh the loan balance.');
 const record={id:crypto.randomUUID(),amount,date,reason,adminId:u.id,adminName:u.name||u.id,createdAt:new Date().toISOString()};
 const result=await d.batch([
  d.prepare("UPDATE loans SET late_waivers=?,repayment_revision=repayment_revision+1,status=? WHERE id=? AND repayment_revision=? AND status='active'").bind(JSON.stringify([...waivers(l),record]),balance.baseDue===0&&amount===balance.interestDue?'completed':'active',l.id,l.repayment_revision),
  d.prepare('INSERT INTO notifications (id,member_id,title,body,kind,read,created_at) SELECT ?,?,?,?,?,0,? WHERE changes()=1').bind(crypto.randomUUID(),l.member_id,'Late interest waived',`${l.id}: PHP ${(amount/100).toFixed(2)} waived. Reason: ${reason}. Future late-interest rates are unchanged.`,'loan',new Date().toISOString())
,
  auditStatement(d,u,'Late interest waived',l.id,{interestDue:balance.interestDue},{...record,interestDue:balance.interestDue-amount},true)
 ]);
 if(!result[0].meta.changes)return json({error:'Loan changed. Refresh before retrying.'},409);
 return json({message:'Late-interest waiver recorded. Future rate unchanged.'});
}

export async function saveRepayment(u:any,b:any){
 if(u.role!=='admin')return json({error:'Administrator access required.'},403);
 const d=db(),l=await d.prepare('SELECT * FROM loans WHERE id=?').bind(string(b.loanId)).first<Loan>();
 if(!l)return json({error:'Loan not found.'},404);
 if(!['pending','active'].includes(l.status))throw Error('Only pending or active loans can be updated.');
 if(b.revision!==l.repayment_revision)return json({error:'Loan settings changed. Refresh before saving.'},409);
 const {method,rateBps}=repaymentFields(b),history=policies(l);
 const effective=l.status==='pending'?'0001-01-01':nextDay(today());
 const next=history.filter(p=>p.effective!==effective);
 next.push({effective,rateBps});next.sort((a,b)=>a.effective.localeCompare(b.effective));
 const result=await d.batch([
  d.prepare('UPDATE loans SET repayment_method=?,late_policy=?,repayment_revision=repayment_revision+1 WHERE id=? AND repayment_revision=? AND status=?').bind(method,JSON.stringify(next),l.id,l.repayment_revision,l.status),
  d.prepare('INSERT INTO notifications (id,member_id,title,body,kind,read,created_at) SELECT ?,?,?,?,?,0,? WHERE changes()=1').bind(crypto.randomUUID(),l.member_id,'Repayment settings updated',`${l.id}: ${method==='self_pay'?'Member-paid':'Automatic deduction'}; monthly late interest ${rateBps/100}%, ${l.status==='pending'?'starting only after an installment is overdue':'effective '+effective}. Simple daily accrual on overdue installments, using a 30-day month.`,'loan',new Date().toISOString())
,
  auditStatement(d,u,'Repayment settings updated',l.id,{method:l.repayment_method,policy:policies(l)},{method,policy:next,effective},true)
 ]);
 if(!result[0].meta.changes)return json({error:'Loan changed. Refresh before saving.'},409);
 return json({message:'Repayment settings saved. '+(l.status==='active'?'The rate takes effect tomorrow.':'The rate applies after an installment becomes overdue.')});
}

export async function recordRepayment(u:any,b:any){
 if(u.role!=='admin')return json({error:'Administrator access required.'},403);
 const d=db(),id=string(b.loanId),reference=string(b.reference,1,100),value=Number(b.amount),amount=Math.round(value*100),date=string(b.date,10,10);
 if(!Number.isFinite(value)||!Number.isSafeInteger(amount)||amount<1||Math.abs(value*100-amount)>.00001)throw Error('Enter a positive payment with at most two decimal places.');
 if(!validDate(date)||date>today())throw Error('Enter a valid payment date that is not in the future.');
 const existing=await d.prepare('SELECT * FROM payments WHERE reference=?').bind(reference).first<any>();
 if(existing)return existing.loan_id===id&&existing.amount===amount&&existing.paid_at===date?json({message:'This payment was already recorded.'}):json({error:'That payment reference is already in use.'},409);
 const l=await d.prepare('SELECT * FROM loans WHERE id=?').bind(id).first<Loan>();
 if(!l)return json({error:'Loan not found.'},404);
 if(l.status!=='active')throw Error('Only active loans accept payments.');
 const history=(await d.prepare('SELECT * FROM payments WHERE loan_id=? ORDER BY paid_at').bind(id).all<Payment>()).results;
 if(date<l.created_at.slice(0,10)||history.some(p=>p.paid_at>date)||waivers(l).some(w=>w.date>date))throw Error('Payment date must be on or after the application date and the most recent recorded payment or waiver.');
 const balance=repaymentBalance(l,history,date);
 if(amount>balance.totalDue)throw Error('Payment exceeds the balance on the selected payment date.');
 // Pay contractual installments first, then late interest. Preserve both components.
 const baseAmount=Math.min(amount,balance.baseDue),interestAmount=amount-baseAmount;
 const paymentId='RC-'+crypto.randomUUID().slice(0,8).toUpperCase();
 const result=await d.batch([
  d.prepare("UPDATE loans SET paid=paid+?,status=?,repayment_revision=repayment_revision+1 WHERE id=? AND status='active' AND repayment_revision=? AND NOT EXISTS (SELECT 1 FROM payments WHERE reference=?)").bind(baseAmount,amount===balance.totalDue?'completed':'active',id,l.repayment_revision,reference),
  d.prepare('INSERT INTO payments (id,loan_id,amount,paid_at,reference,recorded_by,interest_amount,recorded_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1').bind(paymentId,id,amount,date,reference,u.id,interestAmount,new Date().toISOString()),
  d.prepare('INSERT INTO notifications (id,member_id,title,body,kind,read,created_at) SELECT ?,?,?,?,?,0,? WHERE changes()=1').bind(crypto.randomUUID(),l.member_id,'Payment received',`${paymentId}: PHP ${(amount/100).toFixed(2)} recorded, including PHP ${(interestAmount/100).toFixed(2)} late interest.`,'payment',new Date().toISOString())
,
  auditStatement(d,u,'Payment recorded',id,{paid:l.paid,status:l.status},{paymentId,amount,interestAmount,date,reference,paid:l.paid+baseAmount,status:amount===balance.totalDue?'completed':'active'},true)
 ]);
 if(!result[0].meta.changes)return json({error:'Balance or settings changed. Refresh before retrying.'},409);
 return json({message:'Payment recorded and receipt created.'});
}
