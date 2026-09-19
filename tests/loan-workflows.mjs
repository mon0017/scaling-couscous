import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {quote,breakdown} from '../app/shared.ts';
import {validateOrganization,canReviewLoan} from '../app/organization.ts';
import {normalizeEmail,resolveEnrolledMember} from '../app/member-enrollment.ts';
for(const amount of [1000,1000.01,25000,123456.78,500000])for(const term of [3,6,12,18,24]){
 const q=quote(amount,term);assert.equal(q.rows.reduce((s,r)=>s+r.principal,0),q.principal);assert.equal(q.rows.reduce((s,r)=>s+r.interest,0),q.interest);assert.equal(q.rows.reduce((s,r)=>s+r.amount,0),q.total);assert.equal(q.rows.at(-1).balance,0);for(const row of q.rows){assert.equal(row.amount,row.principal+row.interest);assert.ok(row.principal>0&&row.interest>=0&&row.balance>=0)}}
for(const args of [[999,12],[500001,12],[1000,7],[1000.001,12],[NaN,12]])assert.throws(()=>quote(...args));
assert.throws(()=>breakdown(100,90,12));
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
sql.exec(readFileSync('drizzle/0000_dizzy_zaladane.sql','utf8'));
for(const id of ['admin','applicant','staff','manager','president','other'])sql.prepare('INSERT INTO members (id,name,email,role) VALUES (?,?,?,?)').run(id,id,id+'@example.test',id==='admin'?'admin':'member');
sql.exec(readFileSync('drizzle/0001_organization_approvals.sql','utf8'));
sql.exec(readFileSync('drizzle/0002_member_enrollment.sql','utf8'));
class Statement{constructor(text,params=[]){this.text=text;this.params=params}bind(...params){return new Statement(this.text,params)}async first(){return sql.prepare(this.text).get(...this.params)||null}async all(){return{results:sql.prepare(this.text).all(...this.params)}}run(){const result=sql.prepare(this.text).run(...this.params);return{meta:{changes:Number(result.changes)}}}}
const d={prepare:text=>new Statement(text),batch:async statements=>{sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(s.run());sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}}};
globalThis.__workflowDB=d;
const mock=`export const db=()=>globalThis.__workflowDB;export const json=(data,status=200)=>Response.json(data,{status});export function string(v,min=1,max=2000){if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)throw Error('Invalid text');return v.trim()}export function notice(member,title,body,kind='loan',id=crypto.randomUUID()){return db().prepare('INSERT OR IGNORE INTO notifications (id,member_id,title,body,kind,read,created_at) VALUES (?,?,?,?,?,0,?)').bind(id,member,title,body,kind,new Date().toISOString())}`;
const source=readFileSync('app/workflows.ts','utf8').replace("'./server'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(mock).toString('base64'))).replace("'./shared'",JSON.stringify(pathToFileURL(process.cwd()+'/app/shared.ts').href)).replace("'./organization'",JSON.stringify(pathToFileURL(process.cwd()+'/app/organization.ts').href));
const enrollmentSource=source.replace("'./member-enrollment'",JSON.stringify(pathToFileURL(process.cwd()+'/app/member-enrollment.ts').href));
const compiled=ts.transpileModule(enrollmentSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {readOrganization,saveOrganization,applyForLoan,reviewLoan,saveMember}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const admin={id:'admin',role:'admin'},applicant={id:'applicant',role:'member'};
let org=await readOrganization();org.roles.push({id:'staff',name:'Admin Staff',parent_id:'manager'},{id:'manager',name:'Admin Manager',parent_id:'president'},{id:'president',name:'President',parent_id:null});org.assignments.push(...['staff','manager','president'].map(id=>({member_id:id,role_id:id})));org.loanTypes.forEach(t=>t.steps=['staff','manager','president']);
assert.equal((await saveOrganization(applicant,{organization:org})).status,403);
assert.equal((await saveOrganization(admin,{organization:org})).status,200);
assert.equal((await saveOrganization(admin,{organization:org})).status,409);
org=await readOrganization();const cyclic=structuredClone(org);cyclic.roles.find(r=>r.id==='president').parent_id='staff';assert.throws(()=>validateOrganization(cyclic,['admin','staff','manager','president']));
const empty=structuredClone(org);empty.loanTypes[0].steps=[];assert.throws(()=>validateOrganization(empty,['admin','staff','manager','president']));
sql.prepare('INSERT INTO documents (id,member_id,name,mime,size,created_at) VALUES (?,?,?,?,?,?)').run('owned','applicant','payslip.pdf','application/pdf',100,'2026-09-18');
sql.prepare('INSERT INTO documents (id,member_id,name,mime,size,created_at) VALUES (?,?,?,?,?,?)').run('foreign','other','private.pdf','application/pdf',100,'2026-09-18');
const body={typeId:'personal',amount:25000,term:12,purpose:'Home improvement expenses',organizationRevision:org.revision,documentIds:['owned']};
await assert.rejects(applyForLoan(applicant,{...body,documentIds:['foreign']}));
await assert.rejects(applyForLoan(applicant,{...body,documentIds:['owned','owned']}));
assert.equal((await applyForLoan(applicant,{...body,organizationRevision:0})).status,409);
const result=await applyForLoan(applicant,body);assert.equal(result.status,200);const {loanId}=await result.json();assert.equal(sql.prepare('SELECT loan_id FROM loan_documents WHERE document_id=?').get('owned').loan_id,loanId);
await assert.rejects(applyForLoan(applicant,body));
assert.equal((await reviewLoan(admin,{loanId,position:1,decision:'approve',reason:'Reviewed documents'})).status,403);
assert.equal((await reviewLoan({id:'manager'},{loanId,position:2,decision:'approve',reason:'Reviewed documents'})).status,403);
assert.equal(canReviewLoan('applicant','applicant',['staff'],[{position:1,status:'pending',role_id:'staff'}]),false);
const unstaffed=structuredClone(org);unstaffed.assignments=unstaffed.assignments.filter(a=>a.role_id!=='staff');await assert.rejects(saveOrganization(admin,{organization:unstaffed}));
// Changes to a type affect future requests, never the captured steps of this loan.
org.loanTypes.find(t=>t.id==='personal').steps=['president'];assert.equal((await saveOrganization(admin,{organization:org})).status,200);assert.equal(sql.prepare('SELECT count(*) AS n FROM loan_approvals WHERE loan_id=?').get(loanId).n,3);
for(const [index,id] of ['staff','manager','president'].entries()){
 const response=await reviewLoan({id},{loanId,position:index+1,decision:'approve',reason:'Reviewed and approved'});assert.equal(response.status,200);assert.equal(sql.prepare('SELECT status FROM loans WHERE id=?').get(loanId).status,index===2?'active':'pending');assert.notEqual((await reviewLoan({id},{loanId,position:index+1,decision:'approve',reason:'Duplicate request'})).status,200)}
org=await readOrganization();const rejection=await (await applyForLoan(applicant,{...body,organizationRevision:org.revision,documentIds:[]})).json();assert.equal((await reviewLoan({id:'president'},{loanId:rejection.loanId,position:1,decision:'reject',reason:'Insufficient documents'})).status,200);assert.equal(sql.prepare('SELECT status FROM loans WHERE id=?').get(rejection.loanId).status,'rejected');
// Concurrent retries produce one accepted decision and one notification sequence.
const concurrent=await (await applyForLoan(applicant,{...body,organizationRevision:org.revision,documentIds:[]})).json();const decisions=await Promise.all([1,2].map(()=>reviewLoan({id:'president'},{loanId:concurrent.loanId,position:1,decision:'approve',reason:'Reviewed in duplicate'})));assert.equal(decisions.filter(r=>r.status===200).length,1);
// Enroll by email before role assignment; first verified sign-in claims that row.
assert.equal(normalizeEmail(' Person@Example.COM '),'person@example.com');
assert.throws(()=>normalizeEmail('missing-at-sign'));
const person={name:'New Person',email:'Person@Example.COM',department:'Finance',phone:''};
assert.equal((await saveMember(applicant,person)).status,403);
assert.equal((await saveMember(admin,person)).status,200);
assert.equal((await saveMember(admin,{...person,email:' person@example.com '})).status,409);
const enrollment=sql.prepare('SELECT * FROM members WHERE email=?').get('person@example.com');assert.equal(enrollment.auth_id,null);assert.equal(enrollment.role,'member');
assert.equal((await saveMember(admin,{...person,memberId:enrollment.id,email:'updated@example.com'})).status,200);
org=await readOrganization();org.assignments.push({member_id:enrollment.id,role_id:'staff'});assert.equal((await saveOrganization(admin,{organization:org})).status,200);
assert.equal(await resolveEnrolledMember(d,{userId:'unknown',email:'not-enrolled@example.com'},false),null);
assert.equal(await resolveEnrolledMember(d,{userId:'old-email',email:'person@example.com'},false),null);
const claimed=await resolveEnrolledMember(d,{userId:'verified-subject',email:'UPDATED@example.com',fullName:'Provider name'},false);assert.equal(claimed.id,enrollment.id);assert.equal(claimed.name,'New Person');assert.equal(claimed.auth_id,'verified-subject');
assert.equal(sql.prepare('SELECT count(*) AS n FROM member_roles WHERE member_id=?').get(enrollment.id).n,1);
assert.equal((await resolveEnrolledMember(d,{userId:'verified-subject',email:'updated@example.com'},false)).id,enrollment.id);
await assert.rejects(resolveEnrolledMember(d,{userId:'different-subject',email:'updated@example.com'},false));
await assert.rejects(saveMember(admin,{...person,memberId:enrollment.id,email:'hijack@example.com'}));
assert.equal((await saveMember(admin,{...person,memberId:enrollment.id,email:'updated@example.com',department:'Operations'})).status,200);
assert.equal((await resolveEnrolledMember(d,{userId:'admin',email:'admin@example.test'},true)).role,'admin');
const invalidMemberOrg=await readOrganization();invalidMemberOrg.assignments.push({member_id:'not-enrolled',role_id:'staff'});await assert.rejects(saveOrganization(admin,{organization:invalidMemberOrg}));
// Membership, not organizational role, determines who can request a loan.
org=await readOrganization();
for(const id of ['applicant','admin','president']){
 const response=await applyForLoan({id,role:id==='admin'?'admin':'member'},{...body,organizationRevision:org.revision,documentIds:[],memberId:'other'});
 assert.equal(response.status,200);
 const {loanId:requestedId}=await response.json();
 const requested=sql.prepare('SELECT * FROM loans WHERE id=?').get(requestedId);
 assert.equal(requested.member_id,id);assert.equal(requested.status,'pending');
 assert.equal((await reviewLoan({id},{loanId:requestedId,position:1,decision:'approve',reason:'Attempt own approval'})).status,403);
}
sql.close();delete globalThis.__workflowDB;
console.log('PASS: personal-email enrollment, duplicate prevention, enrollment-first role assignment, verified identity linking, stable member records, email edit locking and unauthorized enrollment.');
console.log('PASS: cent-exact monthly breakdown, organization validation, role permissions, self-approval, ordered/final approvals, rejection, concurrency, snapshot preservation, document ownership/linking and revision conflicts.');

