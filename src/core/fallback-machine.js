export const FALLBACK_REASONS = Object.freeze([
  'webgl-unavailable',
  'import-failed',
  'init-failed',
  'context-lost',
]);

export function createRendererState(requestedMode = 'auto') {
  return {
    requestedMode,
    renderer: '',
    status: 'loading',
    fallbackReason: null,
    lastContextLossAt: null,
  };
}

export function transitionRendererState(state, event) {
  switch (event.type) {
    case 'READY':
      return { ...state, renderer: event.renderer, status: 'ready', fallbackReason: null };
    case 'FAIL':
      return {
        ...state,
        renderer: 'base',
        status: 'fallback',
        fallbackReason: FALLBACK_REASONS.includes(event.reason) ? event.reason : 'init-failed',
      };
    case 'CONTEXT_LOST': {
      const at = Number(event.at);
      const repeated = state.lastContextLossAt !== null && at - state.lastContextLossAt <= 30_000;
      return repeated
        ? { ...state, renderer: 'base', status: 'fallback', fallbackReason: 'context-lost', lastContextLossAt: at }
        : { ...state, status: 'recovering', lastContextLossAt: at };
    }
    case 'CONTEXT_RESTORED':
      return state.status === 'recovering' ? { ...state, status: 'ready' } : state;
    case 'RESTORE_TIMEOUT':
      return state.status === 'recovering'
        ? { ...state, renderer: 'base', status: 'fallback', fallbackReason: 'context-lost' }
        : state;
    case 'ERROR':
      return { ...state, status: 'error' };
    default:
      return state;
  }
}
