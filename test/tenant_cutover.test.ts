import assert from "node:assert/strict";
import test from "node:test";
import { provisionTenant } from "../src/tenant_cutover.ts";

test("a valid tenant gets its own hostname and reporting route", async () => {
  const calls: Array<{ method: string; path: string }> = [];
  const client = {
    request: async <T>(method: string, path: string): Promise<T> => {
      calls.push({ method, path });
      if (path === "/v1/dns/domain/add") return { zone_id: "zone-edtech" } as T;
      if (path.includes("/v1/storage/object/presign/")) return { url: "https://assets.example.test/signed" } as T;
      return {} as T;
    },
  };
  const plan = await provisionTenant(client, { tenant: "north-campus", apexDomain: "learn.example.test", assetBucket: "edtech-assets" });
  assert.equal(plan.hostname, "north-campus.learn.example.test");
  assert.equal(plan.zoneId, "zone-edtech");
  assert.equal(plan.educatorReportPath, "/tenants/north-campus/reports/educators");
  assert.deepEqual(calls.map((call) => call.method), ["POST", "PUT", "POST", "POST"]);
});
