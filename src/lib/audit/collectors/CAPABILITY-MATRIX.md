# Audit Collector Capability Matrix

Living reference for what each collector provides, which audit scopes include it, and external dependencies.

| Collector | Public | Client | External API | Status |
|-----------|:------:|:------:|:--------------:|:------:|
| HTTP / Hosting | ✅ | ✅ | No | ✅ |
| Metadata | ✅ | ✅ | No | ✅ |
| Robots / Sitemap | ✅ | ✅ | No | ✅ |
| Structured Data | ✅ | ✅ | No | ✅ |
| Homepage Content / Links | ✅ | ✅ | No | ✅ |
| PageSpeed | ✅ | ✅ | Yes (Google PSI) | ✅ |
| Operations Inventory | ❌ | ✅ | No | ✅ |
| Email Authentication | ❌ | ✅ | No | ❌ |
| Accessibility Basics | ✅ | ✅ | No | ❌ |
| Search Console | ❌ | ✅ | Yes (Google OAuth) | ❌ |
| Google Business Profile | ❌ | ✅ | Yes (Google OAuth) | ❌ |
| Rank Tracking | ❌ | ✅ | Yes (provider TBD) | ❌ |

**Scope rules (collectors do not read public/client flags directly):**

- Website collectors run for all audit types.
- `operations_inventory` runs when `scope.includeOperationsInventory` is true.
- `email_auth` will run when `scope.includeEmailAuth` is true (not yet implemented).

**PageSpeed:** uses mock/unavailable findings when `GOOGLE_PAGESPEED_API_KEY` is not set.
