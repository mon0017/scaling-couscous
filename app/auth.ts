import {headers} from 'next/headers';
import {env} from 'cloudflare:workers';
import {verifyAccessToken,accessSettings} from './access-token';
export async function getUser(){
 const h=await headers();
 // The development server strips supplied identity headers and injects only its local mock.
 // This branch is compiled out of the production build.
 if(import.meta.env.DEV){const id=h.get('oai-authenticated-user-id'),email=h.get('oai-authenticated-user-email');return id&&email?{userId:id,email,fullName:h.get('oai-authenticated-user-full-name')}:null}
 accessSettings(env.CF_ACCESS_TEAM_DOMAIN,env.CF_ACCESS_AUD);
 const token=h.get('cf-access-jwt-assertion');if(!token)return null;
 try{return await verifyAccessToken(token,env.CF_ACCESS_TEAM_DOMAIN,env.CF_ACCESS_AUD)}catch{return null}
}
