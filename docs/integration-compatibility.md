# Integration Compatibility Monitor

## Purpose

This document defines a review-only process for checking whether the external services and plugin integrations used by Nanobot may have changed in ways that affect compatibility.

The monitor is intended to identify changes early and create a clear report for human review. It is not an automatic migration or code-fixing system.

## Current integration inventory

The inventory below is based on the repository files inspected when this document was added. A plugin appearing in the registry means Nanobot lists it as an available integration; it does **not** prove that the user has connected or enabled that service.

| Service / integration | Where it appears in this repository | What should be checked |
| --- | --- | --- |
| Supabase | `@supabase/supabase-js`; `src/lib/supabase.ts`; `supabase/schema.sql`; Worker token verification | JavaScript client releases, Auth changes, REST/API changes, database and RLS guidance |
| Cloudflare Workers | `worker/wrangler.toml`; `worker/package.json`; `worker/src/index.ts` | Workers runtime and compatibility-date changes, Wrangler releases, bindings and deployment guidance |
| Cloudflare D1 | `worker/wrangler.toml`; `worker/schema.sql`; `worker/src/index.ts` | D1 API, SQL behavior, limits and migration guidance |
| Cloudflare R2 | `src/lib/r2.ts`; Worker configuration where applicable | R2 S3-compatible API, authentication, CORS and storage behavior |
| Netlify | `netlify.toml`; GitHub deployment workflows | Build/deploy configuration, redirects, environment-variable behavior and platform changes |
| OpenRouter | OpenRouter chat-completions request in `src/App.tsx` | API endpoint, request/response format, streaming, model/provider routing and authentication changes |
| Tavily | `src/lib/tavily.ts` | Search, Extract and Research API changes, request/response fields, polling and authentication |
| Model Context Protocol (MCP) | `src/lib/plugins.ts` and plugin integration code | Protocol/specification changes and compatibility requirements |
| Firecrawl | Plugin registry in `src/lib/plugins.ts` | MCP server/package changes and Firecrawl API changes |
| GitHub | Plugin registry in `src/lib/plugins.ts`; repository workflows | GitHub API changes, authentication scopes, Actions and workflow behavior |
| Gmail | Plugin registry in `src/lib/plugins.ts` | Google API and OAuth scope changes; MCP server compatibility |
| Google Docs | Plugin registry in `src/lib/plugins.ts` | Google Docs API and OAuth scope changes; MCP server compatibility |
| Google Drive | Plugin registry in `src/lib/plugins.ts` | Google Drive API and OAuth scope changes; MCP server compatibility |
| Notion | Plugin registry in `src/lib/plugins.ts` | Notion API version and endpoint changes; OAuth and MCP compatibility |
| Slack | Plugin registry in `src/lib/plugins.ts` | Slack API and OAuth scope changes; MCP server compatibility |

**Inventory note:** The plugin registry is a catalogue of integrations in the application. Confirm actual runtime connection status separately before describing a service as actively connected.

## Official sources to monitor

Prefer first-party documentation, release notes, changelogs and official repositories. Useful starting points:

| Provider / project | Official source |
| --- | --- |
| Supabase | https://supabase.com/changelog |
| Supabase JavaScript client | https://github.com/supabase/supabase-js/releases |
| Cloudflare Developers | https://developers.cloudflare.com/changelog/ |
| Cloudflare Workers | https://developers.cloudflare.com/workers/ |
| Wrangler | https://github.com/cloudflare/workers-sdk/releases |
| Netlify | https://docs.netlify.com/ and https://github.com/netlify/cli/releases |
| OpenRouter | https://openrouter.ai/docs |
| Tavily | https://docs.tavily.com/ |
| Model Context Protocol | https://modelcontextprotocol.io/specification/ and https://github.com/modelcontextprotocol/specification/releases |
| Firecrawl | https://docs.firecrawl.dev/ and https://github.com/firecrawl/firecrawl/releases |
| GitHub | https://github.blog/changelog/ and https://docs.github.com/en/rest |
| Google APIs | https://developers.googleblog.com/ and https://developers.google.com/ |
| Notion | https://developers.notion.com/page/changelog |
| Slack | https://api.slack.com/changelog |

A source URL is a starting point, not a guarantee that its contents are machine-readable or that every relevant change will be detected. Where an official changelog or release feed is unavailable, record that limitation rather than silently substituting an unofficial source.

## Recommended review process

1. Run checks on a schedule (weekly is a reasonable starting interval).
2. Retrieve updates from the official sources listed above.
3. Compare newly published items with the last recorded check.
4. Identify which Nanobot integration or repository file may be affected.
5. Produce a concise report containing the source link, publication date (when available), change summary, likely impact, confidence and recommended human review.
6. Open a GitHub issue for a potentially relevant change. Use a pull request only when a specific, reviewable documentation or code change is proposed.
7. Have a maintainer verify the source and test any proposed change before merging.

## Safety boundaries

The monitor must be **read-only with respect to production services**.

It must not automatically:

- change application code, dependency versions, API parameters or request payloads;
- change Supabase schemas, database records, RLS policies or authentication settings;
- change Cloudflare Worker code, bindings, D1 databases, R2 objects, DNS or deployment settings;
- change Netlify environment variables, build settings or production deployments;
- rotate, print, copy or expose API keys, OAuth tokens, secrets or other credentials;
- accept new provider terms, legal agreements, pricing changes or policy changes on the user's behalf;
- merge pull requests or deploy changes to production.

A detected change is a **review signal**, not proof that Nanobot is broken or that a code change is required.

## Reporting format

Each finding should include:

- **Provider / integration**
- **Official source URL**
- **Change title and publication date**
- **What changed** (brief, factual summary)
- **Potential Nanobot impact** (name the relevant repository file or integration)
- **Severity:** informational, low, medium or high
- **Confidence:** confirmed, likely or needs investigation
- **Recommended next step**
- **Review status:** pending, reviewed, not applicable or action required

Do not label a finding as breaking unless the official source or a reproducible test supports that conclusion.

## Implementation status

This file records the intended monitoring scope and safety rules. It does not itself run checks, fetch web pages, create issues or install a GitHub Actions workflow. Those capabilities require a separately reviewed workflow and, if needed, carefully scoped repository permissions.
