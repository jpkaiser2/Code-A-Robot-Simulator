import type { Metadata } from "next";

import SimulatorBuilderClient from "@/components/simulator-builder/SimulatorBuilderClient";

export const metadata: Metadata = {
  title: "Simulator Builder | Simulator Studio",
  description:
    "Teacher-facing interface for assembling lesson robots, importing custom components, and generating simulator lesson drafts.",
};

export default function SimulatorBuilderPage() {
  return <SimulatorBuilderClient />;
}
