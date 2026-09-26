import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceTilt, projectDeviceTilt } from '../../src/core/device-tilt.js';

function orientation(beta, gamma) {
  const event = new Event('deviceorientation');
  Object.assign(event, { beta, gamma });
  return event;
}

test('tilt projects into screen axes and stays bounded', () => {
  const portrait = projectDeviceTilt({
    beta: 24, gamma: 9, originBeta: 15, originGamma: 0,
    width: 400, height: 800,
  });
  assert.deepEqual(portrait, { x: 90, y: 110 });

  const landscape = projectDeviceTilt({
    beta: 24, gamma: 9, originBeta: 15, originGamma: 0,
    angle: 90, width: 800, height: 400,
  });
  assert.ok(Math.abs(landscape.x + 120) < 1e-9);
  assert.ok(Math.abs(landscape.y - 70) < 1e-9);

  const extreme = projectDeviceTilt({
    beta: 140, gamma: 80, originBeta: 0, originGamma: 0,
    width: 400, height: 800,
  });
  assert.deepEqual(extreme, { x: 180, y: 220 });
});

test('motion permission gates sensor input and disabling clears it', async () => {
  const windowLike = new EventTarget();
  const documentLike = new EventTarget();
  windowLike.isSecureContext = true;
  windowLike.innerWidth = 400;
  windowLike.innerHeight = 800;
  windowLike.screen = { orientation: { angle: 0 } };
  windowLike.DeviceOrientationEvent = class {
    static requestPermission() { return Promise.resolve('granted'); }
  };
  documentLike.hidden = false;

  const tilt = createDeviceTilt({ windowLike, documentLike, coarsePointer: true, reducedMotion: false });
  assert.equal(tilt.supported, true);
  assert.equal(tilt.enabled, false);
  assert.equal(await tilt.enable(), true);
  windowLike.dispatchEvent(orientation(15, 0));
  windowLike.dispatchEvent(orientation(15, 9));
  assert.equal(tilt.getInput().active, true);
  assert.equal(tilt.getInput().x, 90);

  windowLike.screen.orientation.angle = 90;
  windowLike.dispatchEvent(orientation(15, 9));
  assert.equal(tilt.getInput().x, 0);
  tilt.disable();
  assert.deepEqual(tilt.getInput(), { x: 0, y: 0, active: false });
  tilt.dispose();
});

test('reduced motion never starts the tilt listener', async () => {
  const windowLike = new EventTarget();
  windowLike.isSecureContext = true;
  windowLike.DeviceOrientationEvent = class {};
  const tilt = createDeviceTilt({ windowLike, documentLike: new EventTarget(), coarsePointer: true, reducedMotion: true });
  assert.equal(tilt.supported, false);
  assert.equal(await tilt.enable(), false);
});
