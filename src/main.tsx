import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// Bundle KaTeX and Highlight.js stylesheets locally instead of external CDNs [Commented by: Google AI Studio at 23/11/2026 23:06]
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/atom-one-dark.min.css';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
