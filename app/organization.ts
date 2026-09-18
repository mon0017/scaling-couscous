export type OrgRole={id:string;name:string;parent_id:string|null};
export type LoanType={id:string;name:string;active:number;steps:string[]};
export type Organization={name:string;revision:number;roles:OrgRole[];assignments:{member_id:string;role_id:string}[];loanTypes:LoanType[]};
export function validateOrganization(value:any,memberIds:string[],existingRoleIds:string[]=[]):Organization{
 const label=(v:any,max=100)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw Error('Names must contain 1–100 characters.');return v.trim()};
 const id=(v:any)=>{if(typeof v!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(v))throw Error('Invalid organization identifier.');return v};
 if(!value||!Number.isInteger(value.revision)||value.revision<0||!Array.isArray(value.roles)||!Array.isArray(value.assignments)||!Array.isArray(value.loanTypes)||value.roles.length>100||value.assignments.length>1000||value.loanTypes.length>50)throw Error('Invalid organization configuration.');
 const roles:OrgRole[]=value.roles.map((r:any)=>({id:id(r.id),name:label(r.name),parent_id:r.parent_id?id(r.parent_id):null}));
 const distinct=(values:string[])=>new Set(values).size===values.length;
 if(!distinct(roles.map(r=>r.id))||!distinct(roles.map(r=>r.name.toLowerCase())))throw Error('Role names must be unique.');
 if(existingRoleIds.some(r=>!roles.some(x=>x.id===r)))throw Error('Keep existing roles to preserve application history. Remove their assignments or approval steps instead.');
 for(const role of roles){const visited=new Set([role.id]);let parent=role.parent_id;while(parent){if(visited.has(parent))throw Error('Organization hierarchy cannot contain a cycle.');visited.add(parent);const p=roles.find(r=>r.id===parent);if(!p)throw Error('Choose a valid parent role.');parent=p.parent_id}}
 const assignments=value.assignments.map((a:any)=>({member_id:String(a.member_id),role_id:id(a.role_id)}));
 if(assignments.some((a:any)=>!memberIds.includes(a.member_id)||!roles.some(r=>r.id===a.role_id))||!distinct(assignments.map((a:any)=>a.member_id+':'+a.role_id)))throw Error('Choose valid, unique role assignments.');
 const loanTypes:LoanType[]=value.loanTypes.map((t:any)=>{if(!Array.isArray(t.steps)||t.steps.length<1||t.steps.length>20||t.steps.some((r:any)=>!roles.some(x=>x.id===r))||!distinct(t.steps))throw Error('Each loan type needs 1–20 distinct approval roles in order.');if(t.active!==0&&t.active!==1)throw Error('Invalid loan type status.');return{id:id(t.id),name:label(t.name),active:t.active,steps:t.steps}});
 if(!distinct(loanTypes.map(t=>t.id))||!distinct(loanTypes.map(t=>t.name.toLowerCase())))throw Error('Loan type names must be unique.');
 if(loanTypes.some(t=>t.active&&t.steps.some(r=>!assignments.some((a:any)=>a.role_id===r))))throw Error('Assign at least one member to every approval role used by an enabled loan type.');
 return{name:label(value.name),revision:value.revision,roles,assignments,loanTypes};
}
export function currentApproval(steps:any[]){return [...steps].sort((a,b)=>a.position-b.position).find(s=>s.status!=='approved')}
export function canReviewLoan(userId:string,memberId:string,roles:string[],steps:any[]){const current=currentApproval(steps);return userId!==memberId&&current?.status==='pending'&&roles.includes(current.role_id)}
