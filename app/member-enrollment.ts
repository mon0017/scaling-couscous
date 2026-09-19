export function normalizeEmail(value:unknown){
 if(typeof value!=='string')throw Error('Enter a valid personal email address.');
 const email=value.trim().toLowerCase();
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid personal email address.');
 return email;
}
export function memberFields(value:any){
 const field=(v:unknown,max:number,required=false)=>{if(typeof v!=='string'||v.trim().length>max||(required&&!v.trim()))throw Error(required?'Enter the member’s full name.':'Check the member details.');return v.trim()};
 return {name:field(value.name,100,true),email:normalizeEmail(value.email),phone:field(value.phone||'',30),department:field(value.department||'',100)};
}
// The caller must supply an identity from the verified authentication provider.
// Keep the enrolled member ID stable so existing role assignments and loans survive login.
export async function resolveEnrolledMember(d:any,u:{userId:string;email:string;fullName?:string|null},isAdmin:boolean){
 const email=normalizeEmail(u.email);
 let member=await d.prepare('SELECT * FROM members WHERE auth_id=?').bind(u.userId).first();
 if(!member){
  const enrolled=await d.prepare('SELECT * FROM members WHERE lower(trim(email))=?').bind(email).first();
  if(enrolled){
   if(enrolled.auth_id&&enrolled.auth_id!==u.userId)throw Error('This enrollment is linked to a different sign-in identity. Contact your administrator.');
   await d.prepare('UPDATE members SET auth_id=? WHERE id=? AND auth_id IS NULL').bind(u.userId,enrolled.id).run();
  }else if(isAdmin){
   await d.prepare('INSERT OR IGNORE INTO members (id,name,email,role,phone,department,auth_id) VALUES (?,?,?,?,?,?,?)').bind(u.userId,u.fullName||email.split('@')[0],email,'admin','','',u.userId).run();
  }else return null;
  member=await d.prepare('SELECT * FROM members WHERE auth_id=?').bind(u.userId).first();
 }
 if(!member)return null;
 await d.prepare('UPDATE members SET role=? WHERE id=?').bind(isAdmin?'admin':'member',member.id).run();
 return {...member,role:isAdmin?'admin':'member'};
}
