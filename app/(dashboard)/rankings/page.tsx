"use client";

import { useEffect, useMemo, useState } from "react";
import SubNav from "@/components/layout/SubNav";

import {
  getActiveRankingScenarios,
  getActiveRankingModels,
  getRankingRows,
  getRankingFormula,
  getRankingParameters,
  createRankingScenario,
  seedDefaultRankingModels,
  seedDefaultRankingScenarios,
  deleteRankingScenario,
  duplicateRankingModel,
  createRankingModel,
  updateRankingFormula,
  deleteRankingModel,
  updateRankingModelAndFormulaNames,
  RankingScenario,
  RankingModel,
  RankingRow,
  RankingFormula,
  RankingParameters,
} from "@/lib/rankings";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import {
  createRankingView,
  getRankingViewOverrides,
  getUserRankingViews,
  saveRankingViewOverride,
  RankingView,
  RankingOverride,
  deleteRankingView,
  updateRankingViewName,
} from "@/lib/views";

import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Plus,
  Pencil,
  Eye,
} from "lucide-react";

export default function RankingsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const [scenarios, setScenarios] = useState<RankingScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");

  const [rankingRows, setRankingRows] = useState<RankingRow[]>([]);
  const [formula, setFormula] = useState<RankingFormula | null>(null);
  const [parameters, setParameters] = useState<RankingParameters | null>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState("");

  const ORIGINAL_VIEW_ID = "original";

  const [views, setViews] = useState<RankingView[]>([]);
  const [selectedViewId, setSelectedViewId] =
    useState<string>(ORIGINAL_VIEW_ID);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<"new" | "overwrite">("new");
  const [newViewName, setNewViewName] = useState("");

  const [scenariosSearch, setScenariosSearch] = useState("");
  const [scenariosProvider, setScenariosProvider] = useState("all");
  const [scenariosYear, setScenariosYear] = useState("all");

  const [removedUniversityIds, setRemovedUniversityIds] = useState<string[]>(
    [],
  );

  const [lastEditedUniversityId, setLastEditedUniversityId] = useState<
    string | null
  >(null);

  const [draftOverrides, setDraftOverrides] = useState<
    Record<
      string,
      { universityId: string; changedFields: Record<string, number> }
    >
  >({});

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingView, setSavingView] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [viewsSearch, setViewsSearch] = useState("");
  const [viewsScenarioId, setViewsScenarioId] = useState("");

  const [modelsSearch, setModelsSearch] = useState("");

  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [modelDialogMode, setModelDialogMode] = useState<
    "create" | "duplicate"
  >("duplicate");
  const [modelDialogError, setModelDialogError] = useState("");
  const [savingModel, setSavingModel] = useState(false);

  const [newModelName, setNewModelName] = useState("");
  const [newModelProvider, setNewModelProvider] = useState("QS");
  const [baseModelId, setBaseModelId] = useState("");

  const [formulaDialogOpen, setFormulaDialogOpen] = useState(false);
  const [formulaDialogError, setFormulaDialogError] = useState("");
  const [loadingModelFormula, setLoadingModelFormula] = useState(false);
  const [savingModelFormula, setSavingModelFormula] = useState(false);

  const [selectedFormulaModel, setSelectedFormulaModel] =
    useState<RankingModel | null>(null);

  const [editableFormula, setEditableFormula] = useState<RankingFormula | null>(
    null,
  );

  const [editableFormulaText, setEditableFormulaText] = useState("");
  const [editableFormulaDescription, setEditableFormulaDescription] =
    useState("");
  const [editableWeights, setEditableWeights] = useState<
    Record<string, string>
  >({});

  const [editViewDialogOpen, setEditViewDialogOpen] = useState(false);
  const [editingViewId, setEditingViewId] = useState("");
  const [editingViewName, setEditingViewName] = useState("");
  const [editingViewError, setEditingViewError] = useState("");
  const [savingViewName, setSavingViewName] = useState(false);

  const [editModelDialogOpen, setEditModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<RankingModel | null>(null);
  const [editingModelName, setEditingModelName] = useState("");
  const [editingFormulaName, setEditingFormulaName] = useState("");
  const [editModelError, setEditModelError] = useState("");
  const [savingModelNames, setSavingModelNames] = useState(false);

  const handleOpenEditViewDialog = (view: RankingView) => {
    setEditingViewId(view.id);
    setEditingViewName(view.name);
    setEditingViewError("");
    setEditViewDialogOpen(true);
  };

  const handleOpenEditModelDialog = (model: RankingModel) => {
    if (model.isDefault === true) {
      setError("Default models cannot be renamed.");
      return;
    }

    setEditingModel(model);
    setEditingModelName(model.name || "");
    setEditingFormulaName(model.formulaName || "");
    setEditModelError("");
    setEditModelDialogOpen(true);
  };

  const handleUpdateViewName = async () => {
    if (!user || !viewsScenario) return;

    const cleanName = editingViewName.trim();

    if (!cleanName) {
      setEditingViewError("Please enter a view name.");
      return;
    }

    try {
      setSavingViewName(true);
      setEditingViewError("");

      await updateRankingViewName({
        viewId: editingViewId,
        name: cleanName,
      });

      const updatedViews = await getUserRankingViews({
        uid: user.uid,
        scenarioId: viewsScenario.id,
      });

      setViews(updatedViews);

      setEditViewDialogOpen(false);
      setEditingViewId("");
      setEditingViewName("");
    } catch (err) {
      console.error(err);
      setEditingViewError("Could not update view name.");
    } finally {
      setSavingViewName(false);
    }
  };

  const handleSaveModelNames = async () => {
    if (!editingModel) return;

    const cleanModelName = editingModelName.trim();
    const cleanFormulaName = editingFormulaName.trim();

    if (!cleanModelName) {
      setEditModelError("Please enter a model name.");
      return;
    }

    if (!cleanFormulaName) {
      setEditModelError("Please enter a formula name.");
      return;
    }

    if (cleanModelName.length > 30) {
      setEditModelError("Model name cannot exceed 30 characters.");
      return;
    }

    if (cleanFormulaName.length > 30) {
      setEditModelError("Formula name cannot exceed 30 characters.");
      return;
    }

    try {
      setSavingModelNames(true);
      setEditModelError("");

      await updateRankingModelAndFormulaNames({
        modelId: editingModel.id,
        formulaId: editingModel.formulaId,
        modelName: cleanModelName,
        formulaName: cleanFormulaName,
      });

      await loadModels();

      setEditModelDialogOpen(false);
      setEditingModel(null);
      setEditingModelName("");
      setEditingFormulaName("");
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setEditModelError(err.message);
      } else {
        setEditModelError("Could not update model.");
      }
    } finally {
      setSavingModelNames(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadModels = async () => {
    try {
      const firebaseModels = await getActiveRankingModels();
      setModels(firebaseModels);
    } catch (err) {
      console.error(err);
      setError("Could not load ranking models.");
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const selectedScenario = useMemo(() => {
    return scenarios.find((scenario) => scenario.id === selectedScenarioId);
  }, [scenarios, selectedScenarioId]);

  const [models, setModels] = useState<RankingModel[]>([]);

  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false);
  const [creatingScenario, setCreatingScenario] = useState(false);
  const [scenarioDialogError, setScenarioDialogError] = useState("");

  const [newScenarioName, setNewScenarioName] = useState("");
  const [newScenarioProvider, setNewScenarioProvider] = useState("QS");
  const [newScenarioYear, setNewScenarioYear] = useState("2026");
  const [newScenarioModelId, setNewScenarioModelId] = useState("");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "views", label: "Views" },
    { id: "scenarios", label: "Scenarios" },
    { id: "models", label: "Models" },
  ];

  useEffect(() => {
    if (selectedScenarioId && activeTab === "overview") {
      setViewsScenarioId(selectedScenarioId);
    }
  }, [selectedScenarioId, activeTab]);

  useEffect(() => {
    const loadScenarios = async () => {
      try {
        setInitialLoading(true);
        setError("");

        const firebaseScenarios = await getActiveRankingScenarios();

        console.log("Scenarios from Firebase:", firebaseScenarios);

        setScenarios(firebaseScenarios);

        const defaultScenario =
          firebaseScenarios.find((scenario) => scenario.isAppDefault) ||
          firebaseScenarios.find((scenario) => scenario.isDefault) ||
          firebaseScenarios[0];

        console.log("Default scenario:", defaultScenario);

        if (defaultScenario) {
          setSelectedScenarioId(defaultScenario.id);
          setViewsScenarioId(defaultScenario.id);
        }
      } catch (err) {
        console.error(err);
        setError("Could not load ranking scenarios.");
      } finally {
        setInitialLoading(false);
      }
    };

    loadScenarios();
  }, []);

  const viewsScenario = useMemo(() => {
    return scenarios.find((scenario) => scenario.id === viewsScenarioId);
  }, [scenarios, viewsScenarioId]);

  useEffect(() => {
    if (!viewsScenario || !user) {
      setViews([]);
      return;
    }

    const loadScenarioViews = async () => {
      try {
        const userViews = await getUserRankingViews({
          uid: user.uid,
          scenarioId: viewsScenario.id,
        });

        setViews(userViews);
      } catch (err) {
        console.error(err);
        setError("Could not load ranking views.");
      }
    };

    loadScenarioViews();
  }, [viewsScenario, user]);

  useEffect(() => {
    if (!selectedScenario) return;

    const loadScenarioContent = async () => {
      try {
        setContentLoading(true);
        setError("");

        console.log("Selected scenario:", selectedScenario);
        console.log("Loading rows from:", selectedScenario.resultSetId);

        const [rows, formulaData, parametersData] = await Promise.all([
          getRankingRows(selectedScenario.resultSetId),
          getRankingFormula(selectedScenario.formulaId),
          getRankingParameters(selectedScenario.id),
        ]);

        console.log("Ranking rows:", rows);

        setRankingRows(rows);
        setFormula(formulaData);
        setParameters(parametersData);
      } catch (err) {
        console.error(err);
        setError("Could not load ranking data.");
      } finally {
        setContentLoading(false);
      }
    };

    loadScenarioContent();
  }, [selectedScenario]);

  useEffect(() => {
    if (!selectedScenario || !user) {
      setViews([]);
      setSelectedViewId(ORIGINAL_VIEW_ID);
      setDraftOverrides({});
      setRemovedUniversityIds([]);
      setHasUnsavedChanges(false);
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
        setDraftOverrides({});
        setRemovedUniversityIds([]);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error(err);
        setError("Could not load ranking views.");
      }
    };

    loadViews();
  }, [selectedScenario, user]);

  useEffect(() => {
    if (selectedViewId === ORIGINAL_VIEW_ID) {
      setDraftOverrides({});
      setHasUnsavedChanges(false);
      return;
    }

    const loadOverrides = async () => {
      try {
        const viewOverrides = await getRankingViewOverrides(selectedViewId);

        const normalizedOverrides = Object.fromEntries(
          Object.entries(viewOverrides).map(([universityId, override]) => [
            universityId,
            {
              universityId,
              changedFields: override.changedFields || {},
            },
          ]),
        );

        setDraftOverrides(normalizedOverrides);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error(err);
        setError("Could not load view overrides.");
      }
    };

    loadOverrides();
  }, [selectedViewId]);

  const loadScenarios = async () => {
    try {
      setInitialLoading(true);
      setError("");

      const firebaseScenarios = await getActiveRankingScenarios();

      setScenarios(firebaseScenarios);

      const defaultScenario =
        firebaseScenarios.find((scenario) => scenario.isAppDefault) ||
        firebaseScenarios.find((scenario) => scenario.isDefault) ||
        firebaseScenarios.find((scenario) => scenario.isGlobalDefault) ||
        firebaseScenarios[0];

      if (defaultScenario && !selectedScenarioId) {
        setSelectedScenarioId(defaultScenario.id);
        setViewsScenarioId(defaultScenario.id);
      }
    } catch (err) {
      console.error(err);
      setError("Could not load ranking scenarios.");
    } finally {
      setInitialLoading(false);
    }
  };

  const availableModelsForScenario = useMemo(() => {
    return models.filter(
      (model) =>
        model.provider?.toUpperCase() === newScenarioProvider.toUpperCase() &&
        model.isActive !== false,
    );
  }, [models, newScenarioProvider]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const firebaseModels = await getActiveRankingModels();
        setModels(firebaseModels);
      } catch (err) {
        console.error(err);
        setError("Could not load ranking models.");
      }
    };

    loadModels();
  }, []);

  useEffect(() => {
    setNewScenarioModelId("");
  }, [newScenarioProvider]);

  const handleSaveModel = async () => {
    setModelDialogError("");

    if (!newModelName.trim()) {
      setModelDialogError("Please enter a model name.");
      return;
    }

    try {
      setSavingModel(true);

      if (modelDialogMode === "duplicate") {
        if (!baseModelId) {
          setModelDialogError("Please select a base model.");
          return;
        }

        await duplicateRankingModel({
          baseModelId,
          newModelName,
        });
      }

      if (modelDialogMode === "create") {
        await createRankingModel({
          name: newModelName,
          provider: newModelProvider,
          weights: getDefaultWeightsForProvider(newModelProvider),
        });
      }

      await loadModels();

      setModelDialogOpen(false);
      setNewModelName("");
      setBaseModelId("");
      setModelDialogError("");
    } catch (err) {
      console.error(err);
      setModelDialogError("Could not save model.");
    } finally {
      setSavingModel(false);
    }
  };

  function getDefaultWeightsForProvider(
    provider: string,
  ): Record<string, number> {
    if (provider === "THE") {
      const weights: Record<string, number> = {
        teachingScore: 0.3,
        researchEnvironmentScore: 0.3,
        researchQualityScore: 0.3,
        internationalOutlookScore: 0.1,
      };

      return weights;
    }

    const weights: Record<string, number> = {
      academicReputationScore: 0.3,
      employerReputationScore: 0.15,
      facultyStudentScore: 0.1,
      citationsPerFacultyScore: 0.2,
      internationalFacultyScore: 0.05,
      internationalStudentsScore: 0.05,
      internationalResearchNetworkScore: 0.05,
      employmentOutcomesScore: 0.05,
      sustainabilityScore: 0.05,
    };

    return weights;
  }

  const handleCreateScenario = async () => {
    const yearNumber = Number(newScenarioYear);

    setScenarioDialogError("");

    if (!newScenarioName.trim()) {
      setScenarioDialogError("Please enter a scenario name.");
      return;
    }

    if (!newScenarioProvider.trim()) {
      setScenarioDialogError("Please select a provider.");
      return;
    }

    if (!Number.isFinite(yearNumber)) {
      setScenarioDialogError("Please enter a valid year.");
      return;
    }

    const selectedModel = models.find(
      (model) => model.id === newScenarioModelId,
    );

    if (!selectedModel) {
      setScenarioDialogError("Please select a model.");
      return;
    }

    if (selectedModel.provider !== newScenarioProvider) {
      setScenarioDialogError(
        `Selected model belongs to ${selectedModel.provider}, but scenario provider is ${newScenarioProvider}.`,
      );
      return;
    }

    const isTryingToCreateExistingDefault =
      selectedModel.isDefault === true &&
      scenarios.some((scenario) => {
        return (
          scenario.provider === newScenarioProvider &&
          scenario.year === yearNumber &&
          scenario.modelId === selectedModel.id &&
          getIsDefaultScenario(scenario)
        );
      });

    if (isTryingToCreateExistingDefault) {
      setScenarioDialogError(
        `The default ${newScenarioProvider} scenario for ${yearNumber} already exists.`,
      );
      return;
    }

    try {
      setCreatingScenario(true);

      const scenarioId = await createRankingScenario({
        name: newScenarioName,
        provider: newScenarioProvider,
        year: yearNumber,
        model: selectedModel,
      });

      await loadScenarios();

      setSelectedScenarioId(scenarioId);
      setScenarioDialogOpen(false);

      setNewScenarioName("");
      setNewScenarioProvider("QS");
      setNewScenarioYear("2026");
      setNewScenarioModelId("");
      setScenarioDialogError("");
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setScenarioDialogError(err.message);
      } else {
        setScenarioDialogError("Could not create ranking scenario.");
      }
    } finally {
      setCreatingScenario(false);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    const model = models.find((item) => item.id === modelId);

    if (!model) return;

    if (model.isDefault === true) {
      setError("Default models cannot be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${model.name}"? This will also delete its formula.`,
    );

    if (!confirmed) return;

    try {
      await deleteRankingModel({
        modelId: model.id,
        formulaId: model.formulaId,
        isDefault: model.isDefault,
      });

      await loadModels();
    } catch (err) {
      console.error(err);
      setError("Could not delete model.");
    }
  };

  const handleOpenFormulaDialog = async (modelId: string) => {
    const selectedModel = models.find((model) => model.id === modelId);

    if (!selectedModel) {
      setError("Model not found.");
      return;
    }

    try {
      setLoadingModelFormula(true);
      setFormulaDialogError("");
      setSelectedFormulaModel(selectedModel);
      setFormulaDialogOpen(true);

      const formulaData = await getRankingFormula(selectedModel.formulaId);

      if (!formulaData) {
        setFormulaDialogError("Formula not found.");
        setEditableFormula(null);
        return;
      }

      setEditableFormula(formulaData);
      setEditableFormulaText(formulaData.formulaText || "");
      setEditableFormulaDescription(formulaData.description || "");

      const weightsAsStrings = Object.fromEntries(
        Object.entries(formulaData.weights || {}).map(([key, value]) => [
          key,
          String(value),
        ]),
      );

      setEditableWeights(weightsAsStrings);
    } catch (err) {
      console.error(err);
      setFormulaDialogError("Could not load formula.");
    } finally {
      setLoadingModelFormula(false);
    }
  };

  const handleSaveFormula = async () => {
    if (!selectedFormulaModel || !editableFormula) return;

    if (selectedFormulaModel.isDefault) {
      setFormulaDialogError(
        "Default model formulas are read-only. Duplicate the model first.",
      );
      return;
    }

    const normalizedWeights: Record<string, number> = {};

    for (const [key, value] of Object.entries(editableWeights)) {
      const parsedValue = Number(String(value).replace(",", "."));

      if (!Number.isFinite(parsedValue)) {
        setFormulaDialogError(`Invalid weight for ${key}.`);
        return;
      }

      normalizedWeights[key] = parsedValue;
    }

    const totalWeight = Object.values(normalizedWeights).reduce(
      (sum, value) => sum + value,
      0,
    );

    if (Math.abs(totalWeight - 1) > 0.001) {
      setFormulaDialogError(
        `Weights must sum to 1. Current total: ${totalWeight.toFixed(3)}.`,
      );
      return;
    }

    try {
      setSavingModelFormula(true);
      setFormulaDialogError("");

      await updateRankingFormula({
        formulaId: editableFormula.id,
        formulaText: editableFormulaText,
        description: editableFormulaDescription,
        weights: normalizedWeights,
      });

      setFormulaDialogOpen(false);
      setSelectedFormulaModel(null);
      setEditableFormula(null);
      setEditableWeights({});
    } catch (err) {
      console.error(err);
      setFormulaDialogError("Could not save formula.");
    } finally {
      setSavingModelFormula(false);
    }
  };

  const handleCreateView = async () => {
    if (!user || !selectedScenario) return;

    try {
      const viewId = await createRankingView({
        uid: user.uid,
        name: `${selectedScenario.name} - Custom View`,
        baseScenarioId: selectedScenario.id,
        baseResultSetId: selectedScenario.resultSetId,
        provider: selectedScenario.provider,
        year: selectedScenario.year ?? undefined,
        formulaId: selectedScenario.formulaId,
      });

      const newViews = await getUserRankingViews({
        uid: user.uid,
        scenarioId: selectedScenario.id,
      });

      setViews(newViews);
      setSelectedViewId(viewId);
    } catch (err) {
      console.error(err);
      setError("Could not create ranking view.");
    }
  };

  const effectiveRows = useMemo(() => {
    if (!rankingRows.length) return [];

    const rowsWithDraftChanges = rankingRows
      .filter((row) => {
        const universityId = row.universityId || row.id;
        return !removedUniversityIds.includes(universityId);
      })
      .map((row) => {
        const universityId = row.universityId || row.id;
        const draftOverride = draftOverrides[universityId];

        const hasEditedFields =
          !!draftOverride &&
          Object.keys(draftOverride.changedFields).length > 0;

        const mergedRow = hasEditedFields
          ? {
              ...row,
              ...draftOverride.changedFields,
              originalScore: row.score,
              isEdited: true,
            }
          : {
              ...row,
              originalScore: row.score,
              isEdited: false,
            };

        const recalculatedScore = hasEditedFields
          ? calculateOutputValue(mergedRow, formula?.weights, row.score)
          : row.score;

        return {
          ...mergedRow,
          score: recalculatedScore,
        };
      });

    return rowsWithDraftChanges
      .sort((a, b) => {
        const scoreA = typeof a.score === "number" ? a.score : -Infinity;
        const scoreB = typeof b.score === "number" ? b.score : -Infinity;

        return scoreB - scoreA;
      })
      .map((row, index) => {
        const outputRank = index + 1;
        const originalRank =
          typeof row.rank === "number"
            ? row.rank
            : typeof row.previousRank === "number"
              ? row.previousRank
              : outputRank;

        return {
          ...row,
          outputRank,
          originalRank,
          rankDelta: originalRank - outputRank,
        };
      });
  }, [rankingRows, draftOverrides, removedUniversityIds, formula]);

  const handleMetricDraftChange = ({
    row,
    field,
    value,
  }: {
    row: RankingRow;
    field: string;
    value: number;
  }) => {
    const universityId = row.universityId || row.id;
    const currentValue = getRowValue(row, field);

    if (
      typeof currentValue === "number" &&
      Math.abs(currentValue - value) < 0.0001
    ) {
      return;
    }

    setLastEditedUniversityId(universityId);

    setDraftOverrides((prev) => {
      const existing = prev[universityId];

      return {
        ...prev,
        [universityId]: {
          universityId,
          changedFields: {
            ...(existing?.changedFields || {}),
            [field]: value,
          },
        },
      };
    });

    setHasUnsavedChanges(true);
  };

  const handleSaveView = async () => {
    if (!user || !selectedScenario || !hasUnsavedChanges) return;

    try {
      setSavingView(true);

      let viewIdToSave = selectedViewId;

      const shouldCreateNewView =
        selectedViewId === ORIGINAL_VIEW_ID || saveMode === "new";

      if (shouldCreateNewView) {
        const cleanName = newViewName.trim();

        if (!cleanName) {
          setError("Please enter a name for the view.");
          return;
        }

        viewIdToSave = await createRankingView({
          uid: user.uid,
          name: cleanName,
          baseScenarioId: selectedScenario.id,
          baseResultSetId: selectedScenario.resultSetId,
          provider: selectedScenario.provider,
          year: selectedScenario.year ?? undefined,
          formulaId: selectedScenario.formulaId,
        });
      }

      for (const [universityId, override] of Object.entries(draftOverrides)) {
        const effectiveRow = effectiveRows.find(
          (row) => (row.universityId || row.id) === universityId,
        );

        await saveRankingViewOverride({
          viewId: viewIdToSave,
          universityId,
          changedFields: override.changedFields,
          recalculatedScore:
            typeof effectiveRow?.score === "number" ? effectiveRow.score : 0,
        });
      }

      const updatedViews = await getUserRankingViews({
        uid: user.uid,
        scenarioId: selectedScenario.id,
      });

      setViews(updatedViews);
      setSelectedViewId(viewIdToSave);
      setHasUnsavedChanges(false);
      setSaveDialogOpen(false);
    } catch (err) {
      console.error(err);
      setError("Could not save view.");
    } finally {
      setSavingView(false);
    }
  };

  const handleDiscardChanges = async () => {
    try {
      setError("");

      if (selectedViewId === ORIGINAL_VIEW_ID) {
        setDraftOverrides({});
        setRemovedUniversityIds([]);
        setHasUnsavedChanges(false);
        return;
      }

      const viewOverrides = await getRankingViewOverrides(selectedViewId);

      const normalizedOverrides = Object.fromEntries(
        Object.entries(viewOverrides).map(([universityId, override]) => [
          universityId,
          {
            universityId,
            changedFields: override.changedFields || {},
          },
        ]),
      );

      setDraftOverrides(normalizedOverrides);
      setRemovedUniversityIds([]);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error(err);
      setError("Could not discard changes.");
    }
  };

  const handleDeleteView = async (viewId: string) => {
    if (!user || !viewsScenario) return;

    const confirmed = window.confirm(
      "Delete this view? This action cannot be undone.",
    );
    if (!confirmed) return;

    try {
      await deleteRankingView(viewId);

      const updatedViews = await getUserRankingViews({
        uid: user.uid,
        scenarioId: viewsScenario.id,
      });

      setViews(updatedViews);

      if (selectedViewId === viewId) {
        setSelectedViewId(ORIGINAL_VIEW_ID);
        setDraftOverrides({});
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error(err);
      setError("Could not delete view.");
    }
  };

  const handleSeedDefaultScenarios = async () => {
    try {
      setError("");

      await seedDefaultRankingScenarios();
      await loadScenarios();
    } catch (err) {
      console.error(err);
      setError("Could not seed default scenarios.");
    }
  };

  const handleDeleteScenario = async (scenarioId: string) => {
    const scenario = scenarios.find((item) => item.id === scenarioId);

    if (!scenario) return;

    const isDefaultScenario =
      scenario.isDefault === true ||
      scenario.isGlobalDefault === true ||
      scenario.isAppDefault === true;

    if (isDefaultScenario) {
      setError("Default scenarios cannot be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${scenario.name}"? This will also delete its generated results.`,
    );

    if (!confirmed) return;

    try {
      setError("");

      await deleteRankingScenario({
        scenarioId: scenario.id,
        resultSetId: scenario.resultSetId,
        isDefault: scenario.isDefault,
        isGlobalDefault: scenario.isGlobalDefault,
        isAppDefault: scenario.isAppDefault,
      });

      await loadScenarios();

      if (selectedScenarioId === scenario.id) {
        const fallbackScenario = scenarios.find(
          (item) => item.id !== scenario.id,
        );

        if (fallbackScenario) {
          setSelectedScenarioId(fallbackScenario.id);
          setViewsScenarioId(fallbackScenario.id);
        }
      }
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not delete scenario.");
      }
    }
  };

  const handleRemoveUniversitiesFromRanking = (universityIds: string[]) => {
    setRemovedUniversityIds((prev) =>
      Array.from(new Set([...prev, ...universityIds])),
    );

    setHasUnsavedChanges(true);
  };

  if (initialLoading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        Loading rankings...
      </div>
    );
  }

  if (!scenarios.length) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        No active ranking scenarios found.
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full">
      <div>
        <h2 className="text-4xl font-bold text-slate-900">Rankings</h2>
      </div>

      <SubNav
        tabs={tabs}
        scenarios={scenarios}
        activeTab={activeTab}
        selectedScenarioId={selectedScenarioId}
        onTabChange={setActiveTab}
        onScenarioChange={setSelectedScenarioId}
        views={activeTab === "overview" ? views : undefined}
        selectedViewId={activeTab === "overview" ? selectedViewId : undefined}
        onViewChange={activeTab === "overview" ? setSelectedViewId : undefined}
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm h-full">
        {activeTab === "overview" && (
         <RankingTable
  rows={effectiveRows}
  loading={contentLoading}
  provider={selectedScenario?.provider}
  scenario={selectedScenario}
  formula={formula}
  onMetricChange={handleMetricDraftChange}
  onRemoveUniversities={handleRemoveUniversitiesFromRanking}
  lastEditedUniversityId={lastEditedUniversityId}
/>
        )}

        {activeTab === "views" && (
          <ViewsPanel
            scenarios={scenarios}
            selectedScenarioId={viewsScenarioId || selectedScenarioId}
            onScenarioChange={setViewsScenarioId}
            views={views}
            search={viewsSearch}
            onSearchChange={setViewsSearch}
            onDeleteView={handleDeleteView}
            onEditView={handleOpenEditViewDialog}
          />
        )}

        {activeTab === "scenarios" && (
          <ScenariosPanel
            scenarios={scenarios}
            search={scenariosSearch}
            onSearchChange={setScenariosSearch}
            provider={scenariosProvider}
            onProviderChange={setScenariosProvider}
            year={scenariosYear}
            onYearChange={setScenariosYear}
            onCreateScenario={() => {
              setScenarioDialogError("");
              setNewScenarioName("");
              setNewScenarioProvider("QS");
              setNewScenarioYear("2026");
              setNewScenarioModelId("");
              setScenarioDialogOpen(true);
            }}
            onEditScenario={(scenarioId) => {
              console.log("Edit scenario:", scenarioId);
            }}
            onViewScenario={(scenarioId) => {
              setSelectedScenarioId(scenarioId);
              setActiveTab("overview");
            }}
            onSeedDefaults={handleSeedDefaultScenarios}
            onDeleteScenario={handleDeleteScenario}
          />
        )}

        {activeTab === "models" && (
          <ModelsPanel
            models={models}
            search={modelsSearch}
            onSearchChange={setModelsSearch}
            onDeleteModel={handleDeleteModel}
            onCreateModel={() => {
              setModelDialogMode("create");
              setModelDialogError("");
              setNewModelName("");
              setNewModelProvider("QS");
              setBaseModelId("");
              setModelDialogOpen(true);
            }}
            onDuplicateModel={(modelId) => {
              const baseModel = models.find((model) => model.id === modelId);

              setModelDialogMode("duplicate");
              setModelDialogError("");
              setBaseModelId(modelId);
              setNewModelProvider(baseModel?.provider || "QS");
              setNewModelName(
                baseModel ? `${baseModel.name} Copy` : "Custom Model",
              );
              setModelDialogOpen(true);
            }}
            onSeedDefaults={async () => {
              try {
                await seedDefaultRankingModels();
                await loadModels();
              } catch (err) {
                console.error(err);
                setError("Could not seed default models.");
              }
            }}
            onViewFormula={handleOpenFormulaDialog}
            onEditModel={handleOpenEditModelDialog}
          />
        )}
      </div>

      {hasUnsavedChanges && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
          <div>
            <p className="text-sm font-medium text-slate-900">
              Unsaved changes
            </p>
            <p className="text-xs text-slate-500">
              Save or discard your current ranking edits.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleDiscardChanges}
            disabled={savingView}
            className="bg-white cursor-pointer"
          >
            Discard changes
          </Button>

          <Button
            type="button"
            onClick={() => {
              setSaveMode(
                selectedViewId === ORIGINAL_VIEW_ID ? "new" : "overwrite",
              );
              setNewViewName(
                selectedScenario
                  ? `${selectedScenario.name} - Custom View`
                  : "Custom View",
              );
              setSaveDialogOpen(true);
            }}
            disabled={savingView}
            className="bg-[#D7142A] hover:bg-[#c11224] text-white cursor-pointer"
          >
            Save View
          </Button>
        </div>
      )}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="bg-white text-zinc-700">
          <DialogHeader>
            <DialogTitle>Save ranking view</DialogTitle>
            <DialogDescription>
              Choose whether to save these changes as a new view or overwrite
              the current view.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedViewId !== ORIGINAL_VIEW_ID && (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setSaveMode("overwrite")}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    saveMode === "overwrite"
                      ? "border-[#D7142A] bg-red-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-medium text-slate-900">
                    Overwrite current view
                  </p>
                  <p className="text-sm text-slate-500">
                    Save these changes into the currently selected view.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSaveMode("new")}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    saveMode === "new"
                      ? "border-[#D7142A] bg-red-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-medium text-slate-900">Save as new view</p>
                  <p className="text-sm text-slate-500">
                    Create a separate view and keep the current one unchanged.
                  </p>
                </button>
              </div>
            )}

            {selectedViewId === ORIGINAL_VIEW_ID && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-medium text-slate-900">Save as new view</p>
                <p className="text-sm text-slate-500">
                  Original is read-only, so your edits will be saved as a new
                  view.
                </p>
              </div>
            )}

            {(saveMode === "new" || selectedViewId === ORIGINAL_VIEW_ID) && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  View name
                </label>

                <Input
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="Example: QS 2025 - My Simulation"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              disabled={savingView}
              className="border-slate-900 bg-white hover:text-zinc-700 cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleSaveView}
              disabled={
                savingView ||
                ((saveMode === "new" || selectedViewId === ORIGINAL_VIEW_ID) &&
                  !newViewName.trim())
              }
              className="bg-[#D7142A] hover:bg-[#c11224] text-white cursor-pointer"
            >
              {savingView ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scenarioDialogOpen} onOpenChange={setScenarioDialogOpen}>
        <DialogContent className="bg-white text-zinc-700 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create new scenario</DialogTitle>
            <DialogDescription>
              Create a scenario by selecting a provider, year and existing
              model.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {scenarioDialogError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {scenarioDialogError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Scenario name
              </label>

              <Input
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                placeholder="Example: QS World University Rankings 2026 - Custom"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Provider
                </label>

                <select
                  value={newScenarioProvider}
                  onChange={(e) => setNewScenarioProvider(e.target.value)}
                  className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#D7142A]"
                >
                  <option value="QS">QS</option>
                  <option value="THE">THE</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Year
                </label>

                <Input
                  type="number"
                  value={newScenarioYear}
                  onChange={(e) => setNewScenarioYear(e.target.value)}
                  placeholder="2026"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Model
              </label>

              <select
                value={newScenarioModelId}
                onChange={(e) => setNewScenarioModelId(e.target.value)}
                className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#D7142A]"
              >
                <option value="">Select model</option>

                {availableModelsForScenario.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.isDefault ? "· Default" : "· Custom"}
                  </option>
                ))}
              </select>

              {newScenarioModelId && (
                <p className="text-xs text-slate-500">
                  Formula will be assigned automatically from the selected
                  model.
                </p>
              )}

              {!availableModelsForScenario.length && (
                <p className="text-xs text-red-600">
                  No active models found for this provider.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setScenarioDialogOpen(false);
                setScenarioDialogError("");
              }}
              disabled={creatingScenario}
              className="bg-white cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleCreateScenario}
              disabled={creatingScenario}
              className="bg-[#D7142A] hover:bg-[#c11224] text-white cursor-pointer"
            >
              {creatingScenario ? "Creating..." : "Create scenario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="bg-white text-zinc-700 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {modelDialogMode === "duplicate"
                ? "Duplicate model"
                : "Create new model"}
            </DialogTitle>

            <DialogDescription>
              {modelDialogMode === "duplicate"
                ? "Create a custom copy of an existing model and its formula."
                : "Create a new model with a default formula structure."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {modelDialogError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {modelDialogError}
              </div>
            )}

            {modelDialogMode === "duplicate" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Base model
                </label>

                <select
                  value={baseModelId}
                  onChange={(e) => setBaseModelId(e.target.value)}
                  className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#D7142A]"
                >
                  <option value="">Select base model</option>

                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} · {model.provider}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {modelDialogMode === "create" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Provider
                </label>

                <select
                  value={newModelProvider}
                  onChange={(e) => setNewModelProvider(e.target.value)}
                  className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#D7142A]"
                >
                  <option value="QS">QS</option>
                  <option value="THE">THE</option>
                </select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                New model name
              </label>

              <Input
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="Example: QS Sustainability Model"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setModelDialogOpen(false);
                setModelDialogError("");
              }}
              disabled={savingModel}
              className="bg-white cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleSaveModel}
              disabled={savingModel}
              className="bg-[#D7142A] hover:bg-[#c11224] text-white cursor-pointer"
            >
              {savingModel ? "Saving..." : "Save model"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formulaDialogOpen} onOpenChange={setFormulaDialogOpen}>
        <DialogContent className="bg-white text-zinc-700 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedFormulaModel?.isDefault
                ? "View default formula"
                : "View / edit formula"}
            </DialogTitle>

            <DialogDescription>
              {selectedFormulaModel
                ? `${selectedFormulaModel.name} · ${selectedFormulaModel.provider}`
                : "Formula details"}
            </DialogDescription>
          </DialogHeader>

          {formulaDialogError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formulaDialogError}
            </div>
          )}

          {loadingModelFormula && (
            <p className="text-sm text-slate-500">Loading formula...</p>
          )}

          {!loadingModelFormula && editableFormula && (
            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">
                  {editableFormula.name}
                </p>
                <p className="text-xs text-slate-500">{editableFormula.id}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Description
                </label>

                <Input
                  value={editableFormulaDescription}
                  onChange={(e) =>
                    setEditableFormulaDescription(e.target.value)
                  }
                  disabled={selectedFormulaModel?.isDefault === true}
                  placeholder="Formula description"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Formula
                </label>

                <textarea
                  value={editableFormulaText}
                  onChange={(e) => setEditableFormulaText(e.target.value)}
                  disabled={selectedFormulaModel?.isDefault === true}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#D7142A] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="score = Σ(normalizedMetric * weight)"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    Parameters / weights
                  </h4>
                  <p className="text-xs text-slate-500">
                    Values are stored as decimals. Example: 0.30 = 30%.
                  </p>
                </div>

                <div className="space-y-2">
                  {Object.entries(editableWeights).map(([key, value]) => (
                    <div
                      key={key}
                      className="grid grid-cols-[1fr_120px] items-center gap-3 rounded-md border border-slate-200 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {getMetricLabel(key)}
                        </p>
                        <p className="text-xs text-slate-500">{key}</p>
                      </div>

                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={value}
                        onChange={(e) => {
                          const nextValue = e.target.value;

                          setEditableWeights((prev) => ({
                            ...prev,
                            [key]: nextValue,
                          }));
                        }}
                        disabled={selectedFormulaModel?.isDefault === true}
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>

                <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Total weight:{" "}
                  <span className="font-semibold text-slate-900">
                    {getWeightsTotal(editableWeights).toFixed(3)}
                  </span>
                </div>
              </div>

              {selectedFormulaModel?.isDefault && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Default formulas are read-only. Duplicate the model if you
                  want to edit its formula.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormulaDialogOpen(false);
                setFormulaDialogError("");
              }}
              disabled={savingModelFormula}
              className="bg-white cursor-pointer"
            >
              Close
            </Button>

            {selectedFormulaModel?.isDefault !== true && (
              <Button
                type="button"
                onClick={handleSaveFormula}
                disabled={
                  savingModelFormula || loadingModelFormula || !editableFormula
                }
                className="bg-[#D7142A] hover:bg-[#c11224] text-white cursor-pointer"
              >
                {savingModelFormula ? "Saving..." : "Save formula"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editViewDialogOpen} onOpenChange={setEditViewDialogOpen}>
        <DialogContent className="bg-white text-zinc-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit view name</DialogTitle>
            <DialogDescription>
              Rename this custom ranking view.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editingViewError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editingViewError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                View name
              </label>

              <Input
                value={editingViewName}
                onChange={(e) => setEditingViewName(e.target.value)}
                placeholder="Example: MIT No Sustainability"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditViewDialogOpen(false);
                setEditingViewError("");
              }}
              disabled={savingViewName}
              className="bg-white cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleUpdateViewName}
              disabled={savingViewName || !editingViewName.trim()}
              className="bg-[#D7142A] hover:bg-[#c11224] text-white cursor-pointer"
            >
              {savingViewName ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editModelDialogOpen} onOpenChange={setEditModelDialogOpen}>
        <DialogContent className="bg-white text-zinc-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit model names</DialogTitle>
            <DialogDescription>
              Rename the custom model and its associated formula.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editModelError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editModelError}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Model name
                </label>

                <span
                  className={`text-xs ${
                    editingModelName.length > 30
                      ? "text-red-600"
                      : "text-slate-400"
                  }`}
                >
                  {editingModelName.length}/30
                </span>
              </div>

              <Input
                value={editingModelName}
                maxLength={30}
                onChange={(e) => setEditingModelName(e.target.value)}
                placeholder="Example: QS No Sustainability"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Formula name
                </label>

                <span
                  className={`text-xs ${
                    editingFormulaName.length > 30
                      ? "text-red-600"
                      : "text-slate-400"
                  }`}
                >
                  {editingFormulaName.length}/30
                </span>
              </div>

              <Input
                value={editingFormulaName}
                maxLength={30}
                onChange={(e) => setEditingFormulaName(e.target.value)}
                placeholder="Example: QS No Sustainability Formula"
              />
            </div>

            {editingModel && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                <p>
                  <span className="font-medium text-slate-700">Model ID:</span>{" "}
                  {editingModel.id}
                </p>
                <p>
                  <span className="font-medium text-slate-700">
                    Formula ID:
                  </span>{" "}
                  {editingModel.formulaId}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditModelDialogOpen(false);
                setEditModelError("");
              }}
              disabled={savingModelNames}
              className="bg-white cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleSaveModelNames}
              disabled={
                savingModelNames ||
                !editingModelName.trim() ||
                !editingFormulaName.trim() ||
                editingModelName.length > 30 ||
                editingFormulaName.length > 30
              }
              className="bg-[#D7142A] hover:bg-[#c11224] text-white cursor-pointer"
            >
              {savingModelNames ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RankingTable({
  rows,
  loading,
  provider,
  scenario,
  formula,
  onMetricChange,
  onRemoveUniversities,
  lastEditedUniversityId,
}: {
  rows: RankingRow[];
  loading: boolean;
  provider?: string;
  scenario?: RankingScenario;
  formula: RankingFormula | null;
  onMetricChange: (params: {
    row: RankingRow;
    field: string;
    value: number;
  }) => void;
  onRemoveUniversities: (universityIds: string[]) => void;
  lastEditedUniversityId?: string | null;
}) {
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [sortKey, setSortKey] = useState<string>("outputRank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [universitySearch, setUniversitySearch] = useState("");

  const metricColumns = getMetricColumns(provider);

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("ranking-export");
  const [exportMode, setExportMode] = useState<"all" | "top">("all");
  const [exportLimit, setExportLimit] = useState("100");
  const [exportError, setExportError] = useState("");

  const goToUpf = () => {
    const allVisibleRows = rows;

    const sortedVisibleRows = [...allVisibleRows].sort((a, b) => {
      const aValue = getSortableValue(a, sortKey);
      const bValue = getSortableValue(b, sortKey);

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      return sortDirection === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    const upfIndex = sortedVisibleRows.findIndex(isUpfRow);

    if (upfIndex === -1) return;

    const upfRow = sortedVisibleRows[upfIndex];
    const upfRowId = upfRow.universityId || upfRow.id;

    setUniversitySearch("");
    setPage(Math.floor(upfIndex / pageSize) + 1);
    setSelectedRows((prev) =>
      prev.includes(upfRowId) ? prev : [...prev, upfRowId],
    );
  };

  const sortedRows = useMemo(() => {
    const normalizedSearch = universitySearch.trim().toLowerCase();

    const filteredRows = rows.filter((row) => {
      if (!normalizedSearch) return true;

      const searchableText = [
        row.universityName,
        row.country,
        row.locationCode,
        row.universityId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });

    return [...filteredRows].sort((a, b) => {
      const aValue = getSortableValue(a, sortKey);
      const bValue = getSortableValue(b, sortKey);

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      return sortDirection === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }, [rows, universitySearch, sortKey, sortDirection]);

  useEffect(() => {
    if (!lastEditedUniversityId) return;

    const rowIndex = sortedRows.findIndex((row) => {
      const universityId = row.universityId || row.id;
      return universityId === lastEditedUniversityId;
    });

    if (rowIndex === -1) return;

    const nextPage = Math.floor(rowIndex / pageSize) + 1;

    setUniversitySearch("");
    setPage(nextPage);
    setSelectedRows((prev) =>
      prev.includes(lastEditedUniversityId)
        ? prev
        : [...prev, lastEditedUniversityId],
    );
  }, [lastEditedUniversityId, sortedRows, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedRows = sortedRows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const allCurrentPageSelected =
    paginatedRows.length > 0 &&
    paginatedRows.every((row) => selectedRows.includes(row.id));

  const handleSort = (
    key: string,
    defaultDirection: "asc" | "desc" = "desc",
  ) => {
    setPage(1);

    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(defaultDirection);
  };

  const toggleRow = (rowId: string) => {
    setSelectedRows((prev) =>
      prev.includes(rowId)
        ? prev.filter((id) => id !== rowId)
        : [...prev, rowId],
    );
  };

  const toggleCurrentPage = () => {
    if (allCurrentPageSelected) {
      setSelectedRows((prev) =>
        prev.filter((id) => !paginatedRows.some((row) => row.id === id)),
      );
    } else {
      const newIds = paginatedRows
        .map((row) => row.id)
        .filter((id) => !selectedRows.includes(id));

      setSelectedRows((prev) => [...prev, ...newIds]);
    }
  };

  useEffect(() => {
    setSelectedRows([]);
    setUniversitySearch("");
    setPage(1);
  }, [rows]);

  const handleExportRanking = () => {
  setExportError("");

  const cleanFileName = exportFileName.trim();

  if (!cleanFileName) {
    setExportError("Please enter a file name.");
    return;
  }

  let rowsToExport = [...sortedRows].sort((a, b) => {
    const rankA = typeof a.outputRank === "number" ? a.outputRank : Infinity;
    const rankB = typeof b.outputRank === "number" ? b.outputRank : Infinity;

    return rankA - rankB;
  });

  if (exportMode === "top") {
    const limit = Number(exportLimit);

    if (!Number.isFinite(limit) || limit <= 0) {
      setExportError("Please enter a valid number of universities.");
      return;
    }

    rowsToExport = rowsToExport.slice(0, limit);
  }

  const metricColumns = getMetricColumns(provider);

  const headers = [
    "Position",
    "University",
    "Country",
    "Provider",
    "Year",
    "Model",
    "Formula",
    "Output Score",
    "Original Score",
    ...metricColumns.map((metric) => metric.label),
  ];

  const csvRows = rowsToExport.map((row) => {
    return [
      row.outputRank ?? "",
      row.universityName ?? "",
      row.country ?? "",
      scenario?.provider ?? provider ?? "",
      scenario?.year ?? "",
      scenario?.modelName ?? "",
      scenario?.formulaName ?? "",
      typeof row.score === "number" ? row.score.toFixed(2) : "",
      typeof row.originalScore === "number" ? row.originalScore.toFixed(2) : "",
      ...metricColumns.map((metric) => {
        const value = getRowValue(row, metric.key);
        return typeof value === "number" ? value.toFixed(2) : "";
      }),
    ];
  });

  const csvContent = [headers, ...csvRows]
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell).replaceAll('"', '""');
          return `"${value}"`;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const finalFileName = cleanFileName.endsWith(".csv")
    ? cleanFileName
    : `${cleanFileName}.csv`;

  link.href = url;
  link.download = finalFileName;
  link.click();

  URL.revokeObjectURL(url);

  setExportDialogOpen(false);
};

  useEffect(() => {
    setPage(1);
  }, [pageSize, rows]);

  if (loading) {
    return <p className="text-slate-500">Loading ranking...</p>;
  }

  if (!rows.length) {
    return <p className="text-slate-500">No ranking rows found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mt-[-5px]">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Ranking Table
          </h3>
          <p className="text-sm text-slate-500">
            Look at the ranking results for the selected scenario and view.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={universitySearch}
            onChange={(e) => {
              setUniversitySearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search universities..."
            className="w-full sm:w-[320px]"
          />

          <Button
            type="button"
            variant="outline"
            onClick={goToUpf}
            className="bg-white cursor-pointer h-10"
          >
            Go to UPF
          </Button>
          <Button
  type="button"
  variant="outline"
  onClick={() => {
    setExportError("");
    setExportFileName(
      scenario
        ? `${scenario.provider?.toLowerCase()}-${scenario.year}-ranking`
        : "ranking-export",
    );
    setExportDialogOpen(true);
  }}
  className="bg-white cursor-pointer h-10"
>
  Export ranking
</Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={allCurrentPageSelected}
                  onCheckedChange={toggleCurrentPage}
                />
              </TableHead>

              <SortableTableHead
                label="Position"
                sortKey="outputRank"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onClick={() => handleSort("outputRank", "asc")}
                className="min-w-[90px]"
              />

              <SortableTableHead
                label="University"
                sortKey="universityName"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onClick={() => handleSort("universityName", "asc")}
                className="min-w-[320px]"
              />

              <SortableTableHead
                label="Output Value"
                sortKey="score"
                activeSortKey={sortKey}
                sortDirection={sortDirection}
                onClick={() => handleSort("score", "desc")}
                className="min-w-[130px]"
              />

              {metricColumns.map((metric) => (
                <SortableTableHead
                  key={metric.key}
                  label={metric.label}
                  sortKey={metric.key}
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onClick={() => handleSort(metric.key, "desc")}
                  className="min-w-[140px]"
                />
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedRows.map((row) => {
              const selected = selectedRows.includes(row.id);
              const logo = getUniversityLogo(row);

              return (
                <TableRow
                  key={row.id}
                  className={
                    isUpfRow(row)
                      ? selected
                        ? "bg-gradient-to-r from-red-200 via-red-100 to-white"
                        : "bg-gradient-to-r from-red-100 via-red-50 to-white"
                      : selected
                        ? "bg-red-50/60"
                        : row.isEdited
                          ? "bg-amber-50/50"
                          : ""
                  }
                >
                  <TableCell>
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleRow(row.id)}
                    />
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex min-w-[34px] items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                        {formatRankValue(row.outputRank)}
                      </div>

                      {typeof row.rankDelta === "number" &&
                        row.rankDelta !== 0 && (
                          <span
                            className={`text-xs font-semibold ${
                              row.rankDelta > 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {row.rankDelta > 0
                              ? `↑ ${row.rankDelta}`
                              : `↓ ${Math.abs(row.rankDelta)}`}
                          </span>
                        )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-slate-200">
                        {logo ? (
                          <AvatarImage
                            src={logo}
                            alt={row.universityName || "University logo"}
                          />
                        ) : null}

                        <AvatarFallback className="bg-slate-100 text-slate-700 font-semibold">
                          {getInitials(row.universityName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {row.universityName || "-"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {row.country || "-"}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1">
                      <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                        {formatMetricValue(getRowValue(row, "score"))}
                      </div>

                      {row.isEdited &&
                        typeof row.originalScore === "number" && (
                          <p className="text-xs text-slate-400">
                            Original: {row.originalScore.toFixed(1)}
                          </p>
                        )}
                    </div>
                  </TableCell>

                  {metricColumns.map((metric) => (
                    <TableCell key={metric.key} className="text-slate-700">
                      <EditableMetricCell
                        row={row}
                        field={metric.key}
                        value={getRowValue(row, metric.key)}
                        onSave={(value) => {
                          onMetricChange({
                            row,
                            field: metric.key,
                            value,
                          });
                        }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-4 pt-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-800">
              {(safePage - 1) * pageSize + 1}
            </span>
            {" - "}
            <span className="font-medium text-slate-800">
              {Math.min(safePage * pageSize, sortedRows.length)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-slate-800">
              {sortedRows.length}
            </span>{" "}
            universities ·{" "}
            <span className="font-medium text-slate-800">
              {selectedRows.length}
            </span>{" "}
            selected
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Rows per page</span>

            <select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="appearance-none bg-white px-3 py-2 pr-8 rounded border border-slate-300 text-sm font-medium text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 cursor-pointer min-w-fit mask-ellipse"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-white"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage === 1}
          >
            Previous
          </Button>

          <div className="flex items-center gap-1">
            {getVisiblePages(safePage, totalPages).map((pageNumber, index) =>
              pageNumber === "..." ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-sm text-slate-500"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={pageNumber}
                  variant={safePage === pageNumber ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(pageNumber)}
                  className={
                    safePage === pageNumber
                      ? "text-zinc-700 border-zinc-700"
                      : "text-zinc-200"
                  }
                >
                  {pageNumber}
                </Button>
              ),
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="text-white"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safePage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
      {selectedRows.length > 0 && (
        <div className="fixed bottom-6 left-64 z-50 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {selectedRows.length} universities selected
            </p>
            <p className="text-xs text-slate-500">
              Choose what to do with this selection.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelectedRows([])}
            className="bg-white cursor-pointer"
          >
            Deselect
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onRemoveUniversities(selectedRows);
              setSelectedRows([]);
            }}
            className="bg-white text-red-600 hover:text-red-700 cursor-pointer"
          >
            Remove from ranking
          </Button>
        </div>
      )}

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
  <DialogContent className="bg-white text-zinc-700 sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Export ranking</DialogTitle>
      <DialogDescription>
        Download the current ranking as a CSV file.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-5">
      {exportError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {exportError}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <p className="font-medium text-slate-900 mb-2">Ranking details</p>

        <div className="grid grid-cols-2 gap-2 text-slate-600">
          <p>
            <span className="font-medium text-slate-800">Provider:</span>{" "}
            {scenario?.provider || provider || "-"}
          </p>

          <p>
            <span className="font-medium text-slate-800">Year:</span>{" "}
            {scenario?.year || "-"}
          </p>

          <p className="col-span-2">
            <span className="font-medium text-slate-800">Model:</span>{" "}
            {scenario?.modelName || "-"}
          </p>

          <p className="col-span-2">
            <span className="font-medium text-slate-800">Formula:</span>{" "}
            {scenario?.formulaName || "-"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">
          File name
        </label>

        <Input
          value={exportFileName}
          onChange={(e) => setExportFileName(e.target.value)}
          placeholder="Example: qs-2026-ranking"
        />

        <p className="text-xs text-slate-500">
          The file will be downloaded as a CSV.
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-700">
          Universities to export
        </label>

        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => setExportMode("all")}
            className={`rounded-lg border px-4 py-3 text-left transition-colors ${
              exportMode === "all"
                ? "border-[#D7142A] bg-red-50"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <p className="font-medium text-slate-900">
              Export all universities
            </p>
            <p className="text-sm text-slate-500">
              Export all {sortedRows.length} universities in the current ranking.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setExportMode("top")}
            className={`rounded-lg border px-4 py-3 text-left transition-colors ${
              exportMode === "top"
                ? "border-[#D7142A] bg-red-50"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <p className="font-medium text-slate-900">
              Export top universities only
            </p>
            <p className="text-sm text-slate-500">
              Export only the first N universities.
            </p>
          </button>
        </div>

        {exportMode === "top" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Number of universities
            </label>

            <Input
              type="number"
              min={1}
              max={sortedRows.length}
              value={exportLimit}
              onChange={(e) => setExportLimit(e.target.value)}
              placeholder="100"
            />
          </div>
        )}
      </div>
    </div>

    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        onClick={() => setExportDialogOpen(false)}
        className="bg-white cursor-pointer"
      >
        Cancel
      </Button>

      <Button
        type="button"
        onClick={handleExportRanking}
        className="bg-[#D7142A] hover:bg-[#c11224] text-white cursor-pointer"
      >
        Download CSV
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
    </div>
  );
}

function ViewsPanel({
  scenarios,
  selectedScenarioId,
  onScenarioChange,
  views,
  search,
  onSearchChange,
  onDeleteView,
  onEditView,
}: {
  scenarios: RankingScenario[];
  selectedScenarioId: string;
  onScenarioChange: (scenarioId: string) => void;
  views: RankingView[];
  search: string;
  onSearchChange: (value: string) => void;
  onDeleteView: (viewId: string) => void;
  onEditView: (view: RankingView) => void;
}) {
  const selectedScenario = scenarios.find(
    (scenario) => scenario.id === selectedScenarioId,
  );

  const rows = useMemo(() => {
    const originalRow = {
      id: "original",
      name: "Original",
      type: "Original",
      scenarioName: selectedScenario?.name || "-",
      createdAt: null,
      updatedAt: null,
      isOriginal: true,
      originalView: null,
    };

    const customRows = views.map((view) => ({
      id: view.id,
      name: view.name,
      type: "Custom",
      scenarioName: selectedScenario?.name || "-",
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
      isOriginal: false,
      originalView: view,
    }));

    const allRows = [originalRow, ...customRows];

    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) return allRows;

    return allRows.filter((row) =>
      `${row.name} ${row.type} ${row.scenarioName}`
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [views, search, selectedScenario]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Scenario</span>

          <div className="relative">
            <select
              value={selectedScenarioId}
              onChange={(e) => onScenarioChange(e.target.value)}
              className="appearance-none bg-white px-3 py-2 pr-8 rounded border border-slate-300 text-sm font-medium text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D7142A] cursor-pointer min-w-[300px]"
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

        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search views..."
          className="w-full lg:w-[320px]"
        />
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="min-w-[260px] text-zinc-700">
                View name
              </TableHead>
              <TableHead className="min-w-[220px] text-zinc-700">
                Scenario
              </TableHead>
              <TableHead className="min-w-[120px] text-zinc-700">
                Type
              </TableHead>
              <TableHead className="min-w-[170px] text-zinc-700">
                Created
              </TableHead>
              <TableHead className="min-w-[170px] text-zinc-700">
                Last updated
              </TableHead>
              <TableHead className="w-[120px] text-right text-zinc-700">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="min-h-14 h-14">
                <TableCell>
                  <div>
                    <p className="font-medium text-slate-900">{row.name}</p>
                    {row.isOriginal && (
                      <p className="text-xs text-slate-500">
                        Official data without modifications
                      </p>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-slate-600">
                  {row.scenarioName}
                </TableCell>

                <TableCell>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      row.isOriginal
                        ? "bg-slate-100 text-slate-700"
                        : "bg-red-50 text-[#D7142A]"
                    }`}
                  >
                    {row.type}
                  </span>
                </TableCell>

                <TableCell className="text-slate-600">
                  {formatFirestoreDate(row.createdAt)}
                </TableCell>

                <TableCell className="text-slate-600">
                  {formatFirestoreDate(row.updatedAt)}
                </TableCell>

                <TableCell className="text-right">
                  {row.isOriginal ? (
                    <span className="text-xs text-slate-400">Read-only</span>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (row.originalView) {
                            onEditView(row.originalView);
                          }
                        }}
                        className="bg-white cursor-pointer"
                      >
                        <Pencil size={14} className="mr-1" />
                        Edit
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onDeleteView(row.id)}
                        className="text-red-600 hover:text-red-700 bg-white cursor-pointer border-red"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!rows.length && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No views found.
        </div>
      )}
    </div>
  );
}

function SortableTableHead({
  label,
  sortKey,
  activeSortKey,
  sortDirection,
  onClick,
  className,
}: {
  label: string;
  sortKey: string;
  activeSortKey: string;
  sortDirection: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  const isActive = activeSortKey === sortKey;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1 font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        {label}

        {!isActive && <ArrowUpDown size={14} className="text-slate-400" />}
        {isActive && sortDirection === "asc" && (
          <ArrowUp size={14} className="text-[#D7142A]" />
        )}
        {isActive && sortDirection === "desc" && (
          <ArrowDown size={14} className="text-[#D7142A]" />
        )}
      </button>
    </TableHead>
  );
}

function getSortableValue(
  row: RankingRow,
  key: string,
): string | number | null {
  if (key === "outputRank") {
    return typeof row.outputRank === "number" ? row.outputRank : null;
  }

  const value = getRowValue(row, key);

  if (typeof value === "number") return value;
  if (typeof value === "string") return value;

  return null;
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

function formatMetricValue(value: unknown) {
  if (typeof value !== "number") return "-";
  return value.toFixed(1);
}

function getInitials(name?: string) {
  if (!name) return "U";

  const parts = name.split(" ").filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatRankValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return value;
  return "-";
}

function getMetricColumns(provider?: string) {
  if (provider === "THE") {
    return [
      { key: "teachingScore", label: "Teaching" },
      { key: "researchEnvironmentScore", label: "Research Env." },
      { key: "researchQualityScore", label: "Research Quality" },
      { key: "internationalOutlookScore", label: "International" },
    ];
  }

  return [
    { key: "academicReputationScore", label: "Academic Rep." },
    { key: "employerReputationScore", label: "Employer Rep." },
    { key: "facultyStudentScore", label: "Faculty Student" },
    { key: "citationsPerFacultyScore", label: "Citations" },
    { key: "internationalFacultyScore", label: "International Faculty" },
    { key: "internationalStudentsScore", label: "International Students" },
    { key: "internationalResearchNetworkScore", label: "Research Net." },
    { key: "employmentOutcomesScore", label: "Employment" },
    { key: "sustainabilityScore", label: "Sustainability" },
  ];
}

function getVisiblePages(
  currentPage: number,
  totalPages: number,
): Array<number | "..."> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "...", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [
      1,
      "...",
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

function getUniversityLogo(row: RankingRow) {
  if (!row.universityId) return null;

  return `/universities/${row.universityId}.png`;
}

function FormulaPanel({
  formula,
  loading,
}: {
  formula: RankingFormula | null;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-slate-500">Loading formula...</p>;
  }

  if (!formula) {
    return <p className="text-slate-500">No formula found.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-slate-900">{formula.name}</h3>

        {formula.description && (
          <p className="mt-2 text-slate-500">{formula.description}</p>
        )}
      </div>

      {formula.formulaText && (
        <div className="rounded-md bg-slate-50 border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-500">Formula</p>
          <p className="mt-1 text-slate-900">{formula.formulaText}</p>
        </div>
      )}

      {formula.weights && (
        <div>
          <h4 className="font-semibold text-slate-900 mb-2">Weights</h4>

          <div className="space-y-2">
            {Object.entries(formula.weights).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between border-b border-slate-100 py-2 text-sm"
              >
                <span className="text-slate-600">{key}</span>
                <span className="font-medium text-slate-900">
                  {(value * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ParametersPanel({
  parameters,
  loading,
}: {
  parameters: RankingParameters | null;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-slate-500">Loading parameters...</p>;
  }

  if (!parameters) {
    return <p className="text-slate-500">No parameters found.</p>;
  }

  return (
    <div className="space-y-3 text-sm">
      <ParameterRow
        label="Normalization method"
        value={parameters.normalizationMethod}
      />

      <ParameterRow
        label="Missing data policy"
        value={parameters.missingDataPolicy}
      />

      <ParameterRow
        label="Outlier treatment"
        value={parameters.outlierTreatment}
      />

      <ParameterRow
        label="Minimum sample size"
        value={
          parameters.minSampleSize
            ? String(parameters.minSampleSize)
            : undefined
        }
      />

      <ParameterRow
        label="Included countries"
        value={parameters.includedCountries?.join(", ")}
      />

      <ParameterRow
        label="Excluded institutions"
        value={parameters.excludedInstitutions?.join(", ")}
      />
    </div>
  );
}

function ParameterRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value || "-"}</span>
    </div>
  );
}

function calculateOutputValue(
  row: RankingRow,
  weights?: Record<string, number>,
  fallbackScore = 0,
) {
  if (!weights || Object.keys(weights).length === 0) {
    return fallbackScore;
  }

  let total = 0;
  let matchedFields = 0;

  Object.entries(weights).forEach(([field, weight]) => {
    const value = getRowValue(row, field);

    if (typeof value !== "number") return;

    total += value * weight;
    matchedFields += 1;
  });

  if (matchedFields === 0) {
    return fallbackScore;
  }

  return Number(total.toFixed(2));
}

function EditableMetricCell({
  value,
  onSave,
}: {
  row: RankingRow;
  field: string;
  value: unknown;
  onSave: (value: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(
    typeof value === "number" ? String(value) : "",
  );

  useEffect(() => {
    setLocalValue(typeof value === "number" ? String(value) : "");
  }, [value]);

  const handleSave = () => {
    const originalValue = typeof value === "number" ? value : null;
    const numericValue = Number(String(localValue).replace(",", "."));

    if (!Number.isFinite(numericValue)) {
      setLocalValue(originalValue !== null ? String(originalValue) : "");
      setIsEditing(false);
      return;
    }

    if (
      originalValue !== null &&
      Math.abs(numericValue - originalValue) < 0.0001
    ) {
      setIsEditing(false);
      return;
    }

    onSave(numericValue);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="rounded px-2 py-1 text-left hover:bg-slate-100"
      >
        {formatMetricValue(value)}
      </button>
    );
  }

  return (
    <Input
      autoFocus
      type="number"
      min={0}
      max={100}
      step="0.1"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }

        if (e.key === "Escape") {
          setLocalValue(typeof value === "number" ? String(value) : "");
          setIsEditing(false);
        }
      }}
      className="h-8 w-20"
    />
  );
}

function formatFirestoreDate(value: unknown) {
  if (!value) return "-";

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date })
      .toDate()
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
  }

  if (value instanceof Date) {
    return value.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return "-";
}

function ScenariosPanel({
  scenarios,
  search,
  onSearchChange,
  provider,
  onProviderChange,
  year,
  onYearChange,
  onCreateScenario,
  onEditScenario,
  onViewScenario,
  onSeedDefaults,
  onDeleteScenario,
}: {
  scenarios: RankingScenario[];
  search: string;
  onSearchChange: (value: string) => void;
  provider: string;
  onProviderChange: (value: string) => void;
  year: string;
  onYearChange: (value: string) => void;
  onCreateScenario: () => void;
  onEditScenario: (scenarioId: string) => void;
  onViewScenario: (scenarioId: string) => void;
  onSeedDefaults: () => void;
  onDeleteScenario: (scenarioId: string) => void;
}) {
  const providers = useMemo(() => {
    return Array.from(
      new Set(scenarios.map((scenario) => scenario.provider).filter(Boolean)),
    );
  }, [scenarios]);

  const years = useMemo(() => {
    return Array.from(
      new Set(
        scenarios
          .map((scenario) => scenario.year)
          .filter((scenarioYear): scenarioYear is number => {
            return typeof scenarioYear === "number";
          }),
      ),
    ).sort((a, b) => b - a);
  }, [scenarios]);

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return scenarios
      .filter((scenario) => {
        const matchesProvider =
          provider === "all" || scenario.provider === provider;

        const matchesYear = year === "all" || String(scenario.year) === year;

        const searchableText = [
          scenario.name,
          scenario.id,
          scenario.provider,
          scenario.year,
          scenario.modelId,
          scenario.modelName,
          scenario.formulaId,
          scenario.formulaName,
          scenario.resultSetId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !normalizedSearch || searchableText.includes(normalizedSearch);

        return matchesProvider && matchesYear && matchesSearch;
      })
      .sort((a, b) => {
        const orderA =
          typeof a.sortOrder === "number"
            ? a.sortOrder
            : Number.MAX_SAFE_INTEGER;

        const orderB =
          typeof b.sortOrder === "number"
            ? b.sortOrder
            : Number.MAX_SAFE_INTEGER;

        if (orderA !== orderB) return orderA - orderB;

        const yearA = typeof a.year === "number" ? a.year : 0;
        const yearB = typeof b.year === "number" ? b.year : 0;

        return yearB - yearA;
      });
  }, [scenarios, search, provider, year]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Provider</span>

            <div className="relative">
              <select
                value={provider}
                onChange={(e) => onProviderChange(e.target.value)}
                className="appearance-none bg-white px-3 py-2 pr-8 rounded border border-slate-300 text-sm font-medium text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D7142A] cursor-pointer min-w-[160px]"
              >
                <option value="all">All providers</option>

                {providers.map((providerValue) => (
                  <option key={providerValue} value={providerValue}>
                    {providerValue}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Year</span>

            <div className="relative">
              <select
                value={year}
                onChange={(e) => onYearChange(e.target.value)}
                className="appearance-none bg-white px-3 py-2 pr-8 rounded border border-slate-300 text-sm font-medium text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D7142A] cursor-pointer min-w-[140px]"
              >
                <option value="all">All years</option>

                {years.map((yearValue) => (
                  <option key={yearValue} value={String(yearValue)}>
                    {yearValue}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search scenarios..."
            className="w-full sm:w-[320px]"
          />

          <Button
            type="button"
            variant="outline"
            onClick={onSeedDefaults}
            className="bg-white cursor-pointer h-10"
          >
            Seed scenarios
          </Button>

          <Button
            type="button"
            onClick={onCreateScenario}
            className="bg-[#D7142A] hover:bg-[#c11224] text-white cursor-pointer h-10"
          >
            <Plus size={16} className="mr-2" />
            New scenario
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="min-w-[280px] text-zinc-700">
                Scenario name
              </TableHead>

              <TableHead className="min-w-[100px] text-zinc-700">
                Provider
              </TableHead>

              <TableHead className="min-w-[100px] text-zinc-700">
                Year
              </TableHead>

              <TableHead className="min-w-[260px] text-zinc-700">
                Model
              </TableHead>

              <TableHead className="min-w-[200px] text-zinc-700">
                Result set
              </TableHead>

              <TableHead className="min-w-[120px] text-zinc-700">
                Status
              </TableHead>

              <TableHead className="min-w-[140px] text-zinc-700">
                Default
              </TableHead>

              <TableHead className="w-[180px] text-right text-zinc-700">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((scenario) => {
              const isActive = scenario.isActive === true;
              const isDefaultScenario = getIsDefaultScenario(scenario);

              return (
                <TableRow key={scenario.id} className="min-h-14 h-14">
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">
                        {scenario.name}
                      </p>

                      <p className="text-xs text-slate-500">{scenario.id}</p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {scenario.provider || "-"}
                    </span>
                  </TableCell>

                  <TableCell className="text-slate-600">
                    {scenario.year || "-"}
                  </TableCell>

                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-800">
                        {scenario.modelName || "-"}
                      </p>

                      <p className="text-xs text-slate-500">
                        {scenario.modelId || "-"}
                      </p>

                      {scenario.formulaName || scenario.formulaId ? (
                        <p className="mt-1 text-xs text-slate-400">
                          Formula: {scenario.formulaName || scenario.formulaId}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell>
                    <p className="text-sm text-slate-600">
                      {scenario.resultSetId || "-"}
                    </p>
                  </TableCell>

                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>

                  <TableCell>
                    {isDefaultScenario ? (
                      <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-[#D7142A]">
                        {getDefaultLabel(scenario)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    {isDefaultScenario ? (
                      <span className="text-xs text-slate-400">Read-only</span>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onEditScenario(scenario.id)}
                          className="bg-white cursor-pointer"
                        >
                          <Pencil size={14} className="mr-1" />
                          Edit
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onViewScenario(scenario.id)}
                          className="bg-white cursor-pointer"
                        >
                          <Eye size={14} className="mr-1" />
                          View
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onDeleteScenario(scenario.id)}
                          className="bg-white text-red-600 hover:text-red-700 cursor-pointer border-red"
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {!rows.length && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No scenarios found.
        </div>
      )}
    </div>
  );
}

function getIsDefaultScenario(scenario: RankingScenario) {
  return (
    scenario.isGlobalDefault === true ||
    scenario.isAppDefault === true ||
    scenario.isDefault === true
  );
}

function getDefaultLabel(scenario: RankingScenario) {
  if (scenario.isGlobalDefault === true) return "Global default";
  if (scenario.isAppDefault === true) return "App default";
  if (scenario.isDefault === true) return "Default";

  return "-";
}

function ModelsPanel({
  models,
  search,
  onSearchChange,
  onCreateModel,
  onDuplicateModel,
  onDeleteModel,
  onSeedDefaults,
  onViewFormula,
  onEditModel,
}: {
  models: RankingModel[];
  search: string;
  onSearchChange: (value: string) => void;
  onCreateModel: () => void;
  onDuplicateModel: (modelId: string) => void;
  onDeleteModel: (modelId: string) => void;
  onSeedDefaults: () => void;
  onViewFormula: (modelId: string) => void;
  onEditModel: (model: RankingModel) => void;
}) {
  const [sortKey, setSortKey] = useState<
    "type" | "name" | "provider" | "status"
  >("type");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filteredRows = models.filter((model) => {
      if (!normalizedSearch) return true;

      return `${model.name} ${model.id} ${model.provider} ${model.formulaName} ${model.formulaId}`
        .toLowerCase()
        .includes(normalizedSearch);
    });

    return filteredRows.sort((a, b) => {
      let aValue: string | number = "";
      let bValue: string | number = "";

      if (sortKey === "type") {
        // Default first
        aValue = a.isDefault === true ? 0 : 1;
        bValue = b.isDefault === true ? 0 : 1;
      }

      if (sortKey === "name") {
        aValue = a.name || "";
        bValue = b.name || "";
      }

      if (sortKey === "provider") {
        aValue = a.provider || "";
        bValue = b.provider || "";
      }

      if (sortKey === "status") {
        aValue = a.isActive !== false ? 0 : 1;
        bValue = b.isActive !== false ? 0 : 1;
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      return sortDirection === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }, [models, search, sortKey, sortDirection]);

  const handleSort = (key: "type" | "name" | "provider" | "status") => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Ranking models
          </h3>
          <p className="text-sm text-slate-500">
            Models define the formula used later by scenarios.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search models..."
            className="w-full sm:w-[320px]"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onSeedDefaults}
            className="bg-white cursor-pointer h-10"
          >
            Seed defaults
          </Button>
          <Button
            type="button"
            onClick={onCreateModel}
            className="bg-[#D7142A] hover:bg-[#c11224] text-white cursor-pointer h-10"
          >
            <Plus size={16} className="mr-2" />
            New model
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="min-w-[280px] text-zinc-700">
                <button
                  type="button"
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 hover:text-slate-900"
                >
                  Model name
                  <ArrowUpDown size={14} className="text-slate-400" />
                </button>
              </TableHead>

              <TableHead className="min-w-[120px] text-zinc-700">
                <button
                  type="button"
                  onClick={() => handleSort("provider")}
                  className="flex items-center gap-1 hover:text-slate-900"
                >
                  Provider
                  <ArrowUpDown size={14} className="text-slate-400" />
                </button>
              </TableHead>

              <TableHead className="min-w-[280px] text-zinc-700">
                Formula
              </TableHead>

              <TableHead className="min-w-[120px] text-zinc-700">
                <button
                  type="button"
                  onClick={() => handleSort("status")}
                  className="flex items-center gap-1 hover:text-slate-900"
                >
                  Status
                  <ArrowUpDown size={14} className="text-slate-400" />
                </button>
              </TableHead>

              <TableHead className="min-w-[120px] text-zinc-700">
                <button
                  type="button"
                  onClick={() => handleSort("type")}
                  className="flex items-center gap-1 hover:text-slate-900"
                >
                  Type
                  <ArrowUpDown size={14} className="text-slate-400" />
                </button>
              </TableHead>

              <TableHead className="w-[220px] text-right text-zinc-700">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((model) => {
              const isDefaultModel = model.isDefault === true;

              return (
                <TableRow key={model.id} className="min-h-14 h-14">
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900">{model.name}</p>
                      <p className="text-xs text-slate-500">{model.id}</p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {model.provider || "-"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-800">
                        {model.formulaName || "-"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {model.formulaId || "-"}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        model.isActive !== false
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {model.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </TableCell>

                  <TableCell>
                    {isDefaultModel ? (
                      <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-[#D7142A]">
                        Default
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        Custom
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isDefaultModel ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onDuplicateModel(model.id)}
                          className="bg-white cursor-pointer"
                        >
                          Duplicate
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onEditModel(model)}
                            className="bg-white cursor-pointer"
                          >
                            Edit names
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onDeleteModel(model.id)}
                            className="bg-white text-red-600 hover:text-red-700 cursor-pointer border-red"
                          >
                            Delete
                          </Button>
                        </>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onViewFormula(model.id)}
                        className="bg-white cursor-pointer"
                      >
                        {isDefaultModel ? (
                          <>
                            <Eye size={14} className="mr-1" />
                            View formula
                          </>
                        ) : (
                          <>
                            <Pencil size={14} className="mr-1" />
                            Edit formula
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {!rows.length && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No models found.
        </div>
      )}
    </div>
  );
}

function getWeightsTotal(weights: Record<string, string>) {
  return Object.values(weights).reduce((sum, value) => {
    const parsedValue = Number(String(value).replace(",", "."));

    if (!Number.isFinite(parsedValue)) return sum;

    return sum + parsedValue;
  }, 0);
}

function getMetricLabel(metricKey: string) {
  const labels: Record<string, string> = {
    academicReputationScore: "Academic Reputation",
    employerReputationScore: "Employer Reputation",
    facultyStudentScore: "Faculty Student",
    citationsPerFacultyScore: "Citations per Faculty",
    internationalFacultyScore: "International Faculty",
    internationalStudentsScore: "International Students",
    internationalResearchNetworkScore: "International Research Network",
    employmentOutcomesScore: "Employment Outcomes",
    sustainabilityScore: "Sustainability",

    teachingScore: "Teaching",
    researchEnvironmentScore: "Research Environment",
    researchQualityScore: "Research Quality",
    internationalOutlookScore: "International Outlook",
  };

  return labels[metricKey] || metricKey;
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
