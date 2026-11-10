/**
 * VenueScene - Movistar Arena Buenos Aires 3D Engine
 * Integrates the official 3D GLTF model of Movistar Arena Buenos Aires (Humboldt 450, Villa Crespo),
 * real-scale 15,000 capacity seating bowl, updated Calle Humboldt streetscape,
 * dedicated internal architectural house lighting, 16 entrance gates,
 * and complete stage walkthrough exploration.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TicketInfo } from '../types';
import {
  createAsphaltTexture,
  createConcreteFloorTexture,
  createNeonSignTexture,
  createJumbotronTexture,
  createArenaFacadeTexture,
  createStarTexture,
  createMoonTexture,
} from './textures';

export interface SeatCoordinates {
  position: THREE.Vector3;
  lookTarget: THREE.Vector3;
}

export class VenueScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  // Starry sky & moon
  public starsMesh: THREE.Points | null = null;
  public moonMesh: THREE.Mesh | null = null;

  // Flashlight attached to camera
  public flashlight: THREE.SpotLight;
  public flashlightFill: THREE.PointLight;
  public flashlightBeam: THREE.Mesh;

  // Lighting rigs
  public outdoorKeyLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public arenaAmbientLight: THREE.AmbientLight;
  public envTexture: THREE.Texture | null = null;
  public houseLights: THREE.PointLight[] = [];
  public foyerLights: THREE.PointLight[] = [];
  public streetLights: THREE.PointLight[] = [];
  public facadeLights: (THREE.SpotLight | THREE.PointLight)[] = [];
  public houseFixtureMaterials: THREE.MeshStandardMaterial[] = [];
  public exteriorLampMaterials: THREE.MeshStandardMaterial[] = [];
  public neonMaterials: THREE.MeshStandardMaterial[] = [];
  public stepLedMaterials: THREE.MeshStandardMaterial[] = [];
  public tieredRakingLights: THREE.SpotLight[] = [];
  public movingSpots: {
    light: THREE.SpotLight;
    target: THREE.Object3D;
    cone: THREE.Mesh;
    basePos: THREE.Vector3;
    speed: number;
    phase: number;
    color: THREE.Color;
  }[] = [];
  public laserLines: THREE.LineSegments | null = null;
  public stageWashLights: THREE.PointLight[] = [];

  // Stage Screens & Jumbotron
  public mainLedScreenMesh: THREE.Mesh;
  public jumbotronMeshLeft: THREE.Mesh;
  public jumbotronMeshRight: THREE.Mesh;
  private jumbotronController: ReturnType<typeof createJumbotronTexture>;
  public cameraVideoTexture: THREE.VideoTexture | null = null;
  public videoElement: HTMLVideoElement | null = null;

  // Audience (15,000 Capacity representation)
  public audienceMesh: THREE.InstancedMesh;
  public audienceCount = 240;
  private audienceOriginalPos: THREE.Vector3[] = [];
  private audienceVelocities: THREE.Vector3[] = [];
  public isVenueEmpty = false;

  // User Target Seat & Gates
  public targetSeatCoords: SeatCoordinates = {
    position: new THREE.Vector3(0, 0.25, -50),
    lookTarget: new THREE.Vector3(0, 2.5, -80),
  };
  public seatBeacon: THREE.Group;
  public userGateMarker: THREE.Group;
  public assignedGateNumber = 1;

  // Car reference & Parked vehicle colliders
  public carGroup: THREE.Group;
  public parkedCarColliders: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];

  // Custom Screen Media (GIF / Video / Image)
  public customMediaFile: File | null = null;
  public customMediaUrl: string | null = null;
  public customTexture: THREE.Texture | null = null;
  public isCustomMediaActive = false;
  public customVideoElement: HTMLVideoElement | null = null;
  private gifAnimationStop: (() => void) | null = null;

  // All Venue Seat Positions for Free Sitting Mode when empty
  public allSeatPositions: { pos: THREE.Vector3; rotY: number; label: string }[] = [];

  // Stage Switchboard & Separate Controls (under main screen)
  public stageLightsManualOn = true;
  public stageScreensManualOn = true;
  public gifScreenManualActive = false;
  public isGifRhythmicFadeActive = false;
  public gifRhythmicPhaseTimer = 0;
  public stageSwitchCoords = new THREE.Vector3(0, 2.35, -83.7);

  // Switch LED indicator materials for 3D rack
  public switchLightLedMat: THREE.MeshStandardMaterial | null = null;
  public switchScreenLedMat: THREE.MeshStandardMaterial | null = null;
  public switchGifLedMat: THREE.MeshStandardMaterial | null = null;

  // Boundary markers: Entrances are at Z = -4.73
  public entranceZ = -4.73; // Outdoor Z > -4.73, Inside Z <= -4.73
  public exitLocations = [
    new THREE.Vector3(-14, 0.2, -4.73),
    new THREE.Vector3(0, 0.2, -4.73),
    new THREE.Vector3(14, 0.2, -4.73),
  ];

  // 3D GLTF Arena Model Root
  public arenaModelGroup: THREE.Group | null = null;
  public isModelLoaded = false;

  // Stadium Seats ("asiento_b" 3D Model Copies)
  public seatsInstancedMesh: THREE.InstancedMesh | null = null;
  public targetSeatMesh: THREE.Mesh | null = null;
  public seatGeometry: THREE.BufferGeometry | null = null;
  public seatMaterial: THREE.Material | null = null;
  public areSeatsLoaded = false;

  private dummy = new THREE.Object3D();

  constructor(canvas: HTMLCanvasElement) {
    // 1. Scene & Camera setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060912);
    this.scene.fog = new THREE.FogExp2(0x060912, 0.012);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      350
    );
    // Initial camera position outside on Calle Humboldt facing the vehicle and arena
    this.camera.position.set(2.5, 1.65, 18.0);
    this.camera.rotation.set(0, 0, 0);

    // 2. High Performance WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Studio Environment reflection
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.05).texture;
    this.scene.environment = this.envTexture;
    pmremGenerator.dispose();

    // 3. Outdoor & Venue Ambient Lighting
    this.outdoorKeyLight = new THREE.DirectionalLight(0xb0d0ff, 1.4);
    this.outdoorKeyLight.position.set(20, 45, 35);
    this.scene.add(this.outdoorKeyLight);

    this.hemiLight = new THREE.HemisphereLight(0x35405a, 0x141822, 0.9);
    this.scene.add(this.hemiLight);

    // Interior Ambient Light - balanced to allow crisp shadow contrast on stepped tiers
    this.arenaAmbientLight = new THREE.AmbientLight(0x283244, 0.7);
    this.scene.add(this.arenaAmbientLight);

    // 4. Player Flashlight
    this.flashlight = new THREE.SpotLight(0xfff8ee, 0, 75, Math.PI / 3.8, 0.45, 0.8);
    this.flashlight.position.set(0.12, -0.15, 0);
    this.flashlight.target.position.set(0, 0, -12);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);

    this.flashlightFill = new THREE.PointLight(0xffeed0, 0, 30, 0.9);
    this.flashlightFill.position.set(0, 0, -1.0);
    this.camera.add(this.flashlightFill);

    const beamGeo = new THREE.ConeGeometry(3.6, 22, 16, 1, true);
    beamGeo.translate(0, -11, 0);
    beamGeo.rotateX(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff4d6,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.flashlightBeam = new THREE.Mesh(beamGeo, beamMat);
    this.flashlightBeam.position.set(0, 0, -0.1);
    this.camera.add(this.flashlightBeam);
    this.scene.add(this.camera);

    // 5. Build Updated Calle Humboldt & Parked Vehicle Fleet
    this.carGroup = this.buildParkedVehicles();
    this.scene.add(this.carGroup);

    this.buildUpdatedCalleHumboldt();
    this.buildStarryNightSky();

    // 6. Jumbotron Equalizer Screens
    this.jumbotronController = createJumbotronTexture();
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.jumbotronController.texture,
    });

    const mainScreenGeo = new THREE.PlaneGeometry(28, 12);
    this.mainLedScreenMesh = new THREE.Mesh(mainScreenGeo, screenMat);
    this.mainLedScreenMesh.position.set(0, 10.5, -84.0);
    this.scene.add(this.mainLedScreenMesh);

    const sideScreenGeo = new THREE.PlaneGeometry(10, 6.5);
    this.jumbotronMeshLeft = new THREE.Mesh(sideScreenGeo, screenMat);
    this.jumbotronMeshLeft.position.set(-20.5, 9.5, -76.0);
    this.jumbotronMeshLeft.rotation.y = 0.4;
    this.scene.add(this.jumbotronMeshLeft);

    this.jumbotronMeshRight = new THREE.Mesh(sideScreenGeo, screenMat);
    this.jumbotronMeshRight.position.set(20.5, 9.5, -76.0);
    this.jumbotronMeshRight.rotation.y = -0.4;
    this.scene.add(this.jumbotronMeshRight);

    // 7. Interior House Lighting & Entrance Downlights
    this.setupInternalHouseLights();

    // 8. Dynamic Stage Moving Head Spots & Lasers
    this.setupDynamicStageLights();
    this.laserLines = this.setupLaserBeams();

    // 9. Stage Platform & Band Equipment for Walkthrough Tour
    this.buildStageExplorationArea();
    this.buildStageControlRack();

    // 10. Front Facade Wall & 16 Entrance Gate Portals
    this.buildFrontVenueFacade();
    this.buildEntranceGatePortals();

    // 11. Tiered Seating Bowl, Stepped Rows & Illuminated Staircases
    this.buildArenaSeatingBowlAndStands();

    // 12. Audience Instances (15,000 Capacity distributed across sections)
    this.audienceMesh = this.buildAudience();

    // 12. User Target Seat Beacon & Gate Marker
    this.seatBeacon = this.buildSeatBeacon();
    this.scene.add(this.seatBeacon);

    this.userGateMarker = this.buildUserGateMarker();
    this.scene.add(this.userGateMarker);

    // 13. Load Official Movistar Arena 3D Model
    this.loadMovistarArenaGLB();

    // 14. Load Official Seat 3D Model "asiento_b" & Generate Stadium Seat Copies
    this.loadAsientoBAndGenerateSeats();
  }

  // --- 13. Load Movistar Arena GLTF Model ---
  private loadMovistarArenaGLB(): void {
    const loader = new GLTFLoader();
    const candidateUrls = [
      '/models/movistar_arena_buenos_aires.glb',
      '/model/movistar_arena_buenos_aires.glb',
      'models/movistar_arena_buenos_aires.glb',
    ];

    const tryLoad = (idx: number) => {
      if (idx >= candidateUrls.length) {
        console.warn('Could not load Movistar Arena GLB from candidate paths, using fallback geometry');
        return;
      }
      loader.load(
        candidateUrls[idx],
        (gltf) => {
          const model = gltf.scene;
          // Center the 3D model: X_center = 592.65, Y_ground = -0.24, Z_center = 0
          model.position.set(-592.65, 0.24, 0.0);
          model.updateMatrixWorld(true);

          // Enhance materials, screens, glowing Movistar logo and doors
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;

              const mat = mesh.material;
              const matName = Array.isArray(mat)
                ? mat.map((m) => m.name).join(',')
                : mat?.name || '';

              // Movistar Glowing Cyan-Blue Signage
              if (matName.includes('Movistar')) {
                const movMat = new THREE.MeshStandardMaterial({
                  color: 0x0088ff,
                  emissive: 0x00a9e0,
                  emissiveIntensity: 2.8,
                  roughness: 0.2,
                  metalness: 0.8,
                });
                mesh.material = movMat;
                this.neonMaterials.push(movMat);
              }

              // Stage LED Display Screen (Object_993 / pantalla)
              if (matName.includes('pantalla') || mesh.name === 'Object_993') {
                mesh.material = new THREE.MeshBasicMaterial({
                  map: this.jumbotronController.texture,
                });
                this.mainLedScreenMesh = mesh;
              }

              // Entrance Glass Turnstile Doors (puertaS1)
              if (matName.includes('puertaS1')) {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: 0x88bbdd,
                  transparent: true,
                  opacity: 0.55,
                  metalness: 0.9,
                  roughness: 0.1,
                });
              }

              // Arena Bowl & Steel Trusses
              if (matName.includes('Metal_Ro') || matName.includes('Metal_Co')) {
                if (mesh.material instanceof THREE.MeshStandardMaterial) {
                  mesh.material.metalness = 0.8;
                  mesh.material.roughness = 0.35;
                }
              }

              // Seats & Stands Bowl
              if (matName.includes('butaca11')) {
                if (mesh.material instanceof THREE.MeshStandardMaterial) {
                  mesh.material.roughness = 0.6;
                }
              }

              // Concert Stage Platform
              if (matName.includes('v453') || mesh.name === 'Object_1861') {
                if (mesh.material instanceof THREE.MeshStandardMaterial) {
                  mesh.material.color = new THREE.Color(0x181b24);
                  mesh.material.roughness = 0.45;
                  mesh.material.metalness = 0.3;
                }
              }
            }
          });

          this.arenaModelGroup = model;
          this.scene.add(model);
          this.isModelLoaded = true;
        },
        undefined,
        () => {
          tryLoad(idx + 1);
        }
      );
    };

    tryLoad(0);
  }

  // --- 14. Load Seat Model "asiento_b" & Generate Stadium Seat Copies ---
  private loadAsientoBAndGenerateSeats(): void {
    const loader = new GLTFLoader();
    const candidateUrls = [
      '/models/asiento_b.glb',
      '/model/asiento_b.glb',
      'models/asiento_b.glb',
    ];

    const tryLoad = (idx: number) => {
      if (idx >= candidateUrls.length) {
        console.warn('Could not load asiento_b GLB from candidate paths');
        return;
      }
      loader.load(
        candidateUrls[idx],
        (gltf) => {
          let sourceMesh: THREE.Mesh | null = null;
          gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh && !sourceMesh) {
              sourceMesh = child as THREE.Mesh;
            }
          });

          if (!sourceMesh) return;

          // 1. Prepare Seat Geometry: center, ground alignment, rotate facing -Z, scale to real human chair
          const rawGeo = (sourceMesh as THREE.Mesh).geometry.clone();
          gltf.scene.updateMatrixWorld(true);
          (sourceMesh as THREE.Mesh).updateMatrixWorld(true);
          rawGeo.applyMatrix4((sourceMesh as THREE.Mesh).matrixWorld);
          rawGeo.center();
          rawGeo.computeBoundingBox();
          if (rawGeo.boundingBox) {
            rawGeo.translate(0, -rawGeo.boundingBox.min.y, 0);
          }
          // Rotate Y by +90 deg so seat cushion faces -Z (the stage) and backrest is at +Z
          rawGeo.rotateY(Math.PI / 2);
          // Scale to standard stadium chair (0.525m width x 0.829m height x 0.522m depth)
          rawGeo.scale(0.014, 0.014, 0.014);
          rawGeo.computeVertexNormals();
          this.seatGeometry = rawGeo;

          // 2. Prepare Seat Material with PBR arena stadium coating
          const origMat = (sourceMesh as THREE.Mesh).material;
          const seatMat = (origMat instanceof THREE.MeshStandardMaterial)
            ? origMat.clone()
            : new THREE.MeshStandardMaterial({
                color: 0x142b47,
                roughness: 0.55,
                metalness: 0.25,
              });
          if (seatMat instanceof THREE.MeshStandardMaterial) {
            seatMat.color = new THREE.Color(0x10223d);
            seatMat.roughness = 0.55;
            seatMat.metalness = 0.25;
          }
          this.seatMaterial = seatMat;

          // 3. Generate seat placement transforms across all arena sectors
          const seatTransforms: { pos: THREE.Vector3; rotY: number }[] = [];

          // A. Campo Delantero / VIP Escenario (10 rows x 20 seats = 200 seats)
          for (let r = 1; r <= 10; r++) {
            const z = -46.0 - (r - 1) * 2.2;
            for (let s = 1; s <= 20; s++) {
              const x = (s - 10.5) * 1.1;
              seatTransforms.push({
                pos: new THREE.Vector3(x, 0.2, z),
                rotY: 0, // facing -Z (stage)
              });
            }
          }

          // A2. Planta Baja Trasera (8 rows x 18 seats = 144 seats, Z = -26 to -41, with center aisle)
          for (let r = 1; r <= 8; r++) {
            const z = -26.0 - (r - 1) * 2.0;
            for (let s = 1; s <= 18; s++) {
              const x = (s - 9.5) * 1.08;
              if (Math.abs(x) < 1.1) continue; // Central walkway
              seatTransforms.push({
                pos: new THREE.Vector3(x, 0.2, z),
                rotY: 0, // facing -Z (stage)
              });
            }
          }

          // B. Platea Baja (9 stepped rows on Left & Right stands)
          const sides = [-1, 1];
          sides.forEach((side) => {
            for (let r = 0; r < 9; r++) {
              const stepY = 0.2 + (r + 1) * 0.58;
              const treadX = side * (16.0 + r * 1.22 + 0.65);
              const angle = side < 0 ? Math.PI / 12 : -Math.PI / 12;

              for (let z = -25; z >= -66; z -= 1.15) {
                // Skip vomitorios / access stairs
                if (Math.abs(z - (-23)) < 1.2 || Math.abs(z - (-40)) < 1.2 || Math.abs(z - (-58)) < 1.2) {
                  continue;
                }
                seatTransforms.push({
                  pos: new THREE.Vector3(treadX, stepY, z),
                  rotY: angle,
                });
              }
            }

            // C. Platea Alta & Tribunas (9 upper stepped rows on Left & Right stands)
            for (let ur = 0; ur < 9; ur++) {
              const upperStepY = 5.6 + (ur + 1) * 0.95;
              const upperTreadX = side * (27.0 + ur * 1.33 + 0.7);
              const angle = side < 0 ? Math.PI / 9 : -Math.PI / 9;

              for (let z = -26; z >= -65; z -= 1.15) {
                if (Math.abs(z - (-23)) < 1.2 || Math.abs(z - (-40)) < 1.2 || Math.abs(z - (-58)) < 1.2) {
                  continue;
                }
                seatTransforms.push({
                  pos: new THREE.Vector3(upperTreadX, upperStepY, z),
                  rotY: angle,
                });
              }
            }

            // D. Cabecera (Rear Tiered Stands, Z = -22 to -6)
            for (let cr = 0; cr < 6; cr++) {
              const cabeceraY = 0.2 + (cr + 1) * 0.72;
              const cabeceraZ = -22.0 + (cr + 1) * 2.3;
              for (let xOff = 11.0; xOff <= 27.0; xOff += 1.15) {
                seatTransforms.push({
                  pos: new THREE.Vector3(side * xOff, cabeceraY, cabeceraZ - 1.15),
                  rotY: 0,
                });
              }
            }
          });

          // 4. Populate allSeatPositions for free sitting mode when venue is empty
          this.allSeatPositions = seatTransforms.map((st, i) => {
            let label = `Asiento ${i + 1}`;
            if (st.pos.z <= -45.0 && Math.abs(st.pos.x) <= 15.0) {
              const r = Math.round((-st.pos.z - 46.0) / 2.2) + 1;
              label = `Campo Delantero / VIP (Fila ${r})`;
            } else if (st.pos.z <= -24.0 && st.pos.z > -45.0 && Math.abs(st.pos.x) <= 15.0) {
              const r = Math.round((-st.pos.z - 26.0) / 2.0) + 1;
              label = `Planta Baja Trasera (Fila ${r})`;
            } else if (Math.abs(st.pos.x) >= 27.0) {
              label = `Platea Alta / Tribuna (${st.pos.x > 0 ? 'Sector Este' : 'Sector Oeste'})`;
            } else if (Math.abs(st.pos.x) >= 15.0) {
              label = `Platea Baja (${st.pos.x > 0 ? 'Sector Este' : 'Sector Oeste'})`;
            } else {
              label = `Cabecera Posterior`;
            }
            return { pos: st.pos.clone(), rotY: st.rotY, label };
          });

          // 5. Create InstancedMesh for All Base Scenario Seats
          const count = seatTransforms.length;
          const instancedMesh = new THREE.InstancedMesh(rawGeo, seatMat, count);
          instancedMesh.castShadow = true;
          instancedMesh.receiveShadow = true;

          const dummy = new THREE.Object3D();
          for (let i = 0; i < count; i++) {
            const st = seatTransforms[i];
            dummy.position.copy(st.pos);
            dummy.rotation.set(0, st.rotY, 0);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
          }
          instancedMesh.instanceMatrix.needsUpdate = true;

          this.seatsInstancedMesh = instancedMesh;
          this.scene.add(instancedMesh);
          this.areSeatsLoaded = true;

          // 5. Dedicated Interactive Target Seat Model for Current User Ticket
          const targetMat = new THREE.MeshStandardMaterial({
            color: 0x00d4ff,
            emissive: 0x006699,
            emissiveIntensity: 0.9,
            roughness: 0.3,
            metalness: 0.4,
          });
          const targetSeat = new THREE.Mesh(rawGeo, targetMat);
          targetSeat.position.copy(this.targetSeatCoords.position);
          const dir = new THREE.Vector3().subVectors(this.targetSeatCoords.lookTarget, this.targetSeatCoords.position);
          targetSeat.rotation.y = Math.atan2(-dir.x, -dir.z);
          targetSeat.castShadow = true;

          this.targetSeatMesh = targetSeat;
          this.scene.add(targetSeat);
        },
        undefined,
        () => {
          tryLoad(idx + 1);
        }
      );
    };

    tryLoad(0);
  }

  // --- 5. Updated Calle Humboldt (Harmonized, Realistic Asphalt & Curbs) ---
  private buildUpdatedCalleHumboldt(): void {
    // Street Group spanning across Z = 5.0 to 35.0, X = -70 to +70
    const streetGroup = new THREE.Group();

    // 1. High-Fidelity Asphalt Avenue Ground (No artificial repeating squares)
    const asphaltTex = createAsphaltTexture();
    const avenueGeo = new THREE.PlaneGeometry(140, 30);
    avenueGeo.rotateX(-Math.PI / 2);
    const avenueMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.84,
      metalness: 0.12,
    });
    const avenue = new THREE.Mesh(avenueGeo, avenueMat);
    avenue.position.set(0, 0.0, 20.0);
    avenue.receiveShadow = true;
    streetGroup.add(avenue);

    // 2. Pedestrian Sidewalk Plaza in front of Arena Facade (Z = -4.73 to 5.0)
    const plazaFloorTex = createConcreteFloorTexture();
    const plazaGeo = new THREE.PlaneGeometry(140, 9.73);
    plazaGeo.rotateX(-Math.PI / 2);
    const plazaMat = new THREE.MeshStandardMaterial({
      map: plazaFloorTex,
      roughness: 0.58,
      metalness: 0.18,
    });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.set(0, 0.04, 0.135);
    plaza.receiveShadow = true;
    streetGroup.add(plaza);

    // 2b. Solid Concrete Curb Stone (Cordón de Calle) separating sidewalk from street at Z = 5.0
    const curbGeo = new THREE.BoxGeometry(140, 0.14, 0.3);
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0x7c8594,
      roughness: 0.72,
      metalness: 0.15,
    });
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(0, 0.07, 5.0);
    streetGroup.add(curb);

    // 2c. Storm Drains & Cast Iron Manhole Covers (Tapas de Alcantarilla / Desagüe Pluvial)
    const manholeMat = new THREE.MeshStandardMaterial({
      color: 0x1f2329,
      metalness: 0.82,
      roughness: 0.38,
    });
    const manholeGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.03, 18);
    [-28, -6, 18, 38].forEach((mx, idx) => {
      const mh = new THREE.Mesh(manholeGeo, manholeMat);
      mh.position.set(mx, 0.015, 12.0 + (idx % 2) * 11.0);
      streetGroup.add(mh);
    });

    // 3. Painted Crosswalks (Cebras Peatonales) leading into the gates
    const crosswalkMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      emissive: 0x333333,
    });

    [-12, 0, 12].forEach((cwX) => {
      for (let s = 0; s < 7; s++) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 5.0), crosswalkMat);
        stripe.rotateX(-Math.PI / 2);
        stripe.position.set(cwX + (s - 3) * 1.1, 0.02, 7.5);
        streetGroup.add(stripe);
      }
    });

    // 4. Yellow Center Road Lines (Doble Línea Amarilla Continua)
    const yellowLineMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      roughness: 0.4,
      emissive: 0x443300,
    });
    for (let lx = -60; lx <= 60; lx += 6) {
      const line1 = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.14), yellowLineMat);
      line1.rotateX(-Math.PI / 2);
      line1.position.set(lx, 0.02, 19.86);
      const line2 = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.14), yellowLineMat);
      line2.rotateX(-Math.PI / 2);
      line2.position.set(lx, 0.02, 20.14);
      streetGroup.add(line1, line2);
    }

    // 5. Modern Streetlamps along Calle Humboldt
    const lampPositions = [
      [-28, 16],
      [-14, 16],
      [0, 16],
      [14, 16],
      [28, 16],
      [-21, 28],
      [21, 28],
    ];

    lampPositions.forEach(([lx, lz]) => {
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 7.5, 8);
      poleGeo.translate(0, 3.75, 0);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a303c, metalness: 0.85, roughness: 0.25 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(lx, 0, lz);
      streetGroup.add(pole);

      // Lamp Head
      const lampHeadGeo = new THREE.BoxGeometry(1.2, 0.3, 0.6);
      const lampHeadMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfff0cc,
        emissiveIntensity: 2.2,
      });
      this.exteriorLampMaterials.push(lampHeadMat);
      const lampHead = new THREE.Mesh(lampHeadGeo, lampHeadMat);
      lampHead.position.set(lx, 7.5, lz);
      streetGroup.add(lampHead);

      // Light Cone
      const lampLight = new THREE.PointLight(0xfff0cc, 1.8, 26, 1.6);
      lampLight.position.set(lx, 7.2, lz);
      streetGroup.add(lampLight);
      this.streetLights.push(lampLight);
    });

    // 6. Queue Guiding Barriers (Vallas de acceso)
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
    for (let x = -18; x <= 18; x += 4.5) {
      const barrierGeo = new THREE.BoxGeometry(0.08, 1.1, 4.0);
      const barrier = new THREE.Mesh(barrierGeo, barrierMat);
      barrier.position.set(x, 0.55, 0.5);
      streetGroup.add(barrier);
    }

    // Note: Street sign and unneeded outdoor side block removed per specification
    this.scene.add(streetGroup);
  }

  // --- 5b. Starry Night Sky above Outdoor Venue (Stars & Twinkling) ---
  private buildStarryNightSky(): void {
    const starCount = 2000;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const starColorChoices = [
      new THREE.Color(0xffffff), // Pure diamond white
      new THREE.Color(0xdbeafe), // Light ice blue
      new THREE.Color(0x93c5fd), // Electric sky blue
      new THREE.Color(0xfef08a), // Pale warm gold
      new THREE.Color(0xfbcfe8), // Soft rose tint
      new THREE.Color(0xa5f3fc), // Cyan tint
    ];

    for (let i = 0; i < starCount; i++) {
      // Celestial dome distribution over outdoor street and entrance area
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0) * 0.46; // Upper celestial dome (14° to 85° above horizon)

      const radius = 95 + Math.random() * 45;
      const x = radius * Math.sin(phi) * Math.sin(theta);
      const y = Math.max(14.0, radius * Math.cos(phi));
      const z = 22.0 + radius * Math.sin(phi) * Math.cos(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const col = starColorChoices[Math.floor(Math.random() * starColorChoices.length)];
      const brightness = 0.75 + Math.random() * 0.25;
      colors[i * 3] = col.r * brightness;
      colors[i * 3 + 1] = col.g * brightness;
      colors[i * 3 + 2] = col.b * brightness;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starTex = createStarTexture();
    const starMat = new THREE.PointsMaterial({
      size: 1.8,
      map: starTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false, // Ensures stars remain brilliant against the deep night sky
    });

    this.starsMesh = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starsMesh);

    // Glowing Crescent Moon with Atmospheric Corona
    const moonTex = createMoonTexture();
    const moonGeo = new THREE.PlaneGeometry(16, 16);
    const moonMat = new THREE.MeshBasicMaterial({
      map: moonTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonMesh.position.set(38, 52, 60);
    this.moonMesh.lookAt(0, 1.6, 20); // Aimed down toward Calle Humboldt
    this.scene.add(this.moonMesh);
  }

  // --- 7. Internal House Lights (Luces que mantengan iluminado el interior y las gradas) ---
  private setupInternalHouseLights(): void {
    // Ceiling House Floodlights suspended under the dome (Y = 22m)
    const domePositions = [
      { x: 0, y: 22, z: -25, color: 0xeef4ff, intensity: 2.2, dist: 65 },
      { x: -16, y: 22, z: -50, color: 0xe0eaff, intensity: 2.0, dist: 60 },
      { x: 16, y: 22, z: -50, color: 0xe0eaff, intensity: 2.0, dist: 60 },
      { x: 0, y: 22, z: -55, color: 0xffeedd, intensity: 2.4, dist: 70 },
      { x: 0, y: 21, z: -75, color: 0xfff6ea, intensity: 2.5, dist: 55 },
      { x: 0, y: 19, z: -86, color: 0xddeeff, intensity: 2.0, dist: 45 },
    ];

    domePositions.forEach((dp) => {
      const houseLight = new THREE.PointLight(dp.color, dp.intensity, dp.dist, 1.4);
      houseLight.position.set(dp.x, dp.y, dp.z);
      this.scene.add(houseLight);
      this.houseLights.push(houseLight);

      // High-bay light fixture mesh
      const fixtureGeo = new THREE.CylinderGeometry(0.8, 1.2, 0.4, 12);
      const fixtureMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: dp.color,
        emissiveIntensity: 2.0,
      });
      this.houseFixtureMaterials.push(fixtureMat);
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(dp.x, dp.y + 0.2, dp.z);
      this.scene.add(fixture);
    });

    // Foyer / Concourse Downlights along the entrance gates (Y = 4.2m, Z = -7.5m)
    [-15, -9, -3, 3, 9, 15].forEach((fx) => {
      const foyerLight = new THREE.PointLight(0xfffae8, 1.5, 18, 1.8);
      foyerLight.position.set(fx, 4.2, -7.5);
      this.scene.add(foyerLight);
      this.foyerLights.push(foyerLight);

      const lampTrim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.1, 10),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffae8, emissiveIntensity: 1.8 })
      );
      lampTrim.position.set(fx, 4.2, -7.5);
      this.scene.add(lampTrim);
    });

    // 4 Raking / Grazing Arena Spotlights aimed at 45° across the seating tiers
    // Highlights the horizontal row treads while casting deep shadows on the vertical risers
    const rakingSpotConfigs = [
      { pos: new THREE.Vector3(-14, 18.5, -30), target: new THREE.Vector3(-25, 4.0, -30) },
      { pos: new THREE.Vector3(-14, 18.5, -52), target: new THREE.Vector3(-25, 4.0, -52) },
      { pos: new THREE.Vector3(14, 18.5, -30), target: new THREE.Vector3(25, 4.0, -30) },
      { pos: new THREE.Vector3(14, 18.5, -52), target: new THREE.Vector3(25, 4.0, -52) },
    ];

    rakingSpotConfigs.forEach((cfg) => {
      const spot = new THREE.SpotLight(0xfff6ea, 4.5, 60, Math.PI / 3.2, 0.5, 1.0);
      spot.position.copy(cfg.pos);
      spot.target.position.copy(cfg.target);
      this.scene.add(spot);
      this.scene.add(spot.target);
      this.tieredRakingLights.push(spot);
    });

    // 6 Aisle Stairway Overhead Downlight Spotlights
    // Accentuates the ascending staircase paths cutting through the stands
    [-22, -40, -58].forEach((az) => {
      [-23, 23].forEach((ax) => {
        const stairSpot = new THREE.SpotLight(0xd8eeff, 3.5, 38, Math.PI / 4.2, 0.45, 1.1);
        stairSpot.position.set(ax * 0.72, 16.5, az);
        stairSpot.target.position.set(ax, 3.2, az);
        this.scene.add(stairSpot);
        this.scene.add(stairSpot.target);
        this.tieredRakingLights.push(stairSpot);
      });
    });
  }

  // --- 8. Dynamic Stage Moving Head Spotlights & Lasers ---
  private setupDynamicStageLights(): void {
    const spotColors = [
      new THREE.Color(0x00f0ff), // Cyan
      new THREE.Color(0xff0066), // Magenta
      new THREE.Color(0x7700ff), // Purple
      new THREE.Color(0x00ff88), // Emerald Green
      new THREE.Color(0xffaa00), // Amber
      new THREE.Color(0x00aaff), // Movistar Blue
      new THREE.Color(0xff3300), // Crimson
      new THREE.Color(0xffffff), // White
    ];

    const spotXPositions = [-15, -10, -5, -1.5, 1.5, 5, 10, 15];

    spotXPositions.forEach((x, idx) => {
      const color = spotColors[idx % spotColors.length];
      const spot = new THREE.SpotLight(color, 3.2, 85, Math.PI / 6.5, 0.35, 1.2);
      spot.position.set(x, 15.0, -78);

      const target = new THREE.Object3D();
      target.position.set(x * 0.7, 1.2, -50);
      this.scene.add(target);
      spot.target = target;
      this.scene.add(spot);

      // Volumetric beam cone
      const coneGeo = new THREE.ConeGeometry(4.2, 45, 16, 1, true);
      coneGeo.translate(0, -22.5, 0);
      coneGeo.rotateX(Math.PI / 2);
      const coneMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(spot.position);
      cone.lookAt(target.position);
      this.scene.add(cone);

      this.movingSpots.push({
        light: spot,
        target,
        cone,
        basePos: new THREE.Vector3(x, 15, -78),
        speed: 1.3 + idx * 0.2,
        phase: idx * 0.8,
        color,
      });
    });

    // Stage wash ambient colored lights
    [-12, -4, 4, 12].forEach((x, i) => {
      const wash = new THREE.PointLight(spotColors[i * 2], 2.2, 35);
      wash.position.set(x, 5.5, -80);
      this.scene.add(wash);
      this.stageWashLights.push(wash);
    });
  }

  private setupLaserBeams(): THREE.LineSegments {
    const points: number[] = [];
    const laserCount = 24;
    const originY = 16;
    const originZ = -79;

    for (let i = 0; i < laserCount; i++) {
      const originX = (i / laserCount - 0.5) * 28;
      points.push(originX, originY, originZ);
      points.push(originX * 1.6, 2, -35);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const lines = new THREE.LineSegments(geo, mat);
    this.scene.add(lines);
    return lines;
  }

  // --- 9. Stage Platform & Band Equipment for Stage Tour ---
  private buildStageExplorationArea(): void {
    const stageGroup = new THREE.Group();

    // 1. Stage Platform (Z = -72 to -88, Width 34m, Height 1.8m)
    const stageFloorGeo = new THREE.BoxGeometry(34, 1.8, 16);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x141822,
      metalness: 0.7,
      roughness: 0.3,
    });
    const stageFloor = new THREE.Mesh(stageFloorGeo, stageMat);
    stageFloor.position.set(0, 0.9, -80);
    stageGroup.add(stageFloor);

    // Stage Edge Glowing LED Strip
    const edgeStrip = new THREE.Mesh(
      new THREE.BoxGeometry(34, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    edgeStrip.position.set(0, 1.8, -72);
    stageGroup.add(edgeStrip);

    // Left and Right Access Ramps (Z = -69 to -72)
    [-15, 15].forEach((rx) => {
      const rampGeo = new THREE.BoxGeometry(3.5, 0.25, 4.0);
      const ramp = new THREE.Mesh(rampGeo, stageMat);
      ramp.position.set(rx, 0.95, -70.5);
      ramp.rotation.x = 0.42; // Inclined ramp up to stage level
      stageGroup.add(ramp);
    });

    // 2. DJ Mixer Console & Synthesizer Station (Center Stage)
    const djBoothGeo = new THREE.BoxGeometry(3.2, 1.1, 1.2);
    const djBoothMat = new THREE.MeshStandardMaterial({ color: 0x0d111a, metalness: 0.9, roughness: 0.2 });
    const djBooth = new THREE.Mesh(djBoothGeo, djBoothMat);
    djBooth.position.set(0, 2.35, -79);
    stageGroup.add(djBooth);

    // Glowing Equalizer Display on DJ Booth
    const djDisplay = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x00ffcc })
    );
    djDisplay.position.set(0, 2.45, -78.38);
    stageGroup.add(djDisplay);

    // Microphones & Stands
    [-3, 0, 3].forEach((mx) => {
      const standPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 1.5, 8),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.1 })
      );
      standPole.position.set(mx, 2.55, -75);
      stageGroup.add(standPole);

      const micHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
      );
      micHead.position.set(mx, 3.3, -75);
      stageGroup.add(micHead);
    });

    // Stage Foldback Audio Monitors (Cuñas de retorno)
    [-6, -2, 2, 6].forEach((wx) => {
      const wedgeGeo = new THREE.BoxGeometry(1.0, 0.45, 0.7);
      const wedgeMat = new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.8 });
      const wedge = new THREE.Mesh(wedgeGeo, wedgeMat);
      wedge.position.set(wx, 2.0, -74);
      wedge.rotation.x = -0.35;
      stageGroup.add(wedge);
    });

    // Stage Overhead Truss Columns & Horizontal Beams
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x5a6375, metalness: 0.9, roughness: 0.25 });
    [-16, 16].forEach((tx) => {
      const trussCol = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 18, 8), trussMat);
      trussCol.position.set(tx, 9, -78);
      stageGroup.add(trussCol);
    });

    const crossTruss = new THREE.Mesh(new THREE.BoxGeometry(34, 0.7, 0.7), trussMat);
    crossTruss.position.set(0, 17.5, -78);
    stageGroup.add(crossTruss);

    this.scene.add(stageGroup);
  }

  // --- 9b. Master Stage & Lighting Control Rack (Under main screen at Z = -83.7) ---
  private buildStageControlRack(): void {
    const rackGroup = new THREE.Group();
    rackGroup.position.copy(this.stageSwitchCoords); // (0, 2.35, -83.7)

    // 1. Heavy-duty brushed steel rack chassis
    const chassisGeo = new THREE.BoxGeometry(2.7, 1.15, 0.28);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x18202f,
      metalness: 0.88,
      roughness: 0.25,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.castShadow = true;
    rackGroup.add(chassis);

    // Front control panel faceplate
    const faceplateGeo = new THREE.BoxGeometry(2.55, 1.05, 0.04);
    const faceplateMat = new THREE.MeshStandardMaterial({
      color: 0x0c121e,
      metalness: 0.92,
      roughness: 0.18,
    });
    const faceplate = new THREE.Mesh(faceplateGeo, faceplateMat);
    faceplate.position.set(0, 0, 0.145);
    rackGroup.add(faceplate);

    // Glowing Header Sign: "PANEL DE CONTROL DE ESCENARIO"
    const headerCanvas = document.createElement('canvas');
    headerCanvas.width = 1024;
    headerCanvas.height = 128;
    const hCtx = headerCanvas.getContext('2d')!;
    hCtx.fillStyle = '#060a14';
    hCtx.fillRect(0, 0, 1024, 128);
    hCtx.strokeStyle = '#00f0ff';
    hCtx.lineWidth = 6;
    hCtx.strokeRect(6, 6, 1012, 116);
    hCtx.fillStyle = '#00f0ff';
    hCtx.font = 'bold 44px system-ui, sans-serif';
    hCtx.textAlign = 'center';
    hCtx.fillText('★ INTERRUPTORES DE ESCENARIO ★', 512, 54);
    hCtx.font = '600 28px system-ui, sans-serif';
    hCtx.fillStyle = '#94a3b8';
    hCtx.fillText('LUCES • PANTALLAS • GIF EN PANTALLA', 512, 98);

    const headerTex = new THREE.CanvasTexture(headerCanvas);
    headerTex.colorSpace = THREE.SRGBColorSpace;
    const headerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.35),
      new THREE.MeshBasicMaterial({ map: headerTex })
    );
    headerMesh.position.set(0, 0.34, 0.17);
    rackGroup.add(headerMesh);

    // Switch stations:
    // 1. Stage Lights (X = -0.75)
    // 2. Stage Screens (X = 0.0)
    // 3. GIF Transmission (X = +0.75)
    const switchBezelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.95, roughness: 0.15 });

    // LED Materials
    this.switchLightLedMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00e676,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    this.switchScreenLedMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x00b0ff,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    this.switchGifLedMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      emissive: 0x334155,
      emissiveIntensity: 0.4,
      roughness: 0.5,
    });

    const stations = [
      { x: -0.75, label: 'LUCES', ledMat: this.switchLightLedMat, colorText: '#00ff88' },
      { x: 0.0, label: 'PANTALLAS', ledMat: this.switchScreenLedMat, colorText: '#00d4ff' },
      { x: 0.75, label: 'GIF PANTALLA', ledMat: this.switchGifLedMat, colorText: '#e879f9' },
    ];

    stations.forEach((st) => {
      // Station Bezel
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.48, 0.05), switchBezelMat);
      bezel.position.set(st.x, -0.12, 0.17);
      rackGroup.add(bezel);

      // Station Text Label
      const lblCanvas = document.createElement('canvas');
      lblCanvas.width = 256;
      lblCanvas.height = 128;
      const lCtx = lblCanvas.getContext('2d')!;
      lCtx.fillStyle = '#0f172a';
      lCtx.fillRect(0, 0, 256, 128);
      lCtx.fillStyle = st.colorText;
      lCtx.font = 'bold 34px system-ui, sans-serif';
      lCtx.textAlign = 'center';
      lCtx.fillText(st.label, 128, 52);
      lCtx.fillStyle = '#cbd5e1';
      lCtx.font = '24px system-ui, sans-serif';
      lCtx.fillText('ON / OFF', 128, 98);

      const lblTex = new THREE.CanvasTexture(lblCanvas);
      lblTex.colorSpace = THREE.SRGBColorSpace;
      const lblMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.2),
        new THREE.MeshBasicMaterial({ map: lblTex })
      );
      lblMesh.position.set(st.x, -0.06, 0.20);
      rackGroup.add(lblMesh);

      // Push button
      const button = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 })
      );
      button.rotateX(Math.PI / 2);
      button.position.set(st.x, -0.22, 0.20);
      rackGroup.add(button);

      // Indicator LED jewel
      const ledJewel = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 12, 12),
        st.ledMat
      );
      ledJewel.position.set(st.x, -0.22, 0.23);
      rackGroup.add(ledJewel);
    });

    this.scene.add(rackGroup);
  }

  public setStageLights(on: boolean): void {
    this.stageLightsManualOn = on;
    if (this.switchLightLedMat) {
      this.switchLightLedMat.color.setHex(on ? 0x00ff88 : 0xef4444);
      this.switchLightLedMat.emissive.setHex(on ? 0x00e676 : 0xb91c1c);
      this.switchLightLedMat.emissiveIntensity = on ? 2.2 : 1.4;
    }
  }

  public setStageScreens(on: boolean): void {
    this.stageScreensManualOn = on;
    if (this.switchScreenLedMat) {
      this.switchScreenLedMat.color.setHex(on ? 0x00d4ff : 0x475569);
      this.switchScreenLedMat.emissive.setHex(on ? 0x00b0ff : 0x1e293b);
      this.switchScreenLedMat.emissiveIntensity = on ? 2.2 : 0.2;
    }
    if (this.mainLedScreenMesh) this.mainLedScreenMesh.visible = on;
    if (this.jumbotronMeshLeft) this.jumbotronMeshLeft.visible = on;
    if (this.jumbotronMeshRight) this.jumbotronMeshRight.visible = on;
  }

  public setGifScreenActive(on: boolean, isRhythmicPreview = false): void {
    this.gifScreenManualActive = on;
    this.isGifRhythmicFadeActive = isRhythmicPreview;
    if (this.switchGifLedMat) {
      this.switchGifLedMat.color.setHex(on ? 0xe879f9 : 0x475569);
      this.switchGifLedMat.emissive.setHex(on ? 0xd946ef : 0x1e293b);
      this.switchGifLedMat.emissiveIntensity = on ? 2.4 : 0.2;
    }
    if (on) {
      this.activateCustomMediaOnScreen();
    } else {
      this.resetScreenToDefault();
    }
  }

  // --- Front Architectural Wall & Facade for Movistar Arena ---
  private buildFrontVenueFacade(): void {
    const facadeGroup = new THREE.Group();
    const facadeTex = createArenaFacadeTexture();

    // Metallic architectural composite panel material
    const wallMat = new THREE.MeshStandardMaterial({
      map: facadeTex,
      color: 0x222a36,
      metalness: 0.75,
      roughness: 0.35,
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x11161f,
      metalness: 0.85,
      roughness: 0.25,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x486581,
      transparent: true,
      opacity: 0.55,
      metalness: 0.9,
      roughness: 0.1,
    });

    const neonCyanMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x00bfff,
      emissiveIntensity: 2.5,
    });
    this.neonMaterials.push(neonCyanMat);

    const zFront = -4.73; // Alignment with entrance gates
    const wallHeight = 22.0;

    // 1. Left Front Wall Wing (X = -48 to -18.7, width 29.3m, height 22m, depth 1.2m)
    const leftWallGeo = new THREE.BoxGeometry(29.3, wallHeight, 1.2);
    const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
    leftWall.position.set(-33.35, wallHeight / 2, zFront);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    facadeGroup.add(leftWall);

    // 2. Right Front Wall Wing (X = +18.7 to +48, width 29.3m, height 22m, depth 1.2m)
    const rightWallGeo = new THREE.BoxGeometry(29.3, wallHeight, 1.2);
    const rightWall = new THREE.Mesh(rightWallGeo, wallMat);
    rightWall.position.set(33.35, wallHeight / 2, zFront);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    facadeGroup.add(rightWall);

    // 3. Central Upper Wall Lintel (above all 16 entrance gates, from Y = 4.2 to 22.0, height 17.8m, width 37.4m)
    const upperWallHeight = wallHeight - 4.2;
    const upperWallGeo = new THREE.BoxGeometry(37.4, upperWallHeight, 1.2);
    const upperWall = new THREE.Mesh(upperWallGeo, wallMat);
    upperWall.position.set(0, 4.2 + upperWallHeight / 2, zFront);
    upperWall.castShadow = true;
    upperWall.receiveShadow = true;
    facadeGroup.add(upperWall);

    // 4. Glass Transom Band directly above the entrance gates (Y = 3.3 to 4.2, width 37.4m)
    const transomGeo = new THREE.BoxGeometry(37.4, 0.9, 0.4);
    const transom = new THREE.Mesh(transomGeo, glassMat);
    transom.position.set(0, 3.75, zFront);
    facadeGroup.add(transom);

    // 5. Left and Right Return Side Walls (giving the arena full 3D cubic enclosure)
    const sideWallGeo = new THREE.BoxGeometry(1.2, wallHeight, 35);
    const leftSideWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftSideWall.position.set(-48, wallHeight / 2, zFront - 17.5);
    const rightSideWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightSideWall.position.set(48, wallHeight / 2, zFront - 17.5);
    facadeGroup.add(leftSideWall, rightSideWall);

    // 6. Architectural Entrance Canopy / Marquee Cantilever (projecting over queue area on Calle Humboldt)
    const canopyGeo = new THREE.BoxGeometry(42.0, 0.4, 3.8);
    const canopy = new THREE.Mesh(canopyGeo, darkTrimMat);
    canopy.position.set(0, 4.35, zFront + 1.9);
    facadeGroup.add(canopy);

    // Glowing Cyan underside trim on canopy
    const canopyTrimGeo = new THREE.BoxGeometry(42.2, 0.08, 0.1);
    const canopyTrim = new THREE.Mesh(canopyTrimGeo, neonCyanMat);
    canopyTrim.position.set(0, 4.18, zFront + 3.8);
    facadeGroup.add(canopyTrim);

    // Downlights under canopy (accent lights illuminating entrance turnstiles)
    for (let x = -18; x <= 18; x += 6) {
      const downlight = new THREE.PointLight(0xbbeeff, 1.2, 8, 1.2);
      downlight.position.set(x, 4.1, zFront + 1.5);
      facadeGroup.add(downlight);
      this.facadeLights.push(downlight);
    }

    // 7. Roof Parapet & Top Architectural Fascia
    const roofFasciaGeo = new THREE.BoxGeometry(98.0, 1.2, 1.8);
    const roofFascia = new THREE.Mesh(roofFasciaGeo, darkTrimMat);
    roofFascia.position.set(0, wallHeight + 0.6, zFront);
    facadeGroup.add(roofFascia);

    // 8. Horizontal Glowing LED Accent Lines across the upper facade
    [8.0, 12.0, 17.0, 21.8].forEach((ly) => {
      const lineGeo = new THREE.BoxGeometry(96.0, 0.1, 0.15);
      const lineMesh = new THREE.Mesh(lineGeo, neonCyanMat);
      lineMesh.position.set(0, ly, zFront + 0.62);
      facadeGroup.add(lineMesh);
    });

    // 9. Massive Glowing MOVISTAR ARENA Signage
    const logoTex = createNeonSignTexture('MOVISTAR ARENA', 'BUENOS AIRES • HUMBOLDT 450', '#00d4ff');
    const logoMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 5.5),
      new THREE.MeshBasicMaterial({ map: logoTex, transparent: true })
    );
    logoMesh.position.set(0, 15.0, zFront + 0.65);
    facadeGroup.add(logoMesh);

    // 10. Electronic LED Ticker Screen above the entrance canopy
    const tickerCanvas = document.createElement('canvas');
    tickerCanvas.width = 1024;
    tickerCanvas.height = 128;
    const tCtx = tickerCanvas.getContext('2d')!;
    tCtx.fillStyle = '#060911';
    tCtx.fillRect(0, 0, 1024, 128);
    tCtx.fillStyle = '#00f0ff';
    tCtx.font = 'bold 44px system-ui, sans-serif';
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';
    tCtx.fillText('★ SYNTHWAVE LIVE 2026 ★ ACCESO PUERTAS 1 A 16 ★ HOY 21:00 HS', 512, 64);
    const tickerTex = new THREE.CanvasTexture(tickerCanvas);
    tickerTex.colorSpace = THREE.SRGBColorSpace;
    const tickerMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 2.2),
      new THREE.MeshBasicMaterial({ map: tickerTex })
    );
    tickerMesh.position.set(0, 6.2, zFront + 0.65);
    facadeGroup.add(tickerMesh);

    // Metallic composite architectural material for enclosure walls and bulkheads
    const flankWallMat = new THREE.MeshStandardMaterial({
      color: 0x1b2330,
      metalness: 0.85,
      roughness: 0.3,
    });

    // 11. Concourse Entrance Ceiling (TRIMMED IN CORNERS TO PREVENT OBSTRUCTING SEATS)
    // A. Doorway Vestibule Ceiling (covers only the immediate entrance area: Z = -4.73 to -7.0, X = -18.7 to +18.7)
    const vestibuleCeilingGeo = new THREE.PlaneGeometry(37.4, 2.27);
    vestibuleCeilingGeo.rotateX(Math.PI / 2);
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.8 });
    const vestibuleCeiling = new THREE.Mesh(vestibuleCeilingGeo, ceilingMat);
    vestibuleCeiling.position.set(0, 4.4, zFront - 1.135);
    facadeGroup.add(vestibuleCeiling);

    // B. Central Corridor Ceiling (Z = -7.0 to -22.0, width 20.0m: X = -10.0 to +10.0, height 5.2m)
    // Corners (|X| > 10.0m) are TRIMMED OUT completely, leaving the stands & seats open to the arena ceiling without obstruction!
    const centralCeilingGeo = new THREE.PlaneGeometry(20.0, 15.0);
    centralCeilingGeo.rotateX(Math.PI / 2);
    const centralCeiling = new THREE.Mesh(centralCeilingGeo, ceilingMat);
    centralCeiling.position.set(0, 5.2, -14.5);
    facadeGroup.add(centralCeiling);

    // C. Vertical Bulkhead Transitions & Filler Walls (Covering empty spaces caused by trimming):
    // Bulkhead soffit connector at Z = -7.0 between Y = 4.4 and Y = 5.2 across the central walkway
    const bulkheadCenterGeo = new THREE.BoxGeometry(20.0, 0.8, 0.3);
    const bulkheadCenter = new THREE.Mesh(bulkheadCenterGeo, flankWallMat);
    bulkheadCenter.position.set(0, 4.8, -7.0);
    facadeGroup.add(bulkheadCenter);

    // Bulkhead partition walls at Z = -7.0 above vestibule corners (X = -18.7 to -10, and X = +10 to +18.7, Y = 0 to 4.4m)
    // Neatly closes the entrance vestibule edges before the stands begin
    [-14.35, 14.35].forEach((bx) => {
      const cornerWallGeo = new THREE.BoxGeometry(8.7, 4.4, 0.35);
      const cornerWall = new THREE.Mesh(cornerWallGeo, flankWallMat);
      cornerWall.position.set(bx, 2.2, -7.0);
      facadeGroup.add(cornerWall);
    });

    // Rear acoustic filler back walls behind the Cabecera stands (Z = -4.9, X = -28.4 to -18.7 and +18.7 to +28.4)
    // Covers the empty rear void behind the top seating rows up to Y = 10.0m!
    [-23.55, 23.55].forEach((rx) => {
      const rearCornerBackWallGeo = new THREE.BoxGeometry(9.7, 10.0, 0.45);
      const rearCornerBackWall = new THREE.Mesh(rearCornerBackWallGeo, flankWallMat);
      rearCornerBackWall.position.set(rx, 5.0, -4.9);
      facadeGroup.add(rearCornerBackWall);
    });

    // 12. Architectural Facade Ground Uplights
    [-30, -10, 10, 30].forEach((ux) => {
      const uplight = new THREE.SpotLight(0x00bfff, 3.5, 25, Math.PI / 6, 0.4, 1.2);
      uplight.position.set(ux, 0.2, zFront + 2.5);
      uplight.target.position.set(ux, 15, zFront);
      facadeGroup.add(uplight);
      facadeGroup.add(uplight.target);
      this.facadeLights.push(uplight);
    });

    // 13. Exterior Entrance Flank Security Walls (Z = -4.73 to Z = 5.0, at X = -19.0 and X = +19.0)
    // Prevents walking off the entrance plaza into void and grounds the access perimeter
    const flankWallGeo = new THREE.BoxGeometry(0.5, 3.6, 9.73);
    const leftFlankWall = new THREE.Mesh(flankWallGeo, flankWallMat);
    leftFlankWall.position.set(-19.0, 1.8, 0.135);
    leftFlankWall.castShadow = true;
    leftFlankWall.receiveShadow = true;
    facadeGroup.add(leftFlankWall);

    const rightFlankWall = new THREE.Mesh(flankWallGeo, flankWallMat);
    rightFlankWall.position.set(19.0, 1.8, 0.135);
    rightFlankWall.castShadow = true;
    rightFlankWall.receiveShadow = true;
    facadeGroup.add(rightFlankWall);

    // Glowing Cyan LED accent strips along the exterior flank wall top
    const flankLedGeo = new THREE.BoxGeometry(0.52, 0.08, 9.73);
    const leftFlankLed = new THREE.Mesh(flankLedGeo, neonCyanMat);
    leftFlankLed.position.set(-19.0, 3.62, 0.135);
    const rightFlankLed = new THREE.Mesh(flankLedGeo, neonCyanMat);
    rightFlankLed.position.set(19.0, 3.62, 0.135);
    facadeGroup.add(leftFlankLed, rightFlankLed);

    // 14. Full-Height Interior Hallway Side Enclosure Walls (Z = -4.73 to Z = -22.0, at X = -28.4 and X = +28.4, height 18.0m)
    const insideFlankGeo = new THREE.BoxGeometry(0.8, 18.0, 17.27);
    const leftInsideWall = new THREE.Mesh(insideFlankGeo, flankWallMat);
    leftInsideWall.position.set(-28.4, 9.0, -13.365);
    leftInsideWall.castShadow = true;
    leftInsideWall.receiveShadow = true;
    const rightInsideWall = new THREE.Mesh(insideFlankGeo, flankWallMat);
    rightInsideWall.position.set(28.4, 9.0, -13.365);
    rightInsideWall.castShadow = true;
    rightInsideWall.receiveShadow = true;
    facadeGroup.add(leftInsideWall, rightInsideWall);

    this.scene.add(facadeGroup);
  }

  // --- 10. 16 Entrance Gate Portals & Signage ---
  private buildEntranceGatePortals(): void {
    const gatesGroup = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x242c38, metalness: 0.85, roughness: 0.3 });
    const greenLedMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

    // 16 Doors centered at Z = -4.73, X from -16.45 to +18.46
    for (let i = 1; i <= 16; i++) {
      const gx = -17.5 + (i - 0.5) * 2.3;
      const gateArch = new THREE.Group();
      gateArch.position.set(gx, 0, -4.73);

      // Arch Posts
      const postL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.2), frameMat);
      postL.position.set(-1.0, 1.6, 0);
      const postR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.2), frameMat);
      postR.position.set(1.0, 1.6, 0);
      gateArch.add(postL, postR);

      // Top Header
      const header = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.45, 0.25), frameMat);
      header.position.set(0, 3.2, 0);
      gateArch.add(header);

      // Glowing Green Status Bar
      const statusBar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.1), greenLedMat);
      statusBar.position.set(0, 3.0, 0.12);
      gateArch.add(statusBar);

      // Gate Number Label Canvas
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 256;
      labelCanvas.height = 128;
      const ctx = labelCanvas.getContext('2d')!;
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = '#00f0ff';
      ctx.font = 'bold 50px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P ${i}`, 128, 55);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 24px system-ui, sans-serif';
      ctx.fillText(i <= 2 ? 'VIP' : i <= 6 ? 'PLAT BAJA' : i <= 11 ? 'PLAT ALTA' : 'TRIBUNA', 128, 100);

      const labelTex = new THREE.CanvasTexture(labelCanvas);
      labelTex.colorSpace = THREE.SRGBColorSpace;
      const signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.8),
        new THREE.MeshBasicMaterial({ map: labelTex, transparent: true })
      );
      signMesh.position.set(0, 3.8, 0.15);
      gateArch.add(signMesh);

      gatesGroup.add(gateArch);
    }

    this.scene.add(gatesGroup);
  }

  // --- 10b. Arena Seating Bowl, Stepped Tiers, Risers & Illuminated Staircases ---
  private buildArenaSeatingBowlAndStands(): void {
    const standsGroup = new THREE.Group();

    // 1. Materials for Stepped Tiers and Stadium Seating
    const treadMat = new THREE.MeshStandardMaterial({
      color: 0x242836,
      roughness: 0.38,
      metalness: 0.18,
    });

    const riserMat = new THREE.MeshStandardMaterial({
      color: 0x0f1118,
      roughness: 0.94,
      metalness: 0.05,
    });

    // Glowing Cyan LED Step Nosing Strip for Row Separation
    const stepLedMatCyan = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00d8ff,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.1,
    });
    this.stepLedMaterials.push(stepLedMatCyan);

    // Glowing Amber LED Strip for Aisle Stairways
    const stepLedMatAmber = new THREE.MeshStandardMaterial({
      color: 0xffaa22,
      emissive: 0xff8800,
      emissiveIntensity: 2.4,
      roughness: 0.2,
    });
    this.stepLedMaterials.push(stepLedMatAmber);

    const railingMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.28,
      metalness: 0.85,
    });

    const glassBalustradeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.32,
      roughness: 0.1,
      metalness: 0.9,
    });

    // 2. VIP / Campo Delantero Floor Slab (Z = -22 to -68, X = -16 to +16)
    const floorSlab = new THREE.Mesh(
      new THREE.BoxGeometry(32, 0.2, 46),
      new THREE.MeshStandardMaterial({
        color: 0x181a24,
        roughness: 0.32,
        metalness: 0.22,
      })
    );
    floorSlab.position.set(0, 0.1, -45);
    floorSlab.receiveShadow = true;
    standsGroup.add(floorSlab);

    // 2b. Entrance Concourse / Foyer Floor Slab (Z = -4.73 to Z = -22.0, X = -28.4 to +28.4)
    // Applies the exact same grey concrete floor established inside the arena/stage (0x181a24)
    const entranceFloorSlab = new THREE.Mesh(
      new THREE.BoxGeometry(57.0, 0.2, 17.3),
      new THREE.MeshStandardMaterial({
        color: 0x181a24,
        roughness: 0.32,
        metalness: 0.22,
      })
    );
    entranceFloorSlab.position.set(0, 0.1, -13.365);
    entranceFloorSlab.receiveShadow = true;
    standsGroup.add(entranceFloorSlab);

    // Entrance Portal Transition Sill / Threshold (Z = -4.73, X = -28.4 to +28.4)
    const entranceThreshold = new THREE.Mesh(
      new THREE.BoxGeometry(57.0, 0.2, 0.6),
      new THREE.MeshStandardMaterial({
        color: 0x181a24,
        roughness: 0.32,
        metalness: 0.22,
      })
    );
    entranceThreshold.position.set(0, 0.1, -4.73);
    entranceThreshold.receiveShadow = true;
    standsGroup.add(entranceThreshold);

    // --- 2c. NUEVO SECTOR: PLANTA BAJA TRASERA (Reemplaza al antiguo bloque central FOH) ---
    // Floor boundary separating Planta Baja Trasera (Z = -22 to -43.5) from Campo Delantero (Z = -43.5 to -68)
    const pbDividerMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00bfff,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.neonMaterials.push(pbDividerMat);

    // Glowing Cyan Sector Perimeter Line at Z = -43.5 across floor (with 5m center walkway opening)
    [-8.5, 8.5].forEach((lx) => {
      const lineMesh = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.04, 0.15), pbDividerMat);
      lineMesh.position.set(lx, 0.22, -43.5);
      standsGroup.add(lineMesh);
    });

    // Crowd-control Separation Barriers (Vallas divisorias de sector) at Z = -43.5
    const sectorBarrierMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.25 });
    [-8.5, 8.5].forEach((bx) => {
      const barrierMesh = new THREE.Mesh(new THREE.BoxGeometry(10.5, 1.1, 0.12), sectorBarrierMat);
      barrierMesh.position.set(bx, 0.75, -43.5);
      standsGroup.add(barrierMesh);
    });

    // Overhead Hanging Sector Signage Portal: "PLANTA BAJA TRASERA"
    const pbSignCanvas = document.createElement('canvas');
    pbSignCanvas.width = 1024;
    pbSignCanvas.height = 256;
    const pbCtx = pbSignCanvas.getContext('2d')!;
    pbCtx.fillStyle = '#0b1120';
    pbCtx.fillRect(0, 0, 1024, 256);
    pbCtx.strokeStyle = '#00f0ff';
    pbCtx.lineWidth = 8;
    pbCtx.strokeRect(8, 8, 1008, 240);
    pbCtx.fillStyle = '#00f0ff';
    pbCtx.font = 'bold 64px system-ui, sans-serif';
    pbCtx.textAlign = 'center';
    pbCtx.fillText('SECTOR PLANTA BAJA TRASERA', 512, 110);
    pbCtx.fillStyle = '#94a3b8';
    pbCtx.font = '600 36px system-ui, sans-serif';
    pbCtx.fillText('MOVISTAR ARENA • ACCESO PUERTAS 5 Y 6', 512, 185);

    const pbSignTex = new THREE.CanvasTexture(pbSignCanvas);
    pbSignTex.colorSpace = THREE.SRGBColorSpace;
    const pbSignMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(12.0, 3.0),
      new THREE.MeshBasicMaterial({ map: pbSignTex, transparent: true, side: THREE.DoubleSide })
    );
    pbSignMesh.position.set(0, 5.8, -25.0);
    standsGroup.add(pbSignMesh);

    // Lateral Illuminated Sector Totems at sector entrance (X = +-13.5, Z = -26.0)
    [-13.5, 13.5].forEach((tx) => {
      const totemPole = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 3.5, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 })
      );
      totemPole.position.set(tx, 1.95, -26.0);
      standsGroup.add(totemPole);

      const totemHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.4, 0.56),
        pbDividerMat
      );
      totemHead.position.set(tx, 3.8, -26.0);
      standsGroup.add(totemHead);
    });

    // 3. Platea Baja (9 Stepped Rows, Rise = 0.58m, Run = 1.22m, X = +-16 to +-27)
    // Segments with gaps at Z = -33 and Z = -51 for 3 access stairways
    const tierSegments = [
      { zMin: -32, zMax: -22 },
      { zMin: -50, zMax: -34 },
      { zMin: -68, zMax: -52 },
    ];

    const sides = [-1, 1]; // Left and Right stands

    sides.forEach((side) => {
      // Build 9 Physical Stepped Tiers for Platea Baja
      for (let r = 0; r < 9; r++) {
        const stepY = 0.2 + (r + 1) * 0.58;
        const treadX = side * (16.0 + r * 1.22 + 0.61);
        const riserX = side * (16.0 + r * 1.22);

        tierSegments.forEach((seg) => {
          const segLength = seg.zMax - seg.zMin;
          const segCenterZ = (seg.zMin + seg.zMax) / 2;

          // Horizontal Tread Slab
          const tread = new THREE.Mesh(
            new THREE.BoxGeometry(1.22, 0.08, segLength),
            treadMat
          );
          tread.position.set(treadX, stepY - 0.04, segCenterZ);
          tread.receiveShadow = true;
          standsGroup.add(tread);

          // Vertical Riser Face
          const riser = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.58, segLength),
            riserMat
          );
          riser.position.set(riserX, stepY - 0.29, segCenterZ);
          standsGroup.add(riser);

          // Glowing Cyan LED Step Nosing on the top front edge
          const ledStrip = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.035, segLength),
            stepLedMatCyan
          );
          ledStrip.position.set(riserX, stepY, segCenterZ);
          standsGroup.add(ledStrip);
        });
      }

      // Front Balustrade / Safety Glass Railing along Platea Baja edge (X = +-16)
      const glassRailBaja = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.95, 46),
        glassBalustradeMat
      );
      glassRailBaja.position.set(side * 15.96, 0.2 + 0.58 + 0.45, -45);
      standsGroup.add(glassRailBaja);

      const topRailBaja = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 46, 8),
        railingMat
      );
      topRailBaja.rotation.x = Math.PI / 2;
      topRailBaja.position.set(side * 15.96, 0.2 + 0.58 + 0.95, -45);
      standsGroup.add(topRailBaja);

      // 4. Platea Alta & Tribunas (9 Steeper Stepped Rows, Rise = 0.95m, Run = 1.33m, X = +-27 to +-39)
      for (let ur = 0; ur < 9; ur++) {
        const upperStepY = 5.6 + (ur + 1) * 0.95;
        const upperTreadX = side * (27.0 + ur * 1.33 + 0.665);
        const upperRiserX = side * (27.0 + ur * 1.33);

        tierSegments.forEach((seg) => {
          const segLength = seg.zMax - seg.zMin;
          const segCenterZ = (seg.zMin + seg.zMax) / 2;

          // Upper Tread Slab
          const upperTread = new THREE.Mesh(
            new THREE.BoxGeometry(1.33, 0.1, segLength),
            treadMat
          );
          upperTread.position.set(upperTreadX, upperStepY - 0.05, segCenterZ);
          upperTread.receiveShadow = true;
          standsGroup.add(upperTread);

          // Upper Vertical Riser Face
          const upperRiser = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.95, segLength),
            riserMat
          );
          upperRiser.position.set(upperRiserX, upperStepY - 0.475, segCenterZ);
          standsGroup.add(upperRiser);

          // Glowing Cyan LED Step Nosing
          const upperLed = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.035, segLength),
            stepLedMatCyan
          );
          upperLed.position.set(upperRiserX, upperStepY, segCenterZ);
          standsGroup.add(upperLed);
        });
      }

      // Upper Balcony Front Glass Railing (X = +-27)
      const glassRailAlta = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.1, 46),
        glassBalustradeMat
      );
      glassRailAlta.position.set(side * 26.96, 5.6 + 0.95 + 0.55, -45);
      standsGroup.add(glassRailAlta);

      const topRailAlta = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 46, 8),
        railingMat
      );
      topRailAlta.rotation.x = Math.PI / 2;
      topRailAlta.position.set(side * 26.96, 5.6 + 0.95 + 1.1, -45);
      standsGroup.add(topRailAlta);

      // Acoustic Back Enclosure Wall at top of stands (X = +-39.5)
      const upperBackWall = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 10.0, 48),
        new THREE.MeshStandardMaterial({ color: 0x151822, roughness: 0.9 })
      );
      upperBackWall.position.set(side * 39.5, 15.0, -45);
      standsGroup.add(upperBackWall);
    });

    // 5. Cabecera (Rear Tiered Stands, Z = -22 to -6)
    // The central entrance (|X| < 10m) is completely OPENED to provide an unobstructed,
    // majestic view of the entire venue, stage, screens, and crowd directly from the entrance doors!
    const cabeceraSides = [-1, 1]; // Left (X: -28 to -10) and Right (X: +10 to +28)
    const cabWidth = 18.0;

    for (let cr = 0; cr < 6; cr++) {
      const cabeceraY = 0.2 + (cr + 1) * 0.72;
      const cabeceraZ = -22.0 + (cr + 1) * 2.3;

      cabeceraSides.forEach((side) => {
        const cabCenterX = side * 19.0;

        // Tread
        const cabTread = new THREE.Mesh(
          new THREE.BoxGeometry(cabWidth, 0.08, 2.3),
          treadMat
        );
        cabTread.position.set(cabCenterX, cabeceraY - 0.04, cabeceraZ - 1.15);
        standsGroup.add(cabTread);

        // Riser
        const cabRiser = new THREE.Mesh(
          new THREE.BoxGeometry(cabWidth, 0.72, 0.08),
          riserMat
        );
        cabRiser.position.set(cabCenterX, cabeceraY - 0.36, cabeceraZ - 2.3);
        standsGroup.add(cabRiser);

        // LED Nosing
        const cabLed = new THREE.Mesh(
          new THREE.BoxGeometry(cabWidth, 0.035, 0.04),
          stepLedMatCyan
        );
        cabLed.position.set(cabCenterX, cabeceraY, cabeceraZ - 2.3);
        standsGroup.add(cabLed);
      });
    }

    // Modern Glass Balustrades along inner flanks of the stairs (X = -10 and X = +10)
    cabeceraSides.forEach((side) => {
      const railX = side * 9.95;
      const portalRailGeo = new THREE.BoxGeometry(0.06, 1.0, 13.8);
      const portalRail = new THREE.Mesh(portalRailGeo, glassBalustradeMat);
      portalRail.position.set(railX, 2.35, -15.1);
      standsGroup.add(portalRail);

      const portalTopRailGeo = new THREE.CylinderGeometry(0.035, 0.035, 13.8, 8);
      const portalTopRail = new THREE.Mesh(portalTopRailGeo, railingMat);
      portalTopRail.rotation.x = Math.PI / 2;
      portalTopRail.position.set(railX, 2.85, -15.1);
      standsGroup.add(portalTopRail);
    });

    // 6. Access Stairways (Vómitos) with Amber Step Lights and Safety Handrails
    const stairwayZs = [-23, -40, -58];
    stairwayZs.forEach((sz) => {
      sides.forEach((side) => {
        // Lower Stairway Ramp (Platea Baja, X = 16 to 27)
        for (let st = 0; st < 9; st++) {
          const stX = side * (16.0 + st * 1.22 + 0.61);
          const stY = 0.2 + (st + 1) * 0.58;

          const stairStep = new THREE.Mesh(
            new THREE.BoxGeometry(1.22, 0.12, 1.9),
            new THREE.MeshStandardMaterial({ color: 0x1b202e, roughness: 0.6 })
          );
          stairStep.position.set(stX, stY - 0.06, sz);
          standsGroup.add(stairStep);

          // Amber Step Light on stair nose
          const amberNose = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.035, 1.8),
            stepLedMatAmber
          );
          amberNose.position.set(side * (16.0 + st * 1.22), stY, sz);
          standsGroup.add(amberNose);
        }

        // Upper Stairway Ramp (Platea Alta, X = 27 to 39)
        for (let ust = 0; ust < 9; ust++) {
          const ustX = side * (27.0 + ust * 1.33 + 0.665);
          const ustY = 5.6 + (ust + 1) * 0.95;

          const upperStairStep = new THREE.Mesh(
            new THREE.BoxGeometry(1.33, 0.14, 1.9),
            new THREE.MeshStandardMaterial({ color: 0x1b202e, roughness: 0.6 })
          );
          upperStairStep.position.set(ustX, ustY - 0.07, sz);
          standsGroup.add(upperStairStep);

          const upperAmberNose = new THREE.Mesh(
            new THREE.BoxGeometry(0.04, 0.035, 1.8),
            stepLedMatAmber
          );
          upperAmberNose.position.set(side * (27.0 + ust * 1.33), ustY, sz);
          standsGroup.add(upperAmberNose);
        }

        // Center Handrail along access stair
        const railPost1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), railingMat);
        railPost1.position.set(side * 16.5, 0.78 + 0.45, sz);
        standsGroup.add(railPost1);

        const railPost2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), railingMat);
        railPost2.position.set(side * 27.0, 5.6 + 0.45, sz);
        standsGroup.add(railPost2);
      });
    });

    // Note: Stadium seats are generated as high-fidelity instances of the official 3D "asiento_b" model
    // via loadAsientoBAndGenerateSeats(), mounted across all rows, sectors and Campo Delantero.

    this.scene.add(standsGroup);
  }

  // --- 11. Audience Instances (15,000 Capacity representation) ---
  private buildAudience(): THREE.InstancedMesh {
    const personGeo = new THREE.CapsuleGeometry(0.24, 0.75, 6, 8);
    personGeo.translate(0, 0.6, 0);

    const personMat = new THREE.MeshStandardMaterial({
      color: 0x252a36,
      roughness: 0.75,
      metalness: 0.1,
    });

    const instMesh = new THREE.InstancedMesh(personGeo, personMat, this.audienceCount);
    let count = 0;

    // 1. Campo Delantero / VIP (Z = -45 to -68, X = -14 to +14)
    for (let z = -46; z >= -66 && count < 80; z -= 3.0) {
      for (let x = -13; x <= 13 && count < 80; x += 2.2) {
        if (Math.abs(x) < 1.0) continue; // Walkway
        const pos = new THREE.Vector3(x + (Math.random() - 0.5) * 0.4, 0.2, z + (Math.random() - 0.5) * 0.4);
        this.addAudienceInstance(instMesh, count, pos);
        count++;
      }
    }

    // 2. Platea Baja Lower Tiers (9 stepped rows on Left & Right)
    for (let z = -25; z >= -65 && count < 150; z -= 4.0) {
      for (let r = 0; r < 9 && count < 150; r += 2) {
        const tierY = 0.2 + (r + 1) * 0.58;
        const tierX = 16.0 + r * 1.22 + 0.61;
        [-tierX, tierX].forEach((x) => {
          if (count >= 150) return;
          const pos = new THREE.Vector3(x + (Math.random() - 0.5) * 0.25, tierY, z);
          this.addAudienceInstance(instMesh, count, pos);
          count++;
        });
      }
    }

    // 3. Platea Alta & Tribuna Upper Tiers (9 stepped rows on Left & Right)
    for (let z = -28; z >= -65 && count < this.audienceCount; z -= 4.5) {
      for (let ur = 0; ur < 9 && count < this.audienceCount; ur += 2) {
        const upperY = 5.6 + (ur + 1) * 0.95;
        const upperX = 27.0 + ur * 1.33 + 0.665;
        [-upperX, upperX].forEach((x) => {
          if (count >= this.audienceCount) return;
          const pos = new THREE.Vector3(x, upperY, z);
          this.addAudienceInstance(instMesh, count, pos);
          count++;
        });
      }
    }

    instMesh.instanceMatrix.needsUpdate = true;
    if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;
    this.scene.add(instMesh);
    return instMesh;
  }

  private addAudienceInstance(mesh: THREE.InstancedMesh, index: number, pos: THREE.Vector3): void {
    this.dummy.position.copy(pos);
    this.dummy.rotation.y = (Math.random() - 0.5) * 0.5;
    this.dummy.scale.set(1, 0.9 + Math.random() * 0.2, 1);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(index, this.dummy.matrix);

    const color = new THREE.Color().setHSL(Math.random(), 0.65, 0.4 + Math.random() * 0.25);
    mesh.setColorAt(index, color);

    this.audienceOriginalPos.push(pos.clone());
    this.audienceVelocities.push(new THREE.Vector3(0, 0, 0));
  }

  // --- 12. User Target Seat Beacon & Gate Marker ---
  private buildSeatBeacon(): THREE.Group {
    const group = new THREE.Group();

    // Vertical holographic light pillar
    const beamGeo = new THREE.CylinderGeometry(0.35, 0.35, 8, 16, 1, true);
    beamGeo.translate(0, 4, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    group.add(beam);

    // Floor Ring
    const ringGeo = new THREE.RingGeometry(0.4, 0.7, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.05;
    group.add(ring);

    // Floating Diamond waypoint icon
    const diamondGeo = new THREE.OctahedronGeometry(0.38, 0);
    const diamondMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 2.0,
      metalness: 0.9,
      roughness: 0.1,
    });
    const diamond = new THREE.Mesh(diamondGeo, diamondMat);
    diamond.position.y = 2.4;
    group.add(diamond);

    group.position.copy(this.targetSeatCoords.position);
    return group;
  }

  private buildUserGateMarker(): THREE.Group {
    const group = new THREE.Group();

    // Floating Gate Beacon above the assigned door on the facade
    const ringGeo = new THREE.RingGeometry(0.5, 0.8, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);

    const pointerGeo = new THREE.ConeGeometry(0.3, 0.8, 8);
    pointerGeo.rotateX(Math.PI);
    const pointerMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xffaa00,
      emissiveIntensity: 2.5,
    });
    const pointer = new THREE.Mesh(pointerGeo, pointerMat);
    pointer.position.y = 0.8;
    group.add(pointer);

    // Position at Door 1 default: X = -16.45, Y = 5.2, Z = -4.5
    group.position.set(-16.45, 5.2, -4.5);
    return group;
  }

  public updateTargetSeatFromTicket(ticket: TicketInfo): void {
    let x = 0;
    let y = 0.25;
    let z = -50;

    switch (ticket.sectionCode) {
      case 'VIP':
        // Campo Delantero / VIP (Z = -46 to -66, X = -10 to +10)
        z = -46.0 - (ticket.row - 1) * 2.2;
        y = 0.25;
        x = (ticket.seat - 10.5) * 1.1;
        break;
      case 'PB_TRASERA': {
        // Planta Baja Trasera (Z = -26 to -41, X = -10 to +10)
        const rowIdx = Math.min(7, Math.max(0, ticket.row - 1));
        z = -26.0 - rowIdx * 2.0;
        y = 0.25;
        const sideOffset = ticket.seat <= 9 ? -1 : 1;
        x = sideOffset * (1.5 + (ticket.seat % 9) * 1.05);
        break;
      }
      case 'PLAT': {
        // Platea Baja (9 stepped rows, X = 16 to 27, step Y = 0.2 + (r+1) * 0.58)
        const rowIdx = Math.min(8, Math.max(0, ticket.row - 1));
        const side = ticket.seat <= 10 ? -1 : 1;
        x = side * (16.0 + rowIdx * 1.22 + 0.61);
        z = -28.0 - ((ticket.seat % 10) * 3.6);
        y = 0.2 + (rowIdx + 1) * 0.58 + 0.1;
        break;
      }
      case 'GRAD': {
        // Platea Alta (9 stepped rows, X = 27 to 39, step Y = 5.6 + (ur+1) * 0.95)
        const rowIdx = Math.min(8, Math.max(0, ticket.row - 1));
        const side = ticket.seat <= 10 ? -1 : 1;
        x = side * (27.0 + rowIdx * 1.33 + 0.665);
        z = -30.0 - ((ticket.seat % 10) * 3.6);
        y = 5.6 + (rowIdx + 1) * 0.95 + 0.1;
        break;
      }
      case 'TRIB':
      default: {
        // Tribuna Alta (top rows of Platea Alta tier)
        const rowIdx = Math.min(8, Math.max(4, 4 + Math.floor((ticket.row - 1) / 2)));
        const side = ticket.seat <= 10 ? -1 : 1;
        x = side * (27.0 + rowIdx * 1.33 + 0.665);
        z = -32.0 - ((ticket.seat % 10) * 3.4);
        y = 5.6 + (rowIdx + 1) * 0.95 + 0.1;
        break;
      }
    }

    this.targetSeatCoords.position.set(x, y, z);
    this.targetSeatCoords.lookTarget.set(0, 3.0, -80);
    this.seatBeacon.position.set(x, y, z);

    if (this.targetSeatMesh) {
      this.targetSeatMesh.position.set(x, y, z);
      const dir = new THREE.Vector3().subVectors(this.targetSeatCoords.lookTarget, this.targetSeatCoords.position);
      this.targetSeatMesh.rotation.y = Math.atan2(-dir.x, -dir.z);
    }

    // Update Gate Beacon Marker above the designated door
    const gateNum = ticket.gateNumber || 1;
    this.assignedGateNumber = gateNum;
    const gateX = -17.5 + (gateNum - 0.5) * 2.3;
    this.userGateMarker.position.set(gateX, 5.2, -4.5);
  }

  // --- Procedural Vehicle Generator ---
  private buildProceduralCar(
    color = 0x111e33,
    type: 'sedan' | 'suv' | 'taxi' = 'sedan'
  ): THREE.Group {
    const car = new THREE.Group();
    const isSuv = type === 'suv';
    const isTaxi = type === 'taxi';

    // Chassis dimensions
    const length = isSuv ? 4.9 : 4.6;
    const width = isSuv ? 2.45 : 2.3;
    const height = isSuv ? 0.78 : 0.65;
    const bodyColor = isTaxi ? 0xdfa000 : color;

    const chassisGeo = new THREE.BoxGeometry(width, height, length);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      metalness: 0.88,
      roughness: 0.22,
    });
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = isSuv ? 0.65 : 0.55;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    car.add(chassis);

    // Cabin Glass / Roof
    const cabinH = isSuv ? 0.7 : 0.55;
    const cabinGeo = new THREE.BoxGeometry(width * 0.84, cabinH, length * 0.54);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x070c14,
      metalness: 0.95,
      roughness: 0.05,
    });
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, (isSuv ? 0.65 : 0.55) + height / 2 + cabinH / 2, -0.2);
    car.add(cabin);

    // Taxi Roof Light or SUV Roof Rails
    if (isTaxi) {
      const taxiSignMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: 0xffaa00,
        emissiveIntensity: 1.5,
      });
      const taxiSign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.25), taxiSignMat);
      taxiSign.position.set(0, (isSuv ? 0.65 : 0.55) + height / 2 + cabinH + 0.09, -0.2);
      car.add(taxiSign);
    } else if (isSuv) {
      const railMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9 });
      [-0.8, 0.8].forEach((rx) => {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, length * 0.48, 8), railMat);
        rail.rotateX(Math.PI / 2);
        rail.position.set(rx, 0.65 + height / 2 + cabinH + 0.04, -0.2);
        car.add(rail);
      });
    }

    // Wheels
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const wheelR = isSuv ? 0.44 : 0.38;
    const wheelOffsets = [
      [-(width / 2), wheelR, length * 0.3],
      [width / 2, wheelR, length * 0.3],
      [-(width / 2), wheelR, -length * 0.3],
      [width / 2, wheelR, -length * 0.3],
    ];
    wheelOffsets.forEach(([wx, wy, wz]) => {
      const tireGeo = new THREE.CylinderGeometry(wheelR, wheelR, 0.28, 16);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.position.set(wx, wy, wz);
      car.add(tire);
    });

    // Front Headlights
    const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffae0, emissiveIntensity: 2.2 });
    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.1), hlMat);
    hlLeft.position.set(-(width * 0.35), isSuv ? 0.72 : 0.65, length / 2);
    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.1), hlMat);
    hlRight.position.set(width * 0.35, isSuv ? 0.72 : 0.65, length / 2);
    car.add(hlLeft, hlRight);

    // Rear Taillights
    const tlMat = new THREE.MeshStandardMaterial({ color: 0xff1122, emissive: 0xdd0011, emissiveIntensity: 2.5 });
    const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.1), tlMat);
    tlLeft.position.set(-(width * 0.35), isSuv ? 0.72 : 0.65, -length / 2);
    const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.1), tlMat);
    tlRight.position.set(width * 0.35, isSuv ? 0.72 : 0.65, -length / 2);
    car.add(tlLeft, tlRight);

    return car;
  }

  // --- 5c. Multiple Parked Vehicles Fleet along Calle Humboldt ---
  private buildParkedVehicles(): THREE.Group {
    const group = new THREE.Group();
    this.parkedCarColliders = [];

    // 14 Vehicles parked along north curbside (Z ~ 12.0) and south curbside (Z ~ 26.0)
    const fleetConfigs: { x: number; z: number; rotY: number; color: number; type: 'sedan' | 'suv' | 'taxi' }[] = [
      // North curbside lane (near arena plaza sidewalk)
      { x: -52, z: 11.5, rotY: 0, color: 0x0f172a, type: 'sedan' }, // Midnight
      { x: -39, z: 11.5, rotY: 0, color: 0x1e3a8a, type: 'sedan' }, // Deep Blue
      { x: -27, z: 11.5, rotY: 0, color: 0x991b1b, type: 'sedan' }, // Crimson Red
      { x: -14, z: 11.5, rotY: 0, color: 0x475569, type: 'suv' },   // Slate SUV
      { x: 2.5, z: 11.5, rotY: 0, color: 0x0284c7, type: 'sedan' },  // Movistar Blue Sedan (Facing user upon spawn)
      { x: 14, z: 11.5, rotY: 0, color: 0xf1f5f9, type: 'sedan' },  // Pearl White
      { x: 26, z: 11.5, rotY: 0, color: 0xd97706, type: 'sedan' },  // Amber Sedan
      { x: 38, z: 11.5, rotY: 0, color: 0x18181b, type: 'suv' },    // Black SUV
      { x: 50, z: 11.5, rotY: 0, color: 0xeab308, type: 'taxi' },   // BA Yellow Taxi

      // South curbside lane (across the avenue)
      { x: -46, z: 26.5, rotY: Math.PI, color: 0x3b0764, type: 'sedan' }, // Purple
      { x: -32, z: 26.5, rotY: Math.PI, color: 0x047857, type: 'sedan' }, // Emerald
      { x: -16, z: 26.5, rotY: Math.PI, color: 0x334155, type: 'suv' },   // Charcoal SUV
      { x: 8, z: 26.5, rotY: Math.PI, color: 0xd97706, type: 'sedan' },    // Amber
      { x: 28, z: 26.5, rotY: Math.PI, color: 0x831843, type: 'sedan' },   // Bordeaux
      { x: 44, z: 26.5, rotY: Math.PI, color: 0xeab308, type: 'taxi' },    // BA Yellow Taxi
    ];

    const bayLineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, emissive: 0x333333 });

    fleetConfigs.forEach((cfg) => {
      const car = this.buildProceduralCar(cfg.color, cfg.type);
      car.position.set(cfg.x, 0, cfg.z);
      car.rotation.y = cfg.rotY;
      group.add(car);

      // Register collision bounding box (width ~2.4m, length ~4.9m)
      const halfW = 1.35;
      const halfL = 2.5;
      this.parkedCarColliders.push({
        minX: cfg.x - halfW,
        maxX: cfg.x + halfW,
        minZ: cfg.z - halfL,
        maxZ: cfg.z + halfL,
      });

      // Painted white parking slot markings on the street
      const bay1 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 5.0), bayLineMat);
      bay1.rotateX(-Math.PI / 2);
      bay1.position.set(cfg.x - 1.5, 0.025, cfg.z);
      group.add(bay1);

      const bay2 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 5.0), bayLineMat);
      bay2.rotateX(-Math.PI / 2);
      bay2.position.set(cfg.x + 1.5, 0.025, cfg.z);
      group.add(bay2);
    });

    return group;
  }

  // --- Per-frame Animations & Lighting Dynamics ---
  public update(
    time: number,
    delta: number,
    audioBass: number,
    audioVol: number,
    audioTreble: number,
    isConcertPlaying: boolean,
    isBlackout: boolean,
    isExiting: boolean
  ): void {
    // 1. Audio-reactive Jumbotron Visualizer (when not displaying custom media and lights are on)
    if (!this.isCustomMediaActive && !isBlackout) {
      this.jumbotronController.update(audioBass, audioVol, audioTreble);
    }

    // 2. Animate Seat Beacon and Gate Marker (Completely vanish during blackout)
    if (this.seatBeacon && this.seatBeacon.children[2]) {
      this.seatBeacon.visible = !isBlackout && this.isSeatBeaconVisibleState;
      if (this.seatBeacon.visible) {
        this.seatBeacon.children[2].rotation.y += delta * 1.8;
        this.seatBeacon.children[2].position.y = 2.4 + Math.sin(time * 3.0) * 0.15;
      }
    }
    if (this.userGateMarker) {
      this.userGateMarker.visible = !isBlackout && !isConcertPlaying && !isExiting;
      if (this.userGateMarker.visible) {
        this.userGateMarker.rotation.z += delta * 2.0;
        this.userGateMarker.position.y = 5.2 + Math.sin(time * 4.0) * 0.2;
      }
    }

    // Starry Sky & Celestial Lighting - Entirely disappears during blackout!
    if (this.starsMesh) {
      this.starsMesh.visible = !isBlackout;
      if (!isBlackout) {
        const starMat = this.starsMesh.material as THREE.PointsMaterial;
        starMat.size = 1.8 + Math.sin(time * 3.2) * 0.35;
        this.starsMesh.rotation.y = time * 0.0012;
      }
    }
    if (this.moonMesh) {
      this.moonMesh.visible = !isBlackout;
    }

    // Pitch Black Sky & Atmosphere during blackout
    if (isBlackout) {
      this.scene.background = new THREE.Color(0x000000);
      this.scene.fog = new THREE.FogExp2(0x000000, 0.04);
      this.scene.environment = null;
    } else {
      this.scene.background = new THREE.Color(0x060912);
      this.scene.fog = new THREE.FogExp2(0x060912, 0.012);
      this.scene.environment = this.envTexture;
    }

    // Key, Hemispheric & Ambient Lighting - Pitch dark on blackout
    this.outdoorKeyLight.intensity = isBlackout ? 0.0 : 1.4;
    this.hemiLight.intensity = isBlackout ? 0.0 : 0.9;
    this.arenaAmbientLight.intensity = isBlackout ? 0.0 : (isConcertPlaying ? 0.25 : 0.7);

    // Exterior Street Lamps & Facade Uplights / Downlights
    this.streetLights.forEach((l) => {
      l.intensity = isBlackout ? 0.0 : 1.8;
    });
    this.facadeLights.forEach((l) => {
      l.intensity = isBlackout ? 0.0 : 2.2;
    });

    // Emissive Fixtures & Neon Signage - Extinguished completely during blackout
    this.exteriorLampMaterials.forEach((m) => {
      m.emissiveIntensity = isBlackout ? 0.0 : 2.2;
    });
    this.neonMaterials.forEach((m) => {
      m.emissiveIntensity = isBlackout ? 0.0 : 2.5;
    });
    this.houseFixtureMaterials.forEach((m) => {
      m.emissiveIntensity = isBlackout ? 0.0 : 2.0;
    });

    // Stage LED Screens - Controlled separately via switch, extinguished during blackout
    const screensVisible = !isBlackout && this.stageScreensManualOn;
    if (this.mainLedScreenMesh) this.mainLedScreenMesh.visible = screensVisible;
    if (this.jumbotronMeshLeft) this.jumbotronMeshLeft.visible = screensVisible;
    if (this.jumbotronMeshRight) this.jumbotronMeshRight.visible = screensVisible;

    // Rhythmic GIF transition with instrumental beat & fundido negro (black cuts)
    if (this.isGifRhythmicFadeActive && screensVisible && this.mainLedScreenMesh) {
      // Beat period synced to 124 BPM (~0.484s per beat, 1.93s per 4-beat bar)
      const beatPeriod = 1.935;
      const barPhase = (time % beatPeriod) / beatPeriod; // 0.0 to 1.0

      // Fundido a negro (black cut) during beat accents (first 18% of bar and on beat 3)
      const isBlackoutCut = barPhase < 0.18 || (barPhase > 0.48 && barPhase < 0.62) || (audioBass > 0.88 && barPhase > 0.85);

      const screenMat = this.mainLedScreenMesh.material as THREE.MeshBasicMaterial;
      if (screenMat) {
        if (isBlackoutCut) {
          screenMat.color.setHex(0x000000);
          screenMat.map = null;
          screenMat.needsUpdate = true;
        } else {
          // Transition between custom GIF/media and synthesizer visualizer
          const showGifPhase = barPhase < 0.75;
          if (showGifPhase && this.customTexture) {
            screenMat.map = this.customTexture;
            screenMat.color.setHex(0xffffff);
            screenMat.needsUpdate = true;
          } else {
            screenMat.map = this.jumbotronController.texture;
            screenMat.color.setHex(0xffffff);
            screenMat.needsUpdate = true;
          }
        }
      }
    }

    // Stage Lights: active when lights switch is on and not during blackout
    const stageLightsActive = !isBlackout && this.stageLightsManualOn;

    // Stage Wash Lights & Foyer Lights
    this.stageWashLights.forEach((wash) => {
      wash.intensity = stageLightsActive ? (isConcertPlaying ? 2.2 + audioBass * 1.5 : 1.8) : 0.0;
    });
    this.foyerLights.forEach((fl) => {
      fl.intensity = isBlackout ? 0.0 : 1.8;
    });

    // 3. Architectural Internal Lighting Dynamics
    this.houseLights.forEach((hl) => {
      if (isBlackout || (this.isVenueEmpty && !this.stageLightsManualOn)) {
        hl.intensity = 0.0;
      } else if (isConcertPlaying) {
        hl.intensity = 0.75 + audioBass * 0.35;
      } else {
        hl.intensity = 2.2;
      }
    });

    // Tiered Seating Raking Lights & Step LED Glow
    this.tieredRakingLights.forEach((spot) => {
      if (isBlackout || (this.isVenueEmpty && !this.stageLightsManualOn)) {
        spot.intensity = 0.0;
      } else if (isConcertPlaying) {
        spot.intensity = 0.9 + audioBass * 0.5;
      } else {
        spot.intensity = 3.8;
      }
    });

    this.stepLedMaterials.forEach((mat) => {
      if (isBlackout || (this.isVenueEmpty && !this.stageLightsManualOn)) {
        mat.emissiveIntensity = 0.0;
      } else if (isConcertPlaying) {
        mat.emissiveIntensity = 1.6 + audioTreble * 0.8;
      } else {
        mat.emissiveIntensity = 2.0;
      }
    });

    // 4. Dynamic Moving Stage Spotlights (Off when venue empty or manually switched off)
    this.movingSpots.forEach((spotObj, idx) => {
      if (!stageLightsActive) {
        spotObj.light.intensity = 0;
        (spotObj.cone.material as THREE.MeshBasicMaterial).opacity = 0;
        return;
      }

      if (isConcertPlaying) {
        const sweepSpeed = spotObj.speed * (1.0 + audioBass * 1.5);
        const sweepAngle = Math.sin(time * sweepSpeed + spotObj.phase) * 22;
        const pitchAngle = Math.cos(time * sweepSpeed * 0.8 + spotObj.phase) * 10;

        spotObj.target.position.set(
          spotObj.basePos.x * 0.6 + sweepAngle,
          1 + Math.abs(pitchAngle),
          -55 + Math.sin(time * 2 + idx) * 16
        );

        spotObj.light.intensity = 3.0 + audioBass * 4.0;
        (spotObj.cone.material as THREE.MeshBasicMaterial).opacity = 0.22 + audioVol * 0.4;

        const hue = (0.55 + idx * 0.12 + time * 0.08) % 1.0;
        spotObj.light.color.setHSL(hue, 1.0, 0.6);
        (spotObj.cone.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1.0, 0.6);
      } else {
        spotObj.light.intensity = 1.0;
        (spotObj.cone.material as THREE.MeshBasicMaterial).opacity = 0.08;
        spotObj.target.position.set(
          spotObj.basePos.x + Math.sin(time * 0.5 + spotObj.phase) * 6,
          1,
          -55
        );
      }

      spotObj.cone.lookAt(spotObj.target.position);
    });

    // 5. Laser Beams (Off when venue empty or manually switched off)
    if (this.laserLines) {
      if (!stageLightsActive || !isConcertPlaying) {
        (this.laserLines.material as THREE.LineBasicMaterial).opacity = 0.0;
      } else {
        (this.laserLines.material as THREE.LineBasicMaterial).opacity = 0.6 + audioTreble * 0.4;
        this.laserLines.rotation.y = Math.sin(time * 1.6) * 0.28;
      }
    }

    // 6. Audience Dynamics (Bouncing, Cheering, Exiting)
    this.updateAudienceDynamics(time, delta, audioBass, isConcertPlaying, isBlackout, isExiting);
  }

  private updateAudienceDynamics(
    time: number,
    delta: number,
    audioBass: number,
    isConcertPlaying: boolean,
    isBlackout: boolean,
    isExiting: boolean
  ): void {
    if (this.isVenueEmpty) {
      this.audienceMesh.visible = false;
      return;
    }
    this.audienceMesh.visible = true;

    const count = this.audienceMesh.count;

    for (let i = 0; i < count; i++) {
      const orig = this.audienceOriginalPos[i];
      if (!orig) continue;

      if (isExiting) {
        this.audienceMesh.getMatrixAt(i, this.dummy.matrix);
        this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale);

        // Center aisle lane (-0.55m to +0.55m)
        const centerLaneX = ((i % 9) - 4) * 0.12; // Strictly centered aisle
        let targetX = centerLaneX;
        let targetZ = -4.73; // Center entrance gates

        const isGroundFloor = Math.abs(orig.x) < 15.0 && orig.z < -22.0;

        if (isGroundFloor && Math.abs(this.dummy.position.x) > 0.65 && this.dummy.position.z < -22.0) {
          // 1. First move laterally along their row aisle toward the central aisle
          targetX = 0.0;
          targetZ = this.dummy.position.z;
        } else if (this.dummy.position.z < -22.0) {
          // 2. Once in the central aisle: advance straight along the center walkway
          targetX = centerLaneX;
          targetZ = -20.0;
        } else if (this.dummy.position.z < -4.73) {
          // 3. Concourse corridor: stay strictly centered toward the center entrance doors
          targetX = centerLaneX;
          targetZ = -4.73;
        } else {
          // 4. Exiting onto Calle Humboldt plaza
          targetX = centerLaneX * 1.5;
          targetZ = 4.0;
        }

        const moveTarget = new THREE.Vector3(targetX, 0.2, targetZ);
        const dir = new THREE.Vector3().subVectors(moveTarget, this.dummy.position);
        dir.normalize();

        // Controlled walking speed down the central exit
        const speed = 1.9 + (i % 7) * 0.22;
        this.dummy.position.addScaledVector(dir, delta * speed);

        // Firmly keep ground floor & concourse spectators inside the central aisle
        if (this.dummy.position.z >= -66.0 && this.dummy.position.z <= 2.0) {
          if (isGroundFloor && Math.abs(this.dummy.position.x) <= 0.85) {
            this.dummy.position.x = THREE.MathUtils.clamp(this.dummy.position.x, -0.65, 0.65);
          } else if (this.dummy.position.z >= -22.0) {
            this.dummy.position.x = THREE.MathUtils.clamp(this.dummy.position.x, -1.2, 1.2);
          }
        }
        this.dummy.position.y = 0.2 + Math.abs(Math.sin(time * 6 + i)) * 0.07;
        this.dummy.lookAt(targetX, this.dummy.position.y, targetZ);

        // Gradually fade / scale out as they exit through the center doors onto the plaza
        if (this.dummy.position.z >= -3.5) {
          const fadeScale = Math.max(0.001, (1.0 - (this.dummy.position.z - (-3.5)) / 4.0));
          this.dummy.scale.set(fadeScale, fadeScale, fadeScale);
        } else {
          this.dummy.scale.set(1, 1, 1);
        }

        this.dummy.updateMatrix();
        this.audienceMesh.setMatrixAt(i, this.dummy.matrix);
      } else if (isConcertPlaying && !isBlackout) {
        const bounce = Math.abs(Math.sin(time * 8.0 + (i % 7))) * audioBass * 0.28;
        this.dummy.position.set(orig.x, orig.y + bounce, orig.z);
        this.dummy.rotation.set(0, Math.sin(time * 4 + i) * 0.2, 0);
        this.dummy.scale.set(1, 1 + bounce * 0.5, 1);
        this.dummy.updateMatrix();
        this.audienceMesh.setMatrixAt(i, this.dummy.matrix);
      } else {
        this.dummy.position.copy(orig);
        this.dummy.position.y = orig.y + Math.sin(time * 1.5 + i) * 0.03;
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        this.audienceMesh.setMatrixAt(i, this.dummy.matrix);
      }
    }
    this.audienceMesh.instanceMatrix.needsUpdate = true;
  }

  // --- Flashlight Control ---
  public setFlashlight(enabled: boolean): void {
    this.flashlight.intensity = enabled ? 22.0 : 0;
    if (this.flashlightFill) {
      this.flashlightFill.intensity = enabled ? 8.0 : 0;
    }
    if (this.flashlightBeam) {
      this.flashlightBeam.visible = enabled;
      (this.flashlightBeam.material as THREE.MeshBasicMaterial).opacity = enabled ? 0.35 : 0;
    }
  }

  // --- Seat Beacon Visibility (Disappears once user sits down) ---
  private isSeatBeaconVisibleState = true;
  public setSeatBeaconVisible(visible: boolean): void {
    this.isSeatBeaconVisibleState = visible;
    if (this.seatBeacon) {
      this.seatBeacon.visible = visible;
    }
  }

  // --- Empty Venue Exploration Mode ---
  public setVenueEmpty(empty: boolean): void {
    this.isVenueEmpty = empty;
    if (this.audienceMesh) {
      this.audienceMesh.visible = !empty;
    }
  }

  // --- Custom Screen Media (GIF / Video / Image on Main Stage LED Screen) ---
  public async setCustomMedia(file: File): Promise<string> {
    this.customMediaFile = file;
    if (this.customMediaUrl) {
      URL.revokeObjectURL(this.customMediaUrl);
    }
    const url = URL.createObjectURL(file);
    this.customMediaUrl = url;

    // Clean up previous media resources
    if (this.gifAnimationStop) {
      this.gifAnimationStop();
      this.gifAnimationStop = null;
    }
    if (this.customVideoElement) {
      this.customVideoElement.pause();
      this.customVideoElement.src = '';
      this.customVideoElement = null;
    }

    const isVideo = file.type.startsWith('video/');

    if (isVideo) {
      const vid = document.createElement('video');
      vid.autoplay = true;
      vid.playsInline = true;
      vid.loop = true;
      vid.muted = true;
      vid.src = url;
      vid.play().catch(console.warn);
      this.customVideoElement = vid;

      const videoTex = new THREE.VideoTexture(vid);
      videoTex.colorSpace = THREE.SRGBColorSpace;
      videoTex.minFilter = THREE.LinearFilter;
      videoTex.magFilter = THREE.LinearFilter;
      this.customTexture = videoTex;
    } else {
      // GIF or Still Image
      const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasImageDecoder = typeof window !== 'undefined' && 'ImageDecoder' in window && typeof (window as any).ImageDecoder === 'function';

      if (isGif && hasImageDecoder) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const imageDecoder = new (window as any).ImageDecoder({
            data: file.stream(),
            type: 'image/gif',
          });

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          this.customTexture = tex;

          let frameIndex = 0;
          let active = true;
          this.gifAnimationStop = () => { active = false; };

          const decodeNext = async () => {
            if (!active) return;
            try {
              const frame = await imageDecoder.decode({ frameIndex });
              if (canvas.width !== frame.image.displayWidth || canvas.height !== frame.image.displayHeight) {
                canvas.width = frame.image.displayWidth;
                canvas.height = frame.image.displayHeight;
              }
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(frame.image, 0, 0);
              tex.needsUpdate = true;
              const duration = (frame.image.duration || 80000) / 1000;
              frame.image.close();
              const trackCount = imageDecoder.tracks?.selectedTrack?.frameCount || 1;
              frameIndex = (frameIndex + 1) % trackCount;
              setTimeout(decodeNext, Math.max(30, duration));
            } catch {
              // fallback if decode error
            }
          };
          decodeNext();
        } catch (e) {
          console.warn('ImageDecoder failed, using standard loader:', e);
          const loader = new THREE.TextureLoader();
          const tex = await loader.loadAsync(url);
          tex.colorSpace = THREE.SRGBColorSpace;
          this.customTexture = tex;
        }
      } else {
        const loader = new THREE.TextureLoader();
        const tex = await loader.loadAsync(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        this.customTexture = tex;
      }
    }

    return url;
  }

  public activateCustomMediaOnScreen(): void {
    if (!this.customTexture) return;
    this.isCustomMediaActive = true;
    const mediaMat = new THREE.MeshBasicMaterial({ map: this.customTexture });
    if (this.mainLedScreenMesh) {
      this.mainLedScreenMesh.material = mediaMat;
    }
    if (this.jumbotronMeshLeft) {
      this.jumbotronMeshLeft.material = mediaMat;
    }
    if (this.jumbotronMeshRight) {
      this.jumbotronMeshRight.material = mediaMat;
    }
  }

  public resetScreenToDefault(): void {
    this.isCustomMediaActive = false;
    const defaultMat = new THREE.MeshBasicMaterial({ map: this.jumbotronController.texture });
    if (this.mainLedScreenMesh) {
      this.mainLedScreenMesh.material = defaultMat;
    }
    if (this.jumbotronMeshLeft) {
      this.jumbotronMeshLeft.material = defaultMat;
    }
    if (this.jumbotronMeshRight) {
      this.jumbotronMeshRight.material = defaultMat;
    }
  }

  public dispose(): void {
    if (this.gifAnimationStop) {
      this.gifAnimationStop();
      this.gifAnimationStop = null;
    }
    if (this.customVideoElement) {
      this.customVideoElement.pause();
      this.customVideoElement.src = '';
      this.customVideoElement = null;
    }
    if (this.customMediaUrl) {
      URL.revokeObjectURL(this.customMediaUrl);
      this.customMediaUrl = null;
    }
    this.renderer.dispose();
  }
}
