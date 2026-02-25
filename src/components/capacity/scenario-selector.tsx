"use client";

import { DEMAND_SCENARIOS } from "@/lib/capacity/scenario-engine"; // DIRECT import (D-047)
import type { DemandScenario } from "@/types";

interface ScenarioSelectorProps {
  activeScenario: DemandScenario;
  onScenarioChange: (scenario: DemandScenario) => void;
}

export function ScenarioSelector({ activeScenario, onScenarioChange }: ScenarioSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Scenario
      </span>
      <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
        {DEMAND_SCENARIOS.map((scenario) => {
          const isActive = activeScenario.id === scenario.id;
          const isNonBaseline = scenario.id !== "baseline";
          return (
            <button
              key={scenario.id}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                isActive
                  ? isNonBaseline
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onScenarioChange(scenario as DemandScenario)}
            >
              {scenario.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
