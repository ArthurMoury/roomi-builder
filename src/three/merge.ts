import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Depois que a obra termina, as dezenas de peças de um item viram poucas malhas: uma por material
// e uma por cor de contorno. A cena cai de ~1.900 para ~350 chamadas de desenho por quadro.
export function mergeItem(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true)
  const toLocal = root.matrixWorld.clone().invert()
  const buckets = new Map<THREE.Material, { lines: boolean; geos: THREE.BufferGeometry[] }>()

  root.traverse((o) => {
    const lines = (o as THREE.LineSegments).isLineSegments === true
    if (!(o as THREE.Mesh).isMesh && !lines) return
    const src = o as THREE.Mesh
    let g = src.geometry.clone()
    if (g.index) {
      const flat = g.toNonIndexed()
      g.dispose()
      g = flat
    }
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld))
    const material = src.material as THREE.Material
    if (!buckets.has(material)) buckets.set(material, { lines, geos: [] })
    buckets.get(material)!.geos.push(g)
  })

  const group = new THREE.Group()
  for (const [material, { lines, geos }] of buckets) {
    const merged = mergeGeometries(geos)
    geos.forEach((g) => g.dispose())
    if (!merged) continue
    const obj = lines ? new THREE.LineSegments(merged, material) : new THREE.Mesh(merged, material)
    if (lines) obj.raycast = () => {}
    group.add(obj)
  }
  return group
}

export function disposeMerged(group: THREE.Group) {
  group.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
}
