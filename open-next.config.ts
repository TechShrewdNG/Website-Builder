import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// No incremental cache / ISR is used anywhere in this app — every page is
// rendered per-request from the database — so the default (in-memory, per
// isolate) cache is enough; there's no KV namespace to wire up here.
export default defineCloudflareConfig({});
