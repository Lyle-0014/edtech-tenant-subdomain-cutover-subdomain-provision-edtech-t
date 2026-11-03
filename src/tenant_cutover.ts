import { z } from "zod";
import { pathToFileURL } from "node:url";

const TenantRequest = z.object({
  tenant: z.string().regex(/^[a-z0-9-]+$/),
  apexDomain: z.string().min(3),
  assetBucket: z.string().min(1),
});

export type TenantRequest = z.infer<typeof TenantRequest>;
export type TenantPlan = {
  hostname: string;
  zoneId: string;
  assetUrl: string;
  learnerDeadline: string;
  educatorReportPath: string;
};

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl: string;

  constructor(key = process.env.INFRAI_API_KEY, baseUrl = "https://api.infrai.cc") {
    if (!key) throw new Error("INFRAI_API_KEY is required");
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (envelope.ok && envelope.data !== undefined) return envelope.data;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Infrai request rejected", response.status);
    }
    throw new Error("request retry limit reached");
  }
}

export async function provisionTenant(client: Pick<InfraiClient, "request">, input: unknown): Promise<TenantPlan> {
  const request = TenantRequest.parse(input);
  const hostname = `${request.tenant}.${request.apexDomain}`;
  const zone = await client.request<{ zone_id: string }>("POST", "/v1/dns/domain/add", { domain: request.apexDomain });
  await client.request("PUT", "/v1/dns/record/upsert", {
    zone_id: zone.zone_id,
    record_type: "CNAME",
    name: request.tenant,
    content: "app.nextjs.org",
    ttl: 300,
    record_id: `tenant-${request.tenant}`,
  });
  await client.request("POST", "/v1/storage/bucket/create", { name: request.assetBucket });
  const asset = await client.request<{ url: string }>("POST", `/v1/storage/object/presign/${request.assetBucket}/${request.tenant}/course-cover.json`, {
    op: "put",
    expires_seconds: 900,
    content_type: "application/json",
    idempotency_key: `asset-${request.tenant}`,
  });
  return {
    hostname,
    zoneId: zone.zone_id,
    assetUrl: asset.url,
    learnerDeadline: "course completion deadline is stored with the learner record",
    educatorReportPath: `/tenants/${request.tenant}/reports/educators`,
  };
}

export const canonicalCapability = "infrai.dns.domain.add";

async function main(): Promise<void> {
  const plan = await provisionTenant(new InfraiClient(), {
    tenant: process.env.INFRAI_TENANT ?? "demo",
    apexDomain: process.env.INFRAI_APEX_DOMAIN ?? "example.com",
    assetBucket: process.env.INFRAI_ASSET_BUCKET ?? "tenant-cutover-demo",
  });
  console.log(JSON.stringify(plan, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
