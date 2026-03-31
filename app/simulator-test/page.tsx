import type { Metadata } from "next";

import SimulatorTestClient from "@/components/simulator/SimulatorTestClient";

export const metadata: Metadata = {
  title: "Simulator Test | Simulator Studio",
  description:
    "Standalone FTC simulator testbed using Three.js, a Java bridge harness, and state-driven robot control.",
};

export default function SimulatorTestPage() {
  return <SimulatorTestClient />;
}
