import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {accessSettings} from '../app/access-token.ts';
const product=JSON.parse(readFileSync('cloudflare.config.json','utf8'));
const databaseId=process.env.CLOUDFLARE_D1_DATABASE_ID;
if(!databaseId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId))throw Error('Set CLOUDFLARE_D1_DATABASE_ID to your actual Cloudflare D1 database ID.');
const settings=accessSettings(process.env.CF_ACCESS_TEAM_DOMAIN,process.env.CF_ACCESS_AUD);
const admin=process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();if(!admin||!/^\S+@\S+\.\S+$/.test(admin))throw Error('Set BOOTSTRAP_ADMIN_EMAIL to your administrator sign-in email.');
const config={name:product.name,main:'../dist/server/index.js',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],no_bundle:true,workers_dev:true,preview_urls:false,assets:{directory:'../dist/client',binding:'ASSETS',run_worker_first:true},d1_databases:[{binding:'DB',database_name:product.database_name,database_id:databaseId,migrations_dir:'../drizzle'}],r2_buckets:[{binding:'BUCKET',bucket_name:product.bucket_name}],vars:{CF_ACCESS_TEAM_DOMAIN:settings.issuer,CF_ACCESS_AUD:settings.audience,BOOTSTRAP_ADMIN_EMAIL:admin},rules:[{type:'ESModule',globs:['**/*.js','**/*.mjs']}]};
mkdirSync('.cloudflare',{recursive:true});writeFileSync('.cloudflare/wrangler.json',JSON.stringify(config,null,2)+'\n');console.log('Cloudflare deployment configuration generated. No account credentials are written to this file.');
