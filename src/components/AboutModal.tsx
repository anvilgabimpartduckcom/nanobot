// {Standalone modal for non-signed-in users displaying the About nanobot statement, links, and alphabetically sorted service acknowledgments} [Commented by: Google AI Studio on 18/10/2026 12:58 AM]

import React from 'react';
import { MCP_PLUGINS } from '../lib/plugins';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedPlugins?: Record<string, boolean>;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  connectedPlugins = {}
}) => {
  if (!isOpen) return null;

  const baseServices = [
    'Cloudflare',
    'Github',
    'Google AI Studio',
    'Google Gemini',
    'Netlify',
    'OpenAI ChatGPT',
    'Openrouter',
    'Supabase',
    'Tavily'
  ];

  const activePluginNames = MCP_PLUGINS
    .filter((p) => Boolean(connectedPlugins[p.id]))
    .map((p) => p.name);

  const sortedServices = Array.from(new Set([...baseServices, ...activePluginNames]))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0c0c0c] border border-[#262626] rounded-2xl shadow-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors p-1 cursor-pointer text-sm"
          aria-label="Close About modal"
        >
          ✕
        </button>

        <div className="space-y-4 text-neutral-300">
          <h2 className="text-xl font-bold font-serif text-white">About nanobot</h2>
          {/* {Rewrote description to state 'open source code AI chatbot' and added license hyperlink} [Commented by: Google AI Studio on 21/10/2026 06:08 AM] */}
          <p className="text-sm leading-relaxed">
            Everyone should get to use AI, and that too without giving away their data. So we created nanobot, an open source code AI chatbot which respects your privacy, and is free to use. Users bring their own API keys, which helps in further keeping nanobot completely free to use.
            <br />
            <a
              href="https://github.com/anvilgabimpartduckcom/nanobot/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline font-medium"
            >
              See the license under which nanobot comes.
            </a>
          </p>
          {/* {Updated developer contact section to include GitHub discussions link and preserved email box per user specification} [Commented by: Google AI Studio on 22/10/2026 04:47 AM] */}
          <p className="text-sm leading-relaxed">
            For more information, For reporting a bug, issue, or vulnerability, join the{' '}
            <a
              href="https://github.com/anvilgabimpartduckcom/nanobot/discussions/2"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline font-medium"
            >
              GitHub discussion
            </a>{' '}
            or email at{' '}
            <span className="inline-block bg-[#1a1a1a] border border-[#333] text-neutral-200 px-2 py-0.5 rounded font-mono text-xs select-all">
              molecule-sip-sauna@duck.com
            </span>
          </p>
          <p className="text-sm leading-relaxed">
            You can also get information about more features of nanobot at the{' '}
            <a
              href="https://tropical-chime-8c1.notion.site/nanobot-101-3f4b104092f3804792d0c68bca97e821"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline font-medium"
            >
              nanobot 101
            </a>
          </p>

          <div className="bg-[#141414] border border-[#333] rounded-xl p-4 space-y-2 mt-4 text-xs text-neutral-300">
            <div className="font-semibold text-white text-sm">Note:</div>
            <ol className="list-decimal list-inside space-y-2 leading-relaxed">
              <li>
                nanobot has a 30-days chat deletion policy. Any chat inactive for 30 days will be automatically deleted. This is required for storage purposes. On top of that, we request you to delete any chat that you have no longer use for. Your deleting of one chat will help another user create a new chat.
              </li>
              <li>
                Warning: Though we&#39;ve given our best not to have any data loss, some of your data might get deleted. Though this&#39;ll be extremely rare, we recommend to keep a backup of important chats by saving them using &#39;Ctrl+S&#39; combination.
              </li>
            </ol>
          </div>

          {/* {Added hyperlink for latest update in nanobot above Github source code link} [Commented by: Google AI Studio on 21/10/2026 06:08 AM] */}
          <p className="text-sm pt-2 leading-relaxed">
            <a
              href="https://github.com/anvilgabimpartduckcom/nanobot#-latest-updates"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline font-medium"
            >
              See the latest update in nanobot
            </a>
          </p>
          <p className="text-sm pt-1 leading-relaxed">
            <a
              href="https://github.com/anvilgabimpartduckcom/nanobot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline font-medium"
            >
              Visit nanobot&#39;s source code in Github
            </a>
          </p>

          <div className="border-t border-neutral-800 pt-4 mt-2 space-y-2 text-xs text-neutral-400 leading-relaxed">
            <p>
              Special thanks to {sortedServices.join(', ')}. The features from these services have enabled and assisted us in coding, developing, hosting, creating backend and maintaining nanobot.
            </p>
            <p className="text-[11px] text-neutral-500">
              All terms and conditions are under these services.
            </p>
            {/* {Added centered 'Made in INDIA 🇮🇳 ❤️' statement under terms and conditions} [Commented by: Google AI Studio on 22/10/2026 05:36 AM] */}
            <p className="text-center text-xs text-neutral-300 font-medium pt-2">
              Made in INDIA 🇮🇳 ❤️
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
