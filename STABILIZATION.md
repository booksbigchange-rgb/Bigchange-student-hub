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
