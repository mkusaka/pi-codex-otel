import assert from "node:assert/strict";
import test from "node:test";
import {
  completionAttributes,
  idTokenEmail,
  parseHeaders,
  parseLogAttributeOverrides,
  resolveLogsEndpoint,
  telemetryEmail,
} from "../src/core.ts";

test("resolves standard OTLP log endpoints without duplication", () => {
  assert.equal(
    resolveLogsEndpoint("https://collector.example"),
    "https://collector.example/v1/logs",
  );
  assert.equal(
    resolveLogsEndpoint("https://collector.example/v1/logs"),
    "https://collector.example/v1/logs",
  );
  assert.equal(
    resolveLogsEndpoint("https://ignored.example", "https://logs.example/custom"),
    "https://logs.example/custom",
  );
});

test("maps OMP usage to Codex response.completed token fields", () => {
  assert.deepEqual(
    completionAttributes({
      input: 100,
      output: 40,
      cacheRead: 20,
      cacheWrite: 10,
      reasoning: 30,
      totalTokens: 170,
    }),
    {
      input_token_count: "130",
      output_token_count: "40",
      cached_token_count: 20,
      cache_write_token_count: 10,
      reasoning_token_count: 30,
      tool_token_count: "170",
    },
  );
});

test("uses computed total tokens when OMP omits totalTokens", () => {
  assert.equal(completionAttributes({ input: 2, output: 3, cacheRead: 5 }).tool_token_count, "10");
});

test("parses and decodes OTLP headers without truncating equals", () => {
  assert.deepEqual(parseHeaders("X-Trace=one%3Dtwo,X-Tenant=codex"), {
    "X-Trace": "one=two",
    "X-Tenant": "codex",
  });
});

test("reads the email claim from a Codex id_token", () => {
  const claims = Buffer.from(JSON.stringify({ email: "user@example.com" })).toString("base64url");
  assert.equal(idTokenEmail(`header.${claims}.signature`), "user@example.com");
  assert.equal(idTokenEmail(undefined), undefined);
  assert.equal(idTokenEmail("not-a-jwt"), undefined);
  assert.equal(idTokenEmail("header.bm90LWpzb24.signature"), undefined);
});

test("prefers the native Codex identity over the model provider account", () => {
  assert.equal(
    telemetryEmail("codex@example.com", "provider@example.com", "git@example.com"),
    "codex@example.com",
  );
  assert.equal(
    telemetryEmail(undefined, "provider@example.com", "git@example.com"),
    "provider@example.com",
  );
});

test("parses scalar and array log attribute overrides from a JSON object", () => {
  assert.deepEqual(
    parseLogAttributeOverrides(
      '{"user.email":"masatomo.kusaka+oai1@medley.jp","sampled":true,"retries":2,"roles":["admin","developer"]}',
    ),
    {
      "user.email": "masatomo.kusaka+oai1@medley.jp",
      sampled: true,
      retries: 2,
      roles: ["admin", "developer"],
    },
  );
});

test("ignores malformed or non-attribute log override values", () => {
  assert.deepEqual(
    parseLogAttributeOverrides('{"user.email":{"nested":"value"},"valid":"value"}'),
    {
      valid: "value",
    },
  );
  assert.deepEqual(parseLogAttributeOverrides("not-json"), {});
  assert.deepEqual(parseLogAttributeOverrides('["user.email"]'), {});
});
