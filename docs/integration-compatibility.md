# Integration Compatibility Monitor

## Purpose

This document defines a review-only process for monitoring external services and MCP integrations listed by Nanobot.

The monitor reads public provider changelogs, GitHub release histories, and selected repository commit histories. It creates GitHub issues for newly detected items. It does not automatically decide that an update is breaking, and it does not make application or provider changes.

The inventory is based on `src/lib/plugins.ts`. A plugin listed there means Nanobot advertises the integration; it does **not** prove that the user has connected it, that the configured package is current, or that the integration works at runtime.

## Integration inventory

The registry currently contains 11 integration IDs:

| Registry ID | Integration | Evidence in repository | Compatibility areas to review |
| --- | --- | --- | --- |
| `cloudflare` | Cloudflare | `src/lib/plugins.ts`; Cloudflare Worker/D1/R2 code and configuration | MCP server changes, Workers runtime, Wrangler, D1, R2, OAuth and permissions |
| `firecrawl` | Firecrawl | `src/lib/plugins.ts` | MCP server tools, scrape/crawl/search APIs, authentication and quotas |
| `github` | GitHub | `src/lib/plugins.ts`; GitHub Actions and repository automation | MCP server tools, REST API, OAuth/GitHub Apps, scopes and rate limits |
| `gmail` | Gmail | `src/lib/plugins.ts` | Gmail API, OAuth scopes, message/thread semantics and quotas |
| `google_docs` | Google Docs | `src/lib/plugins.ts` | Docs API, OAuth scopes, document structure and batch updates |
| `google_drive` | Google Drive | `src/lib/plugins.ts` | Drive API, file permissions, search, upload and export behavior |
| `netlify` | Netlify | `src/lib/plugins.ts`; `netlify.toml` and deployment workflows | MCP server, CLI, build/deploy APIs, authentication and permissions |
| `notion` | Notion | `src/lib/plugins.ts` | MCP/API versioning, database/data-source model, OAuth and permissions |
| `slack` | Slack | `src/lib/plugins.ts` | Slack API, MCP tools, OAuth scopes, message/file methods and rate limits |
| `supabase` | Supabase | `src/lib/plugins.ts`; Supabase client and project files | MCP server, JavaScript client, Auth, database, REST API and RLS |
| `tavily` | Tavily | `src/lib/plugins.ts`; Tavily client code | MCP server tools, Search/Extract APIs, authentication and quotas |

## Automated monitoring coverage

The workflow at `.github/workflows/integration-compatibility-monitor.yml` runs weekly (Mondays at 08:15 UTC) and can also be started manually from the GitHub Actions tab.

The monitor in `scripts/integration_compatibility_monitor.py` maps each registry ID to one or more official or provider-maintained public sources:

| Integration(s) | Automated source(s) | Monitoring method |
| --- | --- | --- |
| Cloudflare | Cloudflare developer changelog; `cloudflare/mcp-server-cloudflare`; `cloudflare/workers-sdk` | RSS/Atom and GitHub releases |
| Firecrawl | `firecrawl/firecrawl-mcp-server` | GitHub releases |
| GitHub | GitHub platform changelog; `github/github-mcp-server` | RSS/Atom and GitHub releases |
| Gmail, Google Docs, Google Drive | Google Workspace developer release notes | Google-published RSS feed, filtered for Gmail, Docs and Drive terms |
| Netlify | Netlify changelog; `netlify/netlify-mcp`; `netlify/cli` | Netlify-published RSS feed and GitHub releases |
| Notion | `makenotion/notion-sdk-js` | GitHub releases for the official Notion API client; this is an API-surface signal, not a direct monitor of the MCP server |
| Slack | Slack developer changelog | Slack-published RSS feed |
| Supabase | `supabase/mcp`; `supabase/supabase-js` | GitHub releases |
| Tavily | `tavily-ai/tavily-mcp` | Recent GitHub commit history; the repository currently has no tagged releases |
| All 11 IDs | Model Context Protocol specification | GitHub releases for cross-integration protocol changes |

Source URLs:

- Cloudflare changelog: https://developers.cloudflare.com/changelog/rss/index.xml
- Cloudflare MCP server: https://github.com/cloudflare/mcp-server-cloudflare/releases
- Cloudflare Workers SDK / Wrangler: https://github.com/cloudflare/workers-sdk/releases
- Firecrawl MCP server: https://github.com/firecrawl/firecrawl-mcp-server/releases
- GitHub changelog: https://github.blog/changelog/feed/
- GitHub MCP server: https://github.com/github/github-mcp-server/releases
- Google Workspace feed: https://developers.google.com/feeds/workspace-release-notes.xml
- Netlify changelog feed: https://www.netlify.com/changelog/feed.xml
- Netlify MCP server: https://github.com/netlify/netlify-mcp/releases
- Netlify CLI: https://github.com/netlify/cli/releases
- Notion JavaScript API client: https://github.com/makenotion/notion-sdk-js/releases
- Slack changelog feed: https://docs.slack.dev/changelog/rss.xml
- Supabase MCP server: https://github.com/supabase/mcp/releases
- Supabase JavaScript client: https://github.com/supabase/supabase-js/releases
- Tavily MCP repository: https://github.com/tavily-ai/tavily-mcp/commits
- MCP specification: https://github.com/modelcontextprotocol/specification/releases

The script validates the IDs found in `src/lib/plugins.ts` against the source map before it checks feeds. If a new integration is added without a corresponding source mapping, or a stale mapping remains after an integration is removed, the monitor stops with a clear coverage error.

On its first successful run, it records a baseline and does not open issues for old entries. Later runs report only previously unseen source item IDs. The monitor stores up to 1,000 IDs in `docs/integration-monitor-state.json` to avoid repeatedly reporting the same updates.

## Manual review and known limits

Automated coverage is not the same as complete provider API coverage. Some sources are broad, indirect, or limited to the server/client repository rather than the full provider platform. Review the corresponding official pages when evaluating a change:

- Cloudflare: https://developers.cloudflare.com/changelog/
- Firecrawl: https://docs.firecrawl.dev/
- GitHub: https://github.blog/changelog/
- Gmail, Google Docs and Google Drive: https://developers.google.com/workspace/release-notes
- Netlify: https://www.netlify.com/changelog/
- Notion: https://developers.notion.com/page/changelog
- Slack: https://docs.slack.dev/changelog/
- Supabase: https://supabase.com/changelog
- Tavily: https://docs.tavily.com/

### Registry package identity requires a separate audit

This monitor intentionally does not rewrite `mcpServerName` values or upgrade packages. The package strings in `src/lib/plugins.ts` have not been proven by this monitor to be the current provider-recommended package or server implementation.

Check each registry package against the linked provider-maintained source before treating it as current. In particular:

- Notion's official `makenotion/notion-mcp-server` repository says its self-hosted server is no longer actively maintained or supported and directs users to its hosted Remote MCP service. The monitor therefore watches the official Notion JavaScript API client for API-surface changes and lists the Notion API changelog for manual review; it does not imply the registry's Notion package is current.
- Netlify's provider-maintained MCP repository documents the package `@netlify/mcp`; the registry currently contains a different package string. This monitor does not change that registry entry.
- Provider MCP repositories are useful signals, but their releases do not prove that Nanobot's configured package has the same code, version, tools, or behavior.

These are compatibility-audit findings, not automatic instructions to migrate. Confirm the registry package, its maintainer, published package metadata, and integration code before proposing a change.

Other limitations:

- Release APIs return a bounded recent history. The script requests the latest 30 items; an item that appears and disappears from that window between weekly checks could be missed.
- The Google Workspace feed is shared across several products and uses keyword filtering. A relevant entry with unexpected wording may not match.
- The Slack and Netlify feeds contain platform-wide updates; keyword filtering can include unrelated items or miss a narrowly worded change.
- Tavily is checked through recent repository commits because the monitored repository has no tagged releases. Not every commit affects the public MCP behavior.
- The Notion SDK release history is an indirect signal for API compatibility, not a feed of Notion's hosted MCP service.
- A source outage is recorded in the workflow log. If some sources fail while others succeed, the monitor saves successful results and the source errors for review.
- This is not a semantic API compatibility test. It cannot inspect private account settings, test OAuth credentials, or prove that an announcement affects Nanobot.

## Security and safety boundaries

The monitor is read-only with respect to provider services. It must not automatically:

- change application code, dependency versions, API parameters or request payloads;
- change Supabase schemas, records, RLS policies or authentication settings;
- change Cloudflare Worker code, bindings, D1 databases, R2 objects, DNS or deployments;
- change Netlify environment variables, build settings or production deployments;
- rotate, print, copy or expose API keys, OAuth tokens, secrets or credentials;
- accept provider terms, legal agreements, pricing changes or policy changes;
- merge pull requests or deploy changes to production.

The script uses the repository's `GITHUB_TOKEN` only for GitHub API requests needed to read release/commit metadata and open issues. It does **not** send that token to provider RSS feeds or external sites. It does not need Cloudflare, Supabase, Netlify, Google, Slack, Notion, Firecrawl or Tavily account credentials.

The workflow also commits its own monitor state file. Because `main` is protected in this repository, verify that the repository's branch rules permit the Actions bot to push this state update; otherwise the feed check may succeed while the final state-save step fails. Do not weaken branch protection just to make this workflow pass.

A detected change is a **review signal**, not proof that Nanobot is broken or that a code change is required.

## Reporting format

Each GitHub issue includes the source, update title, publication date, official link, available summary and mapped integration IDs. It also includes official provider pages and a maintainer checklist.

The maintainer should verify the announcement, decide whether it affects the currently configured integration, and test any separately proposed code change before merging. Do not label a finding as breaking unless an official source or a reproducible test supports that conclusion.
