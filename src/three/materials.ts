import * as THREE from 'three'

export const C = { ink: '#1D1D1B', coral: '#F97B55', cream: '#F1E9E7' }

// Toon em 3 degraus: planos chapados que ainda leem volume (nada de degradê suave).
const ramp = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat)
ramp.minFilter = ramp.magFilter = THREE.NearestFilter
ramp.needsUpdate = true

const toon = (color: string) => new THREE.MeshToonMaterial({ color, gradientMap: ramp })

// Meio-tom em espaço de tela: os pontos não encolhem com a perspectiva (gramática Roomi).
// Com uCut, o fundo é descartado e sobram só os pontos (tela de alambrado, guarda-corpo).
const halftoneShader = {
  vertexShader: /* glsl */ `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uBg; uniform vec3 uDot; uniform float uCell; uniform float uR; uniform float uTime; uniform vec2 uDrift; uniform float uCut;
    void main(){
      vec2 p = gl_FragCoord.xy + uDrift * uTime;
      float row = floor(p.y / uCell);
      p.x += mod(row, 2.0) * uCell * 0.5;           // grade escalonada
      vec2 c = mod(p, uCell) - uCell * 0.5;
      float a = 1.0 - smoothstep(uR - 0.7, uR + 0.7, length(c));
      if (uCut > 0.5 && a < 0.5) discard;
      gl_FragColor = vec4(mix(uBg, uDot, a), 1.0);
      #include <colorspace_fragment>
    }`,
}

export const halftones: THREE.ShaderMaterial[] = []

function halftone(bg: string, dot: string, cell: number, r: number, drift: [number, number] = [0, 0], cut = false) {
  const m = new THREE.ShaderMaterial({
    ...halftoneShader,
    side: cut ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: {
      uBg: { value: new THREE.Color(bg) },
      uDot: { value: new THREE.Color(dot) },
      uCell: { value: cell },
      uR: { value: r },
      uTime: { value: 0 },
      uDrift: { value: new THREE.Vector2(...drift) },
      uCut: { value: cut ? 1 : 0 },
    },
  })
  m.userData = { cell, r }
  halftones.push(m)
  return m
}

// Os pontos são medidos em pixels do canvas: acompanhar a densidade mantém o tamanho na tela
export function setHalftoneDpr(dpr: number) {
  for (const m of halftones) {
    m.uniforms.uCell.value = m.userData.cell * dpr
    m.uniforms.uR.value = m.userData.r * dpr
  }
}

export const mat = {
  cream: toon(C.cream),
  coral: toon(C.coral),
  ink: toon(C.ink),
  water: halftone(C.coral, C.cream, 7, 1.3, [14, 6]),
  grass: halftone(C.cream, C.ink, 7, 1.5),
  sand: halftone(C.cream, C.coral, 6, 1.3),
  asphalt: halftone(C.ink, C.cream, 8, 0.9),
  slab: halftone(C.ink, C.cream, 9, 2.2),
  glass: halftone(C.ink, C.cream, 5, 0.85),
  fence: halftone(C.ink, C.ink, 4, 0.8, [0, 0], true),
}

export type MatKey = keyof typeof mat
