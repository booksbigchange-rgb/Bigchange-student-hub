# BigChange Student Hub — Phase 0 Stabilization

This branch exists to make the inherited School MIS safe enough for BigChange evaluation before any rebranding or real student data is introduced.

## Rules

- Do not rebrand on this branch.
- Do not load real student, parent, grade, attendance, or homework data yet.
- Preserve working features unless a security fix requires a behavior change.
- Make small, reviewable commits and test each security boundary.
- Authorization must be derived from the authenticated identity and database relationships; never trust client-supplied IDs as proof of permission.

## P0 — Authorization and privacy

- [ ] Enforce `schoolId`/tenant scope on sensitive queries and dashboard counts.
- [ ] Restrict student list/detail endpoints by role and relationship.
- [ ] Restrict parent access to linked children only.
- [ ] Restrict global search by school and role; prevent student access to staff/admission/private records.
- [ ] Add negative authorization tests: cross-student, cross-parent, cross-school and unauthorized-role access must fail.

## P0 — Homework and grading

- [ ] Derive the submitting student from the authenticated user instead of trusting `studentId` from the request body.
- [ ] Verify the student is eligible for the assignment/class.
- [ ] Restrict teacher assignment updates, publishing, submission review and grading to permitted classes/subjects/assignments.
- [ ] Add regression tests for impersonation and unauthorized grading.

## P0 — File storage

- [ ] Remove unrestricted bucket/file listing from ordinary authenticated users.
- [ ] Require role/ownership checks for upload, download URL generation and deletion.
- [ ] Reduce the inherited 2 GB upload limit to feature-appropriate limits.
- [ ] Validate actual content/MIME type in addition to filename extension.
- [ ] Generate safe server-side object names and prevent path/key abuse.

## P0 — Authentication

- [ ] Replace predictable/universal student default passwords with a secure onboarding flow.
- [ ] Replace `Math.random()` OTP generation with a cryptographically secure mechanism.
- [ ] Do not log password-reset secrets/OTPs in production.
- [ ] Require a verified, short-lived reset token for password reset.
- [ ] Shorten access-token lifetime and review refresh-token rotation/revocation.

## P0 — Deployment and secrets

- [ ] Remove predictable production credentials from examples/defaults.
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

Phase 0 is complete only when the critical authorization, homework identity, teacher ownership, file-access, authentication and deployment issues above are fixed and covered by meaningful tests. Only then create `bigchange-rebrand` and begin the BigChange visual/UI work.
