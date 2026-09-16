import {spawnSync} from 'node:child_process';
const build=spawnSync(process.execPath,['scripts/run-framework.mjs','build'],{stdio:'inherit'});if(build.status!==0)process.exit(build.status||1);
await import('./configure-cloudflare.mjs');
