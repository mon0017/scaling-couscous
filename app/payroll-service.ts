import {db,json,string} from './server';
import {validateDeductions,type DeductionRow} from './payroll';
import type {Loan,Payment} from './shared';
export async function importDeductions(u:any,b:any){
 if(u.role!=='admin')return json({error:'Administrator access required.'},403);
 if(!['preview','commit'].includes(b.mode))throw Error('Choose preview or commit.');
 const filename=string(b.filename,1,150),d=db();
 if(!Array.isArray(b.rows)||b.rows.length<1||b.rows.length>100)throw Error('Import 1–100 deductions at a time.');
 const [loans,members,payments]=await Promise.all([d.prepare('SELECT * FROM loans').all<Loan>(),d.prepare('SELECT id,email,name FROM members').all<any>(),d.prepare('SELECT * FROM payments').all<Payment>()]);
 const results=validateDeductions(b.rows as DeductionRow[],loans.results,members.results,payments.results);
 if(b.mode==='preview')return json({rows:results});
 if(b.confirmed!==true)throw Error('Review and confirm the deduction preview first.');
 if(results.some(r=>r.status==='error'))return json({error:'Some deductions are invalid. No payments were recorded. Review the file again.',rows:results},409);
 const ready=results.filter(r=>r.status==='ready'),skipped=results.length-ready.length;
 if(!ready.length)return json({message:'All deductions were already recorded. No new payments were added.',imported:0,skipped,rows:results});
 if(ready.some(r=>b.revisions?.[r.loanId]!==r.revision))return json({error:'A loan changed after preview. Preview the file again. No payments were recorded.'},409);
 const id='PAYROLL-'+crypto.randomUUID(),now=new Date().toISOString(),total=ready.reduce((s,r)=>s+r.amountCents,0);
 const statements=[d.prepare('INSERT INTO payroll_imports (id,filename,recorded_by,created_at,row_count,total,skipped) VALUES (?,?,?,?,?,?,?)').bind(id,filename,u.id,now,ready.length,total,skipped)];
 for(const r of ready){
  const receipt='RC-'+crypto.randomUUID();
  statements.push(d.prepare("UPDATE loans SET paid=paid+?,repayment_revision=repayment_revision+1,status=? WHERE id=? AND status='active' AND repayment_revision=? AND repayment_method<>'self_pay'").bind(r.amountCents-r.interestCents,r.remaining===0?'completed':'active',r.loanId,r.revision));
  // A failed compare-and-swap deliberately violates NOT NULL: D1 rolls back the entire batch.
  statements.push(d.prepare("INSERT INTO payments (id,loan_id,amount,paid_at,reference,recorded_by,interest_amount,source,import_id,recorded_at) VALUES (?,CASE WHEN changes()=1 THEN ? ELSE NULL END,?,?,?,?,?,'payroll',?,?)").bind(receipt,r.loanId,r.amountCents,r.date,r.reference,u.id,r.interestCents,id,now));
  const loan=loans.results.find(l=>l.id===r.loanId)!;
  statements.push(d.prepare('INSERT INTO notifications (id,member_id,title,body,kind,read,created_at) VALUES (?,?,?,?,?,0,?)').bind(crypto.randomUUID(),loan.member_id,'Salary deduction recorded',`${r.loanId}: PHP ${(r.amountCents/100).toFixed(2)} received through payroll. Receipt ${receipt}.`,'payment',now));
 }
 try{await d.batch(statements)}catch(e){console.error('Payroll batch rolled back',e);return json({error:'A loan or payment changed during import. No payments in this batch were recorded. Preview again before retrying.'},409)}
 return json({message:`Recorded ${ready.length} deductions; skipped ${skipped} already recorded.`,imported:ready.length,skipped,importId:id,rows:results});
}
