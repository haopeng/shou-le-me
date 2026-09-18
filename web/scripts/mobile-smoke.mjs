import assert from "node:assert/strict";

// Read-only checks plus unauthenticated writes, which must never be authorized.
const origin = process.argv[2] ?? "http://127.0.0.1:3217";
let checks = 0;
const fetchWithTimeout = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
function pass(message) { checks++; console.log(`PASS: ${message}`); }
const response = await fetchWithTimeout(`${origin}/api/mobile/config`);
assert.equal(response.status, 200);
const config = await response.json();
assert.ok(config.supabaseUrl.startsWith("https://"));
assert.ok(config.publishableKey);
assert.equal(JSON.stringify(config).includes("sb_secret_"), false);
assert.deepEqual(Object.keys(config).sort(), ["supabaseUrl", "publishableKey", "googleEnabled", "appleEnabled", "socialLoginReady", "minimumVersion"].sort());
pass("mobile config exposes only public fields");

for (const [path, method] of [["/api/me/account", "DELETE"], ["/api/me/reports", "POST"], ["/api/me/dashboard", "GET"], ["/api/groups", "GET"]]) {
  const result = await fetchWithTimeout(`${origin}${path}`, { method });
  assert.equal(result.status, 401, `${method} ${path} must reject unauthenticated access`);
  pass(`unauthenticated ${method} ${path} blocked`);
}
const callback = await fetchWithTimeout(`${origin}/mobile/auth?code=synthetic-code&next=https://example.invalid`, { redirect: "manual" });
assert.equal(callback.status, 302);
assert.equal(callback.headers.get("location"), "com.haopeng.slimyet://auth/callback?code=synthetic-code");
assert.equal(callback.headers.get("referrer-policy"), "no-referrer");
assert.equal(callback.headers.get("cache-control"), "no-store");
pass("callback has a fixed destination and no token caching");
for (const path of ["/privacy", "/terms?lang=zh", "/support", "/.well-known/apple-app-site-association"]) {
  assert.equal((await fetchWithTimeout(`${origin}${path}`)).status, 200);
  pass(path);
}
console.log(`${checks} mobile backend checks passed. No signed-in records were read or modified.`);
