# GitHub → Cloudflare Workers

Use a private GitHub repository and connect it through Cloudflare Workers Builds.

Provision the D1 database and private R2 bucket named in `cloudflare.config.json`. Create a Cloudflare Access application covering the actual hostname, with administrator/member email allowlists. Set these **build variables** in Cloudflare:

- `CLOUDFLARE_D1_DATABASE_ID`: actual database UUID
- `CF_ACCESS_TEAM_DOMAIN`: `https://YOUR-TEAM.cloudflareaccess.com`
- `CF_ACCESS_AUD`: actual Access application audience
- `BOOTSTRAP_ADMIN_EMAIL`: administrator's exact sign-in email
- `NODE_VERSION`: `24`

Configure:

```
Build command: npm run build:cloudflare
Deploy command: npm run deploy:cloudflare
Root directory: repository root
```

The build writes ignored `.cloudflare/wrangler.json`. The deploy command applies pending SQL migrations and publishes the built Worker plus browser assets. Disable branch preview deployments until separate preview storage and Access policies exist. Never put Cloudflare API tokens in Git or chat. Workers Builds provides its deployment identity; it must have access to the Worker, D1 database and R2 bucket.

Run `npm run test:auth` and `npm run build` before uploading. GitHub Actions does both and type-checks. Real Cloudflare login, resource creation, Access configuration and end-to-end deployment must still be completed in your account.

Local development uses `npm run dev` and the starter's synthetic sign-in. Production never accepts its unsigned identity headers. The existing `.openai/hosting.json` is retained for local storage simulation only; do not deploy the generated Sites placeholder database configuration. Always use the explicit `.cloudflare/wrangler.json` for standalone deployment.

See the official [Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/) and [Access verification](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) documentation.
