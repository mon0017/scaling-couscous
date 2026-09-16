import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
const keySets=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
export function accessSettings(domain:string|undefined,audience:string|undefined){
 if(!domain||!audience)throw Error('Cloudflare Access is not configured.');
 const issuer=new URL(domain);
 if(issuer.protocol!=='https:'||!issuer.hostname.endsWith('.cloudflareaccess.com')||issuer.pathname!=='/'||issuer.search||issuer.hash||issuer.port||issuer.username||issuer.password)throw Error('Invalid Cloudflare Access team domain.');
 return {issuer:issuer.origin,audience};
}
export async function verifyAccessToken(token:string,domain:string|undefined,audience:string|undefined,testKey?:JWTVerifyGetKey){
 const settings=accessSettings(domain,audience);
 let keys=testKey||keySets.get(settings.issuer);
 if(!keys){keys=createRemoteJWKSet(new URL(settings.issuer+'/cdn-cgi/access/certs'));keySets.set(settings.issuer,keys as ReturnType<typeof createRemoteJWKSet>)}
 const {payload}=await jwtVerify(token,keys,{issuer:settings.issuer,audience:settings.audience,algorithms:['RS256'],requiredClaims:['sub','email','exp','iat']});
 if(typeof payload.sub!=='string'||!payload.sub||typeof payload.email!=='string'||!payload.email.includes('@'))throw Error('Invalid user identity.');
 return {userId:payload.sub,email:payload.email.toLowerCase(),fullName:typeof payload.name==='string'?payload.name:null};
}
