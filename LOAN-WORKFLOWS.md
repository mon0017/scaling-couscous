# Applications and organization

Members open **Apply for a loan** to choose a configured loan type, attach up to five PDFs or supported images, review every monthly principal/interest/payment line, and submit. Amounts use the existing 6% annual flat-interest policy. The final payment reconciles all cents. Due dates begin on the 15th of the month following final approval.

Uploads go to private R2 storage immediately; cancelling the form or removing an attachment leaves the file in the member's Documents library. Submitting links selected document IDs atomically to the application. Files already linked to another loan cannot be reused. Only the owner, workspace administrator, or a reviewer assigned to a role in the loan's workflow can download its attachments.

Administrators open **Admin workspace → Organization**, with separate Members, Roles and Loan approvals sections, to name the union, add/rename roles and reporting lines, enroll members by personal email, assign those enrolled members, and configure enabled loan types with 1–20 ordered approval roles. A role can have multiple people; one of them completes that step. Holding an organization role does not grant administrator access. Reporting lines describe the organization; they do not implicitly grant approval rights.

New applications snapshot the configured role sequence and role names. Later route edits affect only future applications. Current role membership determines who may review an existing step, allowing staff changes. The backend rejects unstaffed active routes, removal of the last eligible reviewer from pending applications, self-approval, out-of-order decisions, duplicate decisions, and stale configuration submissions. Rejection ends review; only final approval activates the loan. Each decision retains the reviewer, timestamp and reason. Members and the next role receive in-app notifications.

Migration `0001_organization_approvals.sql` is additive. It retains existing data, assigns existing administrators to a Workspace administrator role, configures the three existing loan types, and gives existing pending loans one administrator review step. Configure your actual organization and role assignments before accepting new applications. A sole administrator cannot approve their own loan.

## Validation

Run `npm run test:loans`, `npm run test:auth`, `npx tsc --noEmit`, and `npm run build`. Workflow tests run the actual SQL mutation functions against SQLite with D1-like atomic batches. Cloudflare deployment applies D1 migrations before deploying the application.

## Public demo

Run `node scripts/build-public-demo.mjs` to build `outputs/public-demo`. Upload that directory (or a ZIP of its contents) to the separate `johnloan-baba-yaga-demo` static Worker. This build uses fictional records only. Organization edits and demo applications are kept in page memory until reload; selected file names are shown but file contents are never uploaded. It does not connect to the private workspace database. The authenticated app uses D1 and R2 for persistence.

## Member enrollment

Admins enroll a full name and personal email before assigning roles. The member directory shows team, roles and Awaiting first sign-in / Active status. Each item has its own edit form and save action. No invitation email is sent. Unknown emails cannot create member accounts through sign-in; only the bootstrap administrator can initialize an account without prior enrollment. A verified sign-in matching an unclaimed enrolled email binds its authentication subject while preserving the member ID and assignments. Existing members remain linked through migration 0002. Emails are case-insensitively unique and become locked after first sign-in. An enrollment cannot be claimed by a second authentication subject.

Cloudflare Access remains the outer sign-in gate. Its policy must allow the enrolled personal emails; app enrollment does not modify that policy or grant Cloudflare account membership.


## Repayment collection and late interest
Admins edit each pending or active loan in Loan details > Repayment & late interest. Choose automatic payroll deduction or member-paid. Automatic deduction is a collection designation; the app does not initiate payroll withdrawals. Only administrators record received payments.

New applications default to automatic deduction and 3% monthly late interest. Admins change the default under Organization > Loan approvals. Existing loans preserve their original saved rates; there is no retroactive 3% charge. Admins may set 0–100% monthly in 0.01% increments. Pending-loan rates apply after installments become overdue; active-loan changes start the next UTC day. Historical rates are preserved. Setting 0% stops future accrual without erasing prior charges.

Simple interest applies to overdue unpaid contractual installments starting the day after the due date, at monthly percentage / 30 per day. Payments stop accrual on the paid portion from the next day. No compounding; sum accrual before rounding to cents. The API calculates from the actual payment ledger, as of today or the selected payment date.

Payments settle oldest contractual installments first, then late interest. Dates cannot precede the application or latest recorded payment or waiver. Receipts retain separate late-interest amounts. Loan revision checks protect concurrent payments and policy edits; unique references prevent duplicate payments. Completion requires settling both contractual repayments and late interest.


Admins can partially or fully waive unpaid late interest in Loan details, with a required reason. Immutable waiver history stores amount, UTC date, administrator and timestamp. Waivers reduce accrued interest only; future accrual continues unless the admin separately changes the rate. Atomic revision checks prevent stale waivers and concurrent over-waiving.

## Admin member accounts
Member loans groups every loan by stable member ID, with search, overdue/status filters, balance sorting and 15-row pagination. Each member account includes scoped loans, payments and documents. Enrollment remains in Members; Organization manages roles, approval routes and default late-interest rate. The demo includes 100 additional fictional members; member mode shows only the signed-in sample member.


## Daily collections and Excel payroll reconciliation
The admin overview shows selected-month scheduled installments, settled installments, pending amounts and actual cash received by payment date. Settlement allocates contractual payments oldest-first, includes prepayments and excludes late-interest payments. It is not simply cash received minus expected. Six months of scheduled collection progress and daily activities (Asia/Manila) are included. Older payment records without recording timestamps use their payment date and are labeled; imported historical opening balances cannot establish exact historical receipt dates.

Payroll imports accept a single-sheet .xlsx using the downloadable template: Loan ID, Member Email, Amount PHP, Payment Date, Reference. Maximum 100 rows and 2 MB compressed / 8 MB expanded; formulas, extra data columns, old .xls and macros are rejected. The original workbook is parsed in memory and is not stored. Only normalized deductions and audit metadata are submitted. Every row needs the exact loan ID and matching enrolled personal email. Only active salary-deduction loans can receive new deductions. Dates, cents, outstanding amounts, prior payments/waivers and unique references are validated server-side. One deduction per loan per file. Preview does not write. Confirmation atomically records all new payments, receipts, notifications and an import audit record; any conflict rolls back the batch. Reusing the same payroll reference safely skips identical recorded payments, even with a renamed file. Use the same reference for retries; do not generate a fresh reference for the same deduction. Partial deductions reduce balances; full settlement including late interest marks a loan completed. No salary withdrawals or payroll API integration are performed.

The public demo provides dummy deductions with partial and full payoff rows. Importing them updates only in-memory sample data until reload. Test using the dummy file in the demo, never real payroll data.
