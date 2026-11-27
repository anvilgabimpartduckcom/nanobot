// Created robust Markdown, KaTeX math typesetting, and highlight.js code parsing engine [Commented by: Google AI Studio on 12/10/2026 10:52 PM]

import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import katex from 'katex';
import hljs from 'highlight.js';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } catch {
        // fallback
      }
    }
    return ''; // use default escaping
  }
});
// Prevent untrusted Markdown image syntax from emitting auto-fetching <img> tags [Commented by: Google AI Studio at 24/11/2026 09:45]
function getSafeExternalImageLink(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!/^https?:\/\//i.test(raw)) {
    return '';
  }
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

md.renderer.rules.image = (tokens, idx) => {
  const token = tokens[idx];
  const src = token.attrGet('src') || '';
  const alt = token.content || token.children?.map((c) => c.content).join('') || '';
  const label = escapeHtml(alt.trim() || 'image');
  const safeHref = getSafeExternalImageLink(src);
  if (safeHref) {
    return `<span class="inline-flex items-center gap-1 text-xs text-neutral-400 italic">[External image blocked for privacy: <a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer" class="underline text-blue-400 hover:text-blue-300">${label}</a>]</span>`;
  }
  return `<span class="text-xs text-neutral-400 italic">[External image blocked: ${label}]</span>`;
};

export const MARKDOWN_DOMPURIFY_CONFIG = {
  FORBID_TAGS: [
    'img',
    'picture',
    'source',
    'video',
    'audio',
    'track',
    'image',
    'feimage',
    'iframe',
    'frame',
    'object',
    'embed',
  ],
  FORBID_ATTR: ['srcset', 'poster', 'background'],
};

let domPurifyHooksRegistered = false;

export function registerMarkdownSanitizerHooks(
  purifier: { addHook?: (hook: string, cb: (node: Element, data: { attrName: string; attrValue: string; keepAttr: boolean }) => void) => void } = DOMPurify as unknown as {
    addHook?: (hook: string, cb: (node: Element, data: { attrName: string; attrValue: string; keepAttr: boolean }) => void) => void;
  }
): void {
  if (!purifier || typeof purifier.addHook !== 'function') return;
  if (purifier === (DOMPurify as unknown) && domPurifyHooksRegistered) return;

  purifier.addHook('uponSanitizeAttribute', (node, data) => {
    const attrName = (data.attrName || '').toLowerCase();
    const attrValue = String(data.attrValue || '');

    // Strip CSS url(...) references inside inline style attributes while preserving KaTeX layout styles
    if (attrName === 'style' && /url\s*\(/i.test(attrValue)) {
      const cleaned = attrValue.replace(/url\s*\([^)]*\)/gi, 'none').trim();
      data.attrValue = cleaned;
      if (!cleaned) {
        data.keepAttr = false;
      }
      return;
    }

    // Prevent SVG <use href/xlink:href="..."> from fetching external sprite URLs
    const tagName = (node?.tagName || '').toLowerCase();
    if (tagName === 'use' && (attrName === 'href' || attrName === 'xlink:href')) {
      if (!attrValue.trim().startsWith('#')) {
        data.keepAttr = false;
      }
    }
  });

  if (purifier === (DOMPurify as unknown)) {
    domPurifyHooksRegistered = true;
  }
}

registerMarkdownSanitizerHooks();
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return ch;
    }
  });
}

export function safeUrl(value: unknown): string {
  try {
    let str = String(value ?? '').trim();
    if (!str) return '';
    if (!/^https?:\/\//i.test(str) && !str.startsWith('//')) {
      str = 'https://' + str;
    }
    const u = new URL(str, window.location.href);
    return /^https?:$/.test(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}

export function markdownToHtml(value: unknown): string {
  try {
    let text = String(value ?? '');
    const codePlaceholders: string[] = [];
    const mathPlaceholders: { key: string; html: string }[] = [];

    // Shield code blocks so LaTeX markers inside code blocks or backticks are preserved
    text = text.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
      const idx = codePlaceholders.length;
      codePlaceholders.push(match);
      return `%%%CODE_PH_${idx}%%%`;
    });

    const renderMath = (mathText: string, displayMode: boolean) => {
      try {
        return katex.renderToString(mathText.trim(), {
          displayMode,
          throwOnError: false
        });
      } catch (e) {
        console.error('KaTeX rendering error:', e);
        return escapeHtml(mathText);
      }
    };

    const storeMath = (renderedHtml: string) => {
      const idx = mathPlaceholders.length;
      const key = `%%%MATH_PH_${idx}%%%`;
      mathPlaceholders.push({ key, html: renderedHtml });
      return key;
    };

    // Display Math: \[ ... \] and $$ ... $$
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, p1) => storeMath(renderMath(p1, true)));
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, p1) => storeMath(renderMath(p1, true)));

    // Inline Math: \( ... \) and $ ... $
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, p1) => storeMath(renderMath(p1, false)));
    text = text.replace(/\$([^\$\n]+?)\$/g, (_, p1) => storeMath(renderMath(p1, false)));

    // Restore shielded code blocks prior to markdown compilation
    text = text.replace(/%%%CODE_PH_(\d+)%%%/g, (_, idx) => codePlaceholders[Number(idx)] ?? '');

    // Compile Markdown
    let html = md.render(text);

    // Re-insert rendered KaTeX math
    if (mathPlaceholders.length > 0) {
      mathPlaceholders.forEach(({ key, html: mathHtml }) => {
        html = html.replace(key, () => mathHtml);
      });
    }

    registerMarkdownSanitizerHooks();
    return DOMPurify.sanitize(html, MARKDOWN_DOMPURIFY_CONFIG);
  } catch (error) {
    console.error('Error in markdownToHtml:', error);
    return escapeHtml(String(value ?? ''));
  }
}
