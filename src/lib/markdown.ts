// {Created robust Markdown, KaTeX math typesetting, and highlight.js code parsing engine} [Commented by: Google AI Studio on 12/10/2026 10:52 AM]

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

    return DOMPurify.sanitize(html);
  } catch (error) {
    console.error('Error in markdownToHtml:', error);
    return escapeHtml(String(value ?? ''));
  }
}
