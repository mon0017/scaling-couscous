# Applications and organization

Members open **Apply for a loan** to choose a configured loan type, attach up to five PDFs or supported images, review every monthly principal/interest/payment line, and submit. Amounts use the existing 6% annual flat-interest policy. The final payment reconciles all cents. Due dates begin on the 15th of the month following final approval.

Uploads go to private R2 storage immediately; cancelling the form or removing an attachment leaves the file in the member's Documents library. Submitting links selected document IDs atomically to the application. Files already linked to another loan cannot be reused. Only the owner, workspace administrator, or a reviewer assigned to a role in the loan's workflow can download its attachments.

Administrators open **Admin workspace → Organization** to name the union, add/rename roles and reporting lines, assign existing signed-in members, and configure enabled loan types with 1–20 ordered approval roles. A role can have multiple people; one of them completes that step. Holding an organization role does not grant administrator access. Reporting lines describe the organization; they do not implicitly grant approval rights.

New applications snapshot the configured role sequence and role names. Later route edits affect only future applications. Current role membership determines who may review an existing step, allowing staff changes. The backend rejects unstaffed active routes, removal of the last eligible reviewer from pending applications, self-approval, out-of-order decisions, duplicate decisions, and stale configuration submissions. Rejection ends review; only final approval activates the loan. Each decision retains the reviewer, timestamp and reason. Members and the next role receive in-app notifications.

Migration `0001_organization_approvals.sql` is additive. It retains existing data, assigns existing administrators to a Workspace administrator role, configures the three existing loan types, and gives existing pending loans one administrator review step. Configure your actual organization and role assignments before accepting new applications. A sole administrator cannot approve their own loan.

## Validation

Run `npm run test:loans`, `npm run test:auth`, `npx tsc --noEmit`, and `npm run build`. Workflow tests run the actual SQL mutation functions against SQLite with D1-like atomic batches. Cloudflare deployment applies D1 migrations before deploying the application.

## Public demo

Run `node scripts/build-public-demo.mjs` to build `outputs/public-demo`. Upload that directory (or a ZIP of its contents) to the separate `johnloan-baba-yaga-demo` static Worker. This build uses fictional records only. Organization edits and demo applications are kept in page memory until reload; selected file names are shown but file contents are never uploaded. It does not connect to the private workspace database. The authenticated app uses D1 and R2 for persistence.
