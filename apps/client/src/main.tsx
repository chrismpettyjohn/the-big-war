import './styles/shell.css';
import { render } from 'solid-js/web';
import { Shell } from './ui/shell/Shell';
import '@the-big-war/frontend/ui/kit.css';
import '@the-big-war/frontend/ui/pixel.css';
import '@the-big-war/frontend/ui/tokens.css';

const host = document.getElementById('app');
if (!host) throw new Error('#app host element is missing from index.html');

render(() => <Shell />, host);
