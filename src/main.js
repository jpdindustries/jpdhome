import '@fontsource-variable/bitcount-prop-single/wght.css';
import '@fontsource/vt323/latin-400.css';
import './styles/main.css';
import { createModeMenu } from './components/mode-menu.js';
import {
  createRendererState,
  transitionRendererState,
} from './core/fallback-machine.js';
import { parseRequestedMode } from './core/modes.js';
import { getRuntimePreferences } from './core/quality.js';

const documentRoot = document.documentElement;
const sceneContainer = document.getElementById('scene');
const logoTrigger = document.getElementById('logo-trigger');
const loader = document.getElementById('scene-loader');
const requestedMode = parseRequestedMode(window.location.search);
const preferences = getRuntimePreferences(window);
const assetBase = new URL('assets/', document.baseURI);
const menu = createModeMenu({ requestedMode });
let state = createRendererState(requestedMode);
let activeController = null;
let activeRenderer = '';
let fallbackInProgress = false;
let disposed = false;
let appReadyResolve;

window.__JPD_APP_READY__ = new Promise((resolve) => {
  appReadyResolve = resolve;
});

function applyState() {
  documentRoot.dataset.requestedMode = state.requestedMode;
  documentRoot.dataset.renderer = state.renderer;
  documentRoot.dataset.sceneStatus = state.status;
  if (state.fallbackReason) documentRoot.dataset.fallbackReason = state.fallbackReason;
  else delete documentRoot.dataset.fallbackReason;
}

function classifyFailure(error, phase) {
  if (error?.fallbackReason) return error.fallbackReason;
  return phase === 'import' ? 'import-failed' : 'init-failed';
}

function getRendererImporter(renderer) {
  if (renderer === 'webgl') return () => import('./renderers/webgl.js');
  if (renderer === 'retro') return () => import('./renderers/retro.js');
  if (renderer === 'rgb') return () => import('./renderers/rgb.js');
  return () => import('./renderers/base.js');
}

function createContext(renderer) {
  return {
    container: sceneContainer,
    logo: logoTrigger,
    assetBase,
    quality: preferences.quality,
    motion: preferences.motion,
    onRecovering(at) {
      if (renderer !== 'webgl' || disposed) return;
      state = transitionRendererState(state, { type: 'CONTEXT_LOST', at });
      applyState();
    },
    onRecovered() {
      if (renderer !== 'webgl' || disposed) return;
      state = transitionRendererState(state, { type: 'CONTEXT_RESTORED' });
      applyState();
    },
    onFatal(reason, error) {
      if (disposed) return;
      if (renderer === 'webgl') {
        void fallbackToBase(reason, error);
      } else {
        state = transitionRendererState(state, { type: 'ERROR' });
        applyState();
      }
    },
  };
}

async function importRenderer(renderer) {
  if (renderer === 'webgl' && globalThis.__JPD_TEST_HOOKS__?.webglImportFailure) {
    throw new Error('Forced WebGL chunk import failure');
  }
  return getRendererImporter(renderer)();
}

async function mountRenderer(renderer) {
  let module;
  try {
    module = await importRenderer(renderer);
  } catch (error) {
    error.mountPhase = 'import';
    throw error;
  }
  if (typeof module.mount !== 'function') {
    const error = new Error(`Renderer module ${renderer} does not export mount()`);
    error.mountPhase = 'import';
    throw error;
  }
  try {
    return await module.mount(createContext(renderer));
  } catch (error) {
    error.mountPhase ||= 'mount';
    throw error;
  }
}

function completeReady(renderer, controller) {
  activeRenderer = renderer;
  activeController = controller;
  state = transitionRendererState(state, { type: 'READY', renderer });
  applyState();
  menu.setRenderer(controller, renderer);
  appReadyResolve?.(state);
  appReadyResolve = null;
}

async function fallbackToBase(reason, sourceError) {
  if (fallbackInProgress || disposed) return;
  fallbackInProgress = true;
  const fallbackReason = reason || 'init-failed';
  try {
    activeController?.dispose();
    activeController = null;
    activeRenderer = '';
    menu.setRenderer(null, 'base');
    sceneContainer.replaceChildren();
    const controller = await mountRenderer('base');
    activeController = controller;
    activeRenderer = 'base';
    state = transitionRendererState(state, { type: 'FAIL', reason: fallbackReason });
    applyState();
    menu.setRenderer(controller, 'base');
    appReadyResolve?.(state);
    appReadyResolve = null;
  } catch (fallbackError) {
    state = transitionRendererState(state, { type: 'ERROR' });
    applyState();
    loader.querySelector('.visually-hidden').textContent = 'Unable to load scene';
    globalThis.__JPD_LAST_ERROR__ = fallbackError || sourceError;
    appReadyResolve?.(state);
    appReadyResolve = null;
  } finally {
    fallbackInProgress = false;
  }
}

async function boot() {
  applyState();
  const selectedRenderer = requestedMode === 'auto' ? 'webgl' : requestedMode;
  if (selectedRenderer === 'webgl') {
    try {
      const controller = await mountRenderer('webgl');
      if (disposed) {
        controller.dispose();
        return;
      }
      completeReady('webgl', controller);
    } catch (error) {
      const reason = classifyFailure(error, error.mountPhase === 'import' ? 'import' : 'mount');
      await fallbackToBase(reason, error);
    }
    return;
  }

  try {
    const controller = await mountRenderer(selectedRenderer);
    if (disposed) {
      controller.dispose();
      return;
    }
    completeReady(selectedRenderer, controller);
  } catch (error) {
    state = transitionRendererState(state, { type: 'ERROR' });
    applyState();
    loader.querySelector('.visually-hidden').textContent = 'Unable to load scene';
    globalThis.__JPD_LAST_ERROR__ = error;
    appReadyResolve?.(state);
    appReadyResolve = null;
  }
}

window.__JPD_DIAGNOSTICS__ = {
  getState: () => ({ ...state }),
  getRendererDiagnostics: () => activeController?.getDiagnostics?.() || null,
  getController: () => activeController,
  simulateContextLoss: (options) => activeController?.simulateContextLoss?.(options),
  activateBlackHole: () => activeController?.activateBlackHole?.(),
  spawnFlyby: (type) => activeController?.spawnFlyby?.(type),
  get activeRenderer() {
    return activeRenderer;
  },
};

window.addEventListener('pagehide', () => {
  disposed = true;
  activeController?.dispose();
  menu.dispose();
}, { once: true });

void boot();
