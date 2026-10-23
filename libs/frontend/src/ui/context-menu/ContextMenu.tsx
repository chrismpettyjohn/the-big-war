import './ContextMenu.css';
import { createSignal, For, onCleanup, onMount } from 'solid-js';
import type { ContextMenuProps, MenuEntry } from './ContextMenu.types';

export type { ContextMenuProps, MenuEntry };

const EDGE = 10;

export const ContextMenu = (props: ContextMenuProps) => {
  let menu: HTMLDivElement | undefined;
  const [position, setPosition] = createSignal<{ left: number; top: number } | null>(null);

  const clamp = () => {
    if (!menu) return;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left = Math.min(Math.max(props.x, EDGE), window.innerWidth - width - EDGE);
    const top = Math.min(Math.max(props.y, EDGE), window.innerHeight - height - EDGE);
    setPosition({ left, top });
  };

  onMount(() => {
    clamp();
    const onPointerDown = (event: PointerEvent) => {
      if (menu && !menu.contains(event.target as Node)) props.onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    });
  });

  return (
    <div
      ref={el => (menu = el)}
      class="nitro-context-menu"
      role="menu"
      style={
        position()
          ? { left: `${position()!.left}px`, top: `${position()!.top}px` }
          : { left: `${props.x}px`, top: `${props.y}px`, visibility: 'hidden' }
      }
    >
      <For each={props.entries}>
        {entry =>
          entry.type === 'divider' ? (
            <div class="menu-divider" />
          ) : entry.type === 'header' ? (
            <div class="menu-header">{entry.label}</div>
          ) : (
            <div
              class={`menu-item${entry.danger ? ' bg-danger' : ''}${entry.disabled ? ' disabled' : ''}`}
              role="menuitem"
              onClick={() => {
                if (entry.disabled) return;
                props.onClose();
                entry.onClick();
              }}
            >
              {entry.icon}
              {entry.label}
              {entry.note ? <span class="menu-item-note">{entry.note}</span> : null}
            </div>
          )
        }
      </For>
    </div>
  );
};
