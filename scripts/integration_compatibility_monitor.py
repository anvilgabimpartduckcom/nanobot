#!/usr/bin/env python3
"""Read-only integration update monitor for Nanobot.

The monitor reads public official RSS/Atom feeds and GitHub release APIs.
It creates a GitHub issue for newly published items; it never edits app code,
dependencies, provider settings, databases, secrets, or deployments.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

API = "https://api.github.com"
STATE_PATH = Path("docs/integration-monitor-state.json")
TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPOSITORY = os.environ.get("GITHUB_REPOSITORY", "")
HEADERS = {
    "User-Agent": "Nanobot-Integration-Compatibility-Monitor/1.0",
    "Accept": "application/vnd.github+json",
}
if TOKEN:
    HEADERS["Authorization"] = f"Bearer {TOKEN}"

# Only sources with machine-readable official feeds/APIs are automated here.
# Keyword filters reduce unrelated items from broad provider feeds.
SOURCES = [
    {
        "name": "Cloudflare developer changelog",
        "kind": "rss",
        "url": "https://developers.cloudflare.com/changelog/rss/index.xml",
        "terms": ["workers", "wrangler", "d1", "r2", "durable objects", "workflows", "worker"],
    },
    {
        "name": "GitHub platform changelog",
        "kind": "rss",
        "url": "https://github.blog/changelog/feed/",
        "terms": ["actions", "api", "oauth", "github app", "fine-grained", "token", "security"],
    },
    {
        "name": "Supabase JavaScript client releases",
        "kind": "releases",
        "url": "https://api.github.com/repos/supabase/supabase-js/releases?per_page=10",
    },
    {
        "name": "Cloudflare Workers SDK / Wrangler releases",
        "kind": "releases",
        "url": "https://api.github.com/repos/cloudflare/workers-sdk/releases?per_page=10",
    },
    {
        "name": "Model Context Protocol specification releases",
        "kind": "releases",
        "url": "https://api.github.com/repos/modelcontextprotocol/specification/releases?per_page=10",
    },
    {
        "name": "Firecrawl releases",
        "kind": "releases",
        "url": "https://api.github.com/repos/firecrawl/firecrawl/releases?per_page=10",
    },
    {
        "name": "Netlify CLI releases",
        "kind": "releases",
        "url": "https://api.github.com/repos/netlify/cli/releases?per_page=10",
    },
]

def fetch(url: str):
    request = urllib.request.Request(url, headers=HEADERS)
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
            "title": release.get("name") or tag,
            "url": html_url,
            "published": release.get("published_at") or "Date not supplied",
            "summary": " ".join((release.get("body") or "").split())[:900],
        })
    return results

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
        lines.extend([
            f"### {item['source']}: {item['title']}",
            f"- **Published:** {item['published']}",
            f"- **Official source:** {item['url']}",
            f"- **Summary:** {item['summary'] or 'The source did not provide a summary.'}",
            "",
        ])
    lines.extend([
        "## Maintainer review",
        "- [ ] Verify each announcement on the provider's official site.",
        "- [ ] Decide whether it affects an integration currently used by Nanobot.",
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
        headers={**HEADERS, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        created = json.loads(response.read())
    print(f"Created review issue: {created.get('html_url')}")

def main():
    old_state = {}
    if STATE_PATH.exists():
        old_state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    seen = set(old_state.get("seen_ids", []))
    all_items = []
    errors = []

    for source in SOURCES:
        try:
            items = read_rss(source) if source["kind"] == "rss" else read_releases(source)
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
        "seen_ids": combined_ids[:500],
        "source_errors": errors,
        "automated_sources": [source["name"] for source in SOURCES],
    }
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    if errors:
        print("Some sources were unavailable; see workflow logs. State was updated for successful sources.")

if __name__ == "__main__":
    main()
