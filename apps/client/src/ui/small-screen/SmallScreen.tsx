import './SmallScreen.css';
import { FaDesktop } from '@the-big-war/frontend/ui/icons/icons';

export const SmallScreen = () => (
  <div class="small-screen" role="alert">
    <FaDesktop class="small-screen-icon" />
    <span class="small-screen-title">Screen too small</span>
    <span class="small-screen-note">The Big War needs a larger display. Try a desktop or laptop, or widen your window.</span>
  </div>
);
