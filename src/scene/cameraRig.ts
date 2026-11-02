/**
 * CameraRig & Player Controller
 * Manages first-person locomotion, gyroscope smoothing (Lerp), touch gestures,
 * speed limit enforcement inside the venue, and sitting transitions.
 */
import * as THREE from 'three';
import { VenueScene, SeatCoordinates } from './venueScene';
import { soundEngine } from '../audio/soundEngine';

export interface RigInput {
  moveForward: number; // -1 to 1
  moveRight: number;   // -1 to 1
  lookDeltaX: number;  // radians
  lookDeltaY: number;  // radians
  sprint: boolean;
}

export class CameraRig {
  public scene: VenueScene;
  public camera: THREE.PerspectiveCamera;

  // Position and kinematics
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public yaw = Math.PI; // Face arena at start (looking down -Z)
  public pitch = 0;

  // Gyroscope integration
  public gyroActive = false;
  private gyroYaw = 0;
  private gyroPitch = 0;
  private gyroRoll = 0;
  private targetGyroYaw = 0;
  private targetGyroPitch = 0;

  // Player state
  public isInsideVenue = false;
  public isSeated = false;
  public isNearSeat = false;
  public isNearExit = false;
  public currentSpeed = 0; // m/s

  // Speed constants
  private readonly WALK_SPEED = 4.2;
  private readonly SPRINT_SPEED = 7.5;
  private readonly SPEED_LIMIT = 5.0; // Limit inside the venue!

  // Gravity and Ground Physics
  public readonly EYE_HEIGHT = 1.65;
  public verticalVelocity = 0;
  public readonly GRAVITY = 18.0; // m/s² responsive gravity
  public isGrounded = true;

  // Sitting animation interpolation
  private isTransitioningSeat = false;
  private seatTransitionProgress = 0;
  private seatStartPos = new THREE.Vector3();
  private seatTargetPos = new THREE.Vector3();
  private seatTargetYaw = Math.PI;
  private seatTargetPitch = 0.05;

  // Step sound timer
  private stepTimer = 0;

  // Callbacks
  public onSpeedLimitExceeded: () => void = () => {};
  public onNearSeatChanged: (near: boolean) => void = () => {};
  public onExitReached: () => void = () => {};

  constructor(scene: VenueScene) {
    this.scene = scene;
    this.camera = scene.camera;
    // Initial position outside on Calle Humboldt facing the Movistar Arena facade
    this.position = new THREE.Vector3(0.0, 1.65, 20.0);
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
  }

  public update(delta: number, input: RigInput): void {
    // 1. Handle sitting transition
    if (this.isTransitioningSeat) {
      this.seatTransitionProgress += delta * 2.0;
      const t = Math.min(1.0, this.seatTransitionProgress);
      // Smooth ease
      const easeT = 0.5 - 0.5 * Math.cos(t * Math.PI);

      this.position.lerpVectors(this.seatStartPos, this.seatTargetPos, easeT);
      this.yaw = THREE.MathUtils.lerp(this.yaw, this.seatTargetYaw, easeT);
      this.pitch = THREE.MathUtils.lerp(this.pitch, this.seatTargetPitch, easeT);

      this.camera.position.copy(this.position);
      this.applyCameraRotation();

      if (t >= 1.0) {
        this.isTransitioningSeat = false;
      }
      return;
    }

    if (this.isSeated) {
      // When seated, only allow subtle look orientation
      this.applyLookInput(input.lookDeltaX, input.lookDeltaY);
      this.applyGyroSmoothing(delta);
      this.applyCameraRotation();
      return;
    }

    // 2. Normal Locomotion
    this.applyLookInput(input.lookDeltaX, input.lookDeltaY);
    this.applyGyroSmoothing(delta);
    this.applyCameraRotation();

    // Check outdoor vs indoor status
    const wasInside = this.isInsideVenue;
    this.isInsideVenue = this.position.z <= this.scene.entranceZ;

    // Movement direction vector relative to camera yaw
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    const moveX = forwardX * input.moveForward + rightX * input.moveRight;
    const moveZ = forwardZ * input.moveForward + rightZ * input.moveRight;
    const moveLen = Math.hypot(moveX, moveZ);

    let targetSpeed = 0;
    if (moveLen > 0.05) {
      targetSpeed = input.sprint ? this.SPRINT_SPEED : this.WALK_SPEED;
    }

    // SPEED LIMIT CHECK: If inside venue and running!
    if (this.isInsideVenue && input.sprint && targetSpeed > this.SPEED_LIMIT) {
      soundEngine.playAlarm();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
      this.onSpeedLimitExceeded();
      return;
    }

    // Exponential velocity damping
    this.currentSpeed = THREE.MathUtils.damp(this.currentSpeed, targetSpeed, 10, delta);

    if (moveLen > 0.05) {
      const normX = moveX / moveLen;
      const normZ = moveZ / moveLen;
      const deltaX = normX * this.currentSpeed * delta;
      const deltaZ = normZ * this.currentSpeed * delta;

      // Move with separate X and Z collision handling for smooth wall sliding
      this.moveWithCollisions(deltaX, deltaZ);

      // Play procedural footsteps
      this.stepTimer += delta * this.currentSpeed;
      if (this.stepTimer > 2.2) {
        soundEngine.playFootstep(input.sprint);
        this.stepTimer = 0;
      }
    } else {
      this.stepTimer = 0;
    }

    // Constrain player within venue and parking boundaries
    this.constrainBounds();

    // Apply gravity and ground physics
    this.applyGravityAndGround(delta);

    this.camera.position.copy(this.position);

    // 3. Proximity Checks (Seat & Exit)
    this.checkSeatProximity();
    this.checkExitProximity();
  }

  private applyLookInput(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.pitch - dy));
  }

  public setDeviceOrientation(alpha: number, beta: number, gamma: number): void {
    this.gyroActive = true;
    // Normalize and convert degrees to radians
    // Beta is pitch (tilt front/back, -180 to 180)
    // Gamma is roll (tilt left/right, -90 to 90)
    // Alpha is compass yaw (0 to 360)
    const radBeta = (beta * Math.PI) / 180;
    const radGamma = (gamma * Math.PI) / 180;

    // Center beta around standard holding angle (~50 degrees)
    this.targetGyroPitch = (radBeta - 0.9) * 0.7;
    this.targetGyroYaw = -radGamma * 0.7;
  }

  private applyGyroSmoothing(delta: number): void {
    if (!this.gyroActive) return;
    // Smooth Lerp to avoid camera jerkiness
    this.gyroPitch = THREE.MathUtils.lerp(this.gyroPitch, this.targetGyroPitch, delta * 6.0);
    this.gyroYaw = THREE.MathUtils.lerp(this.gyroYaw, this.targetGyroYaw, delta * 6.0);
  }

  private applyCameraRotation(): void {
    const finalYaw = this.yaw + this.gyroYaw;
    const finalPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.pitch + this.gyroPitch));
    this.camera.rotation.set(finalPitch, finalYaw, 0, 'YXZ');
  }

  public getFloorHeight(x: number, z: number): number {
    if (z > this.scene.entranceZ) {
      // Outdoor street (Calle Humboldt) and entrance plaza
      return 0.0;
    }

    // Inside Movistar Arena:
    // 1. Entrance Foyer / Hallway (-4.73 >= z > -12.0)
    if (z > -12.0) {
      return 0.2;
    }

    const absX = Math.abs(x);

    // 2. Concert Stage Platform and access ramps (z <= -70.0 and central width)
    if (z <= -70.0 && absX <= 18.0) {
      if (z > -73.0) {
        // Smooth access ramp from campo floor (0.2m) to stage level (1.8m)
        const t = (-70.0 - z) / 3.0;
        return 0.2 + t * 1.6;
      }
      // Main stage platform: explore DJ booth, mics, monitors and look out at 15,000 crowd
      return 1.8;
    }

    // 3. Central Arena Floor (Campo Delantero / VIP Standing)
    if (absX <= 16.0) {
      // Flat central arena floor
      if (z > -68.0) {
        return 0.2;
      }
      // Approach to stage
      const t = Math.min(1.0, (-68.0 - z) / 4.0);
      return 0.2 + t * 1.6;
    }

    // 4. Lower Tier Seated Stands (Platea Baja: 16m < |x| <= 27m, stepped rows)
    if (absX <= 27.0) {
      const row = Math.min(8, Math.floor((absX - 16.0) / 1.2));
      return 0.2 + (row + 1) * 0.58;
    }

    // 5. Mid & Upper Tier Stands (Platea Alta & Tribunas: 27m < |x| <= 40m, steep stepped rows)
    const upperRow = Math.min(8, Math.floor((absX - 27.0) / 1.3));
    return Math.min(14.5, 5.6 + (upperRow + 1) * 0.95);
  }

  private applyGravityAndGround(delta: number): void {
    const floorY = this.getFloorHeight(this.position.x, this.position.z);
    const targetEyeY = floorY + this.EYE_HEIGHT;

    // Apply vertical acceleration/velocity
    this.verticalVelocity -= this.GRAVITY * delta;
    this.position.y += this.verticalVelocity * delta;

    if (this.position.y <= targetEyeY) {
      this.position.y = targetEyeY;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    } else if (this.isGrounded && (this.position.y - targetEyeY) <= 0.35) {
      // Step down smoothly along ramps/stairs without false jumping
      this.position.y = targetEyeY;
      this.verticalVelocity = 0;
    } else {
      this.isGrounded = false;
    }
  }

  /**
   * Complete 3D collision check against all venue walls and solid obstacles.
   * r: player collision radius (default 0.45m)
   */
  public isPointBlocked(x: number, z: number, r = 0.45): boolean {
    const entranceZ = this.scene.entranceZ; // -4.73

    // 1. Solid Front Facade Left and Right Wings
    // Front wall is centered at Z = -4.73, thickness ~1.2m (Z from -5.35 to -4.1)
    // The 16 entrance gates are located from X = -18.65 to X = +18.65
    // Solid concrete facade wings exist for |X| >= 18.65
    const isInsideFrontWallBand = z >= -5.35 - r && z <= -4.1 + r;
    if (isInsideFrontWallBand) {
      if (x <= -18.65 + r || x >= 18.65 - r) {
        return true;
      }
    }

    // 2. Return Side Exterior Walls (spanning from front facade Z = -4.73 back to Z = -22 at |X| = 48)
    if (z >= -22.0 && z <= -4.1 + r) {
      if (Math.abs(x) >= 48.0 - r) {
        return true;
      }
    }

    // 3. Inside Arena Enclosure Boundaries (when inside, Z <= entranceZ)
    if (z <= entranceZ) {
      // Left acoustic side wall at X = -39.0
      if (x <= -38.6 + r) return true;
      // Right acoustic side wall at X = +39.0
      if (x >= 38.6 - r) return true;
      // Rear stage wall at Z = -86.5
      if (z <= -86.2 + r) return true;

      // Soundboard / FOH mixing console tower at X = 0, Z = -38 (width 6.5m, depth 4.0m)
      if (Math.abs(x) <= 3.25 + r && Math.abs(z - (-38.0)) <= 2.0 + r) {
        return true;
      }
    }

    // 4. Outdoor Calle Humboldt Boundaries (when outside, Z > entranceZ)
    if (z > entranceZ) {
      // Far sidewalk / street boundary across Humboldt (Z = 30.5)
      if (z >= 30.2 - r) return true;
      // Calle Humboldt west end (X = -64.0)
      if (x <= -64.0 + r) return true;
      // Calle Humboldt east end (X = 64.0)
      if (x >= 64.0 - r) return true;

      // Parked car on Calle Humboldt at X = -6.0, Z = 18.0 (width 2.4, length 4.8)
      if (Math.abs(x - (-6.0)) <= 1.35 + r && Math.abs(z - 18.0) <= 2.5 + r) {
        return true;
      }
    }

    return false;
  }

  private moveWithCollisions(deltaX: number, deltaZ: number): void {
    const r = 0.45; // Collision radius

    // Slide along X axis if free
    const targetX = this.position.x + deltaX;
    if (!this.isPointBlocked(targetX, this.position.z, r)) {
      this.position.x = targetX;
    }

    // Slide along Z axis if free
    const targetZ = this.position.z + deltaZ;
    if (!this.isPointBlocked(this.position.x, targetZ, r)) {
      this.position.z = targetZ;
    }

    // Enforce hard boundary limits
    this.constrainBounds();
  }

  private constrainBounds(): void {
    const r = 0.45;
    const entranceZ = this.scene.entranceZ;

    if (this.position.z > entranceZ) {
      // Outdoor street boundaries
      this.position.x = Math.max(-64.0 + r, Math.min(64.0 - r, this.position.x));
      this.position.z = Math.min(30.2 - r, this.position.z);

      // Cannot walk into solid front wall from outside
      if (this.position.x < -18.65 + r || this.position.x > 18.65 - r) {
        this.position.z = Math.max(-4.1 + r, this.position.z);
      }
    } else {
      // Indoor venue boundaries
      this.position.x = Math.max(-38.6 + r, Math.min(38.6 - r, this.position.x));
      this.position.z = Math.max(-86.2 + r, this.position.z);

      // Cannot walk into solid front wall from inside
      if (this.position.x < -18.65 + r || this.position.x > 18.65 - r) {
        this.position.z = Math.min(-5.35 - r, this.position.z);
      }
    }
  }

  private checkSeatProximity(): void {
    const target = this.scene.targetSeatCoords.position;
    const dist = Math.hypot(this.position.x - target.x, this.position.z - target.z);
    const near = dist < 2.4 && this.isInsideVenue;
    if (near !== this.isNearSeat) {
      this.isNearSeat = near;
      this.onNearSeatChanged(near);
      if (near && navigator.vibrate) {
        navigator.vibrate(40);
      }
    }
  }

  private checkExitProximity(): void {
    for (const exit of this.scene.exitLocations) {
      const dist = Math.hypot(this.position.x - exit.x, this.position.z - exit.z);
      if (dist < 2.8) {
        this.isNearExit = true;
        this.onExitReached();
        return;
      }
    }
    this.isNearExit = false;
  }

  // --- Sit Down Action ---
  public sitDown(): void {
    if (this.isSeated || this.isTransitioningSeat) return;
    this.isSeated = true;
    this.isTransitioningSeat = true;
    this.seatTransitionProgress = 0;

    this.seatStartPos.copy(this.position);
    const targetSeat = this.scene.targetSeatCoords.position;
    // Seated camera height is ~1.05m above seat base
    this.seatTargetPos.set(targetSeat.x, targetSeat.y + 0.95, targetSeat.z + 0.15);

    // Calculate yaw towards the stage center
    const toStage = new THREE.Vector3().subVectors(this.scene.targetSeatCoords.lookTarget, this.seatTargetPos);
    this.seatTargetYaw = Math.atan2(-toStage.x, -toStage.z);
    this.seatTargetPitch = 0.08;

    soundEngine.playSitDown();
    if (navigator.vibrate) navigator.vibrate([40, 30, 60]);
  }

  // --- Stand Up Action ---
  public standUp(): void {
    if (!this.isSeated) return;
    this.isSeated = false;
    this.position.y += 0.6;
    soundEngine.playSitDown();
    if (navigator.vibrate) navigator.vibrate(30);
  }

  // --- Jump Action ---
  public jump(): boolean {
    if (this.isSeated || this.isTransitioningSeat) return false;
    const floorY = this.getFloorHeight(this.position.x, this.position.z);
    const targetEyeY = floorY + this.EYE_HEIGHT;
    // Allow jumping if grounded or within 0.45m of ground or vertical velocity close to 0
    const nearGround = (this.position.y - targetEyeY) <= 0.45;
    if (this.isGrounded || nearGround) {
      this.verticalVelocity = 6.8; // Clean, natural jump launch impulse
      this.position.y += 0.06; // Immediately lift off ground
      this.isGrounded = false;
      soundEngine.playJump();
      if (navigator.vibrate) navigator.vibrate(25);
      return true;
    }
    return false;
  }

  // --- Real-world GPS forward movement ---
  public moveForwardByDistance(distanceMeters: number): void {
    if (this.isSeated || this.isTransitioningSeat) return;
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    this.position.x += forwardX * distanceMeters;
    this.position.z += forwardZ * distanceMeters;
    this.constrainBounds();
  }

  public resetToEntrance(): void {
    this.position.set(0, 1.65, 3.0);
    this.yaw = Math.PI;
    this.pitch = 0;
    this.currentSpeed = 0;
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.isSeated = false;
    this.isTransitioningSeat = false;
    this.camera.position.copy(this.position);
    this.applyCameraRotation();
  }
}
