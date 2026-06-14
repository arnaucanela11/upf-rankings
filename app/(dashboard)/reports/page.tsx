"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  Globe2,
  GraduationCap,
  TrendingUp,
} from "lucide-react";

import { auth } from "@/lib/firebase";

import {
  getActiveRankingScenarios,
  getRankingRows,
  getRankingFormula,
  getRankingParameters,
  RankingScenario,
  RankingRow,
  RankingFormula,
  RankingParameters,
} from "@/lib/rankings";

import {
  getRankingViewOverrides,
  getUserRankingViews,
  RankingView,
} from "@/lib/views";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

const ORIGINAL_VIEW_ID = "original";

export default function ReportsPage() {
  const [user, setUser] = useState<User | null>(null);

  const [scenarios, setScenarios] = useState<RankingScenario[]>([]);
  const [views, setViews] = useState<RankingView[]>([]);

  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [selectedViewId, setSelectedViewId] = useState(ORIGINAL_VIEW_ID);

  const [rankingRows, setRankingRows] = useState<RankingRow[]>([]);
  const [previousRows, setPreviousRows] = useState<RankingRow[]>([]);
  const [formula, setFormula] = useState<RankingFormula | null>(null);
  const [parameters, setParameters] = useState<RankingParameters | null>(null);

  const [growthRate, setGrowthRate] = useState("2");

  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadScenarios = async () => {
      try {
        setLoading(true);
        setError("");

        const firebaseScenarios = await getActiveRankingScenarios();
        setScenarios(firebaseScenarios);

        const defaultScenario =
          firebaseScenarios.find((scenario) => scenario.isAppDefault) ||
          firebaseScenarios.find((scenario) => scenario.isDefault) ||
          firebaseScenarios.find((scenario) => scenario.isGlobalDefault) ||
          firebaseScenarios[0];

        if (defaultScenario) {
          setSelectedScenarioId(defaultScenario.id);
        }
      } catch (err) {
        console.error(err);
        setError("Could not load report scenarios.");
      } finally {
        setLoading(false);
      }
    };

    loadScenarios();
  }, []);

  const selectedScenario = useMemo(() => {
    return scenarios.find((scenario) => scenario.id === selectedScenarioId);
  }, [scenarios, selectedScenarioId]);

  useEffect(() => {
    if (!selectedScenario || !user) {
      setViews([]);
      setSelectedViewId(ORIGINAL_VIEW_ID);
      return;
    }

    const loadViews = async () => {
      try {
        const userViews = await getUserRankingViews({
          uid: user.uid,
          scenarioId: selectedScenario.id,
        });

        setViews(userViews);
        setSelectedViewId(ORIGINAL_VIEW_ID);
      } catch (err) {
        console.error(err);
        setError("Could not load ranking views.");
      }
    };

    loadViews();
  }, [selectedScenario, user]);

  useEffect(() => {
    if (!selectedScenario) return;

    const loadContent = async () => {
      try {
        setContentLoading(true);
        setError("");

        const [rows, formulaData, parametersData] = await Promise.all([
          getRankingRows(selectedScenario.resultSetId),
          getRankingFormula(selectedScenario.formulaId),
          getRankingParameters(selectedScenario.id),
        ]);

        setRankingRows(rows);
        setFormula(formulaData);
        setParameters(parametersData);

        const previousScenario = getPreviousYearDefaultScenario(
          scenarios,
          selectedScenario,
        );

        if (previousScenario) {
          const prevRows = await getRankingRows(previousScenario.resultSetId);
          setPreviousRows(prevRows);
        } else {
          setPreviousRows([]);
        }
      } catch (err) {
        console.error(err);
        setError("Could not load report data.");
      } finally {
        setContentLoading(false);
      }
    };

    loadContent();
  }, [selectedScenario, scenarios]);

  const effectiveRows = useMemo(() => {
    if (!rankingRows.length) return [];

    const applyView = async () => {};

    return rankingRows
      .map((row) => ({
        ...row,
        outputRank: typeof row.rank === "number" ? row.rank : undefined,
      }))
      .sort((a, b) => {
        const rankA =
          typeof a.outputRank === "number" ? a.outputRank : Infinity;
        const rankB =
          typeof b.outputRank === "number" ? b.outputRank : Infinity;

        return rankA - rankB;
      });
  }, [rankingRows]);

  const [viewAdjustedRows, setViewAdjustedRows] = useState<RankingRow[]>([]);

  useEffect(() => {
    const loadViewAdjustedRows = async () => {
      if (!selectedScenario) return;

      if (selectedViewId === ORIGINAL_VIEW_ID) {
        setViewAdjustedRows(effectiveRows);
        return;
      }

      try {
        const viewOverrides = await getRankingViewOverrides(selectedViewId);

        const nextRows = rankingRows
          .map((row) => {
            const universityId = row.universityId || row.id;
            const override = viewOverrides[universityId];

            if (!override) {
              return {
                ...row,
                originalScore: row.score,
              };
            }

            const mergedRow = {
              ...row,
              ...override.changedFields,
              originalScore: row.score,
              isEdited: true,
            };

            return {
              ...mergedRow,
              score:
                typeof override.recalculatedScore === "number"
                  ? override.recalculatedScore
                  : calculateOutputValue(
                      mergedRow,
                      formula?.weights,
                      row.score,
                    ),
            };
          })
          .sort((a, b) => {
            const scoreA = typeof a.score === "number" ? a.score : -Infinity;
            const scoreB = typeof b.score === "number" ? b.score : -Infinity;

            return scoreB - scoreA;
          })
          .map((row, index) => ({
            ...row,
            outputRank: index + 1,
          }));

        setViewAdjustedRows(nextRows);
      } catch (err) {
        console.error(err);
        setError("Could not load selected view in report.");
      }
    };

    loadViewAdjustedRows();
  }, [selectedViewId, effectiveRows, rankingRows, formula, selectedScenario]);

  const reportRows =
    selectedViewId === ORIGINAL_VIEW_ID ? effectiveRows : viewAdjustedRows;

  const reportStats = useMemo(() => {
    return buildReportStats({
      rows: reportRows,
      previousRows,
      scenario: selectedScenario,
      growthRate: Number(growthRate),
    });
  }, [reportRows, previousRows, selectedScenario, growthRate]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full">
      <div>
        <h2 className="text-4xl font-bold text-slate-900">Reports</h2>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <ReportSubNav
        scenarios={scenarios}
        views={views}
        selectedScenarioId={selectedScenarioId}
        selectedViewId={selectedViewId}
        selectedScenario={selectedScenario}
        formula={formula}
        parameters={parameters}
        onScenarioChange={setSelectedScenarioId}
        onViewChange={setSelectedViewId}
      />

      {contentLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-slate-500">
          Loading report content...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          <UpfReportColumn
            stats={reportStats}
            growthRate={growthRate}
            onGrowthRateChange={setGrowthRate}
          />

          <GeneralReportColumn stats={reportStats} />
        </div>
      )}
    </div>
  );
}

function ReportSubNav({
  scenarios,
  views,
  selectedScenarioId,
  selectedViewId,
  selectedScenario,
  formula,
  parameters,
  onScenarioChange,
  onViewChange,
}: {
  scenarios: RankingScenario[];
  views: RankingView[];
  selectedScenarioId: string;
  selectedViewId: string;
  selectedScenario?: RankingScenario;
  formula: RankingFormula | null;
  parameters: RankingParameters | null;
  onScenarioChange: (value: string) => void;
  onViewChange: (value: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-6 py-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Scenario</span>

            <Select value={selectedScenarioId} onValueChange={onScenarioChange}>
              <SelectTrigger className="w-[320px] bg-white">
                <SelectValue placeholder="Select scenario" />
              </SelectTrigger>

              <SelectContent>
                {scenarios.map((scenario) => (
                  <SelectItem key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">View</span>

            <Select value={selectedViewId} onValueChange={onViewChange}>
              <SelectTrigger className="w-[240px] bg-white">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value={ORIGINAL_VIEW_ID}>Original</SelectItem>

                {views.map((view) => (
                  <SelectItem key={view.id} value={view.id}>
                    {view.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <ReadOnlyBadge label="Provider" value={selectedScenario?.provider || "-"} />
          <ReadOnlyBadge label="Year" value={selectedScenario?.year?.toString() || "-"} />
          <ReadOnlyBadge label="Model" value={selectedScenario?.modelName || "-"} />
        </div>
      </div>
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

function UpfReportColumn({
  stats,
  growthRate,
  onGrowthRateChange,
}: {
  stats: ReportStats;
  growthRate: string;
  onGrowthRateChange: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <GraduationCap className="h-5 w-5 text-[#D7142A]" />
            UPF performance
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <MetricBox
              label="Current rank"
              value={stats.upf?.outputRank ? `#${stats.upf.outputRank}` : "-"}
            />

            <MetricBox
              label="Current score"
              value={
                typeof stats.upf?.score === "number"
                  ? stats.upf.score.toFixed(1)
                  : "-"
              }
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              Change vs baseline
            </p>

            <ChangeRow
              label={stats.comparisonLabel}
              rankDelta={stats.upfRankDelta}
              scoreDelta={stats.upfScoreDelta}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-slate-900">Catalan universities</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {stats.catalanUniversities.length ? (
              stats.catalanUniversities.map((row) => (
                <div
                  key={row.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    isUpfRow(row)
                      ? "border-red-200 bg-red-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {row.universityName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.country || "-"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      #{row.outputRank || row.rank || "-"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {typeof row.score === "number"
                        ? row.score.toFixed(1)
                        : "-"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No Catalan universities found in this ranking.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <TrendingUp className="h-5 w-5 text-[#D7142A]" />
            UPF 10-year projection
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Annual score growth
            </label>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={growthRate}
                onChange={(e) => onGrowthRateChange(e.target.value)}
                className="w-24 bg-white text-zinc-900"
              />
              <span className="text-sm text-slate-500">% per year</span>
            </div>
          </div>

          <ProjectionChart data={stats.upfProjection} />
        </CardContent>
      </Card>
    </div>
  );
}

function GeneralReportColumn({ stats }: { stats: ReportStats }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <StatCard
          className="bg-white"
          icon={<Building2 className="h-5 w-5" />}
          label="Universities"
          value={String(stats.totalUniversities)}
        />

        <StatCard
          className="bg-white"
          icon={<Globe2 className="h-5 w-5" />}
          label="Countries"
          value={String(stats.totalCountries)}
        />

        <StatCard
          className="bg-white"
          icon={<BarChart3 className="h-5 w-5" />}
          label="Top score"
          value={stats.topScore ? stats.topScore.toFixed(1) : "-"}
        />

        <StatCard
          className="bg-white"
          icon={<GraduationCap className="h-5 w-5" />}
          label="UPF rank"
          value={stats.upf?.outputRank ? `#${stats.upf.outputRank}` : "-"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 ">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-slate-900">Top 5 universities</CardTitle>
          </CardHeader>

          <CardContent>
            <Table>
              <TableBody>
                {stats.topUniversities.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="w-[70px] font-semibold text-slate-900">
                      #{row.outputRank || row.rank}
                    </TableCell>

                    <TableCell>
                      <p className="font-medium text-slate-900">
                        {row.universityName}
                      </p>
                      <p className="text-xs text-slate-500">{row.country}</p>
                    </TableCell>

                    <TableCell className="text-right font-semibold text-slate-900">
                      {typeof row.score === "number"
                        ? row.score.toFixed(1)
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-slate-900">
              Countries with most universities in top 100
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {stats.topCountries.map((country) => (
              <div key={country.country} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-800">
                    {country.country}
                  </span>
                  <span className="text-slate-500">{country.count}</span>
                </div>

                <Progress
                  value={(country.count / stats.maxCountryCount) * 100}
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-slate-900">Score distribution</CardTitle>

          <p className="text-sm text-slate-500">
            Total:{" "}
            <span className="font-semibold text-slate-900">
              {stats.totalUniversities}
            </span>
          </p>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {stats.scoreBuckets.map((bucket) => (
              <div
                key={bucket.label}
                className={`rounded-lg border px-4 py-3 ${
                  bucket.label === "No score"
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className="text-xs text-slate-500">{bucket.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {bucket.count}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm bg-white mt-6">
        <CardHeader>
          <CardTitle className="text-slate-900">
            Score distribution by university
          </CardTitle>
        </CardHeader>

        <CardContent className="h-[484px]">
          <ScoreDistributionPlot rows={stats.rows} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card className={`border-slate-200 shadow-sm ${className || ""}`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-lg bg-red-50 p-3 text-[#D7142A]">{icon}</div>

        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChangeRow({
  label,
  rankDelta,
  scoreDelta,
}: {
  label: string;
  rankDelta: number | null;
  scoreDelta: number | null;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm font-medium text-slate-900">{label}</p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-500">Rank change</p>

          <p
            className={`mt-1 flex items-center gap-1 text-lg font-bold ${
              rankDelta === null
                ? "text-slate-900"
                : rankDelta > 0
                  ? "text-emerald-600"
                  : rankDelta < 0
                    ? "text-red-600"
                    : "text-slate-900"
            }`}
          >
            {rankDelta === null ? (
              "-"
            ) : rankDelta > 0 ? (
              <>
                <ArrowUp className="h-4 w-4" /> {rankDelta}
              </>
            ) : rankDelta < 0 ? (
              <>
                <ArrowDown className="h-4 w-4" /> {Math.abs(rankDelta)}
              </>
            ) : (
              "0"
            )}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">Score change</p>

          <p
            className={`mt-1 text-lg font-bold ${
              scoreDelta === null
                ? "text-slate-900"
                : scoreDelta > 0
                  ? "text-emerald-600"
                  : scoreDelta < 0
                    ? "text-red-600"
                    : "text-slate-900"
            }`}
          >
            {scoreDelta === null
              ? "-"
              : `${scoreDelta > 0 ? "+" : ""}${scoreDelta.toFixed(1)}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProjectionChart({
  data,
}: {
  data: { yearOffset: number; score: number }[];
}) {
  if (!data.length) return null;

  const width = 340;
  const height = 160;
  const paddingX = 28;
  const paddingY = 22;

  const minScore = Math.min(...data.map((item) => item.score));
  const maxScore = Math.max(...data.map((item) => item.score));

  const safeMin = Math.max(0, Math.floor(minScore - 5));
  const safeMax = Math.min(100, Math.ceil(maxScore + 5));

  const scoreRange = safeMax - safeMin || 1;

  const points = data.map((item, index) => {
    const x =
      paddingX +
      (index / Math.max(data.length - 1, 1)) * (width - paddingX * 2);

    const y =
      height -
      paddingY -
      ((item.score - safeMin) / scoreRange) * (height - paddingY * 2);

    return {
      ...item,
      x,
      y,
    };
  });

  const path = points
    .map((point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`,
    )
    .join(" ");

  const areaPath = `${path} L ${points[points.length - 1].x} ${
    height - paddingY
  } L ${points[0].x} ${height - paddingY} Z`;

  const startScore = data[0]?.score || 0;
  const endScore = data[data.length - 1]?.score || 0;
  const totalGrowth = endScore - startScore;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Projected score curve
          </p>
          <p className="text-xs text-slate-500">
            Based on the selected annual growth rate.
          </p>
        </div>

        <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-[#D7142A]">
          {totalGrowth >= 0 ? "+" : ""}
          {totalGrowth.toFixed(1)} pts
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[170px] w-full overflow-visible"
      >
        <line
          x1={paddingX}
          y1={height - paddingY}
          x2={width - paddingX}
          y2={height - paddingY}
          stroke="#CBD5E1"
          strokeWidth="1"
        />

        <line
          x1={paddingX}
          y1={paddingY}
          x2={paddingX}
          y2={height - paddingY}
          stroke="#CBD5E1"
          strokeWidth="1"
        />

        <text
          x={paddingX - 8}
          y={paddingY + 4}
          textAnchor="end"
          className="fill-slate-400 text-[10px]"
        >
          {safeMax}
        </text>

        <text
          x={paddingX - 8}
          y={height - paddingY + 4}
          textAnchor="end"
          className="fill-slate-400 text-[10px]"
        >
          {safeMin}
        </text>

        <path d={areaPath} fill="#D7142A" opacity="0.08" />

        <path
          d={path}
          fill="none"
          stroke="#D7142A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point) => (
          <g key={point.yearOffset}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#D7142A"
              stroke="white"
              strokeWidth="2"
            />

            {point.yearOffset === 1 ||
            point.yearOffset === 5 ||
            point.yearOffset === 10 ? (
              <>
                <text
                  x={point.x}
                  y={height - 4}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px]"
                >
                  +{point.yearOffset}y
                </text>

                <text
                  x={point.x}
                  y={point.y - 10}
                  textAnchor="middle"
                  className="fill-slate-700 text-[10px] font-semibold"
                >
                  {point.score.toFixed(1)}
                </text>
              </>
            ) : null}
          </g>
        ))}
      </svg>

      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-white px-3 py-2">
          <p className="text-slate-500">Year +1</p>
          <p className="font-semibold text-slate-900">
            {data[0]?.score.toFixed(1)}
          </p>
        </div>

        <div className="rounded-lg bg-white px-3 py-2">
          <p className="text-slate-500">Year +5</p>
          <p className="font-semibold text-slate-900">
            {data[4]?.score.toFixed(1) || "-"}
          </p>
        </div>

        <div className="rounded-lg bg-white px-3 py-2">
          <p className="text-slate-500">Year +10</p>
          <p className="font-semibold text-slate-900">
            {data[9]?.score.toFixed(1) || "-"}
          </p>
        </div>
      </div>
    </div>
  );
}

type ReportStats = {
  totalUniversities: number;
  totalCountries: number;
  topScore: number | null;
  topUniversities: RankingRow[];
  topCountries: { country: string; count: number }[];
  maxCountryCount: number;
  scoreBuckets: { label: string; count: number }[];
  upf: RankingRow | null;
  upfOriginal: RankingRow | null;
  upfPrevious: RankingRow | null;
  upfRankDelta: number | null;
  upfScoreDelta: number | null;
  comparisonLabel: string;
  catalanUniversities: RankingRow[];
  upfProjection: { yearOffset: number; score: number }[];
  rows: RankingRow[];
};

function buildReportStats({
  rows,
  previousRows,
  scenario,
  growthRate,
}: {
  rows: RankingRow[];
  previousRows: RankingRow[];
  scenario?: RankingScenario;
  growthRate: number;
}): ReportStats {
  const sortedRows = [...rows].sort((a, b) => {
    const rankA = typeof a.outputRank === "number" ? a.outputRank : Infinity;
    const rankB = typeof b.outputRank === "number" ? b.outputRank : Infinity;

    return rankA - rankB;
  });

  const topUniversities = sortedRows.slice(0, 5);

  const top100 = sortedRows.filter((row) => {
    const rank = typeof row.outputRank === "number" ? row.outputRank : row.rank;
    return typeof rank === "number" && rank <= 100;
  });

  const countryMap = new Map<string, number>();

  top100.forEach((row) => {
    const country = row.country || "Unknown";
    countryMap.set(country, (countryMap.get(country) || 0) + 1);
  });

  const topCountries = Array.from(countryMap.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const maxCountryCount = Math.max(
    1,
    ...topCountries.map((country) => country.count),
  );

  const countries = new Set(
    sortedRows.map((row) => row.country).filter(Boolean),
  );

  const topScore =
    typeof sortedRows[0]?.score === "number" ? sortedRows[0].score : null;

  const upf = sortedRows.find(isUpfRow) || null;

  const upfPrevious = previousRows.find(isUpfRow) || null;

  const upfOriginal =
    upf && typeof upf.originalScore === "number"
      ? {
          ...upf,
          score: upf.originalScore,
          outputRank:
            typeof upf.rank === "number"
              ? upf.rank
              : typeof upf.outputRank === "number"
                ? upf.outputRank
                : undefined,
        }
      : upf;

  const isDefaultScenario =
    scenario?.isDefault === true || scenario?.isGlobalDefault === true;

  const comparisonBase =
    isDefaultScenario && upfPrevious ? upfPrevious : upfOriginal;

  const comparisonLabel =
    isDefaultScenario && upfPrevious
      ? "Compared with previous year"
      : "Compared with original ranking";

  const currentRank =
    typeof upf?.outputRank === "number"
      ? upf.outputRank
      : typeof upf?.rank === "number"
        ? upf.rank
        : null;

  const baseRank =
    typeof comparisonBase?.outputRank === "number"
      ? comparisonBase.outputRank
      : typeof comparisonBase?.rank === "number"
        ? comparisonBase.rank
        : null;

  const upfRankDelta =
    currentRank !== null && baseRank !== null ? baseRank - currentRank : null;

  const upfScoreDelta =
    typeof upf?.score === "number" && typeof comparisonBase?.score === "number"
      ? upf.score - comparisonBase.score
      : null;

  const catalanUniversities = sortedRows
    .filter(isCatalanUniversity)
    .sort((a, b) => {
      const rankA = typeof a.outputRank === "number" ? a.outputRank : Infinity;
      const rankB = typeof b.outputRank === "number" ? b.outputRank : Infinity;

      return rankA - rankB;
    });

  const upfBaseScore = typeof upf?.score === "number" ? upf.score : 0;
  const safeGrowthRate = Number.isFinite(growthRate) ? growthRate : 0;

  const upfProjection = Array.from({ length: 10 }, (_, index) => {
    const yearOffset = index + 1;
    const score = Math.min(
      100,
      upfBaseScore * Math.pow(1 + safeGrowthRate / 100, yearOffset),
    );

    return {
      yearOffset,
      score,
    };
  });

  return {
    totalUniversities: sortedRows.length,
    totalCountries: countries.size,
    topScore,
    topUniversities,
    topCountries,
    maxCountryCount,
    scoreBuckets: buildScoreBuckets(sortedRows),
    upf,
    upfOriginal,
    upfPrevious,
    upfRankDelta,
    upfScoreDelta,
    comparisonLabel,
    catalanUniversities,
    upfProjection,
    rows,
  };
}

function buildScoreBuckets(rows: RankingRow[]) {
  const buckets = [
    { label: "90-100", min: 90, max: 100, count: 0 },
    { label: "80-89", min: 80, max: 89.999, count: 0 },
    { label: "70-79", min: 70, max: 79.999, count: 0 },
    { label: "60-69", min: 60, max: 69.999, count: 0 },
    { label: "< 60", min: -Infinity, max: 59.999, count: 0 },
    { label: "No score", min: null, max: null, count: 0 },
  ];

  rows.forEach((row) => {
    const score = row.score;

    if (typeof score !== "number" || Number.isNaN(score)) {
      const noScoreBucket = buckets.find(
        (bucket) => bucket.label === "No score",
      );
      if (noScoreBucket) noScoreBucket.count += 1;
      return;
    }

    const bucket = buckets.find(
      (item) =>
        item.min !== null &&
        item.max !== null &&
        score >= item.min &&
        score <= item.max,
    );

    if (bucket) {
      bucket.count += 1;
    }
  });

  return buckets;
}

function getPreviousYearDefaultScenario(
  scenarios: RankingScenario[],
  scenario: RankingScenario,
) {
  if (!scenario.year) return null;

  const previousYear = scenario.year - 1;

  return (
    scenarios.find(
      (item) =>
        item.provider === scenario.provider &&
        item.year === previousYear &&
        (item.isDefault === true || item.isGlobalDefault === true),
    ) || null
  );
}

function calculateOutputValue(
  row: RankingRow,
  weights?: Record<string, number>,
  fallbackScore?: number,
) {
  if (!weights) return typeof fallbackScore === "number" ? fallbackScore : 0;

  let total = 0;
  let matchedFields = 0;

  Object.entries(weights).forEach(([field, weight]) => {
    const value = getRowValue(row, field);

    if (typeof value !== "number") return;

    total += value * weight;
    matchedFields += 1;
  });

  if (!matchedFields) {
    return typeof fallbackScore === "number" ? fallbackScore : 0;
  }

  return Number(total.toFixed(2));
}

function getRowValue(row: RankingRow, key: string): unknown {
  const directValue = (row as Record<string, unknown>)[key];

  if (directValue !== undefined && directValue !== null) {
    return directValue;
  }

  const metrics = (row as { metrics?: Record<string, unknown> }).metrics;

  if (metrics && metrics[key] !== undefined && metrics[key] !== null) {
    return metrics[key];
  }

  return null;
}

function isUpfRow(row: RankingRow) {
  const name = String(row.universityName || "").toLowerCase();
  const id = String(row.universityId || row.id || "").toLowerCase();

  return (
    name.includes("pompeu fabra") ||
    name.includes("universitat pompeu fabra") ||
    id.includes("pompeu_fabra") ||
    id.includes("upf")
  );
}

function isCatalanUniversity(row: RankingRow) {
  const name = String(row.universityName || "").toLowerCase();
  const country = String(row.country || "").toLowerCase();

  if (!country.includes("spain")) return false;

  return (
    name.includes("pompeu fabra") ||
    name.includes("barcelona") ||
    name.includes("autònoma") ||
    name.includes("autonoma") ||
    name.includes("autonomous university of barcelona") ||
    name.includes("politècnica de catalunya") ||
    name.includes("politecnica de catalunya") ||
    name.includes("polytechnic university of catalonia") ||
    name.includes("rovira") ||
    name.includes("girona") ||
    name.includes("lleida") ||
    name.includes("ramon llull")
  );
}

function ScoreDistributionPlot({
  rows,
  upfUniversityId = "universitat_pompeu_fabra_es",
}: {
  rows: RankingRow[];
  upfUniversityId?: string;
}) {
  const scoredRows = rows
    .filter(
      (row): row is RankingRow & { score: number } =>
        typeof row.score === "number" && !Number.isNaN(row.score),
    )
    .sort((a, b) => a.score - b.score);

  if (!scoredRows.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        No scored universities available for this chart.
      </div>
    );
  }

  const width = 900;
  const height = 300;
  const paddingLeft = 36;
  const paddingRight = 24;
  const paddingTop = 42;
  const paddingBottom = 34;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const minScore = 0;
  const maxScore = 100;
  const scoreRange = maxScore - minScore;

  const getX = (score: number) =>
    paddingLeft + ((score - minScore) / scoreRange) * chartWidth;

  const bands = [
    { label: "90-100", start: 90, end: 100, fill: "#fef2f2" },
    { label: "80-89", start: 80, end: 90, fill: "#fff7ed" },
    { label: "70-79", start: 70, end: 80, fill: "#fffbeb" },
    { label: "60-69", start: 60, end: 70, fill: "#f8fafc" },
    { label: "< 60", start: 0, end: 60, fill: "#f1f5f9" },
  ];

  // agrupamos por intervalos pequeños para apilar mejor los dots
  const binSize = 1.5;
  const bins = new Map<number, (RankingRow & { score: number })[]>();

  scoredRows.forEach((row) => {
    const bin = Math.floor(row.score / binSize);
    if (!bins.has(bin)) bins.set(bin, []);
    bins.get(bin)!.push(row);
  });

  const maxStack = Math.max(
    ...Array.from(bins.values()).map((items) => items.length),
    1,
  );

  const dotRows = scoredRows.map((row) => {
    const bin = Math.floor(row.score / binSize);
    const items = bins.get(bin)!;
    const indexInBin = items.findIndex((item) => item.id === row.id);

    const x = getX(row.score);

    const usableHeight = chartHeight - 24;
    const y =
      paddingTop +
      usableHeight -
      (indexInBin / Math.max(maxStack - 1, 1)) * usableHeight;

    const isUpf =
      row.universityId === upfUniversityId ||
      row.universityName?.toLowerCase().includes("pompeu fabra");

    return {
      ...row,
      x,
      y,
      isUpf,
    };
  });

  const upf = dotRows.find((row) => row.isUpf);

  const tickValues = [0, 20, 40, 60, 70, 80, 90, 100];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 w-full h-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Score distribution map
          </p>
          <p className="text-xs text-slate-500">
            Universities positioned by published score. UPF is highlighted in
            red.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200">
            Scored universities: {scoredRows.length}
          </div>

          {upf ? (
            <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-[#D7142A]">
              UPF · #{upf.outputRank || upf.rank || "-"} ·{" "}
              {upf.score.toFixed(1)}
            </div>
          ) : null}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {/* bandas */}
        {bands.map((band) => {
          const x1 = getX(band.start);
          const x2 = getX(band.end);

          return (
            <g key={band.label}>
              <rect
                x={x1}
                y={paddingTop}
                width={x2 - x1}
                height={chartHeight}
                fill={band.fill}
              />
              <text
                x={(x1 + x2) / 2}
                y={24}
                textAnchor="middle"
                className="fill-slate-600 text-[11px] font-semibold"
              >
                {band.label}
              </text>
            </g>
          );
        })}

        {/* grid vertical */}
        {tickValues.map((tick) => {
          const x = getX(tick);
          return (
            <g key={tick}>
              <line
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={paddingTop + chartHeight}
                stroke="#CBD5E1"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={x}
                y={height - 8}
                textAnchor="middle"
                className="fill-slate-500 text-[10px]"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* base */}
        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={width - paddingRight}
          y2={paddingTop + chartHeight}
          stroke="#94A3B8"
          strokeWidth="1.2"
        />

        {/* puntos */}
        {dotRows.map((row) => (
          <circle
            key={row.id}
            cx={row.x}
            cy={row.y}
            r={row.isUpf ? 6 : 3.2}
            fill={row.isUpf ? "#D7142A" : "#94A3B8"}
            opacity={row.isUpf ? 1 : 0.45}
            stroke={row.isUpf ? "white" : "none"}
            strokeWidth={row.isUpf ? 2 : 0}
          />
        ))}

        {/* línea y label UPF */}
        {upf ? (
          <g>
            <line
              x1={upf.x}
              y1={paddingTop}
              x2={upf.x}
              y2={paddingTop + chartHeight}
              stroke="#D7142A"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <rect
              x={Math.min(upf.x + 10, width - 210)}
              y={Math.max(upf.y - 38, paddingTop + 8)}
              width={180}
              height={42}
              rx={8}
              ry={8}
              fill="#fff1f2"
              stroke="#fecdd3"
            />
            <text
              x={Math.min(upf.x + 20, width - 200)}
              y={Math.max(upf.y - 22, paddingTop + 24)}
              className="fill-[#D7142A] text-[11px] font-semibold"
            >
              Universitat Pompeu Fabra
            </text>
            <text
              x={Math.min(upf.x + 20, width - 200)}
              y={Math.max(upf.y - 8, paddingTop + 38)}
              className="fill-slate-600 text-[10px]"
            >
              Rank #{upf.outputRank || upf.rank || "-"} · Score{" "}
              {upf.score.toFixed(1)}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
