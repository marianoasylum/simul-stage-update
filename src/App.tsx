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
    customMediaName: null,
    customMediaUrl: null,
    audienceExitRemainingSeconds: null,
    isVenueEmpty: false,
    hasExploredEmptyVenue: false,
    blackoutCycle: 0,
    targetBlackouts: 2,
    stageLightsOn: true,
    stageScreensOn: true,
    gifScreenActive: false,
    gifPreviewsUsed: 0,
    isNearStagePanel: false,
    currentSeatName: null,
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

  const isVenueEmptyRef = useRef(false);
  isVenueEmptyRef.current = appState.isVenueEmpty;

  const stageLightsOnRef = useRef(true);
  stageLightsOnRef.current = appState.stageLightsOn;

  // Real-World GPS Walking Refs
  const gpsWatchIdRef = useRef<number | null>(null);
  const lastGpsCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // --- 1. Three.js Initialization ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const scene = new VenueScene(canvas);
    const rig = new CameraRig(scene);

    venueSceneRef.current = scene;
    cameraRigRef.current = rig;

    // Rig callbacks
    rig.onNearSeatChanged = (near, label) => {
      setIsNearSeat(near);
      setAppState((prev) => ({
        ...prev,
        currentSeatName: near ? (label || null) : null,
      }));
    };

    rig.onNearStagePanelChanged = (near) => {
      setAppState((prev) => ({ ...prev, isNearStagePanel: near }));
    };

    rig.onSpeedLimitExceeded = () => {
      setAppState((prev) => ({ ...prev, phase: 'SPEED_LIMIT_FAIL' }));
    };

    rig.onExitReached = () => {
      if (phaseRef.current === 'EXITING_VENUE') {
        setAppState((prev) => ({
          ...prev,
          phase: 'COMPLETED',
          hasExploredEmptyVenue: prev.hasExploredEmptyVenue || prev.isVenueEmpty,
        }));
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
      const isBlackout =
        currentPhase === 'CONCERT_BLACKOUT' ||
        (isVenueEmptyRef.current && !stageLightsOnRef.current);
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
            // Check if user is outside the venue when concert begins
            if (!prev.isInsideVenue) {
              soundEngine.stopConcertMusic();
              soundEngine.playExpulsionBuzzer();
              if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
              return {
                ...prev,
                phase: 'EVENT_MISSED',
                timeRemainingSeconds: 0,
                flashlightWarningSeconds: null,
                blackoutRemainingSeconds: null,
              };
            }

            // Trigger Concert automatically when time expires and user is inside!
            const targets = Math.random() < 0.5 ? 2 : 3;
            soundEngine.startConcertMusic();
            venueSceneRef.current?.activateCustomMediaOnScreen();
            newPhase = 'CONCERT_PLAYING';
            newTimeRemaining = 0;
            return {
              ...prev,
              phase: newPhase,
              timeRemainingSeconds: 0,
              blackoutCycle: 0,
              targetBlackouts: targets,
            };
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
            // Blackout ends -> Lights turn back on & music restarts!
            soundEngine.startConcertMusic();
            const nextCycle = prev.blackoutCycle + 1;
            const isLast = nextCycle >= prev.targetBlackouts;
            newPhase = isLast ? 'CONCERT_FINALE' : 'CONCERT_PLAYING';
            newBlackoutSeconds = null;

            // If user still has flashlight on when lights return: trigger immediate 5s expulsion countdown!
            if (prev.flashlightOn) {
              newWarningSeconds = 5;
              soundEngine.playWarningBeep(5);
              if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            }

            return {
              ...prev,
              phase: newPhase,
              blackoutCycle: nextCycle,
              blackoutRemainingSeconds: null,
              flashlightWarningSeconds: newWarningSeconds,
            };
          } else {
            newBlackoutSeconds -= 1;
          }
        }

        // Countdown for audience exit (30-second duration)
        let newAudienceExitSeconds = prev.audienceExitRemainingSeconds;
        let newIsVenueEmpty = prev.isVenueEmpty;
        let newHasExplored = prev.hasExploredEmptyVenue;

        if (prev.phase === 'EXITING_VENUE' && newAudienceExitSeconds !== null && newAudienceExitSeconds > 0) {
          if (newAudienceExitSeconds <= 1) {
            newAudienceExitSeconds = 0;
            newIsVenueEmpty = true;
            newHasExplored = true;
            venueSceneRef.current?.setVenueEmpty(true);
            venueSceneRef.current?.setStageLights(false); // Turn off all stage lights when venue is empty -> causes apagón
            soundEngine.playPowerDown();
            if (navigator.vibrate) navigator.vibrate([150, 60, 200]);
            if (cameraRigRef.current) {
              cameraRigRef.current.allowSprintInVenue = true;
            }
            return {
              ...prev,
              audienceExitRemainingSeconds: 0,
              isVenueEmpty: true,
              hasExploredEmptyVenue: true,
              stageLightsOn: false,
            };
          } else {
            newAudienceExitSeconds -= 1;
          }
        }

        return {
          ...prev,
          phase: newPhase,
          timeRemainingSeconds: newTimeRemaining,
          blackoutRemainingSeconds: newBlackoutSeconds,
          flashlightWarningSeconds: newWarningSeconds,
          audienceExitRemainingSeconds: newAudienceExitSeconds,
          isVenueEmpty: newIsVenueEmpty,
          hasExploredEmptyVenue: newHasExplored,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [appState.phase]);

  // Concert Timeline Progression (Playing -> Blackout -> Finale -> Audience Leaves)
  useEffect(() => {
    let timeoutId: number;

    if (appState.phase === 'CONCERT_PLAYING') {
      // Blackout happens between 2 and 3 times during the concert at a randomized period of time
      // with at least 5 seconds between one blackout and another:
      // First blackout: 14 to 20 seconds of concert intro
      // Subsequent blackouts: random between 5 and 11 seconds (always >= 5 seconds)
      const minDelay = appState.blackoutCycle === 0 ? 14000 : 5000;
      const randomExtra = Math.floor(Math.random() * 6000);
      const delayMs = minDelay + randomExtra;

      timeoutId = window.setTimeout(() => {
        // Music stops when the lights go out!
        soundEngine.stopConcertMusic();
        setAppState((prev) => ({
          ...prev,
          phase: 'CONCERT_BLACKOUT',
          blackoutRemainingSeconds: 12, // 12-second blackout event
        }));
      }, delayMs);
    } else if (appState.phase === 'CONCERT_FINALE') {
      // Finale lasts 20 seconds, then crowd applause & 30s audience exit
      timeoutId = window.setTimeout(() => {
        soundEngine.stopConcertMusic();
        soundEngine.playCrowdApplause();
        if (cameraRigRef.current) {
          cameraRigRef.current.allowSprintInVenue = false;
        }
        venueSceneRef.current?.setVenueEmpty(false);
        setAppState((prev) => ({
          ...prev,
          phase: 'EXITING_VENUE',
          audienceExitRemainingSeconds: 30, // 30-second crowd evacuation
          isVenueEmpty: false,
          flashlightWarningSeconds: null,
          blackoutRemainingSeconds: null,
        }));
      }, 20000);
    }

    return () => clearTimeout(timeoutId);
  }, [appState.phase, appState.blackoutCycle]);

  // --- 3. User Actions & Handlers ---

  const handleTicketConfirmed = (ticket: TicketInfo) => {
    venueSceneRef.current?.updateTargetSeatFromTicket(ticket);
    if (cameraRigRef.current) {
      // Spawn facing the vehicle on Calle Humboldt with the venue in front (yaw = 0, looking down -Z)
      cameraRigRef.current.position.set(2.5, 1.65, 18.0);
      cameraRigRef.current.yaw = 0;
      cameraRigRef.current.pitch = 0;
      cameraRigRef.current.verticalVelocity = 0;
      cameraRigRef.current.isGrounded = true;
      cameraRigRef.current.isSeated = false;
      cameraRigRef.current.isInsideVenue = false;
      cameraRigRef.current.camera.position.set(2.5, 1.65, 18.0);
      cameraRigRef.current.camera.rotation.set(0, 0, 0, 'YXZ');
    }
    setAppState((prev) => ({
      ...prev,
      ticket,
      isInitialized: true,
      phase: 'WALKING_OUTSIDE',
    }));
  };

  const handleAttachMedia = useCallback(async (file: File) => {
    if (!venueSceneRef.current) return;
    try {
      const url = await venueSceneRef.current.setCustomMedia(file);
      if (phaseRef.current === 'CONCERT_PLAYING' || phaseRef.current === 'CONCERT_FINALE') {
        venueSceneRef.current.activateCustomMediaOnScreen();
      }
      setAppState((prev) => ({
        ...prev,
        customMediaName: file.name,
        customMediaUrl: url,
      }));
    } catch (err) {
      console.warn('Failed to attach custom media:', err);
    }
  }, []);

  const handleClearCustomMedia = useCallback(() => {
    venueSceneRef.current?.resetScreenToDefault();
    setAppState((prev) => ({
      ...prev,
      customMediaName: null,
      customMediaUrl: null,
    }));
  }, []);

  const toggleFlashlight = useCallback(() => {
    soundEngine.playFlashlightClick();
    if (navigator.vibrate) navigator.vibrate(25);
    setAppState((prev) => {
      const next = !prev.flashlightOn;
      venueSceneRef.current?.setFlashlight(next);

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
        prev.phase === 'CONCERT_FINALE' ||
        prev.phase === 'EXITING_VENUE'
          ? prev.phase
          : 'SEATED_WAITING',
    }));
  }, []);

  const handleToggleStageLights = useCallback(() => {
    soundEngine.playSwitchClick();
    setAppState((prev) => {
      const next = !prev.stageLightsOn;
      venueSceneRef.current?.setStageLights(next);
      return { ...prev, stageLightsOn: next };
    });
  }, []);

  const handleToggleStageScreens = useCallback(() => {
    soundEngine.playSwitchClick();
    setAppState((prev) => {
      const next = !prev.stageScreensOn;
      venueSceneRef.current?.setStageScreens(next);
      return { ...prev, stageScreensOn: next };
    });
  }, []);

  const handleToggleGifScreen = useCallback(() => {
    soundEngine.playSwitchClick();
    setAppState((prev) => {
      const isPreConcert =
        prev.phase !== 'CONCERT_PLAYING' &&
        prev.phase !== 'CONCERT_BLACKOUT' &&
        prev.phase !== 'CONCERT_FINALE';

      if (isPreConcert) {
        if (prev.gifScreenActive) {
          venueSceneRef.current?.setGifScreenActive(false);
          soundEngine.stopConcertMusic();
          return { ...prev, gifScreenActive: false };
        } else {
          // Pre-concert preview limit is up to 3 times
          if (prev.gifPreviewsUsed >= 3) {
            return prev;
          }
          venueSceneRef.current?.setGifScreenActive(true);
          soundEngine.startConcertMusic();
          return {
            ...prev,
            gifScreenActive: true,
            gifPreviewsUsed: prev.gifPreviewsUsed + 1,
          };
        }
      } else {
        const next = !prev.gifScreenActive;
        venueSceneRef.current?.setGifScreenActive(next);
        return { ...prev, gifScreenActive: next };
      }
    });
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
    // Only available when user is inside the venue / stage area
    if (!appState.isInsideVenue) return;
    soundEngine.startConcertMusic();
    venueSceneRef.current?.activateCustomMediaOnScreen();
    const targets = Math.random() < 0.5 ? 2 : 3;
    setAppState((prev) => ({
      ...prev,
      timeRemainingSeconds: 0,
      phase: 'CONCERT_PLAYING',
      blackoutCycle: 0,
      targetBlackouts: targets,
      flashlightWarningSeconds: null,
      blackoutRemainingSeconds: null,
      hasExploredEmptyVenue: false,
    }));
  }, [appState.isInsideVenue]);

  const handleResetFromEntrance = useCallback(() => {
    cameraRigRef.current?.resetToEntrance();
    venueSceneRef.current?.setFlashlight(false);
    venueSceneRef.current?.setVenueEmpty(false);
    venueSceneRef.current?.setStageLights(true);
    venueSceneRef.current?.setStageScreens(true);
    venueSceneRef.current?.setGifScreenActive(false);
    if (cameraRigRef.current) {
      cameraRigRef.current.allowSprintInVenue = false;
    }
    setAppState((prev) => ({
      ...prev,
      phase: 'INSIDE_VENUE',
      sprintEnabled: false,
      flashlightOn: false,
      flashlightWarningSeconds: null,
      blackoutRemainingSeconds: null,
      audienceExitRemainingSeconds: null,
      isVenueEmpty: false,
      hasExploredEmptyVenue: false,
      blackoutCycle: 0,
      stageLightsOn: true,
      stageScreensOn: true,
      gifScreenActive: false,
      isNearStagePanel: false,
      currentSeatName: null,
    }));
  }, []);

  const handleResetComplete = useCallback(() => {
    soundEngine.stopConcertMusic();
    venueSceneRef.current?.setSeatBeaconVisible(true);
    venueSceneRef.current?.setFlashlight(false);
    venueSceneRef.current?.setVenueEmpty(false);
    venueSceneRef.current?.setStageLights(true);
    venueSceneRef.current?.setStageScreens(true);
    venueSceneRef.current?.setGifScreenActive(false);
    if (cameraRigRef.current) {
      // Spawn facing the vehicle on Calle Humboldt with the venue in front (yaw = 0, looking down -Z)
      cameraRigRef.current.position.set(2.5, 1.65, 18.0);
      cameraRigRef.current.yaw = 0;
      cameraRigRef.current.pitch = 0;
      cameraRigRef.current.verticalVelocity = 0;
      cameraRigRef.current.isGrounded = true;
      cameraRigRef.current.isSeated = false;
      cameraRigRef.current.isInsideVenue = false;
      cameraRigRef.current.allowSprintInVenue = false;
      cameraRigRef.current.camera.position.set(2.5, 1.65, 18.0);
      cameraRigRef.current.camera.rotation.set(0, 0, 0, 'YXZ');
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
      audienceExitRemainingSeconds: null,
      isVenueEmpty: false,
      hasExploredEmptyVenue: false,
      blackoutCycle: 0,
      stageLightsOn: true,
      stageScreensOn: true,
      gifScreenActive: false,
      gifPreviewsUsed: 0,
      isNearStagePanel: false,
      currentSeatName: null,
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

      {/* Floating Dynamic Touch Controller (appears ONLY when finger contacts screen) */}
      {appState.phase !== 'TICKET_SELECTION' &&
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

      {/* In-Game HUD Overlay (Top status, Bottom dock, prompts) */}
      {appState.phase !== 'TICKET_SELECTION' && (
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
          onAttachMedia={handleAttachMedia}
          onClearCustomMedia={handleClearCustomMedia}
          onToggleStageLights={handleToggleStageLights}
          onToggleStageScreens={handleToggleStageScreens}
          onToggleGifScreen={handleToggleGifScreen}
        />
      )}

      {/* Screen 3: Post-Event Completion Celebration Modal */}
      {appState.phase === 'COMPLETED' && (
        <ConcertEndModal
          ticket={appState.ticket}
          hasExploredEmptyVenue={appState.hasExploredEmptyVenue || appState.isVenueEmpty}
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
