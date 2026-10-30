# Integration Compatibility Monitor

## Purpose

This document defines a review-only process for checking whether external services and plugin integrations used by Nanobot may have changed in ways that affect compatibility.

The monitor identifies published updates and opens GitHub issues for human review. It is not an automatic migration or code-fixing system.

## Integration inventory

The inventory below is based on repository files. A plugin appearing in the registry means Nanobot lists it as an available integration; it does **not** prove that the user has connected or enabled that service.

| Service / integration | Repository evidence | What should be reviewed |
| --- | --- | --- |
| Supabase | `@supabase/supabase-js`; `src/lib/supabase.ts`; `supabase/schema.sql`; Worker token verification | Client releases, Auth, REST/API, database and RLS guidance |
| Cloudflare Workers | `worker/wrangler.toml`; `worker/package.json`; `worker/src/index.ts` | Runtime, compatibility dates, Wrangler, bindings and deployment guidance |
| Cloudflare D1 | `worker/wrangler.toml`; `worker/schema.sql`; `worker/src/index.ts` | D1 API, SQL behavior, limits and migrations |
| Cloudflare R2 | `src/lib/r2.ts`; Worker configuration | S3-compatible API, authentication, CORS and storage behavior |
| Netlify | `netlify.toml`; GitHub workflows | Build/deploy configuration and platform changes |
| OpenRouter | Chat-completions request in `src/App.tsx` | Endpoint, request/response format, streaming, model routing and authentication |
| Tavily | `src/lib/tavily.ts` | Search, Extract and Research APIs, polling and authentication |
| MCP | `src/lib/plugins.ts` and plugin integration code | Protocol/specification changes |
| Firecrawl, GitHub, Gmail, Google Docs, Google Drive, Notion and Slack | Plugin registry in `src/lib/plugins.ts` | Provider API, OAuth and MCP compatibility; registry presence does not prove an active connection |

## Automated monitoring coverage

The GitHub Actions workflow at `.github/workflows/integration-compatibility-monitor.yml` runs weekly (Mondays at 08:15 UTC) and can also be started manually from the Actions tab.

The script at `scripts/integration_compatibility_monitor.py` checks these machine-readable official sources:

- Cloudflare developer changelog RSS, filtered for Workers, Wrangler, D1, R2, Durable Objects and related terms: https://developers.cloudflare.com/changelog/rss/index.xml
- GitHub platform changelog RSS, filtered for Actions, API, OAuth, GitHub Apps and token/security terms: https://github.blog/changelog/feed/
- Supabase JavaScript client releases: https://github.com/supabase/supabase-js/releases
- Cloudflare Workers SDK / Wrangler releases: https://github.com/cloudflare/workers-sdk/releases
- MCP specification releases: https://github.com/modelcontextprotocol/specification/releases
- Firecrawl releases: https://github.com/firecrawl/firecrawl/releases
- Netlify CLI releases: https://github.com/netlify/cli/releases

On its first successful run, the monitor records a baseline and does not open issues for old entries. On later runs, it opens one GitHub issue containing newly detected items. It records seen item IDs in `docs/integration-monitor-state.json` to avoid repeatedly reporting the same entries.

## Coverage limitations

This is a feed/release monitor, not a semantic API compatibility checker. It cannot prove that a provider change affects Nanobot, inspect private account settings, or reliably infer breaking changes from an announcement.

OpenRouter, Tavily, Notion, Slack, Google APIs, and parts of Netlify/Supabase product changelogs are **not directly covered by the current automated feeds**. Review their official documentation/changelogs manually:

- Supabase: https://supabase.com/changelog
- Netlify: https://www.netlify.com/changelog/
- OpenRouter: https://openrouter.ai/docs
- Tavily: https://docs.tavily.com/
- Notion: https://developers.notion.com/page/changelog
- Slack: https://api.slack.com/changelog
- Google APIs: https://developers.google.com/

A source URL is a starting point, not a guarantee that every relevant change will be detected. Workflow logs should be checked for source-fetch warnings.

## Safety boundaries

The monitor is read-only with respect to production services. It must not automatically:

- change application code, dependency versions, API parameters or request payloads;
- change Supabase schemas, records, RLS policies or authentication settings;
- change Cloudflare Worker code, bindings, D1 databases, R2 objects, DNS or deployments;
- change Netlify environment variables, build settings or production deployments;
- rotate, print, copy or expose API keys, OAuth tokens, secrets or credentials;
- accept provider terms, legal agreements, pricing changes or policy changes;
- merge pull requests or deploy changes to production.

The workflow uses the repository-provided `GITHUB_TOKEN` only to open issues and commit its own small state file. It does not need provider API keys or access to the connected Cloudflare, Supabase or Netlify accounts.

A detected change is a **review signal**, not proof that Nanobot is broken or that a code change is required.

## Reporting format

Each GitHub issue includes the provider/source, update title, publication date, official link and available summary, plus a maintainer checklist. The maintainer should verify the announcement, decide whether it affects a currently used integration, and test any separately proposed change before merging.

Do not label a finding as breaking unless the official source or a reproducible test supports that conclusion.
