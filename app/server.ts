import {env} from 'cloudflare:workers';
import {getUser} from './auth';
import {resolveEnrolledMember} from './member-enrollment';
export const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
export function db(){if(!env.DB)throw Error('Database unavailable');return env.DB}
export async function identity(){const u=await getUser();if(!u)return null;const d=db();
 const isAdmin=import.meta.env.DEV?u.userId==='local_seedy':Boolean(env.BOOTSTRAP_ADMIN_EMAIL&&u.email.toLowerCase()===env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase());
 const member=await resolveEnrolledMember(d,u,isAdmin);
 if(isAdmin&&member)await d.prepare('INSERT OR IGNORE INTO workspace (id,owner) VALUES (1,?)').bind(member.id).run();
 return member;}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw Error('Invalid request origin');}
export function string(value:any,min=1,max=2000){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw Error(`Enter between ${min} and ${max} characters.`);return value.trim()}
export function notice(member:string,title:string,body:string,kind='loan',id=crypto.randomUUID()){return db().prepare('INSERT OR IGNORE INTO notifications (id,member_id,title,body,kind,read,created_at) VALUES (?,?,?,?,?,0,?)').bind(id,member,title,body,kind,new Date().toISOString())}
