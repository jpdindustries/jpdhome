import {
  MODE_ACCESSIBLE_NAMES,
  MODE_IDS,
  MODE_LABELS,
  buildModeUrl,
} from '../core/modes.js';
import { STAR_MAX, STAR_MIN, changeStarCount } from '../core/stars.js';

export function createModeMenu({ requestedMode, navigate } = {}) {
  const abortController = new AbortController();
  const { signal } = abortController;
  const root = document.createElement('div');
  root.className = 'mode-control';
  root.dataset.open = 'false';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'mode-menu-trigger';
  trigger.setAttribute('aria-label', 'Open display controls');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'mode-menu-panel');
  trigger.innerHTML = '<span class="mode-menu-dot" aria-hidden="true"></span>';

  const panel = document.createElement('div');
  panel.id = 'mode-menu-panel';
  panel.className = 'mode-menu-panel';
  panel.setAttribute('role', 'toolbar');
  panel.setAttribute('aria-label', 'Display mode controls');
  panel.setAttribute('aria-hidden', 'true');
  panel.inert = true;

  const modeButtons = new Map();
  MODE_IDS.forEach((mode) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mode-button';
    button.textContent = MODE_LABELS[mode];
    button.setAttribute('aria-label', MODE_ACCESSIBLE_NAMES[mode]);
    button.setAttribute('aria-pressed', String(mode === requestedMode));
    button.addEventListener('click', () => {
      if (mode === requestedMode) return;
      const destination = buildModeUrl(window.location, mode);
      if (navigate) navigate(destination);
      else window.location.assign(destination);
    }, { signal });
    modeButtons.set(mode, button);
    panel.append(button);
  });

  const starControls = document.createElement('div');
  starControls.className = 'star-controls';
  starControls.hidden = true;
  starControls.setAttribute('role', 'group');
  starControls.setAttribute('aria-label', 'WebGL star count controls');

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.className = 'star-button';
  minus.textContent = '−';
  minus.setAttribute('aria-label', 'Remove 10,000 stars');

  const output = document.createElement('output');
  output.className = 'star-count';
  output.setAttribute('aria-label', 'Current star count');
  output.setAttribute('aria-live', 'polite');

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'star-button';
  plus.textContent = '+';
  plus.setAttribute('aria-label', 'Add 10,000 stars');

  starControls.append(minus, output, plus);
  panel.append(starControls);
  root.append(trigger, panel);
  document.body.append(root);

  let rendererController = null;
  let closeTimer = 0;
  let suppressFocusOpen = false;

  function setOpen(open, { restoreFocus = false } = {}) {
    window.clearTimeout(closeTimer);
    root.dataset.open = String(open);
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open ? 'Close display controls' : 'Open display controls');
    panel.setAttribute('aria-hidden', String(!open));
    panel.inert = !open;
    if (!open && restoreFocus) {
      suppressFocusOpen = true;
      trigger.focus();
      suppressFocusOpen = false;
    }
  }

  function updateStars() {
    if (!rendererController?.getStarCount || !rendererController?.setStarCount) {
      starControls.hidden = true;
      return;
    }
    const count = rendererController.getStarCount();
    starControls.hidden = false;
    output.value = String(count);
    output.textContent = Number(count).toLocaleString('en-US');
    minus.disabled = count <= STAR_MIN;
    plus.disabled = count >= STAR_MAX;
  }

  trigger.addEventListener('click', () => setOpen(root.dataset.open !== 'true'), { signal });
  root.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch') setOpen(true);
  }, { signal });
  root.addEventListener('pointerleave', () => {
    if (!root.contains(document.activeElement)) setOpen(false);
  }, { signal });
  root.addEventListener('focusin', () => {
    if (!suppressFocusOpen) setOpen(true);
  }, { signal });
  root.addEventListener('focusout', () => {
    closeTimer = window.setTimeout(() => {
      if (!root.contains(document.activeElement)) setOpen(false);
    }, 0);
  }, { signal });
  document.addEventListener('pointerdown', (event) => {
    if (root.dataset.open === 'true' && !root.contains(event.target)) setOpen(false);
  }, { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.dataset.open === 'true') {
      event.preventDefault();
      setOpen(false, { restoreFocus: true });
    }
  }, { signal });

  minus.addEventListener('click', () => {
    rendererController?.setStarCount(changeStarCount(rendererController.getStarCount(), -1));
    updateStars();
  }, { signal });
  plus.addEventListener('click', () => {
    rendererController?.setStarCount(changeStarCount(rendererController.getStarCount(), 1));
    updateStars();
  }, { signal });

  return {
    element: root,
    setRenderer(controller, renderer) {
      rendererController = renderer === 'webgl' ? controller : null;
      updateStars();
    },
    setRequestedMode(mode) {
      requestedMode = MODE_IDS.includes(mode) ? mode : 'auto';
      modeButtons.forEach((button, id) => {
        button.setAttribute('aria-pressed', String(id === requestedMode));
      });
    },
    updateStars,
    open: () => setOpen(true),
    close: () => setOpen(false),
    dispose() {
      window.clearTimeout(closeTimer);
      abortController.abort();
      root.remove();
    },
  };
}
