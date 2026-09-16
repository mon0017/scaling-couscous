import Portal from './portal';
import {getUser} from './auth';
export const dynamic='force-dynamic';
export default async function Home(){
 if(import.meta.env.DEV)return <Portal/>;
 try{if(await getUser())return <Portal/>}catch{return <main className="content"><h1>JohnLoan Baba Yaga</h1><p>Sign-in setup is incomplete. Your administrator needs to configure Cloudflare Access before this workspace can open.</p></main>}
 return <main className="content"><h1>Sign in to your union workspace</h1><p>A valid Cloudflare Access session is required.</p><a className="btn primary" href="/">Try sign-in again</a></main>;
}
