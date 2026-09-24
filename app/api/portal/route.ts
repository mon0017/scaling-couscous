import {importDeductions} from '../../payroll-service';
import {saveRepayment,recordRepayment,waiveInterest} from '../../repayment-service';
import {repaymentBalance,today} from '../../repayment';
import {readOrganization,saveOrganization,applyForLoan,reviewLoan,saveMember} from '../../workflows';
import {db,identity,json,sameOrigin,string,notice} from '../../server';
import {quote,schedule,type Loan} from '../../shared';
import {demoData} from '../../sample';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{if(new URL(request.url).searchParams.get('demo')==='1')return json(demoData);const user=await identity();if(!user)return json({error:'Your email is not enrolled. Ask your administrator to enroll your personal email before signing in.'},403);const d=db(),admin=user.role==='admin';const organization=await readOrganization();const ownRoles=organization.assignments.filter(a=>a.member_id===user.id).map(a=>a.role_id);const scope='(l.member_id=? OR EXISTS (SELECT 1 FROM loan_approvals a JOIN member_roles mr ON mr.role_id=a.role_id WHERE a.loan_id=l.id AND mr.member_id=?))';const loans=(await d.prepare('SELECT l.*,m.name FROM loans l JOIN members m ON m.id=l.member_id '+(admin?'':'WHERE '+scope+' ')+'ORDER BY l.created_at DESC').bind(...(admin?[]:[user.id,user.id])).all()).results as Loan[];
 // Deduplicated reminders are generated when the portal is opened, never by a client clock.
 for(const l of loans.filter(l=>l.member_id===user.id&&l.status==='active')){const due=schedule(l).find(s=>s.status!=='Paid');if(due&&due.date<=new Date(Date.now()+7*86400000).toISOString().slice(0,10))await notice(user.id,due.status==='Overdue'?'Payment overdue':'Upcoming deduction',`${l.id}: your next deduction is due on ${due.date}.`,'reminder',`due-${l.id}-${due.number}`).run()}
 const [payments,members,documents,notifications,messages]=await Promise.all([
 d.prepare('SELECT p.*,m.name FROM payments p JOIN loans l ON l.id=p.loan_id JOIN members m ON m.id=l.member_id '+(admin?'':'WHERE l.member_id=? ')+'ORDER BY p.paid_at DESC').bind(...(admin?[]:[user.id])).all(),
 admin?d.prepare("SELECT id,name,email,role,phone,department,CASE WHEN auth_id IS NULL THEN 'pending' ELSE 'active' END AS enrollment_status FROM members ORDER BY name").all():Promise.resolve({results:[]}),
 d.prepare('SELECT f.*,m.name as member_name,(SELECT loan_id FROM loan_documents WHERE document_id=f.id) AS loan_id FROM documents f JOIN members m ON m.id=f.member_id '+(admin?'':'WHERE (f.member_id=? OR EXISTS (SELECT 1 FROM loan_documents ld JOIN loan_approvals a ON a.loan_id=ld.loan_id JOIN member_roles mr ON mr.role_id=a.role_id WHERE ld.document_id=f.id AND mr.member_id=?)) ')+'ORDER BY f.created_at DESC').bind(...(admin?[]:[user.id,user.id])).all(),
 d.prepare('SELECT * FROM notifications WHERE member_id=? ORDER BY created_at DESC LIMIT 100').bind(user.id).all(),
 d.prepare('SELECT x.*,m.name FROM messages x JOIN members m ON m.id=x.sender WHERE x.sender=? OR x.recipient=? ORDER BY x.created_at DESC LIMIT 100').bind(user.id,user.id).all()]);
 const approvals=(await d.prepare('SELECT a.*,m.name AS reviewer_name FROM loan_approvals a JOIN loans l ON l.id=a.loan_id LEFT JOIN members m ON m.id=a.decided_by '+(admin?'':'WHERE '+scope+' ')+'ORDER BY a.position').bind(...(admin?[]:[user.id,user.id])).all()).results;
 const asOf=today();
 const ledger=(await d.prepare('SELECT p.* FROM payments p JOIN loans l ON l.id=p.loan_id '+(admin?'':'WHERE '+scope)).bind(...(admin?[]:[user.id,user.id])).all()).results as any[];
 for(const loan of loans){const balance=repaymentBalance(loan,ledger,asOf);Object.assign(loan,{late_interest_due:balance.interestDue,late_interest_accrued:balance.accrued,balance_due:balance.totalDue,balance_as_of:asOf});}
 const imports=admin?(await d.prepare('SELECT i.*,m.name AS recorded_by_name FROM payroll_imports i JOIN members m ON m.id=i.recorded_by ORDER BY i.created_at DESC LIMIT 100').all()).results:[];
 return json({imports,preview:false,organization:{...organization,assignments:admin?organization.assignments:[]},ownRoles,approvals,user,loans,payments:payments.results,members:members.results,documents:documents.results,notifications:notifications.results,messages:messages.results});
 }catch(e){console.error('Portal read failed',e);return json({error:'Your workspace is temporarily unavailable. Please retry.'},503)}}
export async function POST(request:Request){try{sameOrigin(request);const u=await identity();if(!u)return json({error:'Sign in to continue.'},401);if(Number(request.headers.get('content-length')||0)>256000)return json({error:'Request too large'},413);const raw=await request.text();if(raw.length>256000)return json({error:'Request too large'},413);const b:any=JSON.parse(raw),d=db();if(['payrollImport','waiveInterest','repayment','payment','announcement','organization','saveMember'].includes(b.action)&&u.role!=='admin')return json({error:'Administrator access required.'},403);
 if(b.action==='payrollImport')return await importDeductions(u,b);
 if(b.action==='saveMember')return await saveMember(u,b);
 if(b.action==='organization')return await saveOrganization(u,b);
 if(b.action==='apply')return await applyForLoan(u,b);
 if(b.action==='profile'){await d.prepare('UPDATE members SET name=?,phone=?,department=? WHERE id=?').bind(string(b.name,1,100),string(b.phone||' ',0,30),string(b.department||' ',0,100),u.id).run();return json({message:'Profile updated.'})}
 if(b.action==='readNotifications'){await d.prepare('UPDATE notifications SET read=1 WHERE member_id=?').bind(u.id).run();return json({message:'Notifications marked as read.'})}
 if(b.action==='decision')return await reviewLoan(u,b);
 if(b.action==='waiveInterest')return await waiveInterest(u,b);
 if(b.action==='repayment')return await saveRepayment(u,b);
 if(b.action==='payment')return await recordRepayment(u,b);
 if(b.action==='announcement'){const title=string(b.title,1,100),body=string(b.body,1,2000);await d.prepare('INSERT INTO notifications (id,member_id,title,body,kind,read,created_at) SELECT ? || id,id,?,?,?,0,? FROM members').bind(crypto.randomUUID(),title,body,'announcement',new Date().toISOString()).run();return json({message:'Announcement delivered to members’ in-app notifications.'})}
 if(b.action==='message'){const body=string(b.body,1,2000);const owner=await d.prepare('SELECT owner FROM workspace WHERE id=1').first<any>();const recipient=u.role==='admin'&&b.recipient?string(b.recipient):owner.owner;if(!await d.prepare('SELECT id FROM members WHERE id=?').bind(recipient).first())throw Error('Select a valid recipient.');await d.batch([d.prepare('INSERT INTO messages (id,sender,recipient,body,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),u.id,recipient,body,new Date().toISOString()),notice(recipient,'New message',`${u.name} sent you a message.`,'message')]);return json({message:'Message sent.'})}
 return json({error:'Unknown action'},400);
 }catch(e:any){const message=e?.message||'';if(/Database|D1_|SQLITE|fetch failed|binding/i.test(message)){console.error('Portal mutation failed',e);return json({error:'Could not save right now. Please refresh before retrying.'},503)}return json({error:message||'Invalid request'},400)}}
