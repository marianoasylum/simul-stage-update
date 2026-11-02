/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { AppState, SimPhase, TicketInfo, AudioMetrics } from './types';
import { VenueScene } from './scene/venueScene';
import { CameraRig, RigInput } from './scene/cameraRig';
import { soundEngine } from './audio/soundEngine';
import { TicketSelector } from './components/TicketSelector';
import { SensorPermissionModal } from './components/SensorPermissionModal';
import { HUDOverlay } from './components/HUDOverlay';
import { TouchJoystick } from './components/TouchJoystick';
import { ConcertEndModal } from './components/ConcertEndModal';

const DEFAULT_TICKET: TicketInfo = {
  section: 'Campo Delantero / VIP Escenario',
  sectionCode: 'VIP',
  row: 2,
  seat: 8,
  eventName: 'SYNTHWAVE LIVE 2026 • MOVISTAR ARENA TOUR',
  venueName: 'Movistar Arena Buenos Aires',
  gate: 'Acceso Puertas 1 y 2 (Calle Humboldt)',
  gateNumber: 1,
  ticketId: 'MVA-VIP-28-5421',
  date: 'Viernes, 24 Octubre 2026 • 21:00 HRS',
  price: '$180.000 ARS',
  capacity: '3.500 personas',
  sectorAforo: 3500,
  totalVenueAforo: 15000,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const venueSceneRef = useRef<VenueScene | null>(null);
  const cameraRigRef = useRef<CameraRig | null>(null);

  const [appState, setAppState] = useState<AppState>({
    isInitialized: false,
    phase: 'TICKET_SELECTION',
    ticket: DEFAULT_TICKET,
    sensors: {
      gyroscopeAllowed: false,
      gyroscopeActive: false,
      micAllowed: false,
      micActive: false,
      cameraAllowed: false,
      cameraActive: false,
    },
    orientationData: { alpha: 0, beta: 0, gamma: 0 },
    audioMetrics: { volume: 0, bassLevel: 0, trebleLevel: 0 },
    speed: 0,
    isInsideVenue: false,
    isSeated: false,
    flashlightOn: false,
    timeRemainingSeconds: 180, // 3-minute pre-event countdown
    sprintEnabled: false,
    cameraMode: 'FIRST_PERSON',
    flashlightWarningSeconds: null,
    blackoutRemainingSeconds: null,
    gpsWalkEnabled: false,
    gpsDistanceWalked: 0,
    gpsAccuracy: null,
  });

  const [isNearSeat, setIsNearSeat] = useState(false);

  // Keyboard input states for desktop
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  // Touch inputs
  const touchMoveInput = useRef({ forward: 0, right: 0 });
  const touchLookInput = useRef({ dx: 0, dy: 0 });

  // Refs for loop state access without tearing down effects
  const phaseRef = useRef<SimPhase>('TICKET_SELECTION');
  phaseRef.current = appState.phase;

  const flashlightRef = useRef(false);
  flashlightRef.current = appState.flashlightOn;

  const sprintRef = useRef(false);
  sprintRef.current = appState.sprintEnabled;

  // Real-World GPS Walking Refs
  const gpsWatchIdRef = useRef<number | null>(null);
  const lastGpsCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // --- 1. Three.js Initialization ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const scene = new VenueScene(canvas);
    const rig = new CameraRig(scene);

    venueSceneRef.current = scene;
    cameraRigRef.current = rig;

    // Rig callbacks
    rig.onNearSeatChanged = (near) => {
      setIsNearSeat(near);
    };

    rig.onSpeedLimitExceeded = () => {
      setAppState((prev) => ({ ...prev, phase: 'SPEED_LIMIT_FAIL' }));
    };

    rig.onExitReached = () => {
      if (phaseRef.current === 'EXITING_VENUE') {
        setAppState((prev) => ({ ...prev, phase: 'COMPLETED' }));
      }
    };

    // Responsive resize handler
    const handleResize = () => {
      if (!venueSceneRef.current) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      scene.camera.aspect = width / height;
      scene.camera.updateProjectionMatrix();
      scene.renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Desktop Keyboard Listeners (Support both e.code and e.key)
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;
      if (e.key) {
        keysPressed.current[e.key] = true;
        keysPressed.current[e.key.toLowerCase()] = true;
        keysPressed.current[e.key.toUpperCase()] = true;
      }

      if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
        toggleFlashlight();
      }
      if (e.code === 'KeyE' || e.key === 'e' || e.key === 'E' || e.code === 'Enter') {
        if (cameraRigRef.current?.isSeated) {
          handleStandUp();
        } else if (cameraRigRef.current?.isNearSeat) {
          handleSitDown();
        }
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (cameraRigRef.current?.isSeated) {
          handleStandUp();
        } else {
          cameraRigRef.current?.jump();
        }
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        setAppState((prev) => ({ ...prev, sprintEnabled: !prev.sprintEnabled }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
      if (e.key) {
        keysPressed.current[e.key] = false;
        keysPressed.current[e.key.toLowerCase()] = false;
        keysPressed.current[e.key.toUpperCase()] = false;
      }
    };

    const handleBlur = () => {
      keysPressed.current = {};
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    // Mouse drag to look on desktop (sin graficar nada en pantalla)
    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      // Solo click izquierdo
      if (e.button !== 0) return;
      // No iniciar arrastre si se hace click sobre botones o controles de la interfaz
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, input, select, textarea, a, [role="button"]')) {
        return;
      }
      isMouseDown = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      document.body.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const dx = (e.clientX - lastMouseX) * 0.003;
      const dy = (e.clientY - lastMouseY) * 0.003;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      touchLookInput.current.dx += dx;
      touchLookInput.current.dy += dy;
    };

    const handleMouseUp = () => {
      if (isMouseDown) {
        isMouseDown = false;
        document.body.style.cursor = '';
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Device Orientation (Gyroscope) Listener
    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
        cameraRigRef.current?.setDeviceOrientation(e.alpha, e.beta, e.gamma);
        setAppState((prev) => ({
          ...prev,
          sensors: { ...prev.sensors, gyroscopeActive: true },
          orientationData: { alpha: e.alpha || 0, beta: e.beta || 0, gamma: e.gamma || 0 },
        }));
      }
    };
    window.addEventListener('deviceorientation', handleDeviceOrientation);

    // Render loop
    const clock = new THREE.Clock();
    let animId = 0;
    let hudUpdateCounter = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsedTime = clock.getElapsedTime();

      // Read audio metrics
      const metrics = soundEngine.getAudioMetrics();

      // Determine phase flags for scene
      const currentPhase = phaseRef.current;
      const isConcert =
        currentPhase === 'CONCERT_PLAYING' ||
        currentPhase === 'CONCERT_BLACKOUT' ||
        currentPhase === 'CONCERT_FINALE';
      const isBlackout = currentPhase === 'CONCERT_BLACKOUT';
      const isExiting = currentPhase === 'EXITING_VENUE' || currentPhase === 'COMPLETED';

      // Assemble locomotion inputs
      let kbForward = 0;
      let kbRight = 0;
      if (
        keysPressed.current['KeyW'] ||
        keysPressed.current['ArrowUp'] ||
        keysPressed.current['w'] ||
        keysPressed.current['W']
      ) kbForward += 1;
      if (
        keysPressed.current['KeyS'] ||
        keysPressed.current['ArrowDown'] ||
        keysPressed.current['s'] ||
        keysPressed.current['S']
      ) kbForward -= 1;
      if (
        keysPressed.current['KeyD'] ||
        keysPressed.current['ArrowRight'] ||
        keysPressed.current['d'] ||
        keysPressed.current['D']
      ) kbRight += 1;
      if (
        keysPressed.current['KeyA'] ||
        keysPressed.current['ArrowLeft'] ||
        keysPressed.current['a'] ||
        keysPressed.current['A']
      ) kbRight -= 1;

      const totalForward = Math.max(-1, Math.min(1, kbForward + touchMoveInput.current.forward));
      const totalRight = Math.max(-1, Math.min(1, kbRight + touchMoveInput.current.right));

      const input: RigInput = {
        moveForward: totalForward,
        moveRight: totalRight,
        lookDeltaX: touchLookInput.current.dx,
        lookDeltaY: touchLookInput.current.dy,
        sprint: sprintRef.current,
      };

      // Reset touch look delta after consumption
      touchLookInput.current.dx = 0;
      touchLookInput.current.dy = 0;

      // Update player rig
      if (currentPhase !== 'TICKET_SELECTION' && currentPhase !== 'PERMISSIONS_MODAL' && currentPhase !== 'SPEED_LIMIT_FAIL') {
        rig.update(delta, input);
      }

      // Update 3D scene dynamic visuals
      scene.update(
        elapsedTime,
        delta,
        metrics.bassLevel,
        metrics.volume,
        metrics.trebleLevel,
        isConcert,
        isBlackout,
        isExiting
      );

      // Render
      scene.renderer.render(scene.scene, scene.camera);

      // Throttle HUD state updates to ~15fps to conserve CPU
      hudUpdateCounter++;
      if (hudUpdateCounter % 4 === 0) {
        setAppState((prev) => ({
          ...prev,
          speed: rig.currentSpeed,
          isInsideVenue: rig.isInsideVenue,
          isSeated: rig.isSeated,
          audioMetrics: metrics,
        }));
      }
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      if (gpsWatchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      }
      scene.dispose();
    };
  }, []);

  // --- 2. Countdown Timer & Concert Timeline Management ---
  useEffect(() => {
    if (appState.phase === 'TICKET_SELECTION' || appState.phase === 'PERMISSIONS_MODAL') {
      return;
    }

    const timer = setInterval(() => {
      setAppState((prev) => {
        // If already in failure/expulsion or completed state, pause tick
        if (
          prev.phase === 'FLASHLIGHT_EXPELLED' ||
          prev.phase === 'SPEED_LIMIT_FAIL' ||
          prev.phase === 'COMPLETED'
        ) {
          return prev;
        }

        let newPhase = prev.phase;
        let newTimeRemaining = prev.timeRemainingSeconds;
        let newBlackoutSeconds = prev.blackoutRemainingSeconds;
        let newWarningSeconds = prev.flashlightWarningSeconds;

        const isEventLightsOn =
          prev.phase === 'CONCERT_PLAYING' ||
          prev.phase === 'CONCERT_FINALE' ||
          (prev.isInsideVenue && prev.phase === 'SEATED_WAITING');

        // Check flashlight warning countdown (lights ON with flashlight ON)
        if (prev.flashlightOn && isEventLightsOn) {
          if (newWarningSeconds === null) {
            newWarningSeconds = 5;
            soundEngine.playWarningBeep(5);
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          } else if (newWarningSeconds > 1) {
            newWarningSeconds -= 1;
            soundEngine.playWarningBeep(newWarningSeconds);
            if (navigator.vibrate) navigator.vibrate(80);
          } else {
            // EXPULSION TRIGGERED!
            soundEngine.stopConcertMusic();
            soundEngine.playExpulsionBuzzer();
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
            return {
              ...prev,
              phase: 'FLASHLIGHT_EXPELLED',
              flashlightWarningSeconds: null,
              blackoutRemainingSeconds: null,
            };
          }
        } else if (!prev.flashlightOn || !isEventLightsOn) {
          newWarningSeconds = null;
        }

        // Countdown towards the concert start (3-minute timer)
        if (
          prev.phase === 'WALKING_OUTSIDE' ||
          prev.phase === 'INSIDE_VENUE' ||
          prev.phase === 'SEATED_WAITING'
        ) {
          if (newTimeRemaining <= 1) {
            // Trigger Concert automatically when time expires!
            soundEngine.startConcertMusic();
            newPhase = 'CONCERT_PLAYING';
            newTimeRemaining = 0;
          } else {
            newTimeRemaining -= 1;
          }
        }

        // Countdown during blackout phase (at <= 5s, warn user to turn off flashlight before lights return!)
        if (prev.phase === 'CONCERT_BLACKOUT' && newBlackoutSeconds !== null) {
          if (newBlackoutSeconds <= 5 && newBlackoutSeconds > 1) {
            // 5 second warning before lights turn back on!
            soundEngine.playWarningBeep(newBlackoutSeconds);
            if (navigator.vibrate) navigator.vibrate(50);
          }

          if (newBlackoutSeconds <= 1) {
            // Blackout ends -> CONCERT_FINALE! Lights turn back on!
            newPhase = 'CONCERT_FINALE';
            newBlackoutSeconds = null;

            // If user still has flashlight on when lights return: trigger immediate 5s expulsion countdown!
            if (prev.flashlightOn) {
              newWarningSeconds = 5;
              soundEngine.playWarningBeep(5);
              if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            }
          } else {
            newBlackoutSeconds -= 1;
          }
        }

        return {
          ...prev,
          phase: newPhase,
          timeRemainingSeconds: newTimeRemaining,
          blackoutRemainingSeconds: newBlackoutSeconds,
          flashlightWarningSeconds: newWarningSeconds,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [appState.phase]);

  // Concert Timeline Progression (Playing -> Blackout -> Finale -> Audience Leaves)
  useEffect(() => {
    let timeoutId: number;

    if (appState.phase === 'CONCERT_PLAYING') {
      // After 28 seconds of initial music, trigger blackout with 16-second countdown!
      timeoutId = window.setTimeout(() => {
        setAppState((prev) => ({
          ...prev,
          phase: 'CONCERT_BLACKOUT',
          blackoutRemainingSeconds: 16,
        }));
      }, 28000);
    } else if (appState.phase === 'CONCERT_FINALE') {
      // Finale lasts 20 seconds, then crowd applause & exit
      timeoutId = window.setTimeout(() => {
        soundEngine.stopConcertMusic();
        soundEngine.playCrowdApplause();
        setAppState((prev) => ({
          ...prev,
          phase: 'EXITING_VENUE',
          flashlightWarningSeconds: null,
          blackoutRemainingSeconds: null,
        }));
      }, 20000);
    }

    return () => clearTimeout(timeoutId);
  }, [appState.phase]);

  // --- 3. User Actions & Handlers ---

  const handleTicketConfirmed = (ticket: TicketInfo) => {
    venueSceneRef.current?.updateTargetSeatFromTicket(ticket);
    setAppState((prev) => ({
      ...prev,
      ticket,
      phase: 'PERMISSIONS_MODAL',
    }));
  };

  const handlePermissionsFinished = (sensors: {
    gyroAllowed: boolean;
    micAllowed: boolean;
    cameraStream: MediaStream | null;
    gpsAllowed?: boolean;
  }) => {
    cameraStreamRef.current = sensors.cameraStream;
    if (sensors.cameraStream && venueSceneRef.current) {
      venueSceneRef.current.setCameraStream(sensors.cameraStream);
    }

    setAppState((prev) => ({
      ...prev,
      isInitialized: true,
      phase: 'WALKING_OUTSIDE',
      sensors: {
        gyroscopeAllowed: sensors.gyroAllowed,
        gyroscopeActive: sensors.gyroAllowed,
        micAllowed: sensors.micAllowed,
        micActive: sensors.micAllowed,
        cameraAllowed: !!sensors.cameraStream,
        cameraActive: !!sensors.cameraStream,
      },
    }));

    if (sensors.gpsAllowed) {
      handleToggleGpsWalk();
    }
  };

  const toggleHardwareTorch = (enabled: boolean) => {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    try {
      const track = stream.getVideoTracks()[0];
      if (track && 'applyConstraints' in track) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const capabilities = (track.getCapabilities && track.getCapabilities()) || ({} as any);
        if ('torch' in capabilities) {
          track.applyConstraints({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            advanced: [{ torch: enabled } as any],
          }).catch((err) => console.warn('Torch constraint warning:', err));
        }
      }
    } catch (err) {
      console.warn('Torch warning:', err);
    }
  };

  const toggleFlashlight = useCallback(() => {
    soundEngine.playFlashlightClick();
    if (navigator.vibrate) navigator.vibrate(25);
    setAppState((prev) => {
      const next = !prev.flashlightOn;
      venueSceneRef.current?.setFlashlight(next);
      toggleHardwareTorch(next);

      // If turning OFF, immediately clear any expulsion countdown
      if (!next) {
        return {
          ...prev,
          flashlightOn: false,
          flashlightWarningSeconds: null,
        };
      }

      // If turning ON: check if lights are currently ON in the event!
      const isLightsOnInVenue =
        prev.phase === 'CONCERT_PLAYING' ||
        prev.phase === 'CONCERT_FINALE' ||
        (prev.isInsideVenue && prev.phase === 'SEATED_WAITING');

      let warningSec: number | null = null;
      if (isLightsOnInVenue) {
        // Flashlight turned on incorrectly! Start 5-second countdown to expulsion
        warningSec = 5;
        soundEngine.playWarningBeep(5);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }

      return {
        ...prev,
        flashlightOn: true,
        flashlightWarningSeconds: warningSec,
      };
    });
  }, []);

  const handleSitDown = useCallback(() => {
    cameraRigRef.current?.sitDown();
    venueSceneRef.current?.setSeatBeaconVisible(false);
    setAppState((prev) => ({
      ...prev,
      isSeated: true,
      phase:
        prev.phase === 'CONCERT_PLAYING' ||
        prev.phase === 'CONCERT_BLACKOUT' ||
        prev.phase === 'CONCERT_FINALE'
          ? prev.phase
          : 'SEATED_WAITING',
    }));
  }, []);

  const handleStandUp = useCallback(() => {
    cameraRigRef.current?.standUp();
    setAppState((prev) => ({ ...prev, isSeated: false }));
  }, []);

  const handleJump = useCallback(() => {
    cameraRigRef.current?.jump();
  }, []);

  const handleToggleSprint = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(20);
    setAppState((prev) => ({ ...prev, sprintEnabled: !prev.sprintEnabled }));
  }, []);

  const handleToggleGpsWalk = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate(25);
    setAppState((prev) => {
      const next = !prev.gpsWalkEnabled;

      if (!next) {
        // Stop tracking
        if (gpsWatchIdRef.current !== null && 'geolocation' in navigator) {
          navigator.geolocation.clearWatch(gpsWatchIdRef.current);
          gpsWatchIdRef.current = null;
        }
        lastGpsCoordsRef.current = null;
        return {
          ...prev,
          gpsWalkEnabled: false,
          gpsAccuracy: null,
        };
      }

      // Start Real-World GPS Walking Mode
      if ('geolocation' in navigator) {
        gpsWatchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            let movedDist = 0;

            if (lastGpsCoordsRef.current) {
              const lat1 = lastGpsCoordsRef.current.lat;
              const lon1 = lastGpsCoordsRef.current.lng;
              const lat2 = latitude;
              const lon2 = longitude;
              const R = 6371000; // Earth radius in meters
              const dLat = ((lat2 - lat1) * Math.PI) / 180;
              const dLon = ((lon2 - lon1) * Math.PI) / 180;
              const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((lat1 * Math.PI) / 180) *
                  Math.cos((lat2 * Math.PI) / 180) *
                  Math.sin(dLon / 2) *
                  Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              movedDist = R * c;
            }

            lastGpsCoordsRef.current = { lat: latitude, lng: longitude };

            // Filter out GPS drift noise (< 0.5m) and inaccurate telemetry (> 25m jump or accuracy > 40m)
            if (movedDist >= 0.5 && movedDist <= 25 && accuracy <= 40) {
              cameraRigRef.current?.moveForwardByDistance(movedDist);
              setAppState((p) => ({
                ...p,
                gpsDistanceWalked: Math.round((p.gpsDistanceWalked + movedDist) * 10) / 10,
                gpsAccuracy: Math.round(accuracy),
              }));
            } else {
              setAppState((p) => ({
                ...p,
                gpsAccuracy: Math.round(accuracy),
              }));
            }
          },
          (err) => {
            console.warn('Geolocation error or permission denied:', err);
            setAppState((p) => ({ ...p, gpsWalkEnabled: false }));
          },
          {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 10000,
          }
        );
      } else {
        console.warn('Geolocation not supported on this browser');
        return { ...prev, gpsWalkEnabled: false };
      }

      return { ...prev, gpsWalkEnabled: true };
    });
  }, []);

  const handleStartShowNow = useCallback(() => {
    soundEngine.startConcertMusic();
    setAppState((prev) => ({
      ...prev,
      timeRemainingSeconds: 0,
      phase: 'CONCERT_PLAYING',
      flashlightWarningSeconds: null,
      blackoutRemainingSeconds: null,
    }));
  }, []);

  const handleResetFromEntrance = useCallback(() => {
    cameraRigRef.current?.resetToEntrance();
    venueSceneRef.current?.setFlashlight(false);
    toggleHardwareTorch(false);
    setAppState((prev) => ({
      ...prev,
      phase: 'INSIDE_VENUE',
      sprintEnabled: false,
      flashlightOn: false,
      flashlightWarningSeconds: null,
      blackoutRemainingSeconds: null,
    }));
  }, []);

  const handleResetComplete = useCallback(() => {
    soundEngine.stopConcertMusic();
    venueSceneRef.current?.setSeatBeaconVisible(true);
    venueSceneRef.current?.setFlashlight(false);
    toggleHardwareTorch(false);
    if (cameraRigRef.current) {
      cameraRigRef.current.position.set(2.2, 1.65, 42.5);
      cameraRigRef.current.yaw = Math.PI;
      cameraRigRef.current.pitch = 0;
      cameraRigRef.current.verticalVelocity = 0;
      cameraRigRef.current.isGrounded = true;
      cameraRigRef.current.isSeated = false;
      cameraRigRef.current.isInsideVenue = false;
    }
    setAppState((prev) => ({
      ...prev,
      phase: 'WALKING_OUTSIDE',
      timeRemainingSeconds: 180,
      isSeated: false,
      sprintEnabled: false,
      flashlightOn: false,
      flashlightWarningSeconds: null,
      blackoutRemainingSeconds: null,
    }));
  }, []);

  // Mobile Touch Callbacks
  const handleTouchMove = useCallback((forward: number, right: number) => {
    touchMoveInput.current.forward = forward;
    touchMoveInput.current.right = right;
  }, []);

  const handleTouchLook = useCallback((dx: number, dy: number) => {
    touchLookInput.current.dx += dx;
    touchLookInput.current.dy += dy;
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans">
      {/* 3D WebGL Canvas */}
      <canvas
        id="three-canvas"
        ref={canvasRef}
        tabIndex={0}
        onPointerDown={() => {
          if (typeof window !== 'undefined' && window.focus) window.focus();
        }}
        className="absolute inset-0 w-full h-full block cursor-grab active:cursor-grabbing touch-none z-10"
      />

      {/* Mobile Touch Controller (only active in first-person gameplay) */}
      {appState.phase !== 'TICKET_SELECTION' &&
        appState.phase !== 'PERMISSIONS_MODAL' &&
        appState.phase !== 'SPEED_LIMIT_FAIL' && (
          <TouchJoystick
            onMove={handleTouchMove}
            onLook={handleTouchLook}
            disabled={appState.isSeated}
          />
        )}

      {/* Screen 1: Ticket Selection */}
      {appState.phase === 'TICKET_SELECTION' && (
        <TicketSelector onTicketConfirmed={handleTicketConfirmed} />
      )}

      {/* Screen 2: Sensor Authorization Modal */}
      {appState.phase === 'PERMISSIONS_MODAL' && (
        <SensorPermissionModal onPermissionsFinished={handlePermissionsFinished} />
      )}

      {/* In-Game HUD Overlay (Top status, Bottom dock, prompts) */}
      {appState.phase !== 'TICKET_SELECTION' && appState.phase !== 'PERMISSIONS_MODAL' && (
        <HUDOverlay
          appState={appState}
          isNearSeat={isNearSeat}
          onToggleFlashlight={toggleFlashlight}
          onSitDown={handleSitDown}
          onStandUp={handleStandUp}
          onToggleSprint={handleToggleSprint}
          onToggleGpsWalk={handleToggleGpsWalk}
          onStartShowNow={handleStartShowNow}
          onResetFromEntrance={handleResetFromEntrance}
          onResetComplete={handleResetComplete}
        />
      )}

      {/* Screen 3: Post-Event Completion Celebration Modal */}
      {appState.phase === 'COMPLETED' && (
        <ConcertEndModal
          ticket={appState.ticket}
          onRestart={handleResetComplete}
          onChangeTicket={() =>
            setAppState((prev) => ({
              ...prev,
              phase: 'TICKET_SELECTION',
            }))
          }
        />
      )}
    </div>
  );
}
