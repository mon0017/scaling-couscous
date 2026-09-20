import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const folder='work/public-demo';mkdirSync(folder,{recursive:true});
for(const file of ['repayment.ts','repayment-settings.tsx','shared.ts','sample.ts','request.ts','organization.ts','member-enrollment.ts','loan-application.tsx','organization-editor.tsx'])copyFileSync('app/'+file,folder+'/'+file);
let portal=readFileSync('app/portal.tsx','utf8');const start=portal.indexOf(' async function refresh()'),end=portal.indexOf('\n useEffect',start);
if(start<0||end<0)throw Error('Cannot locate portal refresh; review demo isolation before building.');
portal=portal.slice(0,start)+' async function refresh(){setData(demoData);setLoading(false);return true}'+portal.slice(end);
portal=portal.replace("const signInPath=import.meta.env.DEV?'/signin-with-chatgpt?return_to=/':'/';","const signInPath='https://scaling-couscous.monsourasai.workers.dev/';").replace('You’re exploring sample data.','Public demo — fictional data. Changes last until reload; files are not uploaded.');
writeFileSync(folder+'/portal.tsx',portal);copyFileSync('app/globals.css',folder+'/style.css');
writeFileSync(folder+'/main.tsx',"import React from 'react';import{createRoot}from'react-dom/client';import Portal from './portal';import './style.css';createRoot(document.getElementById('root')!).render(<Portal/>);");
writeFileSync(folder+'/index.html','<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>JohnLoan Baba Yaga — Public Demo</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
writeFileSync(folder+'/vite.config.mjs',"import{defineConfig}from'vite';import react from '@vitejs/plugin-react';export default defineConfig({plugins:[react()],build:{outDir:'../../outputs/public-demo',emptyOutDir:true}});");
const build=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build',folder,'--config',folder+'/vite.config.mjs'],{stdio:'inherit'});process.exit(build.status||0);

