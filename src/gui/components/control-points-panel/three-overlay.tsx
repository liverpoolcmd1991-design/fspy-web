import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import AABB from '../../solver/aabb'
import AABBOps from '../../solver/aabb-ops'
import {
  buildReconstructedSceneGroup,
  computeSceneBaseScale,
  evaluateParallaxCameraPose,
  ParallaxAnimatorConfig,
  SceneBlockoutConfig
} from '../../solver/scene-reconstruction'
import { CameraParameters } from '../../solver/solver-result'
import Vector3D from '../../solver/vector-3d'
import {
  SunShadowConfig,
  ThreeProxyPreset,
  ThreeProxyTransform
} from '../../store/use-fspy-store'

interface ThreeOverlayProps {
  imageAABB: AABB
  cameraParameters: CameraParameters
  visible: boolean
  preset: ThreeProxyPreset
  proxyTransform: ThreeProxyTransform
  customModelUrl: string | null
  customModelFormat: 'glb' | 'obj' | null
  sunShadowConfig: SunShadowConfig
  sceneBlockout: SceneBlockoutConfig
  parallaxAnimator: ParallaxAnimatorConfig
  imageUrl: string | null
}

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return true
  const gl = document.createElement('canvas').getContext('webgl2')
  if (!gl) return true
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER
  const gpu = String(gl.getParameter(param))
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu)
})()

function enableMeshShadows(root: THREE.Object3D) {
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      node.castShadow = true
      node.receiveShadow = true
    }
  })
}

function buildPresetGroup(
  preset: ThreeProxyPreset,
  wireframe: boolean
): THREE.Group {
  const group = new THREE.Group()

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.4,
    roughness: 0.55,
    wireframe
  })
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.2,
    roughness: 0.3,
    wireframe
  })
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.65,
    roughness: 0.25,
    wireframe
  })
  const xMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    metalness: 0.35,
    roughness: 0.35,
    wireframe
  })
  const yMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    metalness: 0.35,
    roughness: 0.35,
    wireframe
  })
  const zMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    metalness: 0.35,
    roughness: 0.35,
    wireframe
  })

  if (preset === 'human-1.8m') {
    const discGeo = new THREE.CylinderGeometry(0.45, 0.48, 0.04, 28)
    discGeo.rotateX(Math.PI / 2)
    discGeo.translate(0, 0, 0.02)
    group.add(new THREE.Mesh(discGeo, baseMat))

    const legGeo = new THREE.CylinderGeometry(0.085, 0.065, 0.86, 16)
    legGeo.rotateX(Math.PI / 2)
    const leftLeg = new THREE.Mesh(legGeo.clone().translate(-0.12, 0, 0.47), bodyMat)
    const rightLeg = new THREE.Mesh(legGeo.clone().translate(0.12, 0, 0.47), bodyMat)
    group.add(leftLeg, rightLeg)

    const torsoGeo = new THREE.BoxGeometry(0.44, 0.24, 0.6)
    torsoGeo.translate(0, 0, 1.2)
    group.add(new THREE.Mesh(torsoGeo, accentMat))

    const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.58, 14)
    armGeo.rotateX(Math.PI / 2)
    group.add(new THREE.Mesh(armGeo.clone().translate(-0.29, 0, 1.18), bodyMat))
    group.add(new THREE.Mesh(armGeo.clone().translate(0.29, 0, 1.18), bodyMat))

    const headGeo = new THREE.SphereGeometry(0.12, 20, 20)
    headGeo.translate(0, 0, 1.68)
    group.add(new THREE.Mesh(headGeo, bodyMat))
  } else if (preset === 'arch-portal') {
    const floorGeo = new THREE.BoxGeometry(2.4, 1.2, 0.08)
    floorGeo.translate(0, 0, 0.04)
    group.add(new THREE.Mesh(floorGeo, baseMat))

    const colGeo = new THREE.BoxGeometry(0.32, 0.32, 2.1)
    group.add(new THREE.Mesh(colGeo.clone().translate(-0.78, 0, 1.13), bodyMat))
    group.add(new THREE.Mesh(colGeo.clone().translate(0.78, 0, 1.13), bodyMat))

    const lintelGeo = new THREE.BoxGeometry(2.05, 0.42, 0.34)
    lintelGeo.translate(0, 0, 2.35)
    group.add(new THREE.Mesh(lintelGeo, accentMat))
  } else if (preset === 'vehicle-sedan') {
    const lowerBody = new THREE.BoxGeometry(2.6, 1.15, 0.48)
    lowerBody.translate(0, 0, 0.44)
    group.add(new THREE.Mesh(lowerBody, bodyMat))

    const cabin = new THREE.BoxGeometry(1.35, 1.0, 0.44)
    cabin.translate(-0.1, 0, 0.9)
    group.add(new THREE.Mesh(cabin, accentMat))

    const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 20)
    const wheelOffsets: [number, number][] = [
      [-0.82, -0.56],
      [-0.82, 0.56],
      [0.82, -0.56],
      [0.82, 0.56]
    ]
    wheelOffsets.forEach(([wx, wy]) => {
      const wMesh = new THREE.Mesh(wheelGeo.clone(), baseMat)
      wMesh.position.set(wx, wy, 0.24)
      group.add(wMesh)
    })
  } else if (preset === 'checker-floor') {
    const tileSize = 0.5
    const half = 3
    for (let ix = -half; ix < half; ix++) {
      for (let iy = -half; iy < half; iy++) {
        const tileGeo = new THREE.BoxGeometry(tileSize * 0.96, tileSize * 0.96, 0.03)
        tileGeo.translate(
          (ix + 0.5) * tileSize,
          (iy + 0.5) * tileSize,
          0.015
        )
        const isEven = (ix + iy) % 2 === 0
        group.add(new THREE.Mesh(tileGeo, isEven ? bodyMat : baseMat))
      }
    }
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 16)
    poleGeo.rotateX(Math.PI / 2)
    poleGeo.translate(0, 0, 0.6)
    group.add(new THREE.Mesh(poleGeo, accentMat))
  } else {
    const plinthGeo = new THREE.BoxGeometry(2.0, 2.0, 0.12)
    plinthGeo.translate(0, 0, 0.06)
    group.add(new THREE.Mesh(plinthGeo, baseMat))

    const tier1Geo = new THREE.BoxGeometry(1.2, 1.2, 0.85)
    tier1Geo.translate(0, 0, 0.12 + 0.425)
    group.add(new THREE.Mesh(tier1Geo, bodyMat))

    const tier2Geo = new THREE.BoxGeometry(0.75, 0.75, 0.65)
    tier2Geo.translate(0, 0, 0.97 + 0.325)
    group.add(new THREE.Mesh(tier2Geo, accentMat))

    const spireGeo = new THREE.CylinderGeometry(0.14, 0.22, 0.7, 24)
    spireGeo.rotateX(Math.PI / 2)
    spireGeo.translate(0, 0, 1.62 + 0.35)
    group.add(new THREE.Mesh(spireGeo, bodyMat))

    const sphereGeo = new THREE.SphereGeometry(0.22, 24, 24)
    sphereGeo.translate(0, 0, 2.52)
    group.add(new THREE.Mesh(sphereGeo, zMat))

    const pillarXGeo = new THREE.BoxGeometry(0.28, 0.28, 0.9)
    pillarXGeo.translate(0.78, 0, 0.12 + 0.45)
    group.add(new THREE.Mesh(pillarXGeo, xMat))

    const pillarYGeo = new THREE.BoxGeometry(0.28, 0.28, 0.9)
    pillarYGeo.translate(0, 0.78, 0.12 + 0.45)
    group.add(new THREE.Mesh(pillarYGeo, yMat))
  }

  enableMeshShadows(group)
  return group
}

export default function ThreeOverlay({
  imageAABB,
  cameraParameters,
  visible,
  preset,
  proxyTransform,
  customModelUrl,
  customModelFormat,
  sunShadowConfig,
  sceneBlockout,
  parallaxAnimator,
  imageUrl
}: ThreeOverlayProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const requestRenderRef = useRef<(() => void) | null>(null)
  const freeOrbitRef = useRef(false)
  const [photoTexture, setPhotoTexture] = useState<THREE.Texture | null>(null)

  const sceneObjectsRef = useRef<{
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    orbitCamera: THREE.PerspectiveCamera
    orbitControls: OrbitControls
    frustumHelper: THREE.CameraHelper
    orbitGridHelper: THREE.GridHelper
    rootRig: THREE.Group
    contentGroup: THREE.Group
    blockoutContainer: THREE.Group
    keyLight: THREE.DirectionalLight
    shadowCatcherMesh: THREE.Mesh
    shadowCatcherMat: THREE.ShadowMaterial
    sunIndicatorGroup: THREE.Group
    renderer: THREE.WebGLRenderer
  } | null>(null)

  const isOverlayActive =
    visible || sceneBlockout.enabled || parallaxAnimator.enabled
  const isFreeOrbit = sceneBlockout.enabled && sceneBlockout.freeOrbitMode
  freeOrbitRef.current = isFreeOrbit

  const aabbWidth = Math.max(1, Math.round(AABBOps.width(imageAABB)))
  const aabbHeight = Math.max(1, Math.round(AABBOps.height(imageAABB)))

  // Load reference photo as a Three.js Texture when imageUrl changes
  useEffect(() => {
    if (!imageUrl) {
      setPhotoTexture(null)
      return
    }
    let cancelled = false
    let loadedTex: THREE.Texture | null = null
    const loader = new THREE.TextureLoader()
    loader.load(
      imageUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose()
          return
        }
        tex.colorSpace = THREE.SRGBColorSpace
        const maxAniso =
          sceneObjectsRef.current?.renderer.capabilities.getMaxAnisotropy() ?? 4
        tex.anisotropy = maxAniso
        loadedTex = tex
        setPhotoTexture(tex)
      },
      undefined,
      () => {
        if (!cancelled) setPhotoTexture(null)
      }
    )
    return () => {
      cancelled = true
      if (loadedTex) loadedTex.dispose()
    }
  }, [imageUrl])

  // Initialize WebGL scene
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance'
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    )
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.id = 'fspy-three-webgl-canvas'

    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    const envTexture = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture
    scene.environment = envTexture
    pmremGenerator.dispose()

    // Calibrated Photo Camera
    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 80)
    camera.matrixAutoUpdate = false

    // Free 3D Orbit Inspection Camera (Z-up to match fSpy world coordinates)
    const orbitCamera = new THREE.PerspectiveCamera(50, 1, 0.05, 500)
    orbitCamera.up.set(0, 0, 1)
    orbitCamera.position.set(5, -6, 4.5)

    const orbitControls = new OrbitControls(orbitCamera, renderer.domElement)
    orbitControls.enableDamping = !isSoftwareGl
    orbitControls.dampingFactor = 0.08
    orbitControls.enabled = false

    const frustumHelper = new THREE.CameraHelper(camera)
    frustumHelper.visible = false
    scene.add(frustumHelper)

    const orbitGridHelper = new THREE.GridHelper(16, 16, 0x38bdf8, 0x1e293b)
    orbitGridHelper.rotation.x = Math.PI / 2
    orbitGridHelper.visible = false
    scene.add(orbitGridHelper)

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.85)
    scene.add(hemiLight)

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2)
    keyLight.position.set(4, -5, 8)
    const shadowMapRes = isSoftwareGl ? 1024 : 2048
    keyLight.shadow.mapSize.set(shadowMapRes, shadowMapRes)
    keyLight.shadow.camera.near = 0.2
    keyLight.shadow.camera.far = 35
    const d = 6
    keyLight.shadow.camera.left = -d
    keyLight.shadow.camera.right = d
    keyLight.shadow.camera.top = d
    keyLight.shadow.camera.bottom = -d
    keyLight.shadow.bias = -0.0005
    scene.add(keyLight)
    scene.add(keyLight.target)

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9)
    rimLight.position.set(-5, 4, 5)
    scene.add(rimLight)

    const rootRig = new THREE.Group()
    const contentGroup = new THREE.Group()
    rootRig.add(contentGroup)

    // Opt-In Shadow-Catcher Ground Plane at Z = 0
    const shadowPlaneGeo = new THREE.PlaneGeometry(14, 14)
    const shadowCatcherMat = new THREE.ShadowMaterial({
      opacity: 0.55,
      color: 0x05070a
    })
    const shadowCatcherMesh = new THREE.Mesh(shadowPlaneGeo, shadowCatcherMat)
    shadowCatcherMesh.position.set(0, 0, 0.002)
    shadowCatcherMesh.receiveShadow = true
    shadowCatcherMesh.visible = false
    rootRig.add(shadowCatcherMesh)

    // Visual 3D Sun Direction Indicator
    const sunIndicatorGroup = new THREE.Group()
    sunIndicatorGroup.visible = false
    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
    )
    sunIndicatorGroup.add(sunOrb)
    rootRig.add(sunIndicatorGroup)

    scene.add(rootRig)

    // Container for 3D Scene Blockout & Camera-Projected Room Shell
    const blockoutContainer = new THREE.Group()
    scene.add(blockoutContainer)

    let frameId = 0
    let renderBusy = false
    let renderDirty = false

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null
      gl.flush()
      if (!sync) {
        frameId = window.setTimeout(cb, 80)
        return
      }
      const poll = () => {
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS)
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5)
        } else {
          gl.deleteSync(sync)
          frameId = window.setTimeout(cb, 80)
        }
      }
      frameId = window.setTimeout(poll, 5)
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true
        return
      }
      renderBusy = true
      frameId = requestAnimationFrame(() => {
        renderDirty = false
        if (freeOrbitRef.current) {
          orbitControls.update()
          renderer.render(scene, orbitCamera)
        } else {
          renderer.render(scene, camera)
        }
        const done = () => {
          renderBusy = false
          if (renderDirty) requestRender()
        }
        if (isSoftwareGl) afterDraw(done)
        else done()
      })
    }

    orbitControls.addEventListener('change', requestRender)

    requestRenderRef.current = requestRender
    sceneObjectsRef.current = {
      scene,
      camera,
      orbitCamera,
      orbitControls,
      frustumHelper,
      orbitGridHelper,
      rootRig,
      contentGroup,
      blockoutContainer,
      keyLight,
      shadowCatcherMesh,
      shadowCatcherMat,
      sunIndicatorGroup,
      renderer
    }

    return () => {
      cancelAnimationFrame(frameId)
      clearTimeout(frameId)
      orbitControls.removeEventListener('change', requestRender)
      orbitControls.dispose()
      requestRenderRef.current = null
      sceneObjectsRef.current = null
      envTexture.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Rebuild or load 3D proxy geometry when preset, customModelUrl, or wireframe changes
  useEffect(() => {
    const objs = sceneObjectsRef.current
    if (!objs) return
    const { contentGroup } = objs

    while (contentGroup.children.length > 0) {
      const child = contentGroup.children[0]
      contentGroup.remove(child)
    }

    if (!visible) {
      requestRenderRef.current?.()
      return
    }

    let cancelled = false

    if (preset === 'custom-model' && customModelUrl) {
      const normalizeAndAttach = (loadedObj: THREE.Object3D) => {
        if (cancelled) return
        loadedObj.rotation.x = Math.PI / 2
        loadedObj.updateMatrixWorld(true)

        const box = new THREE.Box3().setFromObject(loadedObj)
        const size = new THREE.Vector3()
        const center = new THREE.Vector3()
        box.getSize(size)
        box.getCenter(center)

        const maxDim = Math.max(size.x, size.y, size.z, 0.001)
        const targetSize = 2.0
        const scaleFactor = targetSize / maxDim

        const wrapper = new THREE.Group()
        loadedObj.position.set(
          -center.x * scaleFactor,
          -center.y * scaleFactor,
          -box.min.z * scaleFactor
        )
        loadedObj.scale.multiplyScalar(scaleFactor)

        loadedObj.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) {
            const mesh = node as THREE.Mesh
            mesh.castShadow = true
            mesh.receiveShadow = true
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => {
                if ('wireframe' in m) {
                  ;(m as THREE.MeshStandardMaterial).wireframe = proxyTransform.wireframe
                }
              })
            } else if (mesh.material && 'wireframe' in mesh.material) {
              ;(mesh.material as THREE.MeshStandardMaterial).wireframe =
                proxyTransform.wireframe
            }
          }
        })

        wrapper.add(loadedObj)
        contentGroup.add(wrapper)
        requestRenderRef.current?.()
      }

      if (customModelFormat === 'obj') {
        const loader = new OBJLoader()
        loader.load(
          customModelUrl,
          (obj) => {
            const defaultMat = new THREE.MeshStandardMaterial({
              color: 0xe2e8f0,
              metalness: 0.25,
              roughness: 0.35,
              wireframe: proxyTransform.wireframe
            })
            obj.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                ;(child as THREE.Mesh).material = defaultMat
              }
            })
            normalizeAndAttach(obj)
          },
          undefined,
          () => {
            contentGroup.add(buildPresetGroup('calibration-rig', proxyTransform.wireframe))
            requestRenderRef.current?.()
          }
        )
      } else {
        const loader = new GLTFLoader()
        loader.load(
          customModelUrl,
          (gltf) => {
            normalizeAndAttach(gltf.scene)
          },
          undefined,
          () => {
            contentGroup.add(buildPresetGroup('calibration-rig', proxyTransform.wireframe))
            requestRenderRef.current?.()
          }
        )
      }
    } else {
      const built = buildPresetGroup(preset, proxyTransform.wireframe)
      contentGroup.add(built)
      requestRenderRef.current?.()
    }

    return () => {
      cancelled = true
    }
  }, [visible, preset, customModelUrl, customModelFormat, proxyTransform.wireframe])

  // Rebuild 3D Scene Blockout + Camera-Projected UVs whenever sceneBlockout, cameraParameters, or photoTexture changes
  useEffect(() => {
    const objs = sceneObjectsRef.current
    if (!objs) return
    const { blockoutContainer } = objs

    while (blockoutContainer.children.length > 0) {
      const child = blockoutContainer.children[0]
      blockoutContainer.remove(child)
    }

    if (sceneBlockout.enabled) {
      const builtScene = buildReconstructedSceneGroup(
        sceneBlockout,
        cameraParameters,
        photoTexture
      )
      blockoutContainer.add(builtScene)
    }

    requestRenderRef.current?.()
  }, [sceneBlockout, cameraParameters, photoTexture])

  // Position Orbit Camera nicely near the calibrated photo camera when entering Free 3D Orbit Mode
  useEffect(() => {
    const objs = sceneObjectsRef.current
    if (!objs) return
    const { orbitCamera, orbitControls, frustumHelper, orbitGridHelper, renderer } = objs

    if (isFreeOrbit) {
      const m = cameraParameters.cameraTransform.matrix
      const baseScale = computeSceneBaseScale(cameraParameters)
      // Start slightly offset from the solved camera so the user immediately sees 3D parallax
      orbitCamera.position.set(
        m[0][3] + baseScale * 1.6,
        m[1][3] - baseScale * 1.4,
        m[2][3] + baseScale * 1.2
      )
      orbitControls.target.set(0, 0, baseScale * 0.9)
      orbitControls.enabled = true
      orbitControls.update()

      frustumHelper.visible = true
      orbitGridHelper.scale.setScalar(baseScale)
      orbitGridHelper.visible = true
      renderer.setClearColor(0x0c0e13, 1)
    } else {
      orbitControls.enabled = false
      frustumHelper.visible = false
      orbitGridHelper.visible = false
      renderer.setClearColor(
        parallaxAnimator.enabled ? 0x0c0e13 : 0x000000,
        parallaxAnimator.enabled ? 1 : 0
      )
    }

    requestRenderRef.current?.()
  }, [isFreeOrbit, parallaxAnimator.enabled, cameraParameters])

  // Synchronize camera projection, proxy transform, and Sun & Shadow-Catcher settings
  useEffect(() => {
    const objs = sceneObjectsRef.current
    if (!objs || !isOverlayActive) return

    const {
      camera,
      orbitCamera,
      frustumHelper,
      rootRig,
      keyLight,
      shadowCatcherMesh,
      shadowCatcherMat,
      sunIndicatorGroup,
      renderer
    } = objs
    renderer.setSize(aabbWidth, aabbHeight)

    const m = cameraParameters.cameraTransform.matrix
    const camMat = new THREE.Matrix4()
    camMat.set(
      m[0][0], m[0][1], m[0][2], m[0][3],
      m[1][0], m[1][1], m[1][2], m[1][3],
      m[2][0], m[2][1], m[2][2], m[2][3],
      0, 0, 0, 1
    )
    camera.matrix.copy(camMat)
    camera.matrixWorld.copy(camMat)
    camera.matrixWorldInverse.copy(camMat).invert()

    const aspect = aabbWidth / aabbHeight
    orbitCamera.aspect = aspect
    orbitCamera.updateProjectionMatrix()

    const s = 1 / Math.tan(0.5 * cameraParameters.horizontalFieldOfView)
    const sx = aspect >= 1 ? s : s / aspect
    const sy = aspect >= 1 ? s * aspect : s
    const px = cameraParameters.principalPoint.x * (aspect >= 1 ? 1 : 1 / aspect)
    const py = cameraParameters.principalPoint.y * (aspect >= 1 ? aspect : 1)
    const n = 0.05
    const f = Math.max(12, computeSceneBaseScale(cameraParameters) * 18)

    camera.projectionMatrix.set(
      sx, 0, -px, 0,
      0, sy, -py, 0,
      0, 0, -(f + n) / (f - n), (-2 * f * n) / (f - n),
      0, 0, -1, 0
    )
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
    frustumHelper.update()

    const vt = cameraParameters.viewTransform.matrix
    const translation = new Vector3D(vt[0][3], vt[1][3], vt[2][3])
    const normFactor = translation.length * Math.atan(0.5 * cameraParameters.horizontalFieldOfView)
    const baseScale = Math.max(0.01, 0.28 * normFactor)
    const finalScale = baseScale * proxyTransform.scale

    rootRig.visible = visible
    rootRig.scale.set(finalScale, finalScale, finalScale)
    rootRig.position.set(
      proxyTransform.offsetX * baseScale,
      proxyTransform.offsetY * baseScale,
      proxyTransform.offsetZ * baseScale
    )
    rootRig.rotation.set(0, 0, (proxyTransform.rotationZ * Math.PI) / 180)

    // Update Opt-In Sun & Shadow-Catcher Rig
    if (sunShadowConfig.enabled) {
      renderer.shadowMap.enabled = true
      keyLight.castShadow = true
      shadowCatcherMesh.visible = true
      shadowCatcherMat.opacity = sunShadowConfig.shadowOpacity
      shadowCatcherMat.needsUpdate = true

      const azRad = (sunShadowConfig.azimuthDeg * Math.PI) / 180
      const elRad = (Math.max(4, sunShadowConfig.elevationDeg) * Math.PI) / 180
      const sunDist = 10 * Math.max(0.5, finalScale)
      const sxPos = rootRig.position.x + sunDist * Math.cos(elRad) * Math.cos(azRad)
      const syPos = rootRig.position.y + sunDist * Math.cos(elRad) * Math.sin(azRad)
      const szPos = rootRig.position.z + sunDist * Math.sin(elRad)

      keyLight.position.set(sxPos, syPos, szPos)
      keyLight.target.position.copy(rootRig.position)
      keyLight.target.updateMatrixWorld()

      const shadowBound = 4.2 * Math.max(0.4, finalScale)
      keyLight.shadow.camera.left = -shadowBound
      keyLight.shadow.camera.right = shadowBound
      keyLight.shadow.camera.top = shadowBound
      keyLight.shadow.camera.bottom = -shadowBound
      keyLight.shadow.camera.far = sunDist * 2.5
      keyLight.shadow.camera.updateProjectionMatrix()

      sunIndicatorGroup.visible = true
      sunIndicatorGroup.position.set(
        2.3 * Math.cos(elRad) * Math.cos(azRad),
        2.3 * Math.cos(elRad) * Math.sin(azRad),
        2.3 * Math.sin(elRad)
      )
    } else {
      renderer.shadowMap.enabled = false
      keyLight.castShadow = false
      shadowCatcherMesh.visible = false
      sunIndicatorGroup.visible = false
      keyLight.position.set(4, -5, 8)
    }

    requestRenderRef.current?.()
  }, [
    aabbWidth,
    aabbHeight,
    cameraParameters,
    isOverlayActive,
    visible,
    proxyTransform,
    sunShadowConfig
  ])

  // Drive Cinematic 2.5D Parallax Camera Animator (either playing loop or manual timeline scrub)
  useEffect(() => {
    const objs = sceneObjectsRef.current
    if (!objs || !isOverlayActive || isFreeOrbit) return
    const { camera } = objs

    const applyCameraAtPhase = (phase01: number) => {
      if (!parallaxAnimator.enabled) {
        const m = cameraParameters.cameraTransform.matrix
        const camMat = new THREE.Matrix4().set(
          m[0][0], m[0][1], m[0][2], m[0][3],
          m[1][0], m[1][1], m[1][2], m[1][3],
          m[2][0], m[2][1], m[2][2], m[2][3],
          0, 0, 0, 1
        )
        camera.matrix.copy(camMat)
        camera.matrixWorld.copy(camMat)
        camera.matrixWorldInverse.copy(camMat).invert()
        requestRenderRef.current?.()
        return
      }

      const pose = evaluateParallaxCameraPose(
        parallaxAnimator,
        phase01,
        cameraParameters
      )
      const animMat = new THREE.Matrix4().compose(
        pose.position,
        pose.quaternion,
        new THREE.Vector3(1, 1, 1)
      )
      camera.matrix.copy(animMat)
      camera.matrixWorld.copy(animMat)
      camera.matrixWorldInverse.copy(animMat).invert()
      requestRenderRef.current?.()
    }

    if (!parallaxAnimator.enabled) {
      applyCameraAtPhase(0)
      return
    }

    if (!parallaxAnimator.isPlaying) {
      applyCameraAtPhase(parallaxAnimator.manualPhase)
      return
    }

    let rafId = 0
    const durationMs = Math.max(800, parallaxAnimator.durationSec * 1000)
    const startOffsetMs = parallaxAnimator.manualPhase * durationMs
    const startTime = performance.now() - startOffsetMs

    const tick = (now: number) => {
      const elapsed = now - startTime
      const phase01 = ((elapsed % durationMs) + durationMs) / durationMs
      applyCameraAtPhase(phase01 % 1)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [
    parallaxAnimator,
    cameraParameters,
    isOverlayActive,
    isFreeOrbit
  ])

  if (!isOverlayActive) {
    return null
  }

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        left: imageAABB.xMin,
        top: imageAABB.yMin,
        width: aabbWidth,
        height: aabbHeight
      }}
      className={
        isFreeOrbit
          ? 'pointer-events-auto z-25 cursor-grab active:cursor-grabbing ring-2 ring-sky-500/70 rounded-xs'
          : 'pointer-events-none z-10'
      }
    />
  )
}
