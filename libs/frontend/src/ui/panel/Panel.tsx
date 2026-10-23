import './Panel.css';
import { onMount, Show } from 'solid-js';
import type { PanelProps } from './Panel.types';
import {
  StreetDrawerHintContext,
  StreetDrawerPanel,
  StreetDrawerPanelHead,
  StreetDrawerRoot,
  streetDrawerStyle,
  useStreetDrawerEscape,
  useStreetDrawerExclusive,
  useStreetDrawerHint,
} from '../street-drawer/StreetDrawer';

export type { PanelProps };

export const Panel = (props: PanelProps) => {
  const { drawerRef, showHint, hideHint, HintView } = useStreetDrawerHint();
  const close = () => props.onClose?.();
  const closeOthers = useStreetDrawerExclusive(() => true, close);

  onMount(closeOthers);
  useStreetDrawerEscape(close);

  return (
    <StreetDrawerHintContext.Provider value={{ showHint, hideHint }}>
      <StreetDrawerRoot
        ref={drawerRef}
        class={props.class}
        style={streetDrawerStyle(props.tier ? 1 : 0)}
        onMouseLeave={hideHint}
      >
        {props.tier}
        <StreetDrawerPanel label={props.title}>
          <StreetDrawerPanelHead
            title={props.title}
            count={props.kind}
            closeLabel={`Close ${props.title}`}
            {...(props.onClose ? { onClose: close } : {})}
          >
            <Show when={props.headExtra}>{props.headExtra}</Show>
          </StreetDrawerPanelHead>
          <div class="street-drawer-panel-body">{props.children}</div>
        </StreetDrawerPanel>
        <HintView />
      </StreetDrawerRoot>
    </StreetDrawerHintContext.Provider>
  );
};
