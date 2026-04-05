"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_BUILDER_LIBRARY } from "@/lib/simulator/builder/defaultLibrary";
import type {
  BuilderAssemblyInstance,
  BuilderComponentCategory,
  BuilderComponentDefinition,
  TeacherLessonDraft,
} from "@/lib/simulator/builder/types";

const STARTER_TELEOP = `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name = "Student TeleOp")
public class StudentTeleOp extends LinearOpMode {
  @Override
  public void runOpMode() throws Exception {
    waitForStart();

    while (opModeIsActive()) {
      // TODO: Drive the robot with the joysticks.
      // TODO: Map the arm and claw controls.
      telemetry.addData("status", "student teleop running");
      sleep(50);
    }
  }
}
`;

const CATEGORY_OPTIONS: Array<BuilderComponentCategory | "all"> = [
  "all",
  "drive",
  "mechanism",
  "structure",
  "sensor",
  "control",
];

const makeDraftId = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "teacher-draft";

const makeInstanceId = () =>
  `instance-${Math.random().toString(36).slice(2, 10)}`;

function getComponentById(
  library: BuilderComponentDefinition[],
  componentId: string
) {
  return library.find((component) => component.id === componentId) ?? null;
}

function suggestDeviceName(
  component: BuilderComponentDefinition,
  assembly: BuilderAssemblyInstance[]
) {
  if (component.simulatorRole === "driveMotor") {
    const driveMotors = assembly.filter((instance) =>
      instance.deviceName.startsWith("leftFront") ||
      instance.deviceName.startsWith("rightFront") ||
      instance.deviceName.startsWith("driveMotor")
    );
    if (driveMotors.length === 0) {
      return "leftFront";
    }
    if (driveMotors.length === 1) {
      return "rightFront";
    }
  }

  const baseName =
    component.defaultDeviceName ??
    component.displayName.charAt(0).toLowerCase() +
      component.displayName.slice(1).replace(/[^a-zA-Z0-9]/g, "");
  const existingNames = new Set(assembly.map((instance) => instance.deviceName));
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  while (existingNames.has(`${baseName}${suffix}`)) {
    suffix += 1;
  }
  return `${baseName}${suffix}`;
}

function createAssemblyInstance(
  component: BuilderComponentDefinition,
  assembly: BuilderAssemblyInstance[]
): BuilderAssemblyInstance {
  return {
    instanceId: makeInstanceId(),
    componentId: component.id,
    displayName: component.displayName,
    deviceName: suggestDeviceName(component, assembly),
    attachmentTargetId: null,
    attachmentPoint: component.attachmentPoints[0] ?? null,
    notes: "",
    colorOverride: component.color,
  };
}

function validateImportedComponent(value: unknown): BuilderComponentDefinition[] {
  const entries = Array.isArray(value) ? value : [value];

  return entries.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Imported item ${index + 1} is not an object.`);
    }

    const candidate = entry as Partial<BuilderComponentDefinition>;
    if (!candidate.id || !candidate.displayName || !candidate.category || !candidate.simulatorRole) {
      throw new Error(
        `Imported item ${index + 1} must include id, displayName, category, and simulatorRole.`
      );
    }

    return {
      id: candidate.id,
      displayName: candidate.displayName,
      category: candidate.category,
      simulatorRole: candidate.simulatorRole,
      description: candidate.description ?? "Custom teacher-imported component.",
      color: candidate.color ?? "#475569",
      dimensions: candidate.dimensions ?? { width: 4, height: 4, depth: 4 },
      attachmentPoints: candidate.attachmentPoints ?? ["mount"],
      defaultDeviceName: candidate.defaultDeviceName,
      assetSource: "custom",
      tags: candidate.tags ?? ["custom"],
    };
  });
}

function LibraryCard({
  component,
  onAdd,
}: {
  component: BuilderComponentDefinition;
  onAdd: (component: BuilderComponentDefinition) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library:${component.id}`,
    data: {
      source: "library",
      componentId: component.id,
    },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{
        transform: CSS.Translate.toString(transform),
      }}
      className={`group w-full rounded-2xl border p-4 text-left transition ${
        isDragging
          ? "border-white/30 bg-white/[0.06] opacity-70"
          : "border-white/10 bg-black hover:border-white/20 hover:bg-[#090909]"
      }`}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onAdd(component)}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-white">{component.displayName}</div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            {component.category}
          </div>
        </div>
        <div
          className="h-4 w-4 rounded-full border border-white/20"
          style={{ backgroundColor: component.color }}
        />
      </div>
      <p className="mb-3 text-sm text-zinc-400">{component.description}</p>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{component.assetSource === "custom" ? "Custom" : "Built-in"}</span>
        <span>Double-click to add</span>
      </div>
    </button>
  );
}

function AssemblyCard({
  instance,
  component,
  isSelected,
  onSelect,
  onRemove,
}: {
  instance: BuilderAssemblyInstance;
  component: BuilderComponentDefinition | null;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const draggable = useDraggable({
    id: instance.instanceId,
    data: {
      source: "assembly",
      instanceId: instance.instanceId,
    },
  });
  const droppable = useDroppable({
    id: instance.instanceId,
  });

  return (
    <div
      ref={(node) => {
        draggable.setNodeRef(node);
        droppable.setNodeRef(node);
      }}
      style={{
        transform: CSS.Translate.toString(draggable.transform),
      }}
      className={`rounded-2xl border p-4 transition ${
        isSelected
          ? "border-white/25 bg-white/[0.05]"
          : "border-white/10 bg-black"
      } ${draggable.isDragging ? "opacity-60" : ""} ${
        droppable.isOver ? "ring-2 ring-white/30" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onSelect}
        >
          <div className="mb-1 flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full border border-white/20"
              style={{ backgroundColor: instance.colorOverride ?? component?.color ?? "#64748b" }}
            />
            <span className="truncate font-medium text-white">{instance.displayName}</span>
          </div>
          <div className="text-sm text-zinc-400">{component?.simulatorRole ?? "unknown role"}</div>
          <div className="mt-2 font-mono text-xs text-zinc-200">{instance.deviceName}</div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:border-white/20 hover:text-white"
            {...draggable.listeners}
            {...draggable.attributes}
          >
            Drag
          </button>
          <button
            type="button"
            className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300 hover:border-white/20 hover:text-white"
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function AssemblyCanvas({
  assembly,
  library,
  selectedInstanceId,
  onSelect,
  onRemove,
}: {
  assembly: BuilderAssemblyInstance[];
  library: BuilderComponentDefinition[];
  selectedInstanceId: string | null;
  onSelect: (instanceId: string) => void;
  onRemove: (instanceId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "assembly-canvas",
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[520px] rounded-[28px] border p-4 transition ${
        isOver
          ? "border-white/25 bg-white/[0.03]"
          : "border-white/10 bg-[#050505]"
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-[0.24em] text-zinc-500">
            Assembly Canvas
          </div>
          <div className="text-sm text-zinc-400">
            Drag from the library or reorder existing parts to shape the robot lesson.
          </div>
        </div>
        <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
          {assembly.length} part{assembly.length === 1 ? "" : "s"}
        </div>
      </div>

      {assembly.length > 0 ? (
        <div className="space-y-3">
          {assembly.map((instance) => (
            <AssemblyCard
              key={instance.instanceId}
              instance={instance}
              component={getComponentById(library, instance.componentId)}
              isSelected={selectedInstanceId === instance.instanceId}
              onSelect={() => onSelect(instance.instanceId)}
              onRemove={() => onRemove(instance.instanceId)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[420px] items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-black px-8 text-center text-zinc-500">
          Drag a chassis, motors, or mechanisms here to start building a lesson robot.
        </div>
      )}
    </div>
  );
}

export default function SimulatorBuilderClient() {
  const sensors = useSensors(useSensor(PointerSensor));
  const [lessonTitle, setLessonTitle] = useState("Teacher Robot Builder");
  const [objective, setObjective] = useState(
    "Students finish the TeleOp so the robot can drive, raise the arm, and open the claw."
  );
  const [starterCode, setStarterCode] = useState(STARTER_TELEOP);
  const [categoryFilter, setCategoryFilter] = useState<BuilderComponentCategory | "all">("all");
  const [library, setLibrary] = useState<BuilderComponentDefinition[]>(DEFAULT_BUILDER_LIBRARY);
  const [assembly, setAssembly] = useState<BuilderAssemblyInstance[]>([
    createAssemblyInstance(DEFAULT_BUILDER_LIBRARY[0], []),
    createAssemblyInstance(DEFAULT_BUILDER_LIBRARY[1], [
      createAssemblyInstance(DEFAULT_BUILDER_LIBRARY[0], []),
    ]),
  ]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const selectedInstance = assembly.find((instance) => instance.instanceId === selectedInstanceId) ?? null;
  const selectedComponent = selectedInstance
    ? getComponentById(library, selectedInstance.componentId)
    : null;

  const filteredLibrary = useMemo(() => {
    if (categoryFilter === "all") {
      return library;
    }
    return library.filter((component) => component.category === categoryFilter);
  }, [categoryFilter, library]);

  const lessonDraft = useMemo<TeacherLessonDraft>(
    () => ({
      id: makeDraftId(lessonTitle),
      title: lessonTitle,
      objective,
      starterCode,
      componentLibrary: library,
      robotAssembly: assembly,
      simulation: {
        showGamepad: true,
        showTelemetry: true,
        showBridgeLog: true,
      },
    }),
    [assembly, lessonTitle, library, objective, starterCode]
  );

  const addComponentToAssembly = (component: BuilderComponentDefinition, index?: number) => {
    setAssembly((previous) => {
      const nextInstance = createAssemblyInstance(component, previous);
      const nextAssembly = [...previous];
      if (index === undefined || index < 0 || index > nextAssembly.length) {
        nextAssembly.push(nextInstance);
      } else {
        nextAssembly.splice(index, 0, nextInstance);
      }
      return nextAssembly;
    });
  };

  const moveAssemblyItem = (items: BuilderAssemblyInstance[], from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    if (!overId) {
      return;
    }

    if (activeId.startsWith("library:")) {
      const componentId = activeId.replace("library:", "");
      const component = getComponentById(library, componentId);
      if (!component) {
        return;
      }

      if (overId === "assembly-canvas") {
        addComponentToAssembly(component);
        return;
      }

      const targetIndex = assembly.findIndex((instance) => instance.instanceId === overId);
      addComponentToAssembly(component, targetIndex >= 0 ? targetIndex : undefined);
      return;
    }

    if (!assembly.some((instance) => instance.instanceId === activeId)) {
      return;
    }

    if (overId === "assembly-canvas") {
      return;
    }

    const oldIndex = assembly.findIndex((instance) => instance.instanceId === activeId);
    const newIndex = assembly.findIndex((instance) => instance.instanceId === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
      return;
    }

    setAssembly((previous) => moveAssemblyItem(previous, oldIndex, newIndex));
  };

  const updateSelectedInstance = (
    updater: (instance: BuilderAssemblyInstance) => BuilderAssemblyInstance
  ) => {
    if (!selectedInstanceId) {
      return;
    }

    setAssembly((previous) =>
      previous.map((instance) =>
        instance.instanceId === selectedInstanceId ? updater(instance) : instance
      )
    );
  };

  const removeInstance = (instanceId: string) => {
    setAssembly((previous) => previous.filter((instance) => instance.instanceId !== instanceId));
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    }
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      const imported = validateImportedComponent(parsed);
      setLibrary((previous) => {
        const existingIds = new Set(previous.map((component) => component.id));
        const deduped = imported.filter((component) => !existingIds.has(component.id));
        if (deduped.length === 0) {
          setImportStatus("No new components were added. Use unique ids for imports.");
          return previous;
        }
        setImportStatus(`Imported ${deduped.length} custom component${deduped.length === 1 ? "" : "s"}.`);
        return [...previous, ...deduped];
      });
      setImportText("");
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Import failed.");
    }
  };

  return (
    <div className="min-h-screen bg-black px-5 py-8 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-6">
        <div className="rounded-[32px] border border-white/10 bg-[#050505] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-[11px] uppercase tracking-[0.34em] text-zinc-500">
                Builder
              </p>
              <h1 className="mb-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Build lesson-ready robots in a cleaner workspace
              </h1>
              <p className="mb-0 max-w-2xl text-base text-zinc-400 sm:text-lg">
                Assemble parts, configure device names, import custom components, and generate the
                lesson draft JSON your simulator can consume.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black px-4 py-3">
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                  Library
                </div>
                <div className="text-2xl font-semibold text-white">{library.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black px-4 py-3">
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                  Assembly
                </div>
                <div className="text-2xl font-semibold text-white">{assembly.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black px-4 py-3">
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                  Draft Id
                </div>
                <div className="truncate text-sm font-medium text-white">{lessonDraft.id}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1.15fr)_380px]">
          <Card className="border-white/10 bg-[#050505] text-zinc-100 shadow-none">
            <CardHeader>
              <CardTitle className="text-xl text-white">Lesson Setup</CardTitle>
              <CardDescription className="text-zinc-500">
                Title, objective, and starter code that will ship with the saved robot draft.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-300">Lesson title</label>
                <Input
                  value={lessonTitle}
                  onChange={(event) => setLessonTitle(event.target.value)}
                  className="border-white/10 bg-black text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-300">Objective</label>
                <Textarea
                  value={objective}
                  onChange={(event) => setObjective(event.target.value)}
                  className="min-h-[110px] border-white/10 bg-black text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-300">Starter Java</label>
                <Textarea
                  value={starterCode}
                  onChange={(event) => setStarterCode(event.target.value)}
                  className="min-h-[220px] border-white/10 bg-black font-mono text-xs text-zinc-100"
                />
              </div>
            </CardContent>
          </Card>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="flex flex-col gap-6">
              <Card className="border-white/10 bg-[#050505] text-zinc-100 shadow-none">
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <CardTitle className="text-xl text-white">Component Library</CardTitle>
                      <CardDescription className="text-zinc-500">
                        Drag parts into the robot assembly or double-click to add instantly.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setCategoryFilter(option)}
                          className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] transition ${
                            categoryFilter === option
                              ? "border-white/20 bg-white text-black"
                              : "border-white/10 bg-black text-zinc-500 hover:border-white/20 hover:text-zinc-200"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredLibrary.map((component) => (
                      <LibraryCard
                        key={component.id}
                        component={component}
                        onAdd={addComponentToAssembly}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>

              <AssemblyCanvas
                assembly={assembly}
                library={library}
                selectedInstanceId={selectedInstanceId}
                onSelect={setSelectedInstanceId}
                onRemove={removeInstance}
              />
            </div>
          </DndContext>

          <div className="flex flex-col gap-6">
            <Card className="border-white/10 bg-[#050505] text-zinc-100 shadow-none">
              <CardHeader>
                <CardTitle className="text-xl text-white">Inspector</CardTitle>
                <CardDescription className="text-zinc-500">
                  Tune the selected part and assign the device names your students will code
                  against.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedInstance && selectedComponent ? (
                  <>
                    <div
                      className="rounded-2xl border border-white/10 bg-black p-4"
                    >
                      <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">
                        Selected Component
                      </div>
                      <div className="mt-2 text-xl font-medium text-white">
                        {selectedComponent.displayName}
                      </div>
                      <div className="mt-1 text-sm text-zinc-400">
                        {selectedComponent.description}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-300">Display name</label>
                      <Input
                        value={selectedInstance.displayName}
                        onChange={(event) =>
                          updateSelectedInstance((instance) => ({
                            ...instance,
                            displayName: event.target.value,
                          }))
                        }
                        className="border-white/10 bg-black text-zinc-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-300">Device name</label>
                      <Input
                        value={selectedInstance.deviceName}
                        onChange={(event) =>
                          updateSelectedInstance((instance) => ({
                            ...instance,
                            deviceName: event.target.value,
                          }))
                        }
                        className="border-white/10 bg-black font-mono text-zinc-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-300">Attachment target</label>
                      <select
                        value={selectedInstance.attachmentTargetId ?? ""}
                        onChange={(event) =>
                          updateSelectedInstance((instance) => ({
                            ...instance,
                            attachmentTargetId: event.target.value || null,
                          }))
                        }
                        className="flex h-10 w-full rounded-md border border-white/10 bg-black px-3 py-2 text-sm text-zinc-100"
                      >
                        <option value="">No attachment</option>
                        {assembly
                          .filter((instance) => instance.instanceId !== selectedInstance.instanceId)
                          .map((instance) => (
                            <option key={instance.instanceId} value={instance.instanceId}>
                              {instance.displayName}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-300">Preferred attachment point</label>
                      <select
                        value={selectedInstance.attachmentPoint ?? ""}
                        onChange={(event) =>
                          updateSelectedInstance((instance) => ({
                            ...instance,
                            attachmentPoint: event.target.value || null,
                          }))
                        }
                        className="flex h-10 w-full rounded-md border border-white/10 bg-black px-3 py-2 text-sm text-zinc-100"
                      >
                        {selectedComponent.attachmentPoints.map((point) => (
                          <option key={point} value={point}>
                            {point}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-300">Teacher notes</label>
                      <Textarea
                        value={selectedInstance.notes}
                        onChange={(event) =>
                          updateSelectedInstance((instance) => ({
                            ...instance,
                            notes: event.target.value,
                          }))
                        }
                        className="min-h-[100px] border-white/10 bg-black text-zinc-100"
                      />
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black p-8 text-center text-zinc-500">
                    Select a part from the assembly canvas to edit device names, attachments, and
                    teacher notes.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#050505] text-zinc-100 shadow-none">
              <CardHeader>
                <CardTitle className="text-xl text-white">Import Custom Components</CardTitle>
                <CardDescription className="text-zinc-500">
                  Paste one component object or an array of component definitions to extend the
                  teacher library.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder='{"id":"custom-claw","displayName":"Custom Claw","category":"mechanism","simulatorRole":"claw"}'
                  className="min-h-[160px] border-white/10 bg-black font-mono text-xs text-zinc-100"
                />
                <Button onClick={handleImport} className="w-full border border-white/10 bg-white text-black hover:bg-zinc-200">
                  Import Component JSON
                </Button>
                {importStatus ? (
                  <div className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-zinc-300">
                    {importStatus}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#050505] text-zinc-100 shadow-none">
              <CardHeader>
                <CardTitle className="text-xl text-white">Generated Draft JSON</CardTitle>
                <CardDescription className="text-zinc-500">
                  This is the canonical lesson draft the future simulator loader can consume.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  readOnly
                  value={JSON.stringify(lessonDraft, null, 2)}
                  className="min-h-[360px] border-white/10 bg-black font-mono text-xs text-zinc-100"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
