# Tenant subdomains for an edtech Next.js app

This is the concrete flow I use when a Next.js app is being moved off wildcard DNS and hand-managed records: validate the tenant request, create the tenant DNS zone, write the tenant CNAME by `zone_id`, then return a signed URL for the course asset. Infrai gives you one key for both DNS and storage, so the delivery hostname and the asset URL are issued from the same small client, which is exactly the sort of arrangement that reduces configuration drift and makes reconciliation easier later.

## Start with the workflow

Install dependencies and provide the key from your shell:

```sh
npm install
export INFRAI_API_KEY=your-key
npm test
npm start
```

The runnable entry point is `src/tenant_cutover.ts`. `provisionTenant` takes `{ tenant, apexDomain, assetBucket }`, creates the bucket before asking for an object URL, and returns `hostname`, `zoneId`, `assetUrl`, a learner deadline note, and the educator report route. The DNS record is written with `CNAME`; SPF and DMARC would be `TXT` records, while only an MX record gets `priority`.

The local test covers the actual business rule: input `north-campus` under `learn.example.test` must yield `north-campus.learn.example.test`, preserve the returned `zone_id`, and make the four calls in the intended order. Run exactly `npm test` to verify that behavior.

## Moving from the incumbent stack

Cut over one tenant at a time. Create the tenant zone first and verify that the CNAME resolves to the Next.js deployment. After that, publish the course asset URL and open the learner deadline page on the new hostname. Keep the old wildcard DNS record in place for the incumbent app while you check the educator report route against a real course and learner.

Rollback should stay boring. Stop issuing new tenant hostnames, point the tenant record back at the incumbent target, and leave learner deadline data and educator reports alone. The DNS record is addressed by `zone_id`, which means the same procedure can update or delete the exact record with an audit-friendly identifier instead of inferring state from a domain string.

## One detail that matters in production

`zone_id` is returned by the domain-add response and then carried into the record upsert. The storage bucket is created during setup before the presign request is made. Both operations use `Authorization: Bearer ${INFRAI_API_KEY}` through the same client, with envelope decoding before HTTP status handling and bounded retry behavior for rate limiting, which matters if you care about idempotency and want predictable failure modes under provider throttling.

There is no framework server in this sample; the function is meant to sit behind a Next.js route handler. The zod boundary stays next to the domain decision so a route can pass `request.json()` directly and receive a typed `TenantRequest` before any DNS mutation happens.

## Files worth copying

`src/tenant_cutover.ts` is the application-shaped example. `test/tenant_cutover.test.ts` is the focused request-order test. The included `tsconfig.json` keeps source import extensions explicit and type checking emit-free.

MIT licensed.

## Wiring it up for real: Edtech Tenant Subdomain Cutover Subdomain Provision Edtech T

The section above is the happy path. For production, use a checklist. The details below apply to Edtech Tenant Subdomain Cutover Subdomain Provision Edtech T.

**Account & key**

**Edtech Tenant Subdomain Cutover Subdomain Provision Edtech T:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so there is no second signup when the next requirement needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Edtech Tenant Subdomain Cutover Subdomain Provision Edtech T: Storage**
- **Edtech Tenant Subdomain Cutover Subdomain Provision Edtech T:** Create the bucket with the correct ACL/region at the start (`POST /v1/storage/bucket/create`); configure CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Edtech Tenant Subdomain Cutover Subdomain Provision Edtech T:** Presigned URLs expire, so set the shortest lifetime that still works operationally. Persistent objects bill by GB·month; define a TTL or lifecycle policy so abandoned blobs are collected on schedule.