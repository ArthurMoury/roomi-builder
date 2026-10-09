import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GRID } from '../store'
import { C, halftones, mat } from './materials'
import { Edges } from './parts'
import { boardBounds, view } from './view'

// Mar da praia, como um bloco de maquete encostado na divisa de água: a mesma laje em meio-tom do
// terreno, um degrau abaixo dele, com o tampo de água coral chapada. Junto ao terreno fica a faixa
// de areia em pontos miúdos; na linha d'água, a espuma creme vai e volta com um contorno fino; no
// mar, traços de onda creme correm para a praia. Planos chapados, contorno e só as três cores.

export const SEA_D = 12   // do terreno à borda do bloco (60 m)
const SAND = 2.2          // faixa de areia junto ao terreno
const WATER = -0.32       // o tampo fica um degrau abaixo do terreno
const BASE = -1.22        // fundo da laje, como o do terreno
const f = (v: number) => v.toFixed(2)

const top = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uCell: { value: 6 },   // grade dos pontos da areia (px)
    uR: { value: 1.1 },
    uSea: { value: new THREE.Color(C.coral) },
    uFoam: { value: new THREE.Color(C.cream) },
    uInk: { value: new THREE.Color(C.ink) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vP;
    void main(){
      vP = vec2(position.x, ${f(SEA_D / 2)} - position.z); // ao longo da praia; do terreno para o mar
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform float uCell; uniform float uR; uniform vec3 uSea; uniform vec3 uFoam; uniform vec3 uInk;
    varying vec2 vP;
    float dots(float r) {
      vec2 p = gl_FragCoord.xy;
      p.x += mod(floor(p.y / uCell), 2.0) * uCell * 0.5;
      vec2 c = mod(p, uCell) - uCell * 0.5;
      return 1.0 - smoothstep(r - 0.7, r + 0.7, length(c));
    }
    // traço de largura w (px) centrado onde d = 0
    float stroke(float d, float w) { return 1.0 - smoothstep(w, w + 1.0, abs(d) / max(fwidth(d), 1e-4)); }
    void main(){
      float x = vP.x, s = vP.y;
      // linha d'água: a lambida avança e recua sobre a areia
      float shore = ${f(SAND)} + 0.45 * sin(uTime * 0.8) + 0.18 * sin(x * 0.45 + uTime * 1.1);
      vec3 col;
      if (s < shore) {
        col = mix(uFoam, uSea, dots(uR) * 0.85); // areia: creme com pontos coral miúdos
      } else {
        float q = s - shore;
        // espuma creme logo depois da linha d'água, com a borda ondulada e contorno fino
        float edge = 0.34 + 0.12 * sin(x * 1.3 - uTime * 2.0);
        float fw = fwidth(q);
        col = mix(uSea, uFoam, 1.0 - smoothstep(edge - fw, edge + fw, q));
        col = mix(col, uInk, stroke(q - edge, 0.35) * 0.9);
        // traços de onda: fileiras de traços curtos e ondulados que andam para a praia
        float gap = 1.7;
        float k = (s + uTime * 0.55) / gap;
        float row = floor(k);
        float d = (fract(k) - 0.5) * gap + 0.22 * sin(x * 1.1 + row * 2.3);
        float u = fract((x + row * 1.37) / 3.1);
        float dash = smoothstep(0.42, 0.42 + fwidth(u) * 1.5, u);
        col = mix(col, uFoam, stroke(d, 0.6) * dash * smoothstep(0.7, 1.6, q));
      }
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
})
top.userData = { cell: 6, r: 1.1 }
halftones.push(top) // o Rig acerta a densidade dos pontos e anda o tempo

const block = new THREE.BoxGeometry(GRID, WATER - BASE, SEA_D)
// faces: +x, −x, +y (tampo de água), −y, +z, −z
const faces = [mat.slab, mat.slab, top, mat.slab, mat.slab, mat.slab]

// "MAR" em Futura, espaçado, deitado na água
function useLabel(color: string) {
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(Object.assign(document.createElement('canvas'), { width: 512, height: 128 }))
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  useEffect(() => {
    let live = true
    const draw = () => {
      if (!live) return
      const c = tex.image as HTMLCanvasElement
      const g = c.getContext('2d')!
      g.clearRect(0, 0, c.width, c.height)
      g.fillStyle = color
      g.font = '500 60px "Futura New", sans-serif'
      g.textBaseline = 'middle'
      const letters = [...'MAR'], gap = 34
      const width = letters.reduce((s, l) => s + g.measureText(l).width, 0) + gap * (letters.length - 1)
      let x = (c.width - width) / 2
      for (const l of letters) { g.fillText(l, x, c.height / 2); x += g.measureText(l).width + gap }
      tex.needsUpdate = true
    }
    document.fonts.load('500 60px "Futura New"').then(draw, draw)
    return () => { live = false }
  }, [tex, color])
  return tex
}

const TURN = { n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2 }

export function Sea({ side, light }: { side: keyof typeof TURN; light: boolean }) {
  const label = useLabel(C.ink) // grafite sobre coral: o texto aprovado nessa cor (~7:1)
  // o enquadramento passa a incluir o bloco de mar
  useEffect(() => {
    const b = boardBounds(), far = GRID / 2 + SEA_D
    if (side === 'n') b.z0 = -far
    if (side === 's') b.z1 = far
    if (side === 'w') b.x0 = -far
    if (side === 'e') b.x1 = far
    view.bounds = b
    return () => { view.bounds = boardBounds() }
  }, [side])
  return (
    <group rotation-y={TURN[side]}>
      <mesh geometry={block} material={faces} position={[0, (WATER + BASE) / 2, -GRID / 2 - SEA_D / 2]}>
        <Edges color={light ? C.ink : C.cream} />
      </mesh>
      <mesh position={[0, WATER + 0.01, -GRID / 2 - SEA_D * 0.66]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[8, 2]} />
        <meshBasicMaterial map={label} transparent depthWrite={false} />
      </mesh>
    </group>
  )
}
