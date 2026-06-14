"use client";

import { ChevronDown } from "lucide-react";
import { RankingView } from "@/lib/views";
import { RankingScenario } from "@/lib/rankings";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SubNavTab {
  id: string;
  label: string;
  value?: string;
}

interface SubNavProps {
  tabs: SubNavTab[];
  scenarios: RankingScenario[];
  activeTab: string;
  selectedScenarioId: string;

  views?: RankingView[];
  selectedViewId?: string;

  onTabChange: (tabId: string) => void;
  onScenarioChange: (scenarioId: string) => void;
  onViewChange?: (viewId: string) => void;
}

export default function SubNav({
  tabs,
  scenarios,
  activeTab,
  selectedScenarioId,
  views = [],
  selectedViewId = "original",
  onTabChange,
  onScenarioChange,
  onViewChange,
}: SubNavProps) {
  const selectedScenario = scenarios.find(
    (scenario) => scenario.id === selectedScenarioId,
  );

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white">
      {/* Left tabs */}
      <div className="flex items-center gap-8 px-6 py-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`relative cursor-pointer px-1 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-slate-900"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}

            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D7142A]" />
            )}
          </button>
        ))}
      </div>

      {/* Right controls */}
      {onScenarioChange && activeTab === "overview" && (
      <div className="flex items-center gap-4 px-6 py-4">
        {/* Scenario selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Scenario</span>

          <div className="relative">
            <select
              value={selectedScenarioId}
              onChange={(e) => onScenarioChange(e.target.value)}
              className="appearance-none bg-white px-3 py-2 pr-8 rounded border border-slate-300 text-sm font-medium text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 cursor-pointer min-w-[260px]"
            >
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>

            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
          </div>
        </div>

        {/* View selector */}
        {onViewChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">View</span>

            <div className="relative">
              <select
                value={selectedViewId || "original"}
                onChange={(e) => onViewChange(e.target.value)}
                className="appearance-none bg-white px-3 py-2 pr-8 rounded border border-slate-300 text-sm font-medium text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D7142A] cursor-pointer w-fit max-w-[350px]"
              >
                <option value="original">Original</option>

                {views.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.name}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
            </div>
          </div>
        )}

        {/* Read-only scenario metadata */}
        {selectedScenario && (
          <div className="hidden xl:flex items-center gap-3 text-xs">
            <ReadOnlyBadge label="Provider" value={selectedScenario.provider} />
            <ReadOnlyBadge label="Model" value={selectedScenario.modelName} />
            <ReadOnlyBadge label="Year" value={String(selectedScenario.year)} />
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function ReadOnlyBadge({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1">
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium text-slate-900">{value ?? ""}</span>
    </div>
  );
}
