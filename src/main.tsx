/**
 * Entry point. Mounts the app shell and pulls in the global stylesheets in
 * cascade order: design tokens → kit components → app layout.
 */

import { render } from 'solid-js/web';
import { Shell } from './ui/Shell';
import './ui/kit/tokens.css';
import './ui/kit/kit.css';
import './styles/shell.css';

const host = document.getElementById('app');
if (!host) throw new Error('#app host element is missing from index.html');

render(() => <Shell />, host);
