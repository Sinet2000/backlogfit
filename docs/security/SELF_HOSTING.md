# Self-hosting Backlogfit securely

This guide is for operators running the Node server image (`apps/server/Containerfile`) inside
their own network. It assumes Podman or Docker and a TLS-terminating reverse proxy. Read
[PRIVACY.md](PRIVACY.md) first; the short version is that the application stores nothing
beyond a room's lifetime and logs nothing per request, so the remaining privacy work is in
**your proxy and your host**.

Checklist:

- [ ] Image pulled **by digest** and its signature and provenance verified (section 6).
- [ ] Container runs read-only, non-root, no capabilities, no privilege escalation, resource
      limits (section 1).
- [ ] Container has **no outbound network access** (section 5).
- [ ] TLS 1.2+ at the proxy, WebSocket upgrade forwarded, client `X-Forwarded-For` overwritten,
      access logs off or anonymized (section 2).
- [ ] `PUBLIC_ORIGIN` set to the exact public https origin, `NODE_ENV=production` (section 3).
- [ ] `DATA_DIR` empty (memory only) unless you need rooms to survive restarts (section 4).

## 1. Running the container

The image is distroless (no shell, no package manager), runs as UID/GID 65532, and needs only
`/tmp` (and `/data` if persistence is enabled) to be writable.

### Podman / Docker

```sh
IMAGE=ghcr.io/sinet2000/backlogfit@sha256:<digest-from-release-notes>

podman run -d --name backlogfit \
  --read-only \
  --tmpfs /tmp:rw,size=16m,mode=1777,noexec,nosuid,nodev \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  --user 65532:65532 \
  --memory=256m --memory-swap=256m --cpus=1 --pids-limit=128 \
  -p 127.0.0.1:8080:8080 \
  -e NODE_ENV=production \
  -e PUBLIC_ORIGIN=https://estimate.example.com \
  -e TRUST_PROXY=true \
  -e DATA_DIR= \
  --restart=unless-stopped \
  "$IMAGE"
```

`docker run` accepts the same flags. Notes:

- Publish only on `127.0.0.1` (or an internal interface) so the proxy is the only way in.
- Rootless Podman adds a user-namespace layer on top; with rootful Podman add `--userns=auto`.
- Keep the default seccomp and SELinux/AppArmor profiles; the app needs no extra syscalls.
- The image has a `HEALTHCHECK` (`GET /api/health` on loopback). Build with
  `podman build --format docker` to keep it.

### Compose

`apps/server/compose.example.yml` already sets `read_only`, `cap_drop: [ALL]`,
`no-new-privileges`, a tmpfs `/tmp`, `mem_limit`, `pids_limit` and binds to `127.0.0.1`. Add a
CPU limit (`cpus: "1.0"`). It runs memory-only by default; uncomment `DATA_DIR` and the
volume only if rooms must survive restarts (see also section 5 for an egress-free network
layout).

### Kubernetes (equivalent settings)

```yaml
securityContext:            # container
  runAsNonRoot: true
  runAsUser: 65532
  runAsGroup: 65532
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities: { drop: [ALL] }
  seccompProfile: { type: RuntimeDefault }
resources:
  limits: { memory: 256Mi, cpu: "1" }
volumeMounts:
  - { name: tmp, mountPath: /tmp }
volumes:
  - { name: tmp, emptyDir: { medium: Memory, sizeLimit: 16Mi } }
automountServiceAccountToken: false   # pod spec
```

## 2. Reverse proxy

Requirements for every proxy:

1. TLS 1.2+ (prefer 1.3), a valid certificate for the public host. The app itself sends HSTS
   (`max-age=63072000; includeSubDomains`) when `NODE_ENV=production` and `PUBLIC_ORIGIN` is
   https, so do not add a second HSTS header.
2. Forward WebSocket upgrades on `/ws/` with a read timeout above the 30 s heartbeat.
3. **Overwrite** `X-Forwarded-For` with the peer address instead of appending, so a client
   cannot inject addresses into the rate-limit key. Then set `TRUST_PROXY=true`.
4. Turn access logs **off**, or use a format without client IP, user agent, referrer and full
   path (the WebSocket path contains the room ID, which is not a secret but links log lines to
   a meeting). Error logs of most proxies include the client IP; keep their level at `crit`/
   `error` and rotate them quickly.
5. Limit request bodies to 64 KiB (the largest valid request is far smaller).
6. Do not add caching for `/r`, `/new` or `/api/*` (the app sends `Cache-Control: no-store`).

### nginx

```nginx
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
  listen 443 ssl;
  http2 on;
  server_name estimate.example.com;
  ssl_certificate     /etc/ssl/estimate.example.com.crt;
  ssl_certificate_key /etc/ssl/estimate.example.com.key;
  ssl_protocols TLSv1.2 TLSv1.3;
  server_tokens off;
  client_max_body_size 64k;

  access_log off;                       # or: a log_format without $remote_addr, $http_user_agent, $request_uri
  error_log /var/log/nginx/backlogfit.error.log crit;

  location /ws/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;   # overwrite, never $proxy_add_x_forwarded_for
    proxy_read_timeout 120s;
    proxy_buffering off;
  }

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}

server {                                 # plain HTTP only redirects
  listen 80;
  server_name estimate.example.com;
  access_log off;
  return 301 https://$host$request_uri;
}
```

### Caddy

Caddy obtains certificates automatically, proxies WebSockets without extra configuration and
writes no access log unless a `log` directive is present.

```caddyfile
estimate.example.com {
	# No `log` directive: no access log.
	request_body {
		max_size 64KB
	}
	header -Server
	reverse_proxy 127.0.0.1:8080 {
		header_up X-Forwarded-For {remote_host}
	}
}
```

### Traefik

Traefik writes access logs only when `accessLog` is configured, and strips client-supplied
`X-Forwarded-*` headers unless the source IP is in `forwardedHeaders.trustedIPs` (keep it empty
on the public entrypoint).

```yaml
# traefik.yml (static)
entryPoints:
  websecure:
    address: ":443"
    # forwardedHeaders.trustedIPs intentionally not set
# accessLog: omitted. If you must enable it, drop identifying fields:
# accessLog:
#   fields:
#     defaultMode: keep
#     names: { ClientAddr: drop, ClientHost: drop, ClientPort: drop, RequestPath: drop }
#     headers: { defaultMode: drop }
```

```yaml
# compose labels on the backlogfit service
labels:
  - traefik.enable=true
  - traefik.http.routers.backlogfit.rule=Host(`estimate.example.com`)
  - traefik.http.routers.backlogfit.entrypoints=websecure
  - traefik.http.routers.backlogfit.tls=true
  - traefik.http.routers.backlogfit.middlewares=backlogfit-body
  - traefik.http.middlewares.backlogfit-body.buffering.maxRequestBodyBytes=65536
  - traefik.http.services.backlogfit.loadbalancer.server.port=8080
```

### Behind Cloudflare (tunnel or proxied DNS)

Set `TRUST_PROXY=cloudflare`; the client
address then comes from `CF-Connecting-IP`. Make sure the origin is reachable **only** through
Cloudflare (tunnel, or firewall to Cloudflare's ranges), otherwise the header can be forged.

## 3. Environment variables

All have safe defaults; invalid values make the server refuse to start. The Worker uses the
same names as `vars`.

| Variable | Default | Range / values | Meaning |
|---|---|---|---|
| `PUBLIC_ORIGIN` | `http://localhost:$PORT` | absolute http(s) origin; **required** when `NODE_ENV=production` | Exact public origin, e.g. `https://estimate.example.com`. Origin check on `POST /api/rooms` and WebSocket upgrades, CSP `connect-src`. |
| `ALLOWED_ORIGINS` | empty | comma-separated origins | Extra exact origins. Keep empty in production. |
| `NODE_ENV` | `production` in the image | `production`, `development`, `test` | `production`: Trusted Types enforced and source maps hidden (always); HSTS and `upgrade-insecure-requests` only when `PUBLIC_ORIGIN` is https. |
| `PORT` / `HOST` | `8080` / `0.0.0.0` | 0-65535 / address | Listen address inside the container. |
| `TRUST_PROXY` | `false` | `false`, `true` (= 1 hop), `1`-`9` (hop count), `cloudflare` | How the rate-limit key is derived (`parseTrustProxy`). With n hops the client is the n-th `X-Forwarded-For` entry from the right; `cloudflare` reads `CF-Connecting-IP`. Anything else refuses to start. |
| `DATA_DIR` | empty in the image (memory only) | directory path | Opt-in persistence: `/data` (or any path) stores `backlogfit.sqlite` so rooms survive restarts. Empty = nothing touches disk (recommended). |
| `WEB_DIR` | `/app/apps/web/build` | directory path | Static build served by the server. |
| `DEFAULT_LIFETIME_HOURS` | `2` | 1-24, ≤ `MAX_LIFETIME_HOURS` | Default room lifetime. |
| `MAX_LIFETIME_HOURS` | `8` | 1-24 | Hard maximum lifetime including extensions. |
| `IDLE_TIMEOUT_MINUTES` | `30` | 1-1440 | Room ends after this long without voter/facilitator activity. |
| `MAX_PARTICIPANTS` | `50` | 2-500 | Upper bound per room (rooms may choose fewer). |
| `MAX_TASKS` | `500` | 1-5000 | Tasks per room. |
| `MAX_MESSAGE_BYTES` | `16384` | 1024-262144 | Largest accepted WebSocket frame. |
| `MAX_ROOMS` | `1000` | 1-1000000 | Concurrent rooms per server. |
| `RATE_MSGS_PER_SEC` / `RATE_BURST` | `20` / `40` | 1-1000 / 1-10000 | Per-connection message bucket (the room bucket is 5×). |
| `ROOM_CREATE_PER_MIN` | `10` | 1-10000 | Room creations per client address per minute. |
| `PASSCODE_MAX_ATTEMPTS` | `5` | 1-100 | Wrong passcodes per room before passcode joins are refused until a facilitator unlocks. |
| `MAX_CONNECTIONS` | `5000` | 1-1000000 | Global cap on concurrent WebSocket connections (handshakes included); excess upgrades get 503. |
| `MAX_CONNECTIONS_PER_CLIENT` | `50` | 1-100000 | Concurrent WebSocket connections per client address; excess get 429. |
| `WS_UPGRADES_PER_MIN` | `120` | 1-100000 | WebSocket upgrades per client address per minute (token bucket, burst = same value). |
| `HELLO_TIMEOUT_SECONDS` | `20` | 1-3600 | A socket that does not join within this time is closed (1008). |
| `SOCKET_TIMEOUT_SECONDS` | `90` | 30-3600 | A joined socket that sends nothing for this long is treated as dead: closed (1001) and shown as disconnected. The web client pings every 25 s. |
| `HEARTBEAT_SECONDS` | `30` | 1-3600 | Node only: protocol-level WebSocket ping interval; a socket that misses one pong is dropped. |
| `TEST_TIME_SCALE` | `1` | ignored unless `NODE_ENV=test` | Test-only clock acceleration; has no effect in production. |

The limits from `DEFAULT_LIFETIME_HOURS` to `PASSCODE_MAX_ATTEMPTS`, plus `WS_UPGRADES_PER_MIN`, `HELLO_TIMEOUT_SECONDS` and `SOCKET_TIMEOUT_SECONDS`, accept plain decimal integers only (`readLimits` in `packages/security/src/limits.ts`) and are read the same way by both backends; the others are Node-only and read in `apps/server/src/config.ts`. Out-of-range values stop the server at startup. The Worker reads the same names from `vars`; `MAX_ROOMS`, `MAX_CONNECTIONS*` and `HEARTBEAT_SECONDS` do not apply there (one Durable Object per room, no protocol pings under hibernation). The Rate Limiting bindings in `wrangler.jsonc` must be kept equal to `ROOM_CREATE_PER_MIN` and `WS_UPGRADES_PER_MIN`.

## 4. Persistence and backups

- **Backups are not recommended.** Rooms are ephemeral by design; a backup would retain names,
  task text and unrevealed votes beyond the promised lifetime. Exclude the data volume from
  backup jobs and snapshots.
- Memory-only (`DATA_DIR=`) is the most private setting: a restart ends all running rooms
  (participants see "This session has ended"), and nothing is ever written to disk.
- With `DATA_DIR` set, each room is one SQLite row until it ends; then it is deleted with
  `secure_delete` and the WAL is truncated. Copy-on-write filesystems, snapshots and SSD
  wear-levelling can still retain old blocks, so put the volume on an encrypted filesystem.
  (A tmpfs `/data` gives no benefit over memory-only: it is emptied when the container stops.)

## 5. Deny network egress

The server never makes outbound connections (no telemetry, no update checks, no external
fonts or APIs). Enforce that, so a compromised process cannot exfiltrate anything.

Compose: put the app on an **internal** network that only the proxy also joins.

```yaml
networks:
  edge: {}
  app: { internal: true }        # no route to the outside world
services:
  proxy:
    networks: [edge, app]
    ports: ["443:443", "80:80"]
  backlogfit:
    networks: [app]              # no `ports:`; the proxy reaches it as http://backlogfit:8080
```

Kubernetes:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: backlogfit-no-egress }
spec:
  podSelector: { matchLabels: { app: backlogfit } }
  policyTypes: [Egress]
  egress: []                     # deny all outbound, including DNS
```

Host firewall (rootful Podman/Docker on Linux): drop new outbound connections from the
container's network, e.g. with nftables in the `DOCKER-USER`/forward chain for the container's
subnet.

## 6. Verifying the image

Release images are signed keyless with cosign from the GitHub release workflow and carry
GitHub build-provenance and CycloneDX SBOM attestations. Always deploy by digest.

```sh
IMAGE=ghcr.io/sinet2000/backlogfit
DIGEST=sha256:<from the release notes>

# Signature: issued to this repository's release workflow on a version tag.
cosign verify "$IMAGE@$DIGEST" \
  --certificate-identity-regexp '^https://github.com/Sinet2000/backlogfit/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com

# Build provenance (SLSA) and SBOM attestations.
gh attestation verify "oci://$IMAGE@$DIGEST" --repo Sinet2000/backlogfit
gh attestation verify "oci://$IMAGE@$DIGEST" --repo Sinet2000/backlogfit \
  --predicate-type https://cyclonedx.org/bom

# Inspect or re-scan the SBOM yourself.
gh attestation download "oci://$IMAGE@$DIGEST" --repo Sinet2000/backlogfit \
  --predicate-type https://cyclonedx.org/bom
trivy sbom backlogfit-image.cdx.json        # or: osv-scanner scan --sbom backlogfit-image.cdx.json
```

Air-gapped environments: mirror the image by digest together with its signature and
attestations (`cosign copy`), and verify against the mirrored copy.

## 7. Updating

1. Read the release notes and CHANGELOG (security fixes are called out; see `SECURITY.md` for
   advisories).
2. Pull the new digest and verify it (section 6).
3. Replace the container (`podman run` with the new digest, or update the compose/Kubernetes
   manifest). The server shuts down gracefully on SIGTERM: sockets are closed with 1001 and
   clients reconnect automatically. In memory-only mode running rooms end with the restart,
   so update outside meeting hours.
4. Watch the healthcheck; roll back by redeploying the previous digest.

Subscribe to GitHub releases or security advisories of `Sinet2000/backlogfit` to be notified.
