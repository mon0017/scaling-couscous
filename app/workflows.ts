import {auditStatement} from './audit';
import {db,json,string,notice} from './server';
import {quote} from './shared';
import {validateOrganization,canReviewLoan,type Organization} from './organization';
import {memberFields} from './member-enrollment';

export async function saveMember(u:any,b:any){
 if(u.role!=='admin')return json({error:'Administrator access required.'},403);
 const d=db(),fields=memberFields(b),existing=b.memberId?await d.prepare('SELECT * FROM members WHERE id=?').bind(string(b.memberId)).first<any>():null;
 if(b.memberId&&!existing)return json({error:'Member not found.'},404);
 if(existing?.auth_id&&existing.email.trim().toLowerCase()!==fields.email)throw Error('The email is locked after first sign-in. This protects the member’s account.');
 const duplicate=await d.prepare('SELECT id FROM members WHERE lower(trim(email))=? AND id<>?').bind(fields.email,existing?.id||'').first();
 if(duplicate)return json({error:'This email is already enrolled. Find the member in the directory instead.'},409);
 if(existing){const result=await d.batch([d.prepare('UPDATE members SET name=?,email=?,phone=?,department=? WHERE id=? AND (auth_id IS NULL OR lower(trim(email))=?) AND name=? AND email=? AND phone=? AND department=?').bind(fields.name,fields.email,fields.phone,fields.department,existing.id,fields.email,existing.name,existing.email,existing.phone,existing.department),auditStatement(d,u,'Member updated',existing.id,{name:existing.name,email:existing.email,phone:existing.phone,department:existing.department},fields,true)]);if(!result[0].meta.changes)return json({error:'This member changed or signed in. Refresh before editing their details.'},409)}
 else {const memberId='member-'+crypto.randomUUID();await d.batch([d.prepare('INSERT INTO members (id,name,email,role,phone,department) VALUES (?,?,?,?,?,?)').bind(memberId,fields.name,fields.email,'member',fields.phone,fields.department),auditStatement(d,u,'Member enrolled',memberId,null,fields)]);}
 return json({message:existing?'Member details updated.':'Member enrolled. You can now assign roles. No invitation email has been sent.'});
}

export async function readOrganization():Promise<Organization>{
 const d=db();const [org,roles,assignments,types,routes]=await Promise.all([
 d.prepare('SELECT * FROM organization WHERE id=1').first<any>(),d.prepare('SELECT * FROM org_roles ORDER BY name').all<any>(),d.prepare('SELECT * FROM member_roles').all<any>(),d.prepare('SELECT * FROM loan_types ORDER BY name').all<any>(),d.prepare('SELECT * FROM approval_routes ORDER BY position').all<any>()]);
 return{...org,roles:roles.results,assignments:assignments.results,loanTypes:types.results.map(t=>({...t,steps:routes.results.filter(r=>r.type_id===t.id).map(r=>r.role_id)}))};
}
// A failed unique constraint aborts the complete D1 batch, including all writes.
function revisionGuard(revision:number){return db().prepare("INSERT INTO organization (id,name,revision) SELECT 1,'conflict',0 WHERE NOT EXISTS (SELECT 1 FROM organization WHERE id=1 AND revision=?)").bind(revision)}
export async function saveOrganization(u:any,b:any){
 if(u.role!=='admin')return json({error:'Administrator access required.'},403);
 const d=db(),old=await readOrganization();const members=await d.prepare('SELECT id FROM members').all<any>();const org=validateOrganization(b.organization,members.results.map(m=>m.id),old.roles.map(r=>r.id));
 if(org.revision!==old.revision)return json({error:'Organization changed. Refresh and reapply your edits.'},409);
 if(old.loanTypes.some(t=>!org.loanTypes.some(x=>x.id===t.id)))throw Error('Disable existing loan types instead of removing them.');
 const pending=(await d.prepare("SELECT a.role_id,l.member_id FROM loan_approvals a JOIN loans l ON l.id=a.loan_id WHERE a.status='pending' AND l.status='pending'").all<any>()).results;
 if(pending.some(p=>old.assignments.some(a=>a.role_id===p.role_id&&a.member_id!==p.member_id)&&!org.assignments.some(a=>a.role_id===p.role_id&&a.member_id!==p.member_id)))throw Error('Keep an eligible reviewer assigned to every role needed by a pending application.');
 const statements=[revisionGuard(org.revision)];
 for(const r of org.roles)statements.push(d.prepare('INSERT INTO org_roles (id,name) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').bind(r.id,r.name));
 for(const r of org.roles)statements.push(d.prepare('UPDATE org_roles SET parent_id=? WHERE id=?').bind(r.parent_id,r.id));
 statements.push(d.prepare('DELETE FROM member_roles'),d.prepare('DELETE FROM approval_routes'));
 for(const a of org.assignments)statements.push(d.prepare('INSERT INTO member_roles (member_id,role_id) VALUES (?,?)').bind(a.member_id,a.role_id));
 // Recheck inside the transaction: an application may arrive after the earlier
 // validation read but before this configuration batch acquires the database.
 statements.push(d.prepare("INSERT INTO organization (id,name,revision) SELECT 1,'missing reviewer',0 WHERE EXISTS (SELECT 1 FROM loan_approvals a JOIN loans l ON l.id=a.loan_id WHERE a.status='pending' AND l.status='pending' AND EXISTS (SELECT 1 FROM json_each(?) previous WHERE json_extract(previous.value,'$.role_id')=a.role_id AND json_extract(previous.value,'$.member_id')<>l.member_id) AND NOT EXISTS (SELECT 1 FROM member_roles mr WHERE mr.role_id=a.role_id AND mr.member_id<>l.member_id))").bind(JSON.stringify(old.assignments)));
 for(const t of org.loanTypes){statements.push(d.prepare('INSERT INTO loan_types (id,name,active) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active').bind(t.id,t.name,t.active));t.steps.forEach((r,i)=>statements.push(d.prepare('INSERT INTO approval_routes (type_id,position,role_id) VALUES (?,?,?)').bind(t.id,i+1,r)))}
 statements.push(d.prepare('UPDATE organization SET name=?,default_late_rate_bps=?,revision=revision+1 WHERE id=1').bind(org.name,org.default_late_rate_bps??300));statements.push(auditStatement(d,u,'Organization updated','organization',old,{...org,revision:org.revision+1}));await d.batch(statements);return json({message:'Organization and approval routes saved. Existing applications keep their original steps.'});
}
export async function applyForLoan(u:any,b:any){
 const d=db(),org=await readOrganization(),type=org.loanTypes.find(t=>t.id===b.typeId&&t.active);
 if(!type)throw Error('Choose an enabled loan type.');
 if(b.organizationRevision!==org.revision)return json({error:'Loan settings changed. Refresh and review the application again.'},409);
 if(!type.steps.length)throw Error('This loan type needs an approval workflow. Please contact your administrator.');
 // Every enrolled member may apply, even when their role is on the approval route.
 // The application stays pending until a different eligible reviewer can act.
 const q=quote(Number(b.amount),Number(b.term)),purpose=string(b.purpose,10,1000);
 if(!Array.isArray(b.documentIds)||b.documentIds.length>5||new Set(b.documentIds).size!==b.documentIds.length)throw Error('Attach up to five different documents.');
 for(const id of b.documentIds){if(typeof id!=='string'||!await d.prepare('SELECT id FROM documents WHERE id=? AND member_id=? AND NOT EXISTS (SELECT 1 FROM loan_documents WHERE document_id=documents.id)').bind(id,u.id).first())throw Error('An attachment is unavailable or already linked to another loan.');}
 const id='LN-'+crypto.randomUUID().slice(0,8).toUpperCase(),now=new Date().toISOString();
 const statements=[revisionGuard(org.revision),d.prepare('INSERT INTO loans (id,member_id,type,amount,term,rate,total,paid,status,purpose,created_at,start_date,late_policy) VALUES (?,?,?,?,?,6,?,0,?,?,?,?,?)').bind(id,u.id,type.name,q.principal,Number(b.term),q.total,'pending',purpose,now,'',JSON.stringify([{effective:'0001-01-01',rateBps:org.default_late_rate_bps??300}]))];
 type.steps.forEach((r,i)=>statements.push(d.prepare('INSERT INTO loan_approvals (loan_id,position,role_id,role_name) VALUES (?,?,?,?)').bind(id,i+1,r,org.roles.find(x=>x.id===r)!.name)));
 for(const documentId of b.documentIds)statements.push(d.prepare('INSERT INTO loan_documents (loan_id,document_id) VALUES (?,?)').bind(id,documentId));
 statements.push(notice(u.id,'Application received',`${id} is awaiting ${org.roles.find(r=>r.id===type.steps[0])!.name}.`));
 for(const a of org.assignments.filter(a=>a.role_id===type.steps[0]&&a.member_id!==u.id))statements.push(notice(a.member_id,'Application ready for review',`${id} is waiting for your role.`));
 statements.push(auditStatement(d,u,'Loan applied',id,null,{memberId:u.id,type:type.name,principal:q.principal,term:Number(b.term),total:q.total,documents:b.documentIds,approvalRoles:type.steps}));await d.batch(statements);return json({message:'Application and attachments submitted for review.',loanId:id});
}
export async function reviewLoan(u:any,b:any){
 const d=db(),id=string(b.loanId),reason=string(b.reason,5,1000);if(!['approve','reject'].includes(b.decision))throw Error('Choose approve or reject.');
 const loan=await d.prepare('SELECT * FROM loans WHERE id=?').bind(id).first<any>();if(!loan)return json({error:'Loan not found'},404);
 const steps=(await d.prepare('SELECT * FROM loan_approvals WHERE loan_id=? ORDER BY position').bind(id).all<any>()).results;
 const roles=(await d.prepare('SELECT role_id FROM member_roles WHERE member_id=?').bind(u.id).all<any>()).results.map(r=>r.role_id);
 if(loan.status!=='pending')return json({error:'This application has already been reviewed.'},409);
 if(!canReviewLoan(u.id,loan.member_id,roles,steps))return json({error:'Only an assigned member of the current approval role can review this step. Self-approval is not allowed.'},403);
 const current=steps.find(s=>s.status!=='approved')!;if(b.position!==current.position)return json({error:'The approval step changed. Refresh before reviewing.'},409);
 const approved=b.decision==='approve',last=current.position===steps[steps.length-1].position,now=new Date().toISOString();const date=new Date();date.setUTCDate(15);date.setUTCMonth(date.getUTCMonth()+1);
 const result=await d.batch([
 d.prepare("UPDATE loan_approvals SET status=?,decided_by=?,decided_at=?,reason=? WHERE loan_id=? AND position=? AND status='pending' AND EXISTS (SELECT 1 FROM loans WHERE id=? AND status='pending' AND member_id<>?) AND EXISTS (SELECT 1 FROM member_roles WHERE member_id=? AND role_id=loan_approvals.role_id) AND NOT EXISTS (SELECT 1 FROM loan_approvals earlier WHERE earlier.loan_id=? AND earlier.position<? AND earlier.status<>'approved')").bind(approved?'approved':'rejected',u.id,now,reason,id,current.position,id,u.id,u.id,id,current.position),
 d.prepare('INSERT INTO notifications (id,member_id,title,body,kind,read,created_at) SELECT ?,?,?,?,?,0,? WHERE changes()=1').bind(crypto.randomUUID(),loan.member_id,!approved?'Application rejected':last?'Loan approved':'Approval step completed',`${id} · ${current.role_name}: ${reason}`,'loan',now),
 d.prepare("UPDATE loans SET status=?,start_date=?,decision_by=?,decision_reason=? WHERE changes()=1 AND id=? AND status='pending' AND EXISTS (SELECT 1 FROM loan_approvals WHERE loan_id=? AND position=? AND decided_by=? AND decided_at=?)").bind(!approved?'rejected':last?'active':'pending',approved&&last?date.toISOString().slice(0,10):'',u.id,reason,id,id,current.position,u.id,now),
 auditStatement(d,u,approved?'Loan approval recorded':'Loan rejected',id,{status:loan.status,step:current.position},{status:!approved?'rejected':last?'active':'pending',step:current.position,role:current.role_name,reason},true),
 d.prepare("INSERT INTO notifications (id,member_id,title,body,kind,read,created_at) SELECT ? || mr.member_id,mr.member_id,'Application ready for review',?,'loan',0,? FROM member_roles mr JOIN loan_approvals a ON a.role_id=mr.role_id JOIN loans l ON l.id=a.loan_id WHERE changes()=1 AND a.loan_id=? AND a.position=? AND l.status='pending' AND mr.member_id<>l.member_id AND EXISTS (SELECT 1 FROM loan_approvals p WHERE p.loan_id=a.loan_id AND p.position=? AND p.decided_by=? AND p.decided_at=? AND p.status='approved')").bind(crypto.randomUUID(),`${id} is waiting for your role.`,now,id,current.position+1,current.position,u.id,now)
 ]);
 if(!result[0].meta.changes)return json({error:'Another reviewer updated this step. Refresh before retrying.'},409);
 return json({message:!approved?'Application rejected. Member notified.':last?'Final approval complete. Payment schedule created.':'Step approved. The application is now with the next approval role.'});
}
