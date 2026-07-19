import { mountCanvasRenderer } from './canvas.js';

export function mount(context) {
  return mountCanvasRenderer(context, 'base');
}
