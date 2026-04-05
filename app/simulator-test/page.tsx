import type { Metadata } from "next";

import SimulatorTestClient from "@/components/simulator/SimulatorTestClient";

export const metadata: Metadata = {
  title: "Simulator Test | Simulator Studio",
  description:
    "Full-page FTC simulator workspace with code, controls, and a live robot view.",
};

export default function SimulatorTestPage() {
  return <SimulatorTestClient />;
}
