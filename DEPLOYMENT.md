# Deployment security  -  Phase 0

This branch is not approved for production or real student data.

## Host-local setup

The Compose file runs infrastructure only. All published ports bind to IPv4
loopback: MySQL 3308, Redis 6381, MinIO API 9000 and console 9001.
Run the application on the same host. Remote computers cannot use these URLs.
Redis has no authentication: only trusted local processes/containers may share
this host or Compose network. Do not expose its port or use host networking.

Copy `.env.example` to an untracked `.env`. Generate independent secrets with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Use separate values for DB_PASSWORD, DB_ROOT_PASSWORD, JWT_SECRET and
MINIO_PASSWORD. Choose a non-default MINIO_USER. Fill DATABASE_URL using
`mysql://mis_user:YOUR_GENERATED_HEX_PASSWORD@127.0.0.1:3308/mis_ilsms`.
JWT_REFRESH_SECRET is unused by the current opaque refresh-token implementation.
For local evaluation, S3_ACCESS_KEY/S3_SECRET_KEY must match the MinIO values.
Production requires a separate bucket-scoped storage identity, not root access.
Supply the API variables to its process (or its untracked packages/api/.env);
root Compose variables are not automatically inherited by workspace processes.
Supply NEXT_PUBLIC_API_URL to the web build separately.

Run `docker compose config --quiet` before `docker compose up -d`.
Changing these variables does not rotate credentials in existing database volumes.
Back up first and rotate existing DB users/MinIO credentials deliberately; do not
remove volumes as a password-reset shortcut. Rotate any previously deployed
example passwords and signing secrets. Do not run inherited demo seed scripts.

## Production release blockers

No application Dockerfiles, production proxy configuration, certificate provisioning,
or CI existed at the start of this pass. Loopback bindings reduce exposure but
are not a verified production deployment. Confirm firewall rules and port scans
on the actual host; Docker runtime validation is required.

Terminate TLS at a controlled reverse proxy, redirect HTTP to HTTPS and configure
HSTS after certificate/hostname validation. Bind the API and web processes to
loopback, or isolate them on a private container network accessible only to the
proxy. Do not trust client-supplied forwarded headers. Express proxy trust remains
disabled until the real trusted proxy addresses and topology are known.
Configure exact HTTPS frontend origins for production CORS. CORS is a browser
policy, not an authorization boundary or protection against non-browser clients.

The frontend keeps access and refresh tokens in localStorage, so XSS can read
them; cookie security flags do not protect this flow. Token-storage changes,
CSP testing and authentication throttling remain separate release blockers.
MinIO signed downloads currently use S3_ENDPOINT directly: a remote browser
cannot reach localhost/private storage. A reviewed HTTPS storage gateway and
private bucket policies must be designed and tested before remote rollout.
Never publish the MinIO console to solve download reachability.

The API defaults to API_HOST=127.0.0.1. Containers may explicitly use 0.0.0.0
only behind the private network described above. NODE_ENV=production disables
Swagger and requires a nonempty list of exact HTTPS CORS origins (no paths,
trailing slashes, wildcards or credentials). Separate entries with commas.
