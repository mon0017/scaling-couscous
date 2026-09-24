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
 const payload=JSON.stringify(ready.map(r=>({...r,principal:r.amountCents-r.interestCents,receipt:'RC-'+crypto.randomUUID(),noticeId:crypto.randomUUID()})));
 // Four set-based statements keep a 100-row batch within the free-tier query budget.
 // A failed revision/ownership guard violates NOT NULL and rolls back the whole transaction.
 const statements=[
  d.prepare("INSERT INTO payroll_imports (id,filename,recorded_by,created_at,row_count,total,skipped) SELECT ?,?,?,?,CASE WHEN (SELECT count(*) FROM json_each(?) r JOIN loans l ON l.id=json_extract(r.value,'$.loanId') JOIN members m ON m.id=l.member_id WHERE l.status='active' AND l.repayment_method<>'self_pay' AND l.repayment_revision=json_extract(r.value,'$.revision') AND lower(trim(m.email))=json_extract(r.value,'$.email'))=? THEN ? ELSE NULL END,?,?").bind(id,filename,u.id,now,payload,ready.length,ready.length,total,skipped),
  d.prepare("WITH deductions AS (SELECT value FROM json_each(?)) UPDATE loans SET paid=paid+(SELECT json_extract(value,'$.principal') FROM deductions WHERE json_extract(value,'$.loanId')=loans.id),repayment_revision=repayment_revision+1,status=CASE WHEN (SELECT json_extract(value,'$.remaining') FROM deductions WHERE json_extract(value,'$.loanId')=loans.id)=0 THEN 'completed' ELSE 'active' END WHERE id IN (SELECT json_extract(value,'$.loanId') FROM deductions)").bind(payload),
  d.prepare("INSERT INTO payments (id,loan_id,amount,paid_at,reference,recorded_by,interest_amount,source,import_id,recorded_at) SELECT json_extract(value,'$.receipt'),json_extract(value,'$.loanId'),json_extract(value,'$.amountCents'),json_extract(value,'$.date'),json_extract(value,'$.reference'),?,json_extract(value,'$.interestCents'),'payroll',?,? FROM json_each(?)").bind(u.id,id,now,payload),
  d.prepare("INSERT INTO notifications (id,member_id,title,body,kind,read,created_at) SELECT json_extract(r.value,'$.noticeId'),l.member_id,'Salary deduction recorded',l.id || ': PHP ' || printf('%.2f',json_extract(r.value,'$.amountCents')/100.0) || ' received through payroll. Receipt ' || json_extract(r.value,'$.receipt') || '.','payment',0,? FROM json_each(?) r JOIN loans l ON l.id=json_extract(r.value,'$.loanId')").bind(now,payload)
 ];
 try{await d.batch(statements)}catch(e){console.error('Payroll batch rolled back',e);return json({error:'A loan or payment changed during import. No payments in this batch were recorded. Preview again before retrying.'},409)}
 return json({message:`Recorded ${ready.length} deductions; skipped ${skipped} already recorded.`,imported:ready.length,skipped,importId:id,rows:results});
}
