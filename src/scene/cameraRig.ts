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
  public yaw = 0; // Face forward toward vehicle and venue facade (looking down -Z)
  public pitch = 0;

  // Player state
  public isInsideVenue = false;
  public isSeated = false;
  public isNearSeat = false;
  public isNearExit = false;
  public currentSpeed = 0; // m/s
  public allowSprintInVenue = false; // When arena is empty, user can sprint freely inside!

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

  // Stage switchboard & Any-seat interaction
  public isNearStagePanel = false;
  public activeAnySeat: { pos: THREE.Vector3; rotY: number; label: string } | null = null;

  // Callbacks
  public onSpeedLimitExceeded: () => void = () => {};
  public onNearSeatChanged: (near: boolean, seatLabel?: string) => void = () => {};
  public onNearStagePanelChanged: (near: boolean) => void = () => {};
  public onExitReached: () => void = () => {};

  constructor(scene: VenueScene) {
    this.scene = scene;
    this.camera = scene.camera;
    // Initial position outside on Calle Humboldt facing the vehicle and Movistar Arena facade
    this.position = new THREE.Vector3(2.5, 1.65, 18.0);
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
      this.applyCameraRotation();
      return;
    }

    // 2. Normal Locomotion
    this.applyLookInput(input.lookDeltaX, input.lookDeltaY);
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

    // SPEED LIMIT CHECK: If inside venue and running! (Allowed once venue is empty and user is last)
    if (this.isInsideVenue && input.sprint && targetSpeed > this.SPEED_LIMIT && !this.allowSprintInVenue) {
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

    // 3. Proximity Checks (Seat, Stage Switchboard & Exit)
    this.checkSeatProximity();
    this.checkStagePanelProximity();
    this.checkExitProximity();
  }

  private applyLookInput(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.pitch - dy));
  }

  private applyCameraRotation(): void {
    const finalPitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.pitch));
    this.camera.rotation.set(finalPitch, this.yaw, 0, 'YXZ');
  }

  public getFloorHeight(x: number, z: number): number {
    if (z > this.scene.entranceZ) {
      // Outdoor street (Calle Humboldt) and entrance plaza
      return 0.0;
    }

    const absX = Math.abs(x);

    // 1. Entrance Stepped Gradas / Stands (Cabecera rear tiers flanking the entrance corridor)
    // Left (X: -28.2 to -9.8) and Right (X: +9.8 to +28.2), from Z = -22.0 to Z = -6.0
    // 6 stepped rows: rise = 0.72m, run = 2.3m along Z
    if (z <= -6.0 && z >= -22.0 && absX >= 9.8 && absX <= 28.5) {
      const stepRow = Math.min(5, Math.max(0, Math.floor((z - (-22.0)) / 2.3)));
      return 0.2 + (stepRow + 1) * 0.72;
    }

    // 1b. Top back landing behind entrance gradas (Z from -6.0 to -4.73, |X| between 9.8 and 28.5)
    if (z > -6.0 && z <= this.scene.entranceZ && absX >= 9.8 && absX <= 28.5) {
      return 0.2 + 6 * 0.72; // 4.52m top landing
    }

    // 1c. Entrance Foyer / Central Hallway corridor (-4.73 >= z > -12.0)
    if (z > -12.0 || absX < 10.0) {
      if (z > -22.0) {
        return 0.2;
      }
    }

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
    } else if (this.isGrounded && (this.position.y - targetEyeY) <= 0.85) {
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
    const absX = Math.abs(x);

    // 1. Outside Entrance Flank Security Walls (Z = -4.73 to Z = 5.0, at X = +-19.0)
    // Physical lateral walls containing the entrance queue plaza
    if (z >= -4.73 - r && z <= 5.0 + r && Math.abs(absX - 19.0) <= 0.35 + r) {
      return true;
    }

    // 2. Solid Front Facade Left and Right Wings
    // Centered at Z = -4.73, thickness ~1.2m (Z from -5.35 to -4.1)
    // The 16 entrance gates are located between X = -18.65 and X = +18.65
    const isInsideFrontWallBand = z >= -5.35 - r && z <= -4.1 + r;
    if (isInsideFrontWallBand) {
      if (absX >= 18.65 - r) {
        return true;
      }
    }

    // 3. Inside Entrance Hallway Side Enclosure Walls (Z = -4.73 to Z = -22.0 at X = +-28.4)
    if (z >= -22.0 - r && z <= -4.73 + r && absX >= 28.0 - r) {
      return true;
    }

    // 4. Inner Glass Balustrades Flanking Central Entrance Corridor (X = +-9.95, Z = -22.0 to -8.2)
    // Prevents clipping sideways through railings into the entrance gradas
    if (z >= -22.0 && z <= -8.2 && Math.abs(absX - 9.95) <= 0.18 + r) {
      return true;
    }

    // 5. Rear Enclosure behind the top of Entrance Gradas (Z = -6.0 to -4.73)
    if (z >= -5.8 - r && z <= -4.73 + r && absX >= 9.8 && absX <= 28.5) {
      return true;
    }

    // 6. Return Side Exterior Walls (spanning from front facade Z = -4.73 back to Z = -22 at |X| = 48)
    if (z >= -22.0 && z <= -4.1 + r && absX >= 48.0 - r) {
      return true;
    }

    // 7. Inside Arena Enclosure Boundaries (when inside, Z <= entranceZ)
    if (z <= entranceZ) {
      // Left and right acoustic side walls at X = +-39.0
      if (absX >= 38.6 - r) return true;
      // Rear stage wall at Z = -86.5
      if (z <= -86.2 + r) return true;

      // 7b. Dividing Walls between Campo Delantero and Planta Baja Trasera (Z = -43.5)
      // Spans lateral widths |X| between 1.85 and 14.0, preserving the central corridor
      if (Math.abs(z - (-43.5)) <= 0.25 + r && absX >= 1.85 - r && absX <= 14.0 + r) {
        return true;
      }

      // 7c. Ground Floor Seat Rows Collision (Campo Delantero & Planta Baja Trasera)
      // Blocks walking through the physical chair blocks when standing, while keeping central walkway |x| < 1.05 and row aisles navigable
      if (!this.isSeated && !this.isTransitioningSeat && this.position.y < 1.45) {
        if (absX >= 1.05 - r && absX <= 14.2 + r) {
          const groundRows = [-26, -29, -32, -35, -38, -41, -46, -49, -52, -55, -58, -61, -64, -67];
          for (let i = 0; i < groundRows.length; i++) {
            if (Math.abs(z - groundRows[i]) <= 0.45 + r) {
              return true;
            }
          }
        }
      }

      // 7d. Stage Switchboard Rack Console (Z = -83.7 on stage platform)
      if (this.position.y >= 1.4 && Math.abs(z - (-83.7)) <= 0.35 + r && absX <= 1.25 + r) {
        return true;
      }
    }

    // 8. Outdoor Calle Humboldt Boundaries & Parked Vehicle Fleet Collisions
    if (z > entranceZ) {
      // Far sidewalk / street boundary across Humboldt (Z = 30.5)
      if (z >= 30.2 - r) return true;
      // Calle Humboldt west and east limits
      if (absX >= 64.0 - r) return true;

      // Check all parked vehicles on Calle Humboldt
      if (this.scene.parkedCarColliders && this.scene.parkedCarColliders.length > 0) {
        for (const car of this.scene.parkedCarColliders) {
          if (
            x >= car.minX - r &&
            x <= car.maxX + r &&
            z >= car.minZ - r &&
            z <= car.maxZ + r
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  private moveWithCollisions(deltaX: number, deltaZ: number): void {
    const r = 0.45; // Collision radius
    const currentFloor = this.getFloorHeight(this.position.x, this.position.z);

    // Slide along X axis if free and step height manageable
    const targetX = this.position.x + deltaX;
    const floorX = this.getFloorHeight(targetX, this.position.z);
    if (!this.isPointBlocked(targetX, this.position.z, r) && (floorX - currentFloor <= 0.85 || !this.isGrounded)) {
      this.position.x = targetX;
    }

    // Slide along Z axis if free and step height manageable
    const targetZ = this.position.z + deltaZ;
    const floorZ = this.getFloorHeight(this.position.x, targetZ);
    if (!this.isPointBlocked(this.position.x, targetZ, r) && (floorZ - currentFloor <= 0.85 || !this.isGrounded)) {
      this.position.z = targetZ;
    }

    // Enforce hard boundary limits
    this.constrainBounds();
  }

  private constrainBounds(): void {
    const r = 0.45;
    const entranceZ = this.scene.entranceZ;

    if (this.position.z > entranceZ) {
      // If in outdoor entrance plaza (Z from -4.73 to 5.0), enforce lateral side walls
      if (this.position.z < 5.0) {
        this.position.x = Math.max(-18.65 + r, Math.min(18.65 - r, this.position.x));
      } else {
        // Calle Humboldt street boundaries
        this.position.x = Math.max(-64.0 + r, Math.min(64.0 - r, this.position.x));
        this.position.z = Math.min(30.2 - r, this.position.z);
      }

      // Cannot walk into solid front wall wings from outside
      if (Math.abs(this.position.x) > 18.65 - r) {
        this.position.z = Math.max(-4.1 + r, this.position.z);
      }
    } else {
      // Indoor venue boundaries
      if (this.position.z > -22.0) {
        // Enforce hallway side walls
        this.position.x = Math.max(-28.0 + r, Math.min(28.0 - r, this.position.x));
      } else {
        this.position.x = Math.max(-38.6 + r, Math.min(38.6 - r, this.position.x));
      }
      this.position.z = Math.max(-86.2 + r, this.position.z);

      // Cannot walk into solid front wall wings from inside
      if (Math.abs(this.position.x) > 18.65 - r) {
        this.position.z = Math.min(-5.35 - r, this.position.z);
      }
    }
  }

  private checkSeatProximity(): void {
    if (this.scene.isVenueEmpty) {
      // When venue is empty, allow user to sit in ANY seat in the venue!
      let closestDist = Infinity;
      let closestSeat: { pos: THREE.Vector3; rotY: number; label: string } | null = null;

      for (const seat of this.scene.allSeatPositions) {
        const dist = Math.hypot(this.position.x - seat.pos.x, this.position.z - seat.pos.z);
        if (dist < closestDist) {
          closestDist = dist;
          closestSeat = seat;
        }
      }

      const near = closestDist < 1.65 && this.isInsideVenue;
      if (near && closestSeat) {
        this.activeAnySeat = closestSeat;
        if (!this.isNearSeat) {
          this.isNearSeat = true;
          this.onNearSeatChanged(true, closestSeat.label);
          if (navigator.vibrate) navigator.vibrate(35);
        }
      } else {
        this.activeAnySeat = null;
        if (this.isNearSeat) {
          this.isNearSeat = false;
          this.onNearSeatChanged(false);
        }
      }
      return;
    }

    // Normal ticket seat proximity before/during concert
    const target = this.scene.targetSeatCoords.position;
    const dist = Math.hypot(this.position.x - target.x, this.position.z - target.z);
    const near = dist < 2.4 && this.isInsideVenue;
    if (near !== this.isNearSeat) {
      this.isNearSeat = near;
      this.activeAnySeat = null;
      this.onNearSeatChanged(near, 'Tu Asiento Asignado');
      if (near && navigator.vibrate) {
        navigator.vibrate(40);
      }
    }
  }

  private checkStagePanelProximity(): void {
    // Switchboard is located under the main LED screen at (0, 2.35, -83.7) on stage (Y >= 1.4)
    const dist = Math.hypot(this.position.x - 0, this.position.z - (-83.7));
    const near = dist < 2.6 && this.position.y >= 1.4 && this.isInsideVenue;
    if (near !== this.isNearStagePanel) {
      this.isNearStagePanel = near;
      this.onNearStagePanelChanged(near);
      if (near && navigator.vibrate) {
        navigator.vibrate(30);
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

    if (this.scene.isVenueEmpty && this.activeAnySeat) {
      // Sit in the detected nearby seat
      const seat = this.activeAnySeat;
      this.seatTargetPos.set(seat.pos.x, seat.pos.y + 0.95, seat.pos.z + 0.15);
      const toStage = new THREE.Vector3(0, 2.5, -80).sub(this.seatTargetPos);
      this.seatTargetYaw = Math.atan2(-toStage.x, -toStage.z);
      this.seatTargetPitch = 0.08;
    } else {
      const targetSeat = this.scene.targetSeatCoords.position;
      // Seated camera height is ~1.05m above seat base
      this.seatTargetPos.set(targetSeat.x, targetSeat.y + 0.95, targetSeat.z + 0.15);

      // Calculate yaw towards the stage center
      const toStage = new THREE.Vector3().subVectors(this.scene.targetSeatCoords.lookTarget, this.seatTargetPos);
      this.seatTargetYaw = Math.atan2(-toStage.x, -toStage.z);
      this.seatTargetPitch = 0.08;
    }

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
    this.yaw = 0; // Look towards entrance doors (down -Z)
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
