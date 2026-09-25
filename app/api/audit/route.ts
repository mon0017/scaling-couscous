import {db,identity,json} from '../../server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  const u=await identity();if(!u)return json({error:'Sign in to continue.'},401);if(u.role!=='admin')return json({error:'Administrator access required.'},403);
  const p=new URL(request.url).searchParams,q=(p.get('q')||'').slice(0,100),from=p.get('from')||'',to=p.get('to')||'',page=Math.max(1,Math.min(100000,Number(p.get('page'))||1));
  if(!Number.isInteger(page)||[from,to].some(v=>v&&!/^\d{4}-\d{2}-\d{2}$/.test(v))||from&&to&&from>to)return json({error:'Choose a valid date range.'},400);
  const clauses=['1=1'],args:string[]=[];
  if(q){clauses.push("(instr(lower(actor_name),lower(?))>0 OR instr(lower(action),lower(?))>0 OR instr(lower(entity_id),lower(?))>0)");args.push(q,q,q)}
  if(from){clauses.push('created_at>=?');args.push(from+'T00:00:00.000Z')}
  if(to){clauses.push('created_at<=?');args.push(to+'T23:59:59.999Z')}
  const where=clauses.join(' AND '),d=db();const [count,events]=await Promise.all([d.prepare('SELECT count(*) AS total FROM audit_events WHERE '+where).bind(...args).first<any>(),d.prepare('SELECT * FROM audit_events WHERE '+where+' ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET ?').bind(...args,(page-1)*50).all()]);
  return json({events:events.results,total:count?.total||0,page});
 }catch(e){console.error('Audit read failed',e);return json({error:'Audit history is unavailable. Please retry.'},503)}
}
