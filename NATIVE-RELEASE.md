# JohnLoan Baba Yaga mobile release

The web app is the shared application. `capacitor.config.ts` and `native-shell/` define its native shell. This is a packaging scaffold, not signed Android/iOS binaries.

## Configuration

Set `APP_ORIGIN` to the deployed HTTPS origin when building the shell. Set a union-owned app ID before generating native projects. Install the current mutually compatible Capacitor core, CLI, Android, iOS, App, SplashScreen, and PushNotifications packages; run Capacitor add/sync on the appropriate development machines. iOS signing and store submission require macOS, Xcode, and an Apple developer account. Android signing requires an Android build environment and keystore.

## Required before a member rollout

- Configure an identity path suitable for union members and native app sessions. The standalone web build now uses verified Cloudflare Access authentication; do not assume the embedded webview can reuse the system browser's session.
- Provision APNs/FCM, register device tokens against authenticated members, and add server-side notification delivery. Current updates are in-app only; reminders are generated on portal access, not a background scheduler.
- Add and test platform biometric authentication with Keychain/Keystore-protected credentials; never store financial data or refresh tokens in ordinary browser storage. Current biometric UI explicitly reports this pending setup.
- Configure universal/app links and associated domains for the actual production domain. The web app already supports `?view=` navigation; native OS domain verification is not yet installed.
- Generate platform icon sizes from the supplied brand, configure splash resources and camera/photo permission descriptions, and test native camera uploads on physical devices, including HEIC conversion.
- Validate sign-in, downloads, safe areas, keyboard behavior, background/resume, rotation, notification permission denial, push delivery and deep links on real Android and iOS devices. Browser viewport checks do not replace these tests.
- Confirm your union's lending policy. The example product rule is PHP 1,000–500,000, 3/6/12/18/24 months, 6% annual flat interest, no fees. First deduction is the 15th of the following month. Approval creates a schedule; it does not transfer or disburse money. Recorded payments are accounting entries, not payment processor charges or automatic payroll integration.

## Access and privacy

Configure Cloudflare Access with an explicit member allowlist. `BOOTSTRAP_ADMIN_EMAIL` identifies the administrator; arbitrary first visitors never receive administrator privileges. Production requests verify Access JWTs and ignore Sites identity headers. The local development sign-in remains synthetic. Configure Access before granting member access.

Financial records remain in D1 and documents in R2. API/download responses use `no-store`; the client does not persist financial data in browser storage. No offline financial cache or queued payments are implemented. Add operational backups, audit retention, monitoring, upload scanning and disaster recovery before production use.

Reports, receipts and statements currently download as CSV. There is no signed PDF statement workflow. The app supports camera/file inputs with JPEG/PNG/WebP compression; HEIC is rejected with conversion guidance. Files have signature and size validation, not malware scanning.

