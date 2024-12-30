import type { PlaneProps } from '@react-three/cannon'
import { Physics, usePlane, useSphere, useContactMaterial } from '@react-three/cannon'
import type { MeshPhongMaterialProps } from '@react-three/fiber'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import type { InstancedMesh, Mesh } from 'three'
import { Color } from 'three'
import * as dat from 'lil-gui'

import niceColors from './colors'

type OurPlaneProps = Pick<MeshPhongMaterialProps, 'color'> & Pick<PlaneProps, 'material' | 'position' | 'rotation'>

const bouncyMaterial = {
  name: 'bouncy',
  /*
  Restitution for this material.
  If non-negative, it will be used instead of the restitution given by ContactMaterials.
  If there's no matching ContactMaterial, the value from .defaultContactMaterial in the World will be used.
  */
  restitution: 1.1,
}

const boxMaterial = 'box'

const groundMaterial = 'ground'

/*
Setting the friction on both materials prevents overriding the friction given by ContactMaterials.
Since we want rubber to not be slippery we do not set this here and instead use a ContactMaterial.
See https://github.com/pmndrs/cannon-es/blob/e9f1bccd8caa250cc6e6cdaf85389058e1c9238e/src/world/World.ts#L661-L673
*/
const rubberMaterial = 'rubber'

const slipperyMaterial = {
  /*
  Friction for this material.
  If non-negative, it will be used instead of the friction given by ContactMaterials.
  If there's no matching ContactMaterial, the value from .defaultContactMaterial in the World will be used.
  */
  friction: 0,
  name: 'slippery',
}

const useContactMaterials = (rubberSlips: boolean) => {
  useContactMaterial(groundMaterial, groundMaterial, {
    contactEquationRelaxation: 3,
    contactEquationStiffness: 1e8,
    friction: 0.4,
    frictionEquationStiffness: 1e8,
    restitution: 0.3,
  })

  useContactMaterial(boxMaterial, groundMaterial, {
    contactEquationRelaxation: 3,
    contactEquationStiffness: 1e8,
    friction: 0.4,
    frictionEquationStiffness: 1e8,
    restitution: 0.3,
  })
  useContactMaterial(boxMaterial, slipperyMaterial, {
    friction: 0,
    restitution: 0.3,
  })

  useContactMaterial(groundMaterial, slipperyMaterial, {
    friction: 0,
    restitution: 0.3,
  })
  useContactMaterial(slipperyMaterial, slipperyMaterial, {
    friction: 0.1,
    restitution: 0.3,
  })

  useContactMaterial(bouncyMaterial, slipperyMaterial, {
    friction: 0,
    restitution: 0.5,
  })
  useContactMaterial(bouncyMaterial, groundMaterial, {
    restitution: 0.8,
  })
  useContactMaterial(bouncyMaterial, bouncyMaterial, {
    restitution: 0.8, // This does nothing because bouncyMaterial already has a restitution
  })

  useContactMaterial(
    rubberMaterial,
    slipperyMaterial,
    {
      friction: rubberSlips ? 0 : 1,
      restitution: 0.3,
    },
    [rubberSlips],
  )

  useContactMaterial(rubberMaterial, bouncyMaterial, {
    restitution: 0.5,
  })
}

function Plane({ color, ...props }: OurPlaneProps) {
  const [ref] = usePlane(() => ({ ...props, }), useRef<Mesh>(null))
  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshPhongMaterial color={color} />
    </mesh>
  )
}

interface ShakeSettings {
  shakeStrength: number
  motionThreshold: number
}

// Define a type guard for checking if DeviceMotionEvent has requestPermission
function hasRequestPermission(deviceMotionEvent: typeof DeviceMotionEvent): deviceMotionEvent is typeof DeviceMotionEvent & {
  requestPermission: () => Promise<PermissionState>
} {
  return 'requestPermission' in deviceMotionEvent
}

function InstancedSpheres({ number = 100, shakeSettings, shake }: { number?: number; shakeSettings: ShakeSettings; shake: boolean }) {
  const [ref, api] = useSphere(
    (index) => ({
      args: [1],
      mass: 1,
      material: "bouncy",
      position: [Math.random() - 0.5, Math.random() - 5, index * 2],
    }),
    useRef<InstancedMesh>(null),
  )
  const colors = useMemo(() => {
    const array = new Float32Array(number * 3)
    const color = new Color()
    for (let i = 0; i < number; i++)
      color
        .set(niceColors[Math.floor(Math.random() * 5)])
        .convertSRGBToLinear()
        .toArray(array, i * 3)
    return array
  }, [number])

  useFrame(() => {
    if (shake) {
      for (let i = 0; i < number; i++) {
        api.at(i).applyImpulse(
          [
            (Math.random() - 0.5) * shakeSettings.shakeStrength,
            (Math.random() - 0.5) * shakeSettings.shakeStrength,
            (Math.random() - 0.5) * shakeSettings.shakeStrength
          ],
          [0, 0, 0]
        )
      }
    }
  })

  return (
    <instancedMesh ref={ref} castShadow receiveShadow args={[undefined, undefined, number]}>
      <sphereGeometry args={[1, 16, 16]}>
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </sphereGeometry>
      <meshPhongMaterial vertexColors />
    </instancedMesh>
  )
}

function Scene({ shakeSettings, shake }: { shakeSettings: ShakeSettings; shake: boolean }) {
  useContactMaterials(false)

  return (
    <group>
      <Plane color={niceColors[4]} material="ground" position={[0, 0, 0]} rotation={[0, 0, 0]} />
      <Plane color={niceColors[1]} material="ground" position={[-10, 0, 0]} rotation={[0, 0.9, 0]} />
      <Plane color={niceColors[2]} material="ground" position={[10, 0, 0]} rotation={[0, -0.9, 0]} />
      <Plane color={niceColors[3]} material="ground" position={[0, 10, 0]} rotation={[0.9, 0, 0]} />
      <Plane color={niceColors[0]} material="ground" position={[0, -10, 0]} rotation={[-0.9, 0, 0]} />
      <InstancedSpheres number={100} shakeSettings={shakeSettings} shake={shake} />
    </group>
  )
}

function App() {
  const [motionPermission, setMotionPermission] = useState(false)

  const requestMotionPermission = async () => {
    if (hasRequestPermission(DeviceMotionEvent)) {
      try {
        const permissionState = await DeviceMotionEvent.requestPermission()
        if (permissionState === 'granted') {
          setMotionPermission(true)
          window.addEventListener('devicemotion', handleMotion)
        }
      } catch (error) {
        console.error('Error requesting motion permission:', error)
      }
    } else {
      // handle regular non iOS 13+ devices
      setMotionPermission(true)
      if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
        window.addEventListener('devicemotion', handleMotion)
      }
    }
  }

  const [shakeSettings] = useState<ShakeSettings>({
    shakeStrength: 10,
    motionThreshold: 15,
  })
  const [shake, setShake] = useState(false)

  const handleMotion = useCallback(
    (event: DeviceMotionEvent) => {
      if (event.acceleration) {
        const { x, y, z } = event.acceleration
        const acceleration = Math.sqrt((x ?? 0) ** 2 + (y ?? 0) ** 2 + (z ?? 0) ** 2)
        if (acceleration > shakeSettings.motionThreshold) {
          setShake(true)
          setTimeout(() => setShake(false), 100) // Reset shake after a short delay
        }
      }
    },
    [shakeSettings.motionThreshold]
  )

  useEffect(() => {
    const gui = new dat.GUI()
    const shakeFolder = gui.addFolder('Shake Settings')

    shakeFolder.add(shakeSettings, 'shakeStrength', 1, 20).name('Shake Strength')
    shakeFolder.add(shakeSettings, 'motionThreshold', 5, 30).name('Motion Threshold')

    const shakeButton = { shake: () => {
      setShake(true)
      setTimeout(() => setShake(false), 100) // Reset shake after a short delay
    }}
    shakeFolder.add(shakeButton, 'shake').name('Shake!')

    shakeFolder.open()

    return () => {
      gui.destroy()
      if (motionPermission) {
        window.removeEventListener('devicemotion', handleMotion)
      }
    }
  }, [handleMotion, shakeSettings, motionPermission])

  return (
    <div className="relative w-full h-full">
      {!motionPermission && (
        <div className="absolute bottom-4 left-4 z-10">
          <button
            onClick={requestMotionPermission}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Enable Motion Detection
          </button>
        </div>
      )}
      <Canvas camera={{ position: [0, 0, 40] }} shadows>
        <hemisphereLight intensity={0.35 * Math.PI} />
        <spotLight
          angle={0.3}
          castShadow
          decay={0}
          intensity={2 * Math.PI}
          penumbra={1}
          position={[30, 0, 30]}
          shadow-mapSize-width={256}
          shadow-mapSize-height={256}
        />
        <pointLight decay={0} intensity={0.5 * Math.PI} position={[-30, 0, -30]} />
        <Physics gravity={[0, 0, -10]}>
          <Scene shakeSettings={shakeSettings} shake={shake} />
        </Physics>
      </Canvas>
    </div>
  )
}

export default App