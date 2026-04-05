import type { Metadata } from "next";

import DriverStationTestClient from "@/components/simulator/DriverStationTestClient";

export const metadata: Metadata = {
  title: "Driver Station Test | Simulator Studio",
  description:
    "Standalone FTC driver station test page for matching the real device UI before integration.",
};

export default function DriverStationTestPage() {
  return <DriverStationTestClient />;
}
