export type SimulatorStatus = "idle" | "running";

export interface SimulatorTelemetryEntry {
  label: string;
  value: string;
}

export interface SimulatorRuntimeTelemetryEntry {
  caption: string;
  value: string;
  updatedAtLabel: string;
}

export interface SimulatorLogEntry {
  id: number;
  message: string;
  timestampLabel: string;
}

export type MotorRunMode =
  | "RUN_WITHOUT_ENCODER"
  | "RUN_TO_POSITION"
  | "STOP_AND_RESET_ENCODER";

export interface SimulatorMotorDevice {
  name: string;
  currentTicks: number;
  targetTicks: number;
  power: number;
  runMode: MotorRunMode;
}

export interface SimulatorServoDevice {
  name: string;
  position: number;
}

export interface SimulatorState {
  robotX: number;
  robotY: number;
  robotHeadingDeg: number;
  fieldMinX: number;
  fieldMaxX: number;
  fieldMinY: number;
  fieldMaxY: number;
  drivetrainTrackWidth: number;
  drivetrainMaxSpeed: number;
  drivetrainMaxTurnRateDegPerSecond: number;
  armAngleDeg: number;
  armTargetDeg: number;
  armMinDeg: number;
  armMaxDeg: number;
  clawOpenAmount: number;
  clawTargetAmount: number;
  clawMinAmount: number;
  clawMaxAmount: number;
  armSpeedDegPerSecond: number;
  clawSpeedPerSecond: number;
  status: SimulatorStatus;
  elapsedSeconds: number;
  loopCount: number;
  lastAction: string;
  demoPhase: "raising" | "lowering";
  telemetry: SimulatorTelemetryEntry[];
  runtimeTelemetry: SimulatorRuntimeTelemetryEntry[];
  runtimeTelemetryHistory: SimulatorLogEntry[];
  telemetryLog: SimulatorLogEntry[];
  nextLogId: number;
  motors: Record<string, SimulatorMotorDevice>;
  servos: Record<string, SimulatorServoDevice>;
  armEncoderTicks: number;
  motorRunMode: MotorRunMode;
  motorTargetTicks: number;
  motorPower: number;
}

export type SimulatorAction =
  | { type: "RUN" }
  | { type: "RESET" }
  | { type: "OPEN_CLAW" }
  | { type: "CLOSE_CLAW" }
  | { type: "ARM_DELTA"; deltaDeg: number }
  | { type: "ARM_TARGET"; targetDeg: number }
  | { type: "SET_ARM_TARGET_TICKS"; targetTicks: number }
  | {
      type: "SET_MOTOR_MODE";
      deviceName: string;
      mode: MotorRunMode;
    }
  | { type: "SET_MOTOR_POWER"; deviceName: string; power: number }
  | { type: "SET_CLAW"; deviceName: string; amount: number }
  | { type: "SET_STATUS"; status: SimulatorStatus }
  | { type: "ADD_TELEMETRY"; caption: string; value: string }
  | { type: "SET_LAST_ACTION"; label: string }
  | { type: "APPEND_LOG"; message: string };

type SimulatorListener = () => void;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const ARM_MOTOR_NAME = "armMotor";
const CLAW_SERVO_NAME = "clawServo";
const LEFT_FRONT_MOTOR_NAME = "leftFront";
const RIGHT_FRONT_MOTOR_NAME = "rightFront";
const THREE_DEG_TO_RAD = Math.PI / 180;

const moveToward = (current: number, target: number, maxDelta: number) => {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }

  return current + Math.sign(target - current) * maxDelta;
};

const normalizeHeadingDegrees = (heading: number) => {
  const normalized = ((heading + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
};

const cloneMotors = (motors: Record<string, SimulatorMotorDevice>) =>
  Object.fromEntries(
    Object.entries(motors).map(([name, motor]) => [name, { ...motor }])
  );

const cloneServos = (servos: Record<string, SimulatorServoDevice>) =>
  Object.fromEntries(
    Object.entries(servos).map(([name, servo]) => [name, { ...servo }])
  );

const getMotor = (state: SimulatorState, deviceName: string) => state.motors[deviceName];

const getServo = (state: SimulatorState, deviceName: string) => state.servos[deviceName];

export function createDefaultSimulatorState(): SimulatorState {
  const initialLog: SimulatorLogEntry = {
    id: 1,
    message: "Simulator initialized",
    timestampLabel: "t+0.00s",
  };

  const state: SimulatorState = {
    robotX: 0,
    robotY: 0,
    robotHeadingDeg: 0,
    fieldMinX: -4.5,
    fieldMaxX: 4.5,
    fieldMinY: -4.5,
    fieldMaxY: 4.5,
    drivetrainTrackWidth: 1.35,
    drivetrainMaxSpeed: 2.8,
    drivetrainMaxTurnRateDegPerSecond: 160,
    armAngleDeg: 12,
    armTargetDeg: 12,
    armMinDeg: -15,
    armMaxDeg: 85,
    clawOpenAmount: 0.6,
    clawTargetAmount: 0.6,
    clawMinAmount: 0.1,
    clawMaxAmount: 1,
    armSpeedDegPerSecond: 55,
    clawSpeedPerSecond: 1.8,
    status: "idle",
    elapsedSeconds: 0,
    loopCount: 0,
    lastAction: "Initialized simulator",
    demoPhase: "raising",
    telemetry: [],
    runtimeTelemetry: [],
    runtimeTelemetryHistory: [],
    telemetryLog: [initialLog],
    nextLogId: 2,
    motors: {
      [ARM_MOTOR_NAME]: {
        name: ARM_MOTOR_NAME,
        currentTicks: 133,
        targetTicks: 133,
        power: 0,
        runMode: "RUN_WITHOUT_ENCODER",
      },
      [LEFT_FRONT_MOTOR_NAME]: {
        name: LEFT_FRONT_MOTOR_NAME,
        currentTicks: 0,
        targetTicks: 0,
        power: 0,
        runMode: "RUN_WITHOUT_ENCODER",
      },
      [RIGHT_FRONT_MOTOR_NAME]: {
        name: RIGHT_FRONT_MOTOR_NAME,
        currentTicks: 0,
        targetTicks: 0,
        power: 0,
        runMode: "RUN_WITHOUT_ENCODER",
      },
    },
    servos: {
      [CLAW_SERVO_NAME]: {
        name: CLAW_SERVO_NAME,
        position: 0.6,
      },
    },
    armEncoderTicks: 133,
    motorRunMode: "RUN_WITHOUT_ENCODER",
    motorTargetTicks: 133,
    motorPower: 0,
  };

  state.telemetry = buildTelemetry(state);
  return state;
}

function buildTelemetry(state: SimulatorState): SimulatorTelemetryEntry[] {
  return [
    { label: "Status", value: state.status },
    {
      label: "Robot Pose",
      value: `x ${state.robotX.toFixed(2)}, y ${state.robotY.toFixed(2)}, h ${state.robotHeadingDeg.toFixed(0)} deg`,
    },
    {
      label: "Drive Power",
      value: `L ${state.motors[LEFT_FRONT_MOTOR_NAME]?.power.toFixed(2) ?? "0.00"} / R ${state.motors[RIGHT_FRONT_MOTOR_NAME]?.power.toFixed(2) ?? "0.00"}`,
    },
    { label: "Arm Angle", value: `${state.armAngleDeg.toFixed(1)} deg` },
    { label: "Arm Target", value: `${state.armTargetDeg.toFixed(1)} deg` },
    { label: "Claw Open", value: state.clawOpenAmount.toFixed(2) },
    { label: "Arm Encoder", value: `${Math.round(state.armEncoderTicks)} ticks` },
    { label: "Motor Mode", value: state.motorRunMode },
    { label: "Motor Target", value: `${Math.round(state.motorTargetTicks)} ticks` },
    { label: "Claw Target", value: state.clawTargetAmount.toFixed(2) },
    { label: "Elapsed", value: `${state.elapsedSeconds.toFixed(2)} s` },
    { label: "Demo Loops", value: String(state.loopCount) },
    { label: "Last Action", value: state.lastAction },
  ];
}

function reduceSimulatorState(
  previousState: SimulatorState,
  action: SimulatorAction
): SimulatorState {
  if (action.type === "RESET") {
    return createDefaultSimulatorState();
  }

  const nextState: SimulatorState = {
    ...previousState,
    motors: cloneMotors(previousState.motors),
    servos: cloneServos(previousState.servos),
    telemetry: previousState.telemetry,
    runtimeTelemetry: previousState.runtimeTelemetry,
    runtimeTelemetryHistory: previousState.runtimeTelemetryHistory,
    telemetryLog: previousState.telemetryLog,
  };
  const armMotor = getMotor(nextState, ARM_MOTOR_NAME);
  const clawServo = getServo(nextState, CLAW_SERVO_NAME);

  switch (action.type) {
    case "RUN":
      nextState.status = "running";
      nextState.lastAction = "Started demo loop";
      break;
    case "OPEN_CLAW":
      nextState.clawTargetAmount = nextState.clawMaxAmount;
      if (clawServo) {
        clawServo.position = nextState.clawMaxAmount;
      }
      nextState.lastAction = "Open claw";
      break;
    case "CLOSE_CLAW":
      nextState.clawTargetAmount = nextState.clawMinAmount;
      if (clawServo) {
        clawServo.position = nextState.clawMinAmount;
      }
      nextState.lastAction = "Close claw";
      break;
    case "ARM_DELTA":
      nextState.armTargetDeg = clamp(
        nextState.armTargetDeg + action.deltaDeg,
        nextState.armMinDeg,
        nextState.armMaxDeg
      );
      if (armMotor) {
        armMotor.targetTicks = Math.round(nextState.armTargetDeg * 11.08);
      }
      nextState.status = "idle";
      nextState.lastAction = action.deltaDeg > 0 ? "Arm up" : "Arm down";
      break;
    case "ARM_TARGET":
      nextState.armTargetDeg = clamp(
        action.targetDeg,
        nextState.armMinDeg,
        nextState.armMaxDeg
      );
      nextState.motorTargetTicks = Math.round(nextState.armTargetDeg * 11.08);
      if (armMotor) {
        armMotor.targetTicks = nextState.motorTargetTicks;
      }
      nextState.lastAction = "Set arm target";
      break;
    case "SET_ARM_TARGET_TICKS":
      nextState.motorTargetTicks = action.targetTicks;
      nextState.armTargetDeg = clamp(
        action.targetTicks / 11.08,
        nextState.armMinDeg,
        nextState.armMaxDeg
      );
      if (armMotor) {
        armMotor.targetTicks = action.targetTicks;
      }
      nextState.lastAction = "Set motor target position";
      break;
    case "SET_MOTOR_MODE":
      if (nextState.motors[action.deviceName]) {
        nextState.motors[action.deviceName] = {
          ...nextState.motors[action.deviceName],
          runMode: action.mode,
        };
      }
      if (action.deviceName === ARM_MOTOR_NAME) {
        nextState.motorRunMode = action.mode;
      }
      if (action.deviceName === ARM_MOTOR_NAME && action.mode === "STOP_AND_RESET_ENCODER") {
        nextState.armEncoderTicks = 0;
        nextState.armAngleDeg = 0;
        nextState.armTargetDeg = 0;
        nextState.motorTargetTicks = 0;
        nextState.motorPower = 0;
        if (armMotor) {
          armMotor.currentTicks = 0;
          armMotor.targetTicks = 0;
          armMotor.power = 0;
        }
      }
      nextState.lastAction = `Motor mode: ${action.mode}`;
      break;
    case "SET_MOTOR_POWER":
      if (nextState.motors[action.deviceName]) {
        nextState.motors[action.deviceName] = {
          ...nextState.motors[action.deviceName],
          power: clamp(action.power, -1, 1),
        };
      }
      if (action.deviceName === ARM_MOTOR_NAME) {
        nextState.motorPower = clamp(action.power, -1, 1);
        nextState.lastAction = `Motor power: ${nextState.motorPower.toFixed(2)}`;
      } else {
        nextState.lastAction = `Motor power: ${action.deviceName}`;
      }
      break;
    case "SET_CLAW":
      nextState.clawTargetAmount = clamp(
        action.amount,
        nextState.clawMinAmount,
        nextState.clawMaxAmount
      );
      if (nextState.servos[action.deviceName]) {
        nextState.servos[action.deviceName] = {
          ...nextState.servos[action.deviceName],
          position: nextState.clawTargetAmount,
        };
      }
      nextState.lastAction = "Set claw target";
      break;
    case "SET_STATUS":
      nextState.status = action.status;
      nextState.lastAction = `Status set to ${action.status}`;
      break;
    case "ADD_TELEMETRY": {
      const nextEntry: SimulatorRuntimeTelemetryEntry = {
        caption: action.caption,
        value: action.value,
        updatedAtLabel: `t+${previousState.elapsedSeconds.toFixed(2)}s`,
      };
      nextState.runtimeTelemetry = [
        nextEntry,
        ...previousState.runtimeTelemetry.filter((entry) => entry.caption !== action.caption),
      ];
      nextState.runtimeTelemetryHistory = [
        ...previousState.runtimeTelemetryHistory,
        {
          id: previousState.nextLogId,
          message: `${action.caption}: ${action.value}`,
          timestampLabel: nextEntry.updatedAtLabel,
        },
      ].slice(-24);
      nextState.nextLogId = previousState.nextLogId + 1;
      nextState.lastAction = `Telemetry update: ${action.caption}`;
      break;
    }
    case "SET_LAST_ACTION":
      nextState.lastAction = action.label;
      break;
    case "APPEND_LOG":
      nextState.telemetryLog = [
        ...previousState.telemetryLog,
        {
          id: previousState.nextLogId,
          message: action.message,
          timestampLabel: `t+${previousState.elapsedSeconds.toFixed(2)}s`,
        },
      ].slice(-12);
      nextState.nextLogId = previousState.nextLogId + 1;
      break;
  }

  nextState.telemetry = buildTelemetry(nextState);
  return nextState;
}

export interface SimulatorStore {
  dispatch: (action: SimulatorAction) => void;
  getState: () => SimulatorState;
  reset: () => void;
  step: (deltaSeconds: number) => void;
  subscribe: (listener: SimulatorListener) => () => void;
}

export function createSimulatorStore(): SimulatorStore {
  let state = createDefaultSimulatorState();
  const listeners = new Set<SimulatorListener>();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const setState = (nextState: SimulatorState) => {
    state = {
      ...nextState,
      telemetry: buildTelemetry(nextState),
    };
    emit();
  };

  return {
    dispatch(action) {
      setState(reduceSimulatorState(state, action));
    },
    getState() {
      return state;
    },
    reset() {
      setState(createDefaultSimulatorState());
    },
    step(deltaSeconds) {
      if (deltaSeconds <= 0) {
        return;
      }

      const nextState: SimulatorState = {
        ...state,
        motors: cloneMotors(state.motors),
        servos: cloneServos(state.servos),
        elapsedSeconds: state.elapsedSeconds + deltaSeconds,
      };
      const armMotor = getMotor(nextState, ARM_MOTOR_NAME);
      const clawServo = getServo(nextState, CLAW_SERVO_NAME);

      if (state.status === "running") {
        if (state.demoPhase === "raising" && state.armTargetDeg >= state.armMaxDeg - 0.5) {
          nextState.demoPhase = "lowering";
          nextState.armTargetDeg = state.armMinDeg + 20;
          nextState.clawTargetAmount = state.clawMinAmount;
          nextState.loopCount = state.loopCount + 1;
          nextState.lastAction = "Demo cycle: lowering arm";
        } else if (
          state.demoPhase === "lowering" &&
          state.armTargetDeg <= state.armMinDeg + 20.5
        ) {
          nextState.demoPhase = "raising";
          nextState.armTargetDeg = state.armMaxDeg;
          nextState.clawTargetAmount = state.clawMaxAmount;
          nextState.lastAction = "Demo cycle: raising arm";
        } else if (Math.abs(state.armTargetDeg - state.armAngleDeg) < 0.5) {
          nextState.armTargetDeg =
            state.demoPhase === "raising" ? state.armMaxDeg : state.armMinDeg + 20;
          }
      }

      const armMotorRunMode = armMotor?.runMode ?? state.motorRunMode;
      const armMotorPower = armMotor?.power ?? state.motorPower;
      const armMotorTargetTicks = armMotor?.targetTicks ?? state.motorTargetTicks;
      const leftDriveMotor = getMotor(nextState, LEFT_FRONT_MOTOR_NAME);
      const rightDriveMotor = getMotor(nextState, RIGHT_FRONT_MOTOR_NAME);

      if (armMotorRunMode === "RUN_TO_POSITION" && Math.abs(armMotorPower) > 0.001) {
        nextState.armTargetDeg = clamp(
          armMotorTargetTicks / 11.08,
          state.armMinDeg,
          state.armMaxDeg
        );
      } else if (armMotorRunMode === "RUN_WITHOUT_ENCODER" && Math.abs(armMotorPower) > 0.001) {
        nextState.armTargetDeg = clamp(
          state.armAngleDeg + armMotorPower * state.armSpeedDegPerSecond * 0.35,
          state.armMinDeg,
          state.armMaxDeg
        );
      }

      nextState.armAngleDeg = moveToward(
        state.armAngleDeg,
        nextState.armTargetDeg,
        Math.max(0.01, Math.abs(armMotorPower)) *
          state.armSpeedDegPerSecond *
          deltaSeconds
      );
      nextState.armEncoderTicks = nextState.armAngleDeg * 11.08;
      nextState.motorRunMode = armMotorRunMode;
      nextState.motorPower = armMotorPower;
      nextState.motorTargetTicks = armMotorTargetTicks;
      if (armMotor) {
        armMotor.currentTicks = nextState.armEncoderTicks;
        armMotor.targetTicks = armMotorTargetTicks;
      }

      if (
        armMotorRunMode === "RUN_TO_POSITION" &&
        Math.abs(nextState.armEncoderTicks - armMotorTargetTicks) < 6
      ) {
        nextState.motorPower = 0;
        if (armMotor) {
          armMotor.power = 0;
        }
      }
      nextState.clawOpenAmount = moveToward(
        state.clawOpenAmount,
        nextState.clawTargetAmount,
        state.clawSpeedPerSecond * deltaSeconds
      );
      if (clawServo) {
        clawServo.position = nextState.clawOpenAmount;
      }

      const leftDrivePower = leftDriveMotor?.power ?? 0;
      const rightDrivePower = rightDriveMotor?.power ?? 0;
      const forwardVelocity =
        ((leftDrivePower + rightDrivePower) * 0.5) * nextState.drivetrainMaxSpeed;
      const turnVelocityDeg =
        ((rightDrivePower - leftDrivePower) / Math.max(nextState.drivetrainTrackWidth, 0.001)) *
        nextState.drivetrainMaxTurnRateDegPerSecond;
      const nextHeadingDeg =
        nextState.robotHeadingDeg + turnVelocityDeg * deltaSeconds;
      const headingRad = THREE_DEG_TO_RAD * nextHeadingDeg;

      nextState.robotHeadingDeg = normalizeHeadingDegrees(nextHeadingDeg);
      nextState.robotX = clamp(
        nextState.robotX + Math.sin(headingRad) * forwardVelocity * deltaSeconds,
        nextState.fieldMinX,
        nextState.fieldMaxX
      );
      nextState.robotY = clamp(
        nextState.robotY + Math.cos(headingRad) * forwardVelocity * deltaSeconds,
        nextState.fieldMinY,
        nextState.fieldMaxY
      );

      if (leftDriveMotor) {
        leftDriveMotor.currentTicks += leftDrivePower * 48 * deltaSeconds;
      }
      if (rightDriveMotor) {
        rightDriveMotor.currentTicks += rightDrivePower * 48 * deltaSeconds;
      }
      nextState.telemetry = buildTelemetry(nextState);

      setState(nextState);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export interface SimulatorBridge {
  armDown: () => void;
  armUp: () => void;
  closeClaw: () => void;
  dispatchAction: (action: SimulatorAction) => void;
  getSnapshot: () => SimulatorState;
  getMotorMode: (deviceName: string) => MotorRunMode;
  openClaw: () => void;
  reset: () => void;
  run: () => void;
  setMotorPower: (deviceName: string, power: number) => void;
  getMotorCurrentPosition: (deviceName: string) => number;
  isMotorBusy: (deviceName: string) => boolean;
  setMotorMode: (deviceName: string, mode: MotorRunMode) => void;
  setMotorTargetPosition: (deviceName: string, targetTicks: number) => void;
  setServoPosition: (deviceName: string, position: number) => void;
  addTelemetry: (caption: string, value: string | number) => void;
}

export function createSimulatorBridge(store: SimulatorStore): SimulatorBridge {
  const logBridgeMessage = (message: string) => {
    store.dispatch({ type: "APPEND_LOG", message });
  };

  return {
    run() {
      store.dispatch({ type: "RUN" });
      logBridgeMessage("Bridge call: run()");
    },
    reset() {
      store.reset();
    },
    openClaw() {
      store.dispatch({ type: "OPEN_CLAW" });
      logBridgeMessage("Bridge call: openClaw()");
    },
    closeClaw() {
      store.dispatch({ type: "CLOSE_CLAW" });
      logBridgeMessage("Bridge call: closeClaw()");
    },
    armUp() {
      store.dispatch({ type: "ARM_DELTA", deltaDeg: 12 });
      logBridgeMessage("Bridge call: armUp()");
    },
    armDown() {
      store.dispatch({ type: "ARM_DELTA", deltaDeg: -12 });
      logBridgeMessage("Bridge call: armDown()");
    },
    dispatchAction(action) {
      store.dispatch(action);
      logBridgeMessage(`Bridge action: ${action.type}`);
    },
    getSnapshot() {
      return store.getState();
    },
    getMotorMode(deviceName) {
      return getMotor(store.getState(), deviceName)?.runMode ?? "RUN_WITHOUT_ENCODER";
    },
    setMotorPower(deviceName, power) {
      const normalizedPower = clamp(power, -1, 1);

      if (getMotor(store.getState(), deviceName)) {
        store.dispatch({ type: "SET_MOTOR_POWER", deviceName, power: normalizedPower });
        store.dispatch({
          type: "SET_LAST_ACTION",
          label: `motor.setPower(${deviceName}, ${normalizedPower.toFixed(2)})`,
        });
        logBridgeMessage(
          `motor.setPower("${deviceName}", ${normalizedPower.toFixed(2)})`
        );
      }
    },
    getMotorCurrentPosition(deviceName) {
      return Math.round(getMotor(store.getState(), deviceName)?.currentTicks ?? 0);
    },
    isMotorBusy(deviceName) {
      const motor = getMotor(store.getState(), deviceName);
      if (motor) {
        return (
          motor.runMode === "RUN_TO_POSITION" &&
          Math.abs(motor.currentTicks - motor.targetTicks) >= 6
        );
      }

      return false;
    },
    setMotorMode(deviceName, mode) {
      if (getMotor(store.getState(), deviceName)) {
        store.dispatch({ type: "SET_MOTOR_MODE", deviceName, mode });
        logBridgeMessage(`motor.setMode("${deviceName}", ${mode})`);
      }
    },
    setMotorTargetPosition(deviceName, targetTicks) {
      if (getMotor(store.getState(), deviceName)) {
        store.dispatch({ type: "SET_ARM_TARGET_TICKS", targetTicks });
        logBridgeMessage(`motor.setTargetPosition("${deviceName}", ${targetTicks})`);
      }
    },
    setServoPosition(deviceName, position) {
      const normalizedPosition = clamp(position, 0, 1);

      if (getServo(store.getState(), deviceName)) {
        store.dispatch({ type: "SET_CLAW", deviceName, amount: normalizedPosition });
        store.dispatch({
          type: "SET_LAST_ACTION",
          label: `servo.setPosition(${deviceName}, ${normalizedPosition.toFixed(2)})`,
        });
        logBridgeMessage(
          `servo.setPosition("${deviceName}", ${normalizedPosition.toFixed(2)})`
        );
      }
    },
    addTelemetry(caption, value) {
      store.dispatch({
        type: "ADD_TELEMETRY",
        caption,
        value: String(value),
      });
      store.dispatch({
        type: "SET_LAST_ACTION",
        label: `telemetry.addData(${caption}, ${String(value)})`,
      });
      logBridgeMessage(`telemetry.addData("${caption}", ${String(value)})`);
    },
  };
}
