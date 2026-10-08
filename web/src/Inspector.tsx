import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Button, Select, Seg, useOnClose } from './controls'
import { catalogOf } from './config'
import { cardTitle, parseName, Slab } from './ui'

// The inspector: a rendered 3D slab, and a 2D precision view. Both use representative art, never a photograph of the exact slab, and say so.
// Three.js loads only when this opens, renders only when something changes, and releases the GPU on close.

type Props = { name: string; sibs: { name: string; sku: string }[]; onClose: () => void }
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off'
const webgl = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}
const LIGHTS = ['neutral', 'raking', 'dark'] as const
type Light = (typeof LIGHTS)[number]

export default function Inspector({ name, sibs, onClose }: Props) {
  const dlg = useRef<HTMLDialogElement>(null)
  const reduced = still()
  const can3d = webgl() && !reduced
  const [view, setView] = useState<'3d' | '2d'>(can3d ? '3d' : '2d')
  const [help, setHelp] = useState(false)
  useEffect(() => {
    dlg.current?.showModal()
  }, [])
  useOnClose(dlg, onClose)
  const info = catalogOf(name)
  return (
    <dialog ref={dlg} className="inspector" aria-labelledby="insp-title" onCancel={() => setHelp(false)}>
      <div className="insp-head">
        <h2 id="insp-title">Inspect {cardTitle(name)}, {parseName(name).grader} {parseName(name).grade}</h2>
        <span className="insp-tools">
          <Seg label="View" value={view} onChange={setView} options={[{ value: '3d', label: '3D view', text: can3d ? '3D view' : '3D view, unavailable' }, { value: '2d', label: '2D precision' }]} />
          <Button variant="tertiary" size={32} onClick={() => setHelp(!help)}>Shortcuts</Button>
          <Button variant="secondary" size={32} autoFocus onClick={() => (dlg.current?.close(), onClose())}>Close</Button>
        </span>
      </div>
      {!can3d && <p className="fine">{reduced ? 'The rendered view is off because reduced motion is on. The 2D view shows the same card.' : 'The rendered view needs WebGL, which this browser does not offer. The 2D view shows the same card.'}</p>}
      {help && (
        <dl className="kbd-list" aria-label="Inspector shortcuts">
          {[['Arrows', 'Rotate the slab, or pan when zoomed'], ['F', 'Flip between front and back'], ['R', 'Reset the view'], ['L', 'Change the lighting'], ['+ and −', 'Zoom in and out (2D)'], ['Esc', 'Close the inspector']].map(([k, d]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>)}
        </dl>
      )}
      {view === '3d' && can3d ? <Render3D name={name} imageUrl={info?.imageUrl} /> : <Precision name={name} sibs={sibs} />}
      <p className="fine insp-note">{view === '3d' && can3d ? 'Rendered view, not a photograph.' : 'Representative image of this card, not a photograph of this slab.'}</p>
    </dialog>
  )
}

// ===================================================================== 3D
/** The slab label drawn on a canvas: white label, red rule, the card and its grade, legible at any angle. */
function labelTexture(name: string, flipped = false, onReady: () => void = () => {}) {
  const { grader, grade } = parseName(name)
  const c = catalogOf(name)
  const [setName, year] = c?.set.split(' · ') ?? []
  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 320
  const g = cv.getContext('2d')!
  const draw = () => {
  g.textAlign = 'left'
  g.fillStyle = '#fbfafd'
  g.fillRect(0, 0, 1024, 320)
  g.fillStyle = '#b3261e'
  g.fillRect(0, 0, 1024, 26)
  g.fillStyle = '#14111f'
  g.textBaseline = 'alphabetic'
  g.font = '600 44px Geist, system-ui, sans-serif'
  g.fillText(`${grader} · ${[year, setName].filter(Boolean).join(' ')}`.toUpperCase(), 40, 110)
  g.font = '500 62px Geist, system-ui, sans-serif'
  const title = cardTitle(name)
  g.fillText(title.length > 26 ? title.slice(0, 25) + '…' : title, 40, 200)
  g.font = '400 36px Geist, system-ui, sans-serif'
  g.fillText(`Grade ${grade}`, 40, 262)
  g.font = '600 150px Geist, system-ui, sans-serif'
  g.textAlign = 'right'
  g.fillText(grade, 984, 260)
  }
  draw()
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  if (flipped) (t.wrapS = THREE.RepeatWrapping), (t.repeat.x = -1)
  document.fonts.load('600 44px Geist').then(() => (draw(), (t.needsUpdate = true), onReady()), () => {})
  return t
}

function backTexture() {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 704
  const g = cv.getContext('2d')!
  g.fillStyle = '#25232f'
  g.fillRect(0, 0, 512, 704)
  g.fillStyle = '#b9b8c4'
  g.font = '500 26px Geist, system-ui, sans-serif'
  g.textAlign = 'center'
  g.fillText('No image of the back', 256, 340)
  g.fillText('is on file for this card', 256, 376)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const FOIL_V = 'varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }'
const FOIL_F = 'uniform sampler2D map; uniform vec3 uLight; varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ vec4 c = texture2D(map, vUv); vec3 V = normalize(cameraPosition - vP); float f = dot(normalize(vN), V); float L = dot(normalize(vN), normalize(uLight)); vec3 foil = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + f * 1.3 + vUv.y * 0.6 + L * 0.5)); float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114)); float k = 0.22 * (0.4 + 0.6 * (1.0 - lum)) * pow(1.0 - abs(f), 1.2); gl_FragColor = vec4(mix(c.rgb, foil, k), 1.0); }'

function Render3D({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<{ yaw: (d: number) => void; pitch: (d: number) => void; flip: () => void; reset: () => void; light: (l: Light) => void } | undefined>(undefined)
  const [light, setLight] = useState<Light>('neutral')
  const [tilt, setTilt] = useState<'off' | 'on' | 'denied'>('off')
  const lightRef = useRef(light)
  lightRef.current = light
  const holo = /holo/i.test(name)
  const canTilt = typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches

  useEffect(() => {
    const el = host.current!
    const canvas = document.createElement('canvas')
    canvas.className = 'insp-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    el.prepend(canvas)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.toneMapping = THREE.NoToneMapping
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50)
    camera.position.set(0, 0, 11)
    const pmrem = new THREE.PMREMGenerator(renderer)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env

    const W = 2.4, H = 4.0, D = 0.26
    const slab = new THREE.Group()
    scene.add(slab)
    const owned: { dispose: () => void }[] = [env, pmrem]
    const own = <T extends { dispose: () => void }>(x: T) => (owned.push(x), x)
    const caseMat = own(new THREE.MeshPhysicalMaterial({ transmission: 1, thickness: 0.5, roughness: 0.04, ior: 1.5, clearcoat: 0.6, clearcoatRoughness: 0.08, transparent: false }))
    slab.add(new THREE.Mesh(own(new RoundedBoxGeometry(W, H, D, 4, 0.1)), caseMat))
    const insert = new THREE.Mesh(own(new THREE.PlaneGeometry(W - 0.3, H - 0.3)), own(new THREE.MeshBasicMaterial({ color: 0x1c1a25 })))
    insert.position.z = 0
    slab.add(insert)
    const labelF = new THREE.Mesh(own(new THREE.PlaneGeometry(W - 0.4, (W - 0.4) * 0.3125)), own(new THREE.MeshBasicMaterial({ map: own(labelTexture(name, false, () => wake())) })))
    labelF.position.set(0, H / 2 - 0.6, D / 2 - 0.035)
    slab.add(labelF)
    const labelB = new THREE.Mesh(labelF.geometry, own(new THREE.MeshBasicMaterial({ map: own(labelTexture(name, true, () => wake())) })))
    labelB.position.set(0, H / 2 - 0.6, -(D / 2 - 0.035))
    labelB.rotation.y = Math.PI
    slab.add(labelB)
    const cw = 1.62, ch = 2.26
    const cardGeo = own(new THREE.PlaneGeometry(cw, ch))
    const front = new THREE.Mesh<THREE.PlaneGeometry, THREE.Material>(cardGeo, own(new THREE.MeshBasicMaterial({ color: 0x25232f })))
    front.position.set(0, -0.42, 0.02)
    slab.add(front)
    const back = new THREE.Mesh(cardGeo, own(new THREE.MeshBasicMaterial({ map: own(backTexture()) })))
    back.position.set(0, -0.42, -0.02)
    back.rotation.y = Math.PI
    slab.add(back)
    const lightDir = new THREE.Vector3(3, 4, 5)
    if (imageUrl) {
      new THREE.TextureLoader().load(imageUrl, (t) => {
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
        owned.push(t)
        front.material = holo ? own(new THREE.ShaderMaterial({ uniforms: { map: { value: t }, uLight: { value: lightDir } }, vertexShader: FOIL_V, fragmentShader: FOIL_F })) : own(new THREE.MeshBasicMaterial({ map: t }))
        wake()
      })
    }
    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xffffff, 0)
    scene.add(rim)

    // ---- state: eased towards a target, drawn only while it moves
    const s = { yaw: 0, pitch: 0, ty: 0, tp: 0, intro: 0, drag: false, lx: 0, ly: 0 }
    const reset = () => ((s.ty = 0), (s.tp = 0))
    let raf = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const calm = still()
    const apply = (l: Light) => {
      const p = { neutral: { env: 0.55, key: [3, 4, 5, 1], rim: 0 }, raking: { env: 0.25, key: [7, 0.8, 2, 3.4], rim: 0 }, dark: { env: 0.08, key: [0, 1, 3, 0.4], rim: 2.6 } }[l]
      scene.environmentIntensity = p.env
      key.position.set(p.key[0], p.key[1], p.key[2])
      key.intensity = p.key[3]
      rim.position.set(-5, 2, -4)
      rim.intensity = p.rim
      lightDir.set(p.key[0], p.key[1], p.key[2])
      el.dataset.light = l
    }
    apply(lightRef.current)
    const tick = () => {
      raf = 0
      const k = calm ? 1 : 0.18
      s.yaw += (s.ty - s.yaw) * k
      s.pitch += (s.tp - s.pitch) * k
      if (s.intro > 0) {
        s.ty = 0
        s.yaw = -Math.PI / 4 * (s.intro / 1)
        s.intro = Math.max(0, s.intro - 0.012)
      }
      slab.rotation.set(s.pitch, s.yaw, 0)
      renderer.render(scene, camera)
      if (Math.abs(s.ty - s.yaw) > 0.002 || Math.abs(s.tp - s.pitch) > 0.002 || s.intro > 0 || s.drag) wake()
    }
    function wake() {
      if (raf || timer) return
      // animation frames do not run in a hidden tab, so fall back to a timer there
      if (document.hidden) timer = setTimeout(() => ((timer = undefined), tick()), 16)
      else raf = requestAnimationFrame(tick)
    }
    const size = () => {
      const w = el.clientWidth
      const h = Math.max(320, Math.min(560, innerHeight * 0.6))
      renderer.setSize(w, h, false)
      canvas.style.width = '100%'
      canvas.style.height = h + 'px'
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      wake()
    }
    const ro = new ResizeObserver(size)
    ro.observe(el)
    size()
    if (!calm) s.intro = 1 // one slow quarter turn when it first opens
    api.current = {
      yaw: (d) => ((s.ty += d), wake()),
      pitch: (d) => ((s.tp = Math.max(-0.9, Math.min(0.9, s.tp + d))), wake()),
      flip: () => ((s.ty = Math.round(s.ty / Math.PI) * Math.PI + Math.PI), wake()),
      reset: () => (reset(), wake()),
      light: (l) => (apply(l), wake()),
    }
    // pointer drag rotates; wheel is left to the page
    const down = (e: PointerEvent) => ((s.drag = true), (s.lx = e.clientX), (s.ly = e.clientY), canvas.setPointerCapture(e.pointerId), (s.intro = 0), wake())
    const move = (e: PointerEvent) => {
      if (!s.drag) return
      s.ty += (e.clientX - s.lx) * 0.01
      s.tp = Math.max(-0.9, Math.min(0.9, s.tp + (e.clientY - s.ly) * 0.01))
      s.lx = e.clientX
      s.ly = e.clientY
      wake()
    }
    const up = () => ((s.drag = false), wake())
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    const orient = (e: DeviceOrientationEvent) => ((s.ty = ((e.gamma ?? 0) * Math.PI) / 180 * 0.8), (s.tp = Math.max(-0.9, Math.min(0.9, (((e.beta ?? 45) - 45) * Math.PI) / 180 * 0.8))), wake())
    ;(api.current as { tilt?: (on: boolean) => void }).tilt = (on) => (on ? addEventListener('deviceorientation', orient) : removeEventListener('deviceorientation', orient))
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      ro.disconnect()
      removeEventListener('deviceorientation', orient)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      owned.forEach((x) => x.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
      api.current = undefined
    }
  }, [name, imageUrl, holo])

  useEffect(() => api.current?.light(light), [light])
  const key = (e: React.KeyboardEvent) => {
    const a = api.current
    if (!a) return
    const k = e.key
    if (k === 'ArrowLeft') a.yaw(-0.26)
    else if (k === 'ArrowRight') a.yaw(0.26)
    else if (k === 'ArrowUp') a.pitch(-0.2)
    else if (k === 'ArrowDown') a.pitch(0.2)
    else if (k === 'f' || k === 'F') a.flip()
    else if (k === 'r' || k === 'R') a.reset()
    else if (k === 'l' || k === 'L') setLight(LIGHTS[(LIGHTS.indexOf(light) + 1) % LIGHTS.length])
    else return
    e.preventDefault()
  }
  const askTilt = async () => {
    const DO = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    try {
      if (DO.requestPermission && (await DO.requestPermission()) !== 'granted') return setTilt('denied')
      ;(api.current as unknown as { tilt: (on: boolean) => void }).tilt(true)
      setTilt('on')
    } catch {
      setTilt('denied')
    }
  }
  return (
    <div className="insp-3d" data-light={light}>
      <div ref={host} className="insp-stage" tabIndex={0} role="group" aria-label={`3D view of ${name}. Arrow keys rotate, F flips, R resets, L changes the lighting.`} onKeyDown={key} />
      <p className="insp-badge" role="note">Rendered view, not a photograph</p>
      <div className="insp-controls">
        <Button variant="secondary" size={32} onClick={() => api.current?.yaw(-0.5)}>Rotate left</Button>
        <Button variant="secondary" size={32} onClick={() => api.current?.yaw(0.5)}>Rotate right</Button>
        <Button variant="secondary" size={32} onClick={() => api.current?.pitch(-0.3)}>Tilt up</Button>
        <Button variant="secondary" size={32} onClick={() => api.current?.pitch(0.3)}>Tilt down</Button>
        <Button variant="secondary" size={32} onClick={() => api.current?.flip()}>Flip</Button>
        <Button variant="tertiary" size={32} onClick={() => api.current?.reset()}>Reset</Button>
        <Seg label="Lighting" value={light} onChange={setLight} options={[{ value: 'neutral', label: 'Neutral' }, { value: 'raking', label: 'Raking light' }, { value: 'dark', label: 'Dark field' }]} />
        {canTilt && <Button variant="tertiary" size={32} onClick={askTilt}>{tilt === 'on' ? 'Tilt control on' : 'Use device tilt'}</Button>}
      </div>
      {tilt === 'denied' && <p className="fine">Device tilt was not allowed, so it stays off.</p>}
      {holo && <p className="fine">The foil shimmer is simulated from the light angle. It is a rendering, not what the card looks like.</p>}
    </div>
  )
}

// ===================================================================== 2D
type Pane = { scale: number; x: number; y: number }
function Precision({ name, sibs }: { name: string; sibs: { name: string; sku: string }[] }) {
  const [t, setT] = useState<Pane>({ scale: 1, x: 0, y: 0 })
  const [loupe, setLoupe] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number; w: number }>()
  const [compare, setCompare] = useState(false)
  const [other, setOther] = useState(() => sibs.find((s) => s.name !== name)?.name ?? name)
  const [label, setLabel] = useState(false)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | undefined>(undefined)
  const max = 6
  const zoom = (f: number) => setT((p) => ({ ...p, scale: Math.max(1, Math.min(max, p.scale * f)), ...(p.scale * f <= 1 ? { x: 0, y: 0 } : {}) }))
  const key = (e: React.KeyboardEvent) => {
    const k = e.key
    const step = 30
    if (k === '+' || k === '=') zoom(1.4)
    else if (k === '-') zoom(1 / 1.4)
    else if (k === '0' || k === 'r' || k === 'R') setT({ scale: 1, x: 0, y: 0 })
    else if (k === 'ArrowLeft') setT((p) => ({ ...p, x: p.x + step }))
    else if (k === 'ArrowRight') setT((p) => ({ ...p, x: p.x - step }))
    else if (k === 'ArrowUp') setT((p) => ({ ...p, y: p.y + step }))
    else if (k === 'ArrowDown') setT((p) => ({ ...p, y: p.y - step }))
    else if (k === 'l' || k === 'L') setLoupe((v) => !v)
    else return
    e.preventDefault()
  }
  const stage = (n: string, i: number) => {
    const c = catalogOf(n)
    return (
      <div key={i} className="prec-pane">
        <div
          className={`prec-stage ${t.scale > 1 ? 'zoomed' : ''}`}
          tabIndex={0}
          role="group"
          aria-label={`${n}. Plus and minus zoom, arrow keys pan, L toggles the loupe.`}
          onKeyDown={key}
          onPointerDown={(e) => { if (t.scale > 1) (drag.current = { x: e.clientX, y: e.clientY, px: t.x, py: t.y }), e.currentTarget.setPointerCapture(e.pointerId) }}
          onPointerMove={(e) => {
            if (drag.current) setT((p) => ({ ...p, x: drag.current!.px + e.clientX - drag.current!.x, y: drag.current!.py + e.clientY - drag.current!.y }))
            const r = e.currentTarget.getBoundingClientRect()
            setPos({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width })
          }}
          onPointerUp={() => (drag.current = undefined)}
          onPointerLeave={() => setPos(undefined)}
          onWheel={(e) => { if (e.ctrlKey || e.metaKey) (e.preventDefault(), zoom(e.deltaY > 0 ? 1 / 1.2 : 1.2)) }}
        >
          <div className="prec-inner" style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})` }}>
            {label ? <div className="prec-label"><Slab name={n} size="xl" /></div> : c?.imageUrl ? <img src={c.imageUrl} alt={`${cardTitle(n)}, ${parseName(n).grader} ${parseName(n).grade}, representative image`} draggable={false} /> : <div className="nophoto"><b>{cardTitle(n)}</b><small>No image on file</small></div>}
          </div>
          {loupe && pos && c?.imageUrl && !label && <i className="loupe" style={{ left: pos.x - 70, top: pos.y - 70, backgroundImage: `url(${c.imageUrl})`, backgroundSize: `${pos.w * 3}px auto`, backgroundPosition: `${-pos.x * 3 + 70}px ${-pos.y * 3 + 70}px` }} aria-hidden />}
        </div>
        <p className="fine">{parseName(n).grader} {parseName(n).grade}</p>
      </div>
    )
  }
  return (
    <div className="prec">
      <div className="insp-controls">
        <Button variant="secondary" size={32} onClick={() => zoom(1.4)}>Zoom in</Button>
        <Button variant="secondary" size={32} onClick={() => zoom(1 / 1.4)}>Zoom out</Button>
        <Button variant="secondary" size={32} onClick={() => setT({ scale: 1, x: 0, y: 0 })}>Fit</Button>
        <Button variant="secondary" size={32} aria-pressed={loupe} onClick={() => setLoupe(!loupe)}>Loupe</Button>
        <Button variant="secondary" size={32} aria-pressed={label} onClick={() => setLabel(!label)}>Label close-up</Button>
        <Button variant="secondary" size={32} disabled title="No image of the back is on file" aria-describedby="back-why">Back</Button>
        {sibs.length > 1 && <Button variant="secondary" size={32} aria-pressed={compare} onClick={() => setCompare(!compare)}>Compare grades</Button>}
      </div>
      <p className="fine" id="back-why">The back is not shown because no image of it is on file. Corner, edge and centring views need real photographs of a slab, so they are not offered.</p>
      {compare && sibs.length > 1 && <label className="lab" style={{ maxWidth: 260 }}>Compare with<Select label="Compare with" value={other} onChange={setOther} options={sibs.map((s) => ({ value: s.name, label: `${parseName(s.name).grader} ${parseName(s.name).grade}` }))} /></label>}
      <div className={`prec-panes ${compare ? 'two' : ''}`}>
        {stage(name, 0)}
        {compare && stage(other, 1)}
      </div>
      {compare && <p className="fine">Zoom and pan are linked. Every grade uses the same representative image, so only the slab label differs.</p>}
      <p className="fine">Zoom is {Math.round(t.scale * 100)}%. Ctrl or Cmd with scroll also zooms. Drag to pan when zoomed.</p>
    </div>
  )
}
