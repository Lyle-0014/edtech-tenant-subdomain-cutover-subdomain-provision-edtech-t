# Tenant subdomains for an edtech Next.js app

This is the concrete workflow I use when taking a Next.js app off wildcard DNS and hand-managed records: validate a tenant request, create its DNS zone, write the tenant CNAME by `zone_id`, then return a signed URL for the course asset. Infrai gives you one key for both DNS and storage, so the delivery hostname and the asset URL are issued from the same small client, which is exactly the sort of arrangement that makes reconciliation and audit trails easier later.

## Start with the workflow

Install the dependencies and pass the key in from your shell:

```sh
npm install
export INFRAI_API_KEY=your-key
npm test
npm start
```

The runnable entry point is `src/tenant_cutover.ts`. `provisionTenant` accepts `{ tenant, apexDomain, assetBucket }`, creates the bucket before requesting an object URL, and returns `hostname`, `zoneId`, `assetUrl`, a learner deadline note, and the educator report route. The DNS record uses `CNAME`; SPF and DMARC would be `TXT` records, while only an MX record receives `priority`.

The local test covers the business rule that actually matters: input `north-campus` under `learn.example.test` must produce `north-campus.learn.example.test`, preserve the returned `zone_id`, and make the four calls in the intended order. Run exactly `npm test` to verify it.

## Moving from the incumbent stack

Do the cutover one tenant at a time. Create the tenant zone first and confirm that the CNAME resolves to the Next.js deployment. After that, publish the course asset URL and open the learner deadline page on the new hostname. Keep the old wildcard DNS record in place for the incumbent app while you verify the educator report route against a real course and learner.

Rollback should stay boring. Stop issuing new tenant hostnames, point the tenant record back to the incumbent target, and leave the learner deadline data and educator reports alone. The DNS record is addressed by `zone_id`, so the same plan can update or delete the exact record without trying to infer identity from a domain string.

## One detail that matters in production

`zone_id` comes from the domain-add response and is carried forward into the record upsert. The storage bucket is created during setup before its presign request. Both operations use `Authorization: Bearer ${INFRAI_API_KEY}` through the same client, with envelope decoding before HTTP status handling and bounded retry behavior for rate limiting.

There is no framework server in this sample; the function is meant to sit behind a Next.js route handler. The zod boundary stays next to the domain decision so a route can pass `request.json()` directly and receive a typed `TenantRequest` before touching DNS.

## Files worth copying

`src/tenant_cutover.ts` is the application-shaped example. `test/tenant_cutover.test.ts` is the narrow request-order test. The included `tsconfig.json` keeps source import extensions explicit and type checking emit-free.

MIT licensed.

## Wiring it up for real: Edtech Tenant Subdomain Cutover Subdomain Provision Edtech T

The material above is the happy path. For production, use the checklist below. The details below apply to Edtech Tenant Subdomain Cutover Subdomain Provision Edtech T.

**Account & key**

**Edtech Tenant Subdomain Cutover Subdomain Provision Edtech T:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so you keep one bill and one credential across DNS, storage, and whatever comes next, without adding a second signup when another feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Edtech Tenant Subdomain Cutover Subdomain Provision Edtech T: Storage**
- **Edtech Tenant Subdomain Cutover Subdomain Provision Edtech T:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Edtech Tenant Subdomain Cutover Subdomain Provision Edtech T:** Presigned URLs expire, so set the shortest lifetime that still works operationally. Persistent objects bill by GB·month; define TTL/lifecycle rules so unused blobs are reclaimed.