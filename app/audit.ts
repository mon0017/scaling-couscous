export function auditStatement(d:any,u:any,action:string,entity:string,before:unknown,after:unknown,conditional=false){
 return d.prepare('INSERT INTO audit_events (id,actor_id,actor_name,action,entity_id,before_json,after_json,created_at) SELECT ?,?,?,?,?,?,?,?'+(conditional?' WHERE changes()=1':'')).bind(crypto.randomUUID(),u.id,u.name||u.id,action,entity,JSON.stringify(before??null),JSON.stringify(after??null),new Date().toISOString());
}
