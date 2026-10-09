import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GRID } from '../store'
import { C, halftones } from './materials'

// Mar da praia, além da divisa da água. Areia em pontos miúdos, a espuma que lambe a areia e a linha
// da arrebentação indo e voltando, e o mar em retícula: os pontos coral crescem para o fundo (a
// retícula da marca), ondas correm para a areia e tudo some nas pontas e no horizonte. Os pontos são
// medidos na tela, como os outros meios-tons: o Rig acerta a densidade e anda o tempo.

const W = 58    // largura da faixa, pouco além das laterais do terreno
const D = 28    // da linha d'água até onde o mar some
const SAND = 3  // areia entre o terreno e a água
const f = (v: number) => v.toFixed(1)

const material = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uTime: { value: 0 },
    uCell: { value: 8 },
    uR: { value: 2.7 },
    uSea: { value: new THREE.Color(C.coral) },
    uLine: { value: new THREE.Color(C.ink) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vP;
    void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform float uCell; uniform float uR; uniform vec3 uSea; uniform vec3 uLine;
    varying vec2 vP;
    float dots(float r) {
      vec2 p = gl_FragCoord.xy + vec2(uTime * 2.0, uTime * 4.0);
      p.x += mod(floor(p.y / uCell), 2.0) * uCell * 0.5;
      vec2 c = mod(p, uCell) - uCell * 0.5;
      return 1.0 - smoothstep(r - 0.7, r + 0.7, length(c));
    }
    float line(float d) { return 1.0 - clamp(abs(d) / fwidth(d) - 0.5, 0.0, 1.0); }
    void main(){
      float y = vP.y - ${f(SAND)};
      float side = 1.0 - smoothstep(0.62, 1.0, abs(vP.x) / ${f(W / 2)});
      float swash = -1.0 + 0.8 * sin(uTime * 0.7) + 0.25 * sin(vP.x * 0.31 + uTime * 0.9);
      float surf = 1.7 + 0.35 * sin(uTime * 0.7 - 1.2) + 0.3 * sin(vP.x * 0.22 - uTime * 0.6);
      float foam = max(line(y - swash), 0.7 * line(y - surf)) * side;
      float a;
      vec3 col;
      if (y < swash) {
        a = dots(uR * 0.36) * side * 0.6;
        col = uLine;
      } else {
        float t = clamp(y / ${f(D)}, 0.0, 1.0);
        float wave = 0.5 + 0.5 * sin(y * 0.55 + uTime * 1.3 + sin(vP.x * 0.07) * 2.0);
        a = dots(uR * mix(0.42, 1.2, smoothstep(0.0, 0.55, t)) * mix(0.78, 1.12, wave)) * side * (1.0 - smoothstep(0.55, 1.0, t));
        col = uSea;
      }
      float alpha = max(a, foam);
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(mix(col, uLine, step(a, foam)), alpha);
      #include <colorspace_fragment>
    }`,
})
material.userData = { cell: 8, r: 2.7 }
halftones.push(material)

// a faixa começa na divisa do terreno (y local 0) e vai até o horizonte
const plane = new THREE.PlaneGeometry(W, SAND + D, 1, 1).translate(0, (SAND + D) / 2, 0)

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
  const ink = light ? C.ink : C.cream
  useEffect(() => { material.uniforms.uLine.value.set(ink) }, [ink])
  const label = useLabel(ink)
  return (
    <group rotation-y={TURN[side]}>
      <mesh geometry={plane} material={material} position={[0, -0.75, -GRID / 2]} rotation-x={-Math.PI / 2} />
      <mesh position={[0, -0.7, -GRID / 2 - SAND - 11]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[7, 1.75]} />
        <meshBasicMaterial map={label} transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </group>
  )
}
