# BigChange Student Hub — Phase 0 Stabilization

This branch exists to make the inherited School MIS safe enough for BigChange evaluation before any rebranding or real student data is introduced.

## Rules
- Do not rebrand on this branch.
- Do not load real student, parent, grade, attendance, or homework data yet.
- Preserve working features unless a security fix requires a behavior change.
- Make small, reviewable commits and test each security boundary.
- Authorization must come from authenticated identity/database relationships, never client-supplied IDs.

## Change log

### Authorization / tenant isolation
- Hardened sensitive student/parent access and school scoping.
- Restricted global/search-style access by authenticated role and school where patched.

### Homework / grading
- Student submission identity is derived from authentication rather than trusted request identity.
- Assignment eligibility and teacher ownership/subject authorization checks added.
- Submission review/grading inherits assignment authorization.
- Marks cannot exceed assignment total marks.

### File storage
- Objects are scoped under `schools/{schoolId}/`.
- Bucket browsing/listing/statistics/delete endpoints restricted to appropriate staff roles.
- Upload names are server-generated and folder/key traversal is rejected.
- Upload cap reduced from 2 GB to 50 MB during stabilization.
- Extension and declared MIME allowlists enforced; GIF removed from accepted uploads.
- Signed download links shortened to 5 minutes.
- Direct storage URL is no longer returned after upload.
- Default `minioadmin` credentials removed; explicit S3 credentials required.
- Remaining: object-level ownership/relationship authorization and content-signature inspection.

### Authentication
- Access token lifetime reduced from 7 days to 15 minutes.
- JWT secret is now required and must be at least 32 characters.
- Refresh tokens use 48 cryptographically random bytes and are stored only as SHA-256 hashes.
- Refresh token rotation retained; inactive users cannot refresh sessions.
- Password reset OTP uses cryptographic randomness, is stored hashed, expires after 10 minutes, and is never logged.
- OTP verification consumes the OTP and returns a 10-minute purpose-bound reset JWT.
- Password reset now requires that verified reset token rather than accepting email+OTP again.
- Password reset and password change revoke all refresh sessions.
- New passwords require at least 10 characters and bcrypt cost 12.
- Universal `student123` account password removed. Newly created student accounts receive an unreturned cryptographically random bootstrap secret, so they cannot log in until the verified onboarding/reset delivery flow sets their password.
- Remaining: reset/onboarding delivery provider and rate limiting/lockout.

## P0 — Authorization and privacy
- [ ] Finish `schoolId`/tenant scope audit on every sensitive query/dashboard count.
- [x] Restrict student list/detail endpoints by role and relationship where identified.
- [x] Restrict parent access to linked children where identified.
- [x] Restrict global search by school and role where identified.
- [ ] Add negative authorization tests: cross-student, cross-parent, cross-school and unauthorized-role access must fail.

## P0 — Homework and grading
- [x] Derive submitting student from authenticated user.
- [x] Verify student eligibility for assignment/class.
- [x] Restrict teacher assignment management/review/grading to permitted ownership/subjects.
- [ ] Add regression tests for impersonation and unauthorized grading.

## P0 — File storage
- [x] Remove unrestricted bucket/file listing from ordinary authenticated users.
- [ ] Require object-level role/ownership/relationship checks for every upload/download/delete context.
- [x] Reduce inherited 2 GB upload limit.
- [ ] Validate actual file content/signature in addition to extension and declared MIME type.
- [x] Generate safe server-side object names and prevent path/key abuse.

## P0 — Authentication
- [x] Remove predictable/universal student default passwords; accounts remain inaccessible until secure onboarding/reset is completed.
- [x] Replace `Math.random()` OTP generation with cryptographically secure randomness.
- [x] Do not log password-reset secrets/OTPs.
- [x] Require verified, short-lived reset token for password reset.
- [x] Shorten access-token lifetime and add refresh-token rotation/hashing/revocation controls.
- [ ] Implement reset/onboarding delivery provider.
- [ ] Add authentication/reset rate limiting and brute-force protection.

## P0 — Deployment and secrets
- [ ] Remove predictable production credentials from all examples/defaults.
- [ ] Do not expose MySQL, Redis, MinIO admin/API ports publicly in production.
- [ ] Verify production CORS, proxy, cookie/token and TLS assumptions.
- [ ] Add dependency and secret scanning to CI.

## P1 — Test quality and release gate
- [ ] Tighten E2E assertions: unexpected HTTP 500 responses must fail tests.
- [ ] Add object-level authorization and tenant-isolation tests.
- [ ] Run clean install, lint, typecheck, build, unit/integration/E2E tests.
- [ ] Verify database migrations and seed behavior on a clean non-production database.
- [ ] Verify backup/restore procedure before real data is allowed.

## Exit criteria
Phase 0 is complete only when the critical authorization, homework identity, teacher ownership, file-access, authentication and deployment issues above are fixed and covered by meaningful tests. Only then create `bigchange-rebrand` and begin BigChange visual/UI work.

## 2026-09-29  -  Infrastructure configuration
- `docker-compose.yml`: bind all four infrastructure ports to 127.0.0.1; require explicit database and MinIO secrets instead of predictable fallbacks.
- `.env.example`: leave secrets blank, fix Redis host port to 6381.
- `DEPLOYMENT.md`: document setup, existing-volume credential rotation, environment loading, host-local limitations, production TLS/proxy/storage/token blockers.
- Inspection: no application Dockerfiles, proxy/TLS configs or CI workflows found. README and demo seeds still contain inherited demo credentials; these are not production provisioning and must not be run.
- Validation: reviewed config diff; Docker is not installed here, so Compose parsing/runtime and external port checks are blocked. Production checklist remains open.

## 2026-09-30 - HTTP configuration hardening
- `packages/api/src/config/http-security.ts`: validate exact origins, trim/deduplicate lists, require explicit HTTPS origins in production.
- `packages/api/src/main.ts`: use validated CORS configuration; disable Swagger in production; default API listener to loopback.
- `.env.example`, `DEPLOYMENT.md`: document NODE_ENV/API_HOST and private-network overrides. Live TLS/proxy, remote signed downloads and token storage remain unverified release blockers.
- `packages/api/test/http-security.spec.ts`, `test/jest-security.json`: 14 focused policy tests; all passed locally. API test script now explicitly loads the TypeScript test config (default Jest could not parse the new test).
- Full application checks are recorded separately below; policy tests do not establish end-to-end authorization or TLS correctness.

## 2026-09-30 - CI security gates
- `.github/workflows/security.yml`: dependency audit (high/critical fail), full-history Gitleaks scan and isolated HTTP policy tests on pushes/PRs; actions pinned to verified commit SHAs with read-only repository permissions and no persisted checkout credentials.
- Weekly schedule runs only after the workflow reaches the default branch; main is preserved in this pass. Remote execution and branch-protection enforcement are not yet verified.
- Local `npm audit --json`: 48 findings (6 low, 21 moderate, 18 high, 3 critical). Critical packages: handlebars, next, tar. Dependency upgrades require a separate compatibility/test pass; no audit suppressions or force upgrades applied.
- Gitleaks execution is pending CI; no clean secret-scan claim. Existing leaked credentials would require rotation even if later removed from files.

## 2026-09-30 - Verification and remaining blockers
- `README.md`: remove demo-seeding commands and advertised passwords, remove the unsupported production-ready claim, link deployment guidance and correct Redis port. Inherited seed/test fixtures still contain demo passwords and must not be used for provisioning.
- Clean `npm ci`: passed after moving TEMP/TMP into the workspace. No dependencies or lockfile versions changed.
- `npm test`: passed, 14 HTTP policy tests; shared package build also passed. This is not the database E2E suite.
- YAML syntax parsing: Compose and security workflow passed with js-yaml. `git diff --check` passed. Docker is absent, so Compose semantic/runtime and port-isolation checks remain blocked.
- `npm run lint`: failed because ESLint is not installed/configured in the inherited repository.
- Web typecheck: failed with 14 errors in untouched fees, LMS, promotions and users pages. Existing Next configuration skips type/lint errors during builds, so build success would not clear this gate.
- API typecheck and root build: failed with errors across untouched modules, including unavailable generated Prisma types. Prisma generation failed downloading the Windows engine from binaries.prisma.sh; these failures cannot yet be classified entirely as code defects versus missing generated types.
- Standalone web build also encountered a blocked Google Fonts download; see saved verification logs for final compiler output.
- Database E2E tests not run: no isolated MySQL/MinIO runtime, no test environment credentials, and inherited tests require demo accounts/data. No seeds, migrations or real-data operations performed.
- Production TLS, proxy topology, remote storage URLs, bucket policy, secret rotation and branch protection need deployment-side verification. Authentication throttling, onboarding delivery, tenant/object authorization and dependency upgrades remain open.
- Local Git push failed connecting to github.com:443. Commits remain local on bigchange-stabilization; no remote branch or main updates were made. A Git bundle and verification report preserve the changes for transfer.

## 2026-09-30 - Dependency remediation follow-up
- `packages/web/package.json`: Next 14.2.15 -> 14.2.35, staying on the existing major to reduce migration scope. This does NOT resolve all current Next advisories.
- `packages/api/package.json`: bcrypt 5 -> 6.0.0, removing the old node-pre-gyp/tar chain. Cost-12 hash/compare and wrong-password rejection passed locally; no stored passwords changed.
- `package-lock.json`: regenerated for these versions and compatible Handlebars 4.7.9. No force-audit fixes or vulnerability suppressions.
- Fresh audit: 44 findings (6 low, 21 moderate, 16 high, 1 critical), down from 48/3 critical. Remaining critical package: Next. A supported-major Next migration with UI/runtime regression checks is still required.
- Prisma client generation now succeeds with network access; API typecheck and API build pass. The earlier missing-client errors are resolved.
- Policy tests: 14/14 passed after dependency updates. Full web build is recorded in the follow-up verification entry.

## 2026-09-30 - Web typecheck repairs
- `packages/web/src/app/(dashboard)/users/page.tsx`: parenthesize the mixed nullish/OR fallback that prevented compilation.
- `fees/page.tsx`: align payment/defaulter labels with the string-or-object rendering already present.
- `promotions/page.tsx`: declare the existing studentId/fromClassId response fields used by fallback labels.
- `lms/page.tsx`: type the dashboard stats response and handle HTTP failure through the existing catch path.
- Web `tsc --noEmit --incremental false`: passed after dependency installation completed. No redesign, mock data or unrelated features introduced.
