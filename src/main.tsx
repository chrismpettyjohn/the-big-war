import { render } from 'solid-js/web';
import { Rail, RailAction } from './ui/kit/Rail';
import './ui/kit/tokens.css';
import './ui/kit/kit.css';

function Placeholder() {
  return (
    <>
      <Rail label="Main navigation" brand={<span style={{ 'font-size': '18px' }}>⚔</span>}>
        <RailAction label="Map" icon={<span>🗺</span>} active onClick={() => {}} />
        <RailAction label="Build" icon={<span>🏠</span>} onClick={() => {}} />
        <RailAction label="Research" icon={<span>🔬</span>} badge={2} badgeAccent onClick={() => {}} />
        <RailAction label="Army" icon={<span>⚔</span>} onClick={() => {}} />
      </Rail>
      <div class="boot">
        <h1>The Big War</h1>
        <p>Bootstrapping…</p>
      </div>
    </>
  );
}

render(() => <Placeholder />, document.getElementById('app')!);
