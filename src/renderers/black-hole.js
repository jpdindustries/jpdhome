import * as THREE from 'three';

const BASE_TARGET_RADIUS = 0.32;
const CORE_TO_TARGET_LIMIT = 0.82;
const LENS_RADIUS_MULTIPLIER = 1.58;

function smootherStep(value) {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * clamped * (
    clamped * (clamped * 6 - 15) + 10
  );
}

function stagedReveal(progress, start, end) {
  return smootherStep((progress - start) / Math.max(end - start, Number.EPSILON));
}

export function calculateBlackHoleEntry(progress, reducedMotion = false) {
  if (reducedMotion) {
    return { core: 1, radius: 1, lens: 1, rim: 1, disk: 1, dim: 1, gather: 1 };
  }

  const clamped = Math.min(1, Math.max(0, Number(progress) || 0));
  return {
    core: stagedReveal(clamped, 0, 0.24),
    radius: stagedReveal(clamped, 0, 0.42),
    lens: stagedReveal(clamped, 0.02, 0.8),
    rim: stagedReveal(clamped, 0.04, 0.42),
    disk: stagedReveal(clamped, 0.1, 0.62),
    dim: stagedReveal(clamped, 0.06, 0.72),
    gather: stagedReveal(clamped, 0.18, 0.95),
  };
}

export function calculateBlackHoleLayout({
  viewportWidth,
  viewportHeight,
  logoWidth,
  logoHeight,
}) {
  const minDimension = Math.max(1, Math.min(viewportWidth, viewportHeight));
  const logoDiameter = Math.max(0, logoWidth, logoHeight);
  const padding = Math.min(48, minDimension * 0.1);
  const desiredCoreDiameter = Math.max(logoDiameter + padding, minDimension * 0.34);
  const startCoreDiameter = Math.min(
    desiredCoreDiameter,
    logoDiameter + Math.min(14, padding * 0.35),
  );
  const fittedTargetRadius = desiredCoreDiameter
    / (2 * minDimension * CORE_TO_TARGET_LIMIT);
  const targetRadius = Math.max(BASE_TARGET_RADIUS, fittedTargetRadius);
  const coreRadius = Math.min(
    desiredCoreDiameter / (2 * minDimension),
    targetRadius * CORE_TO_TARGET_LIMIT,
  );

  return {
    targetRadius,
    coreRadius,
    startCoreRadius: startCoreDiameter / (2 * minDimension),
    logoDiameterCss: logoDiameter,
    startCoreDiameterCss: startCoreDiameter,
    coreDiameterCss: coreRadius * minDimension * 2,
    targetDiameterCss: targetRadius * minDimension * 2,
    lensDiameterCss: targetRadius * LENS_RADIUS_MULTIPLIER * minDimension * 2,
  };
}

function fullScreenVertexShader() {
  return `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;
}

function createDistortionMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uTargetRadius: { value: BASE_TARGET_RADIUS },
      uCoreRadius: { value: 0.24 },
      uStartCoreRadius: { value: 0.2 },
      uRadiusReveal: { value: 0 },
    },
    vertexShader: fullScreenVertexShader(),
    fragmentShader: `
      precision highp float;
      uniform float uProgress;
      uniform vec2 uResolution;
      uniform vec2 uCenter;
      uniform float uTargetRadius;
      uniform float uCoreRadius;
      uniform float uStartCoreRadius;
      uniform float uRadiusReveal;
      varying vec2 vUv;

      float smoother(float value) {
        value = clamp(value, 0.0, 1.0);
        return value * value * value * (value * (value * 6.0 - 15.0) + 10.0);
      }

      float softBand(float value, float center, float halfWidth, float feather) {
        return smoothstep(center - halfWidth - feather, center - halfWidth, value)
          * (1.0 - smoothstep(center + halfWidth, center + halfWidth + feather, value));
      }

      void main() {
        float minDimension = max(1.0, min(uResolution.x, uResolution.y));
        float pixel = 1.0 / minDimension;
        vec2 centerUv = uCenter / uResolution;
        vec2 point = (vUv - centerUv) * uResolution / minDimension;
        float distanceToCenter = length(point);
        float progress = smoother(uProgress);
        float coreRadius = max(
          mix(uStartCoreRadius, uCoreRadius, uRadiusReveal),
          pixel * 8.0
        );
        float activeRadius = mix(coreRadius * 1.1, uTargetRadius, progress);
        float field = 1.0 - smoothstep(
          coreRadius * 0.24,
          activeRadius * 1.42,
          distanceToCenter
        );
        float innerLens = 1.0 - smoothstep(
          coreRadius * 0.12,
          coreRadius,
          distanceToCenter
        );
        float photon = softBand(
          distanceToCenter,
          coreRadius * 1.018,
          max(pixel * 1.25, coreRadius * 0.006),
          max(pixel * 4.5, coreRadius * 0.028)
        );
        float strength = clamp(
          field * (0.8 + progress * 0.2) + photon * 0.2,
          0.0,
          1.0
        );
        gl_FragColor = vec4(strength, innerLens, photon, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}

function createCompositeMaterial(sceneTexture, distortionTexture, reducedMotion) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: sceneTexture },
      tDistortion: { value: distortionTexture },
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uTargetRadius: { value: BASE_TARGET_RADIUS },
      uCoreRadius: { value: 0.24 },
      uStartCoreRadius: { value: 0.2 },
      uReducedMotion: { value: reducedMotion ? 1 : 0 },
      uCoreReveal: { value: reducedMotion ? 1 : 0 },
      uRadiusReveal: { value: reducedMotion ? 1 : 0 },
      uLensReveal: { value: reducedMotion ? 1 : 0 },
      uRimReveal: { value: reducedMotion ? 1 : 0 },
      uDiskReveal: { value: reducedMotion ? 1 : 0 },
      uDimReveal: { value: reducedMotion ? 1 : 0 },
      uGatherReveal: { value: reducedMotion ? 1 : 0 },
    },
    vertexShader: fullScreenVertexShader(),
    fragmentShader: `
      precision highp float;
      uniform sampler2D tScene;
      uniform sampler2D tDistortion;
      uniform float uTime;
      uniform float uProgress;
      uniform vec2 uResolution;
      uniform vec2 uCenter;
      uniform float uTargetRadius;
      uniform float uCoreRadius;
      uniform float uStartCoreRadius;
      uniform float uReducedMotion;
      uniform float uCoreReveal;
      uniform float uRadiusReveal;
      uniform float uLensReveal;
      uniform float uRimReveal;
      uniform float uDiskReveal;
      uniform float uDimReveal;
      uniform float uGatherReveal;
      varying vec2 vUv;

      float hash(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        vec2 curve = local * local * (3.0 - 2.0 * local);
        float a = hash(cell);
        float b = hash(cell + vec2(1.0, 0.0));
        float c = hash(cell + vec2(0.0, 1.0));
        float d = hash(cell + vec2(1.0, 1.0));
        return mix(mix(a, b, curve.x), mix(c, d, curve.x), curve.y);
      }

      float fbm(vec2 point) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int octave = 0; octave < 5; octave++) {
          value += amplitude * noise(point);
          point *= 2.03;
          amplitude *= 0.5;
        }
        return value;
      }

      mat2 rotate2d(float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return mat2(cosine, sine, -sine, cosine);
      }

      float smoother(float value) {
        value = clamp(value, 0.0, 1.0);
        return value * value * value * (value * (value * 6.0 - 15.0) + 10.0);
      }

      float softBand(float value, float center, float halfWidth, float feather) {
        return smoothstep(center - halfWidth - feather, center - halfWidth, value)
          * (1.0 - smoothstep(center + halfWidth, center + halfWidth + feather, value));
      }

      float sceneEdgeMask(vec2 uv) {
        vec2 fade = max(vec2(2.0) / uResolution, vec2(0.0015));
        vec2 lower = smoothstep(vec2(0.0), fade, uv);
        vec2 upper = 1.0 - smoothstep(vec2(1.0) - fade, vec2(1.0), uv);
        return lower.x * lower.y * upper.x * upper.y;
      }

      vec4 sampleScene(vec2 uv) {
        return texture2D(
          tScene,
          clamp(uv, vec2(0.001), vec2(0.999))
        ) * sceneEdgeMask(uv);
      }

      vec3 sampleRGBShift(vec2 uv, vec2 offset) {
        vec2 offset120 = vec2(
          offset.x * -0.5 - offset.y * 0.8660254,
          offset.x * 0.8660254 + offset.y * -0.5
        );
        vec2 offset240 = vec2(
          offset.x * -0.5 + offset.y * 0.8660254,
          offset.x * -0.8660254 + offset.y * -0.5
        );
        return vec3(
          sampleScene(uv + offset120).r,
          sampleScene(uv + offset240).g,
          sampleScene(uv + offset).b
        );
      }

      void main() {
        float minDimension = max(1.0, min(uResolution.x, uResolution.y));
        float pixel = 1.0 / minDimension;
        vec2 centerUv = uCenter / uResolution;
        vec2 centered = (vUv - centerUv) * uResolution / minDimension;
        float distanceToCenter = length(centered);
        vec2 radial = distanceToCenter > 0.0001
          ? centered / distanceToCenter
          : vec2(1.0, 0.0);
        vec2 tangent = vec2(-radial.y, radial.x);
        float progress = smoother(uProgress);
        float motionScale = 1.0 - uReducedMotion;
        float flowTime = uTime * motionScale;
        float coreRadius = max(
          mix(uStartCoreRadius, uCoreRadius, uRadiusReveal),
          pixel * 8.0
        );
        float activeRadius = mix(coreRadius * 1.1, uTargetRadius, progress);
        float edge = max(pixel * 1.7, coreRadius * 0.0075);

        if (distanceToCenter > activeRadius * 1.6 + pixel * 4.0) {
          gl_FragColor = vec4(vec3(0.0), uDimReveal * 0.2);
          return;
        }

        vec4 distortionSample = texture2D(tDistortion, vUv);
        float distortion = distortionSample.r;
        float innerLens = distortionSample.g;
        float photonFromPass = distortionSample.b;
        float interiorMask = 1.0 - smoothstep(
          coreRadius * 0.86,
          coreRadius,
          distanceToCenter
        );
        float broadLens = max(distortion, interiorMask * 0.82) * uLensReveal;
        float lensNoise = fbm(
          centered * 6.4 + vec2(flowTime * 0.18, -flowTime * 0.11)
        );
        float shimmer = (lensNoise - 0.5) * motionScale;
        float pulse = sin(distanceToCenter * 42.0 - flowTime * 1.45) * 0.5 + 0.5;
        float pull = broadLens
          * activeRadius
          * (0.4 + innerLens * 0.24 + interiorMask * 0.16)
          / (0.9 + distanceToCenter / max(activeRadius, 0.02));
        float movingPull = broadLens
          * activeRadius
          * 0.015
          * (shimmer + pulse * 0.32)
          * motionScale;
        float swirl = broadLens * activeRadius * 0.019 * shimmer * motionScale;
        vec2 warped = centered - radial * (pull + movingPull) + tangent * swirl;
        vec2 warpedUv = centerUv + warped * minDimension / uResolution;

        float rimNoise = mix(
          lensNoise,
          noise(
            rotate2d(flowTime * 0.035) * centered * 46.0
              + vec2(flowTime * 0.12, -flowTime * 0.08)
          ),
          0.42
        );
        float rimOffset = (rimNoise - 0.5) * coreRadius * 0.052;
        float photonRing = softBand(
          distanceToCenter,
          coreRadius * 1.018 + rimOffset,
          max(pixel * 1.25, coreRadius * 0.006),
          max(pixel * 4.5, coreRadius * 0.028)
        ) * mix(0.52, 1.0, smoother(rimNoise));
        float photonGlow = softBand(
          distanceToCenter,
          coreRadius * 1.04 + rimOffset * 0.72,
          max(pixel * 5.0, coreRadius * 0.04),
          max(pixel * 12.0, coreRadius * 0.074)
        ) * mix(0.72, 1.0, rimNoise);
        float lensHalo = smoothstep(
          coreRadius * 0.82,
          coreRadius * 1.04,
          distanceToCenter
        ) * (
          1.0 - smoothstep(
            activeRadius * 1.04,
            activeRadius * 1.56,
            distanceToCenter
          )
        ) * mix(0.28, 1.0, progress);
        float outerGather = softBand(
          distanceToCenter,
          activeRadius * 1.04,
          activeRadius * 0.17,
          activeRadius * 0.28
        ) * progress;
        float chromaAmount = (
          photonRing * 0.0042 + photonGlow * 0.0014
        ) * motionScale * uRimReveal;
        vec2 chromaOffset = radial * chromaAmount * minDimension / uResolution;
        vec4 sceneMid = sampleScene(warpedUv);
        vec3 sceneRgb = mix(
          sceneMid.rgb,
          sampleRGBShift(warpedUv, chromaOffset),
          clamp(photonRing * 0.9 + photonGlow * 0.24, 0.0, 1.0)
        );

        float coreWindow = 1.0 - smoothstep(
          coreRadius * 0.1,
          coreRadius,
          distanceToCenter
        );
        vec2 coreWarp = centered * (0.32 + shimmer * 0.012)
          - radial * activeRadius * (0.18 + broadLens * 0.11);
        vec3 coreSample = sampleScene(
          centerUv + coreWarp * minDimension / uResolution
        ).rgb;
        coreSample *= 0.08
          + max(max(coreSample.r, coreSample.g), coreSample.b) * 0.12;

        vec2 diskPoint = rotate2d(-0.09) * centered;
        vec2 flattenedDisk = vec2(diskPoint.x, diskPoint.y * 3.05);
        float diskDistance = length(flattenedDisk);
        float diskInner = coreRadius * 0.76;
        float diskOuter = max(activeRadius * 1.18, coreRadius * 1.24);
        float diskRange = max(diskOuter - diskInner, 0.001);
        float diskNorm = clamp(
          (diskDistance - diskInner) / diskRange,
          0.0,
          1.0
        );
        float diskEnvelope = smoothstep(
          diskInner - coreRadius * 0.16,
          diskInner + coreRadius * 0.22,
          diskDistance
        ) * (
          1.0 - smoothstep(
            diskOuter - diskRange * 0.34,
            diskOuter + diskRange * 0.12,
            diskDistance
          )
        ) * (
          1.0 - smoothstep(
            coreRadius * 0.12,
            coreRadius * 1.24,
            abs(diskPoint.y)
          )
        );
        vec2 coarseFlow = rotate2d(flowTime * 0.24) * flattenedDisk;
        vec2 fineFlow = rotate2d(-flowTime * 0.39) * flattenedDisk;
        float cloudNoise = 0.5;
        float fineCloud = 0.5;
        if (diskEnvelope > 0.001) {
          cloudNoise = fbm(
            coarseFlow * 7.2 + vec2(flowTime * 0.16, -flowTime * 0.07)
          );
          fineCloud = fbm(
            fineFlow * 17.0 + vec2(-flowTime * 0.2, flowTime * 0.11)
          );
        }
        float boundaryDrift = (cloudNoise - 0.5) * diskRange * 0.18
          + (fineCloud - 0.5) * diskRange * 0.055;
        float softenedDiskDistance = diskDistance + boundaryDrift;
        float verticalDrift = (cloudNoise - 0.5) * coreRadius * 0.24
          + (fineCloud - 0.5) * coreRadius * 0.06;
        float verticalWindow = 1.0 - smoothstep(
          coreRadius * 0.12,
          coreRadius * 1.12,
          abs(diskPoint.y) + verticalDrift
        );
        float diskWindow = smoothstep(
          diskInner - coreRadius * 0.12,
          coreRadius * 1.06,
          softenedDiskDistance
        ) * (
          1.0 - smoothstep(
            diskOuter - diskRange * 0.28,
            diskOuter + diskRange * 0.08,
            softenedDiskDistance
          )
        ) * verticalWindow * mix(0.36, 1.0, progress);
        float orbitAngle = atan(flattenedDisk.y, flattenedDisk.x);
        float streams = 0.5 + 0.5 * sin(
          orbitAngle * 10.0
            - flowTime * 2.15
            + diskDistance * 38.0
            + (cloudNoise - 0.5) * 3.0
        );
        float orbitPulse = pow(
          0.5 + 0.5 * sin(
            orbitAngle * 6.0
              - flowTime * 3.4
              + diskDistance * 52.0
              + fineCloud * 2.0
          ),
          1.65
        );
        float orbitArc = pow(
          0.5 + 0.5 * cos(
            orbitAngle * 2.0
              - flowTime * 1.4
              - diskNorm * 2.4
          ),
          2.1
        );
        float frontFeather = smoothstep(
          -coreRadius * 0.2,
          coreRadius * 0.34,
          diskPoint.y
        );
        float doppler = smoothstep(
          -0.9,
          0.9,
          diskPoint.x / max(distanceToCenter, 0.001)
        );
        float radialEnergy = mix(
          0.48,
          1.0,
          smoother(1.0 - abs(diskNorm * 2.0 - 1.0))
        );
        float cloud = diskWindow
          * radialEnergy
          * (
            0.1
              + cloudNoise * 0.34
              + fineCloud * 0.12
              + streams * 0.18
              + orbitPulse * 0.26
              + orbitArc * 0.16
          )
          * mix(0.64, 1.0, frontFeather)
          * (0.86 + doppler * 0.04);
        float flowHighlight = diskWindow
          * radialEnergy
          * (orbitPulse * 0.58 + orbitArc * 0.3)
          * (0.24 + fineCloud * 0.54);
        vec2 speckPoint = rotate2d(flowTime * 0.3) * flattenedDisk;
        vec2 speckUv = speckPoint * minDimension * 0.29
          + vec2(flowTime * 19.0, -flowTime * 5.0);
        float specks = smoothstep(0.9945, 0.9994, hash(floor(speckUv)))
          * smoothstep(0.1, 0.28, diskNorm)
          * (1.0 - smoothstep(0.76, 1.0, diskNorm))
          * diskWindow
          * motionScale;

        sceneRgb *= 1.0 - broadLens * 0.05;
        sceneRgb *= 1.0 - interiorMask * 0.985;
        float frontLayer = smoothstep(
          coreRadius * 0.04,
          coreRadius * 0.48,
          diskPoint.y
        );
        float foregroundSkim = frontLayer
          * smoothstep(
            coreRadius * 0.72,
            coreRadius * 0.98,
            distanceToCenter
          )
          * 0.22;
        float diskVisibility = max(1.0 - interiorMask, foregroundSkim);
        cloud *= diskVisibility;
        flowHighlight *= diskVisibility;
        specks *= diskVisibility;

        vec3 diskColor = mix(
          vec3(1.0, 0.32, 0.075),
          vec3(1.0, 0.62, 0.22),
          doppler
        ) * mix(1.08, 0.86, doppler);
        float rimAngle = atan(centered.y, centered.x);
        float rimFlow = 0.94 + motionScale * (
          0.04 * sin(rimAngle * 5.0 - flowTime * 0.9)
            + 0.02 * sin(rimAngle * 11.0 + flowTime * 1.4)
        );
        vec3 color = sceneRgb;
        color = mix(color, coreSample, coreWindow * 0.18);
        color *= 1.0 - coreWindow * 0.82 * uCoreReveal;
        color += cloud * diskColor * 0.58 * uDiskReveal;
        color += flowHighlight
          * vec3(1.0, 0.76, 0.34)
          * 0.34
          * uDiskReveal;
        color += specks * vec3(1.0, 0.68, 0.3) * 0.55 * uDiskReveal;
        color += vec3(1.0, 0.88, 0.58)
          * max(photonRing, photonFromPass * 0.35)
          * 1.04
          * rimFlow
          * uRimReveal;
        color += vec3(1.0, 0.7, 0.36)
          * photonGlow
          * 0.42
          * uRimReveal;
        color += vec3(0.42, 0.2, 0.62)
          * lensHalo
          * 0.08
          * uLensReveal;
        color += vec3(0.72, 0.4, 0.2)
          * outerGather
          * 0.035
          * uGatherReveal;

        float apertureShadow = softBand(
          distanceToCenter,
          coreRadius * 0.93,
          max(pixel * 2.0, coreRadius * 0.065),
          max(edge * 5.0, coreRadius * 0.04)
        );
        color *= 1.0 - apertureShadow * 0.3;

        float lensMask = (
          1.0 - smoothstep(
            activeRadius * 1.02,
            activeRadius * 1.58,
            distanceToCenter
          )
        ) * uLensReveal;
        float lightMask = clamp(
          max(photonRing, photonFromPass * 0.35) * uRimReveal
            + photonGlow * 0.42 * uRimReveal
            + cloud * 0.82 * uDiskReveal
            + specks * 0.8 * uDiskReveal
            + lensHalo * 0.38 * uLensReveal
            + outerGather * 0.12 * uGatherReveal,
          0.0,
          1.0
        );
        float coreMask = coreWindow * uCoreReveal;
        float effectAlpha = clamp(
          max(lensMask * 0.6, coreMask * 0.995)
            + lightMask * 0.38
            + broadLens * 0.18 * uLensReveal,
          0.0,
          0.995
        );
        float dimAlpha = uDimReveal * 0.2;
        float outputAlpha = clamp(
          dimAlpha + effectAlpha * (1.0 - dimAlpha),
          0.0,
          0.995
        );
        vec3 outputColor = mix(
          vec3(0.0),
          clamp(color, 0.0, 1.32),
          effectAlpha / max(outputAlpha, 0.001)
        );
        gl_FragColor = vec4(outputColor, outputAlpha);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
  });
  material.toneMapped = false;
  return material;
}

export function createBlackHolePass(reducedMotion) {
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  sceneTarget.texture.colorSpace = THREE.SRGBColorSpace;
  sceneTarget.texture.generateMipmaps = false;
  const distortionTarget = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  distortionTarget.texture.generateMipmaps = false;

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const distortionScene = new THREE.Scene();
  const distortionMaterial = createDistortionMaterial();
  const distortionMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    distortionMaterial,
  );
  distortionScene.add(distortionMesh);

  const scene = new THREE.Scene();
  const material = createCompositeMaterial(
    sceneTarget.texture,
    distortionTarget.texture,
    reducedMotion,
  );
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(mesh);

  return {
    scene,
    camera,
    material,
    mesh,
    distortionScene,
    distortionMaterial,
    distortionMesh,
    sceneTarget,
    distortionTarget,
    reducedMotion: Boolean(reducedMotion),
    entry: calculateBlackHoleEntry(0, reducedMotion),
    active: false,
    clickTimes: [],
    progress: 0,
    flowTime: 0,
    targetRadius: BASE_TARGET_RADIUS,
    coreRadius: 0.24,
    startCoreRadius: 0.2,
    logoDiameterCss: 0,
    startCoreDiameterCss: 0,
    coreDiameterCss: 0,
    targetDiameterCss: 0,
    lensDiameterCss: 0,
    drawingBufferSize: new THREE.Vector2(1, 1),
  };
}

export function fitBlackHoleToLogo(pass, logo) {
  const logoBounds = logo.getBoundingClientRect();
  const layout = calculateBlackHoleLayout({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    logoWidth: logoBounds.width,
    logoHeight: logoBounds.height,
  });
  Object.assign(pass, layout);

  for (const shader of [pass.material, pass.distortionMaterial]) {
    shader.uniforms.uTargetRadius.value = layout.targetRadius;
    shader.uniforms.uCoreRadius.value = layout.coreRadius;
    shader.uniforms.uStartCoreRadius.value = layout.startCoreRadius;
  }
  return layout;
}

export function resizeBlackHolePass(pass, renderer) {
  renderer.getDrawingBufferSize(pass.drawingBufferSize);
  const width = Math.max(1, Math.round(pass.drawingBufferSize.x));
  const height = Math.max(1, Math.round(pass.drawingBufferSize.y));
  const center = new THREE.Vector2(width / 2, height / 2);

  for (const shader of [pass.material, pass.distortionMaterial]) {
    shader.uniforms.uResolution.value.set(width, height);
    shader.uniforms.uCenter.value.copy(center);
  }
  if (pass.active) {
    pass.sceneTarget.setSize(width, height);
    pass.distortionTarget.setSize(width, height);
  }
}

export function updateBlackHolePass(pass, elapsed, progress) {
  const entry = calculateBlackHoleEntry(progress, pass.reducedMotion);
  pass.progress = progress;
  pass.flowTime = elapsed;
  pass.entry = entry;
  pass.material.uniforms.uTime.value = elapsed;
  pass.material.uniforms.uProgress.value = progress;
  pass.material.uniforms.uCoreReveal.value = entry.core;
  pass.material.uniforms.uRadiusReveal.value = entry.radius;
  pass.material.uniforms.uLensReveal.value = entry.lens;
  pass.material.uniforms.uRimReveal.value = entry.rim;
  pass.material.uniforms.uDiskReveal.value = entry.disk;
  pass.material.uniforms.uDimReveal.value = entry.dim;
  pass.material.uniforms.uGatherReveal.value = entry.gather;
  pass.distortionMaterial.uniforms.uProgress.value = progress;
  pass.distortionMaterial.uniforms.uRadiusReveal.value = entry.radius;
}

export function renderBlackHolePass(pass, renderer, scene, camera) {
  renderer.setRenderTarget(pass.sceneTarget);
  renderer.clear();
  renderer.render(scene, camera);

  renderer.setRenderTarget(pass.distortionTarget);
  renderer.clear();
  renderer.render(pass.distortionScene, pass.camera);

  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(pass.scene, pass.camera);
  renderer.autoClear = true;
}

export function disposeBlackHolePass(pass) {
  pass.sceneTarget.dispose();
  pass.distortionTarget.dispose();
  pass.mesh.geometry.dispose();
  pass.material.dispose();
  pass.distortionMesh.geometry.dispose();
  pass.distortionMaterial.dispose();
}
