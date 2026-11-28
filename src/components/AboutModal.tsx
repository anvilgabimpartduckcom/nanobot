// Standalone modal for non-signed-in users displaying the upgraded About nanobot sections, data disclosure, links, and service acknowledgments [Commented by: Google AI Studio on 28/11/2026 06:48]

import React from 'react';
import { AppTheme } from '../lib/theme';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedPlugins?: Record<string, boolean>;
  theme?: AppTheme;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  theme = 'Neon Black',
}) => {
  if (!isOpen) return null;

  const isLight = theme === 'Minimalist Light';

  // Removed Google Gemini from Special thanks list per user update [Commented by: Google AI Studio on 28/11/2026 06:48]
  const baseServices = [
    'Cloudflare',
    'Github',
    'Google AI Studio',
    'Netlify',
    'OpenAI ChatGPT',
    'Openrouter',
    'Supabase',
    'Tavily',
  ];

  // Static services acknowledgment list without dynamically inserted plugins [Commented by: Google AI Studio on 29/10/2026 04:00 PM]
  const sortedServices = [...baseServices].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-xl rounded-2xl shadow-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto border ${
          isLight
            ? 'bg-white border-neutral-200 text-neutral-800'
            : 'bg-[#0c0c0c] border-[#262626] text-neutral-300'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 transition-colors p-1 cursor-pointer text-sm ${
            isLight ? 'text-neutral-500 hover:text-neutral-900' : 'text-neutral-400 hover:text-white'
          }`}
          aria-label="Close About modal"
        >
          ✕
        </button>

        {/* Upgraded About nanobot text block above Special thanks to section [Commented by: Google AI Studio on 28/11/2026 06:48] */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className={`text-xl font-bold font-serif ${isLight ? 'text-neutral-900' : 'text-white'}`}>
              About nanobot
            </h2>
            <p className="text-sm leading-relaxed">
              AI should be a tool, which is free to use, easy to set up, and can be used in many use cases. So we created nanobot, a completely free-to-use AI chat bot that runs on the API keys provided by an user.
            </p>
          </div>

          {/* Updated privacy disclosure to match H-5 local-first storage architecture accurately [Commented by: Google AI Studio on 28/11/2026 07:30] */}
          <div className="space-y-2.5">
            <h3 className={`text-base font-bold font-serif ${isLight ? 'text-neutral-900' : 'text-white'}`}>
              Understand how your data is stored
            </h3>
            <p className="text-sm leading-relaxed">
              nanobot separates account data, public shared snapshots, and browser-local conversations:
            </p>
            <ol className="text-sm leading-relaxed pl-6 space-y-1.5">
              <li>
                <strong>i. Account &amp; authentication data (Supabase):</strong> Your username, authentication record, encrypted API keys, and connected add-on permissions are managed through your account backend.
              </li>
              <li>
                <strong>ii. Shared Noodles (Cloudflare):</strong> Snapshots you explicitly choose to share are stored in Cloudflare for public link access (up to 30 days, or until you revoke the link).
              </li>
              <li>
                <strong>iii. Regular chats (Browser localStorage):</strong> Stored locally in this browser&apos;s localStorage (and encrypted with your account password when signed in) — never synchronized or backed up to Supabase.
              </li>
              <li>
                <strong>iv. Incognito chats (Browser localStorage):</strong> Stored locally in this browser under a separate incognito localStorage key so they persist across refreshes without mixing into regular history, and are never uploaded to Supabase or Cloudflare.
              </li>
              <li>
                <strong>v. Uploaded files &amp; extracted outputs:</strong> Raw files remain in browser IndexedDB, and extracted summaries/reader scripts remain in browser localStorage only.
              </li>
            </ol>
            <p className={`text-xs leading-relaxed pt-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
              Important: Browser storage (localStorage and IndexedDB) keeps data on your device rather than in Supabase, but does not protect data against malicious browser extensions, XSS, or compromise of the local browser or device.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className={`text-base font-bold font-serif ${isLight ? 'text-neutral-900' : 'text-white'}`}>
              Other links you&#39;d like to visit
            </h3>
            <div className="space-y-1.5 text-sm">
              <p>
                <a
                  href="https://github.com/anvilgabimpartduckcom/nanobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="accent-text underline font-medium hover:opacity-80 transition-opacity"
                >
                  See nanobot&#39;s source code
                </a>
              </p>
              <p>
                <a
                  href="https://github.com/anvilgabimpartduckcom/nanobot#-latest-updates"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="accent-text underline font-medium hover:opacity-80 transition-opacity"
                >
                  See the latest updates in nanobot
                </a>
              </p>
              <p>
                <a
                  href="https://github.com/anvilgabimpartduckcom"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="accent-text underline font-medium hover:opacity-80 transition-opacity"
                >
                  See our full catalog of products
                </a>
              </p>
              <p>
                <a
                  href="https://tropical-chime-8c1.notion.site/AI-News-3e6b104092f38092a013ff0804763a13"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="accent-text underline font-medium hover:opacity-80 transition-opacity"
                >
                  Try AI News
                </a>
              </p>
            </div>
          </div>

          <div className={`border-t pt-4 mt-2 space-y-2 text-xs leading-relaxed ${
            isLight ? 'border-neutral-200 text-neutral-600' : 'border-neutral-800 text-neutral-400'
          }`}>
            <p>
              Special thanks to {sortedServices.join(', ')}. The features provided by these services have helped me code, develop, host, build the backend for, and maintain nanobot.
            </p>
            <p className={`text-[11px] ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>
              All terms and conditions are under these services.
            </p>
            {/* Added centered 'Made in INDIA 🇮🇳 ❤️' statement under terms and conditions  [Commented by: Google AI Studio on 22/10/2026 05:36 PM] */}
            <p className={`text-center text-xs font-medium pt-2 ${isLight ? 'text-neutral-800' : 'text-neutral-300'}`}>
              Made in INDIA 🇮🇳 ❤️
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

