#!/usr/bin/env python3
"""Read-only compatibility monitor for all MCP integrations registered by Nanobot.

The monitor reads public provider feeds and official GitHub release APIs. It
creates GitHub issues for newly published items; it never edits app code,
dependencies, provider settings, databases, secrets, or deployments.
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

API = "https://api.github.com"
STATE_PATH = Path("docs/integration-monitor-state.json")
REGISTRY_PATH = Path("src/lib/plugins.ts")
TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "")
BASE_HEADERS = {
    "User-Agent": "Nanobot-Integration-Compatibility-Monitor/2.0",
}


def request_headers(url: str) -> dict[str, str]:
    """Send the repository token only to the GitHub API, never to provider feeds."""
    headers = dict(BASE_HEADERS)
    if urllib.parse.urlparse(url).hostname == "api.github.com":
        headers["Accept"] = "application/vnd.github+json"
        if TOKEN:
            headers["Authorization"] = f"Bearer {TOKEN}"
    return headers

# These IDs are the integration IDs in src/lib/plugins.ts. Each must have at
# least one automated source below. A shared source can cover several IDs.
INTEGRATION_NAMES = {
    "cloudflare": "Cloudflare",
    "firecrawl": "Firecrawl",
    "github": "GitHub",
    "gmail": "Gmail",
    "google_docs": "Google Docs",
    "google_drive": "Google Drive",
    "netlify": "Netlify",
    "notion": "Notion",
    "slack": "Slack",
    "supabase": "Supabase",
    "tavily": "Tavily",
}

# Machine-readable official sources. "integrations" explicitly ties every
# source to registry IDs, so the script can detect coverage gaps.
SOURCES = [
    {
        "name": "Cloudflare developer changelog",
        "kind": "rss",
        "url": "https://developers.cloudflare.com/changelog/rss/index.xml",
        "integrations": ["cloudflare"],
        "terms": ["workers", "wrangler", "d1", "r2", "durable objects", "workflows", "worker"],
    },
    {
        "name": "Cloudflare MCP server releases",
        "kind": "releases",
        "url": f"{API}/repos/cloudflare/mcp-server-cloudflare/releases?per_page=30",
        "integrations": ["cloudflare"],
    },
    {
        "name": "Cloudflare Workers SDK / Wrangler releases",
        "kind": "releases",
        "url": f"{API}/repos/cloudflare/workers-sdk/releases?per_page=30",
        "integrations": ["cloudflare"],
    },
    {
        "name": "Firecrawl MCP server releases",
        "kind": "releases",
        "url": f"{API}/repos/firecrawl/firecrawl-mcp-server/releases?per_page=30",
        "integrations": ["firecrawl"],
    },
    {
        "name": "GitHub platform changelog",
        "kind": "rss",
        "url": "https://github.blog/changelog/feed/",
        "integrations": ["github"],
        "terms": ["actions", "api", "oauth", "github app", "fine-grained", "token", "security", "mcp"],
    },
    {
        "name": "GitHub MCP server releases",
        "kind": "releases",
        "url": f"{API}/repos/github/github-mcp-server/releases?per_page=30",
        "integrations": ["github"],
    },
    {
        "name": "Google Workspace developer release notes",
        "kind": "rss",
        "url": "https://developers.google.com/feeds/workspace-release-notes.xml",
        "integrations": ["gmail", "google_docs", "google_drive"],
        "terms": ["gmail", "google drive", "drive api", "google docs", "docs api"],
    },
    {
        "name": "Netlify platform changelog",
        "kind": "rss",
        "url": "https://www.netlify.com/changelog/feed.xml",
        "integrations": ["netlify"],
        "terms": ["api", "mcp", "deploy", "build", "functions", "environment", "oauth", "cli", "netlify"],
    },
    {
        "name": "Netlify MCP server releases",
        "kind": "releases",
        "url": f"{API}/repos/netlify/netlify-mcp/releases?per_page=30",
        "integrations": ["netlify"],
    },
    {
        "name": "Netlify CLI releases",
        "kind": "releases",
        "url": f"{API}/repos/netlify/cli/releases?per_page=30",
        "integrations": ["netlify"],
    },
    {
        "name": "Notion JavaScript API client releases",
        "kind": "releases",
        "url": f"{API}/repos/makenotion/notion-sdk-js/releases?per_page=30",
        "integrations": ["notion"],
    },
    {
        "name": "Slack developer changelog",
        "kind": "rss",
        "url": "https://docs.slack.dev/changelog/rss.xml",
        "integrations": ["slack"],
        "terms": ["mcp", "oauth", "api", "scope", "rate limit", "deprecated", "deprecation", "token", "message", "file", "permission"],
    },
    {
        "name": "Supabase MCP server releases",
        "kind": "releases",
        "url": f"{API}/repos/supabase/mcp/releases?per_page=30",
        "integrations": ["supabase"],
    },
    {
        "name": "Supabase JavaScript client releases",
        "kind": "releases",
        "url": f"{API}/repos/supabase/supabase-js/releases?per_page=30",
        "integrations": ["supabase"],
    },
    {
        "name": "Tavily MCP server repository updates",
        "kind": "commits",
        "url": f"{API}/repos/tavily-ai/tavily-mcp/commits?per_page=30",
        "integrations": ["tavily"],
    },
    {
        "name": "Model Context Protocol specification releases",
        "kind": "releases",
        "url": f"{API}/repos/modelcontextprotocol/specification/releases?per_page=30",
        "integrations": list(INTEGRATION_NAMES),
    },
]

# These official pages need human interpretation even when adjacent project
# releases are monitored automatically. They are included in each issue so
# that a maintainer can verify API-level changes rather than infer impact.
MANUAL_REVIEW_URLS = {
    "cloudflare": "https://developers.cloudflare.com/changelog/",
    "firecrawl": "https://docs.firecrawl.dev/",
    "github": "https://github.blog/changelog/",
    "gmail": "https://developers.google.com/workspace/release-notes",
    "google_docs": "https://developers.google.com/workspace/release-notes",
    "google_drive": "https://developers.google.com/workspace/release-notes",
    "netlify": "https://www.netlify.com/changelog/",
    "notion": "https://developers.notion.com/page/changelog",
    "slack": "https://docs.slack.dev/changelog/",
    "supabase": "https://supabase.com/changelog",
    "tavily": "https://docs.tavily.com/",
}


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers=request_headers(url))
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def child_text(element, names):
    for name in names:
        found = element.find(name)
        if found is not None and found.text:
            return found.text.strip()
    return ""


def matches_terms(item, terms):
    haystack = (item.get("title", "") + " " + item.get("summary", "")).lower()
    return any(term in haystack for term in terms)


def read_rss(source):
    root = ET.fromstring(fetch(source["url"]))
    entries = root.findall(".//item")
    if not entries:
        entries = [e for e in root.iter() if e.tag.split("}")[-1] == "entry"]

    results = []
    for entry in entries:
        title = child_text(entry, ["title", "{http://www.w3.org/2005/Atom}title"])
        link = child_text(entry, ["link"])
        if not link:
            for node in entry:
                if node.tag.split("}")[-1] == "link":
                    link = node.attrib.get("href", "")
                    if link:
                        break
        summary = child_text(entry, ["description", "summary", "{http://www.w3.org/2005/Atom}summary"])
        published = child_text(entry, ["pubDate", "published", "updated"])
        identity = child_text(entry, ["guid", "id"]) or link or title
        item = {
            "id": source["name"] + ":" + identity,
            "source": source["name"],
            "integrations": source["integrations"],
            "title": title or "Untitled update",
            "url": link or source["url"],
            "published": published or "Date not supplied",
            "summary": " ".join(summary.split())[:900],
        }
        if not source.get("terms") or matches_terms(item, source["terms"]):
            results.append(item)
    return results


def read_releases(source):
    data = json.loads(fetch(source["url"]))
    results = []
    for release in data:
        if release.get("draft"):
            continue
        tag = release.get("tag_name", "release")
        html_url = release.get("html_url", source["url"])
        results.append({
            "id": source["name"] + ":" + str(release.get("id", tag)),
            "source": source["name"],
            "integrations": source["integrations"],
            "title": release.get("name") or tag,
            "url": html_url,
            "published": release.get("published_at") or "Date not supplied",
            "summary": " ".join((release.get("body") or "").split())[:900],
        })
    return results


def read_commits(source):
    data = json.loads(fetch(source["url"]))
    results = []
    for commit in data:
        details = commit.get("commit", {})
        message = details.get("message", "")
        results.append({
            "id": source["name"] + ":" + str(commit.get("sha", message)),
            "source": source["name"],
            "integrations": source["integrations"],
            "title": message.splitlines()[0] if message else "Repository update",
            "url": commit.get("html_url", source["url"]),
            "published": (details.get("author") or {}).get("date") or "Date not supplied",
            "summary": " ".join(message.split())[:900],
        })
    return results


def validate_registry_coverage():
    if not REGISTRY_PATH.exists():
        raise RuntimeError(f"Integration registry not found: {REGISTRY_PATH}")
    registry_text = REGISTRY_PATH.read_text(encoding="utf-8")
    registered = set(re.findall(r"^\s*id:\s*['\"]([^'\"]+)['\"]", registry_text, re.MULTILINE))
    if not registered:
        raise RuntimeError("No integration IDs could be read from src/lib/plugins.ts.")

    covered = {
        integration_id
        for source in SOURCES
        for integration_id in source.get("integrations", [])
    }
    missing = sorted(registered - covered)
    undocumented = sorted(covered - registered)
    if missing or undocumented:
        details = []
        if missing:
            details.append("registry IDs without automated sources: " + ", ".join(missing))
        if undocumented:
            details.append("source mappings absent from registry: " + ", ".join(undocumented))
        raise RuntimeError("Integration coverage validation failed: " + "; ".join(details))
    return sorted(registered)


def create_issue(items):
    if not TOKEN or not REPOSITORY:
        raise RuntimeError("GITHUB_TOKEN and GITHUB_REPOSITORY are required to create an issue.")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lines = [
        "## Newly detected official updates",
        "",
        "These are review signals, not confirmed compatibility failures. Verify each provider announcement and assess the matching Nanobot integration before changing anything.",
        "",
    ]
    for item in items:
        integration_labels = ", ".join(
            INTEGRATION_NAMES.get(integration_id, integration_id)
            for integration_id in item.get("integrations", [])
        )
        lines.extend([
            f"### {item['source']}: {item['title']}",
            f"- **Integration(s):** {integration_labels}",
            f"- **Published:** {item['published']}",
            f"- **Official source:** {item['url']}",
            f"- **Summary:** {item['summary'] or 'The source did not provide a summary.'}",
            "",
        ])

    lines.extend([
        "## Official provider pages for human verification",
        "",
    ])
    for integration_id in sorted({i for item in items for i in item.get("integrations", [])}):
        name = INTEGRATION_NAMES.get(integration_id, integration_id)
        url = MANUAL_REVIEW_URLS.get(integration_id)
        if url:
            lines.append(f"- [{name}]({url})")

    lines.extend([
        "",
        "## Maintainer review",
        "- [ ] Verify each announcement on the provider's official site.",
        "- [ ] Decide whether it affects the matching integration and its registered MCP server.",
        "- [ ] Check API, OAuth, scopes, permissions, quotas, and MCP protocol changes where relevant.",
        "- [ ] If relevant, create a separate, scoped change and test it before merging.",
        "",
        "This monitor does not modify application code, dependencies, provider settings, databases, secrets, or deployments.",
    ])

    payload = json.dumps({
        "title": f"Integration monitor: new provider updates ({now})",
        "body": "\n".join(lines),
    }).encode()
    request = urllib.request.Request(
        f"{API}/repos/{REPOSITORY}/issues",
        data=payload,
        headers={**request_headers(f"{API}/repos/{REPOSITORY}/issues"), "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        created = json.loads(response.read())
    print(f"Created review issue: {created.get('html_url')}")


def main():
    registry_ids = validate_registry_coverage()
    old_state = {}
    if STATE_PATH.exists():
        old_state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    seen = set(old_state.get("seen_ids", []))
    all_items = []
    errors = []

    for source in SOURCES:
        try:
            if source["kind"] == "rss":
                items = read_rss(source)
            elif source["kind"] == "commits":
                items = read_commits(source)
            else:
                items = read_releases(source)
            all_items.extend(items)
            print(f"OK: {source['name']} ({len(items)} entries)")
        except Exception as exc:
            errors.append(f"{source['name']}: {type(exc).__name__}: {exc}")
            print(f"WARNING: {errors[-1]}", file=sys.stderr)

    if not all_items and errors:
        raise RuntimeError("Every monitored source failed; refusing to update monitor state.")

    unique = {item["id"]: item for item in all_items}
    # On the first run, establish a baseline rather than opening a noisy issue
    # for old announcements. Later runs report only IDs not previously seen.
    is_first_run = not old_state.get("initialized", False)
    new_items = [] if is_first_run else [item for key, item in unique.items() if key not in seen]
    new_items.sort(key=lambda item: (item["published"], item["source"]), reverse=True)

    if new_items:
        create_issue(new_items[:30])
    elif is_first_run:
        print("First run: saved baseline; no issue created.")
    else:
        print("No new monitored updates.")

    combined_ids = list(dict.fromkeys(list(unique.keys()) + list(seen)))
    state = {
        "initialized": True,
        "last_checked_utc": datetime.now(timezone.utc).isoformat(),
        "seen_ids": combined_ids[:1000],
        "source_errors": errors,
        "automated_sources": [source["name"] for source in SOURCES],
        "covered_registry_integrations": registry_ids,
    }
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    if errors:
        print("Some sources were unavailable; see workflow logs. State was updated for successful sources.")


if __name__ == "__main__":
    main()
