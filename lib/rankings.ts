// lib/rankings.ts

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export interface RankingScenario {
  id: string;
  name: string;
  provider: string;
  year?: number | null;
  modelId: string;
  modelName?: string;
  formulaId: string;
  formulaName?: string;
  resultSetId: string;
  isActive?: boolean;
  isDefault?: boolean;
  isAppDefault?: boolean;
  isGlobalDefault?: boolean;
  sortOrder?: number;
}

export interface RankingParameters {
  id: string;
  scenarioId: string;
  normalizationMethod?: string;
  missingDataPolicy?: string;
  outlierTreatment?: string;
  includedCountries?: string[];
  excludedInstitutions?: string[];
  minSampleSize?: number;
}

export interface RankingRow {
  id: string;

  universityId?: string;
  universityName?: string;
  country?: string;
  locationCode?: string;

  provider?: string;
  year?: number;

  rank?: number;
  previousRank?: number;
  score?: number;

  originalScore?: number;
  outputRank?: number;
  isEdited?: boolean;

  [key: string]: unknown;
}

export async function createRankingScenario({
  name,
  provider,
  year,
  model,
}: {
  name: string;
  provider: string;
  year: number;
  model: RankingModel;
}) {
  const cleanProvider = provider.trim().toUpperCase();

  if (model.provider !== cleanProvider) {
    throw new Error(
      `Selected model belongs to ${model.provider}, but scenario provider is ${cleanProvider}.`,
    );
  }

  const isTryingToCreateDefaultScenario =
    model.isDefault === true &&
    ((cleanProvider === "QS" && model.id === "qs_default_v1") ||
      (cleanProvider === "THE" && model.id === "the_default_v1"));

  if (isTryingToCreateDefaultScenario) {
    const defaultScenarioId =
      cleanProvider === "QS" ? `qs_${year}_default` : `the_${year}_default`;

    const defaultScenarioSnap = await getDoc(
      doc(db, "RankingScenarios", defaultScenarioId),
    );

    if (defaultScenarioSnap.exists()) {
      throw new Error(
        `The default ${cleanProvider} scenario for ${year} already exists.`,
      );
    }
  }

  const cleanModelId = model.id.trim().toLowerCase();
  const cleanProviderId = cleanProvider.toLowerCase();

  const resultSetId = `${cleanProvider}_${year}_${cleanModelId}_results`;
  const scenarioId = `${cleanProvider}_${year}_${cleanModelId}`;

  const scenarioRef = doc(db, "RankingScenarios", scenarioId);
  const scenarioSnap = await getDoc(scenarioRef);

  if (scenarioSnap.exists()) {
    throw new Error(
      "A scenario with this provider, year and model already exists.",
    );
  }

  await setDoc(scenarioRef, {
    name: name.trim(),

    provider: provider.trim().toUpperCase(),
    year,

    modelId: model.id,
    modelName: model.name,

    formulaId: model.formulaId,
    formulaName: model.formulaName,

    resultSetId,

    isActive: true,
    isGlobalDefault: false,
    isDefault: false,
    isAppDefault: false,

    sortOrder: 999,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await createScenarioResultsFromDefault({
    provider,
    year,
    formulaId: model.formulaId,
    targetResultSetId: resultSetId,
  });

  return scenarioId;
}

function getDefaultResultSetId(provider: string, year: number) {
  const cleanProvider = provider.trim().toLowerCase();

  return `${cleanProvider}_${year}_default_results`;
}

function getMetricValue(row: RankingRow, metricKey: string): number | null {
  const directValue = (row as Record<string, unknown>)[metricKey];

  if (typeof directValue === "number") return directValue;

  const metrics = (row as { metrics?: Record<string, unknown> }).metrics;

  if (metrics && typeof metrics[metricKey] === "number") {
    return metrics[metricKey] as number;
  }

  return null;
}

function calculateScenarioScore({
  row,
  weights,
  fallbackScore,
}: {
  row: RankingRow;
  weights: Record<string, number>;
  fallbackScore?: number;
}) {
  let total = 0;
  let matchedFields = 0;

  Object.entries(weights).forEach(([metricKey, weight]) => {
    const value = getMetricValue(row, metricKey);

    if (typeof value !== "number") return;

    total += value * weight;
    matchedFields += 1;
  });

  if (matchedFields === 0) {
    return typeof fallbackScore === "number" ? fallbackScore : 0;
  }

  return Number(total.toFixed(2));
}

async function commitBatches(
  writes: Array<{
    ref: ReturnType<typeof doc>;
    data: Record<string, unknown>;
  }>,
) {
  const chunkSize = 450;

  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = writeBatch(db);
    const chunk = writes.slice(i, i + chunkSize);

    chunk.forEach(({ ref, data }) => {
      batch.set(ref, data, { merge: true });
    });

    await batch.commit();
  }
}

export async function getActiveRankingScenarios(): Promise<RankingScenario[]> {
  const scenariosRef = collection(db, "RankingScenarios");

  const q = query(scenariosRef, where("isActive", "==", true));

  const snapshot = await getDocs(q);

  const scenarios = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as RankingScenario[];

  return scenarios.sort((a, b) => {
    const sortA = a.sortOrder ?? 999;
    const sortB = b.sortOrder ?? 999;
    return sortA - sortB;
  });
}

export async function getRankingRows(
  resultSetId: string,
  rowsLimit = 1500,
): Promise<RankingRow[]> {
  const rowsRef = collection(db, "RankingResults", resultSetId, "Rows");

  const q = query(rowsRef, orderBy("rank", "asc"), limit(rowsLimit));

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as RankingRow[];
}

export async function getRankingFormula(
  formulaId: string,
): Promise<RankingFormula | null> {
  const formulaRef = doc(db, "RankingFormulas", formulaId);
  const snapshot = await getDoc(formulaRef);

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as RankingFormula;
}

export async function getRankingParameters(
  scenarioId: string,
): Promise<RankingParameters | null> {
  const parametersRef = doc(db, "RankingParameters", scenarioId);
  const snapshot = await getDoc(parametersRef);

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as RankingParameters;
}

export interface RankingModel {
  id: string;
  name: string;
  provider: string;
  formulaId: string;
  formulaName: string;
  isActive?: boolean;
  isDefault?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RankingFormula {
  id: string;
  name: string;
  provider: string;
  formulaText?: string;
  description?: string;
  weights?: Record<string, number>;
  isDefault?: boolean;
  version?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function getActiveRankingModels(): Promise<RankingModel[]> {
  const modelsRef = collection(db, "RankingModels");
  const q = query(modelsRef, where("isActive", "==", true));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as RankingModel[];
}

export async function getRankingFormulas(): Promise<RankingFormula[]> {
  const formulasRef = collection(db, "RankingFormulas");
  const snapshot = await getDocs(formulasRef);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as RankingFormula[];
}

export async function duplicateRankingModel({
  baseModelId,
  newModelName,
}: {
  baseModelId: string;
  newModelName: string;
}) {
  const baseModelRef = doc(db, "RankingModels", baseModelId);
  const baseModelSnap = await getDoc(baseModelRef);

  if (!baseModelSnap.exists()) {
    throw new Error("Base model not found.");
  }

  const baseModel = {
    id: baseModelSnap.id,
    ...baseModelSnap.data(),
  } as RankingModel;

  const baseFormulaRef = doc(db, "RankingFormulas", baseModel.formulaId);
  const baseFormulaSnap = await getDoc(baseFormulaRef);

  if (!baseFormulaSnap.exists()) {
    throw new Error("Base formula not found.");
  }

  const baseFormula = {
    id: baseFormulaSnap.id,
    ...baseFormulaSnap.data(),
  } as RankingFormula;

  const cleanModelId = slugifyModelId(newModelName);
  const newFormulaId = `${cleanModelId}_formula`;

  await setDoc(doc(db, "RankingFormulas", newFormulaId), {
    name: `${newModelName} Formula`,
    provider: baseModel.provider,
    formulaText: baseFormula.formulaText || "",
    description: baseFormula.description || "",
    weights: baseFormula.weights || {},
    isDefault: false,
    version: "1.0",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, "RankingModels", cleanModelId), {
    name: newModelName.trim(),
    provider: baseModel.provider,
    formulaId: newFormulaId,
    formulaName: `${newModelName.trim()} Formula`,
    isActive: true,
    isDefault: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return cleanModelId;
}

export async function createRankingModel({
  name,
  provider,
  weights,
}: {
  name: string;
  provider: string;
  weights: Record<string, number>;
}) {
  const modelId = slugifyModelId(name);
  const formulaId = `${modelId}_formula`;

  await setDoc(doc(db, "RankingFormulas", formulaId), {
    name: `${name.trim()} Formula`,
    provider,
    formulaText: "score = Σ(normalizedMetric * weight)",
    description: "",
    weights,
    isDefault: false,
    version: "1.0",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, "RankingModels", modelId), {
    name: name.trim(),
    provider,
    formulaId,
    formulaName: `${name.trim()} Formula`,
    isActive: true,
    isDefault: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return modelId;
}

function slugifyModelId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_")
    .replace(/[^a-z0-9_]/g, "");
}

export async function seedDefaultRankingModels() {
  await setDoc(
    doc(db, "RankingModels", "qs_default_v1"),
    {
      name: "QS Default Model",
      provider: "QS",

      formulaId: "qs_default_v1",
      formulaName: "QS Default Formula",

      isActive: true,
      isDefault: true,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await setDoc(
    doc(db, "RankingModels", "the_default_v1"),
    {
      name: "THE Default Model",
      provider: "THE",

      formulaId: "the_default_v1",
      formulaName: "THE Default Formula",

      isActive: true,
      isDefault: true,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updateRankingFormula({
  formulaId,
  formulaText,
  description,
  weights,
}: {
  formulaId: string;
  formulaText: string;
  description: string;
  weights: Record<string, number>;
}) {
  const formulaRef = doc(db, "RankingFormulas", formulaId);

  await updateDoc(formulaRef, {
    formulaText,
    description,
    weights,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRankingModel({
  modelId,
  formulaId,
  isDefault,
}: {
  modelId: string;
  formulaId?: string;
  isDefault?: boolean;
}) {
  if (isDefault === true) {
    throw new Error("Default models cannot be deleted.");
  }

  const batch = writeBatch(db);

  batch.delete(doc(db, "RankingModels", modelId));

  if (formulaId) {
    batch.delete(doc(db, "RankingFormulas", formulaId));
  }

  await batch.commit();
}

function getDefaultScenarioConfig(provider: string, year: number) {
  const cleanProvider = provider.trim().toUpperCase();

  if (cleanProvider === "QS") {
    return {
      scenarioId: `qs_${year}_default`,
      name: `QS World University Rankings ${year}`,
      provider: "QS",
      year,
      modelId: "qs_default_v1",
      modelName: "QS Default Model",
      formulaId: "qs_default_v1",
      formulaName: "QS Default Formula",
      resultSetId: `qs_${year}_default_results`,
    };
  }

  if (cleanProvider === "THE") {
    return {
      scenarioId: `the_${year}_default`,
      name: `THE World University Rankings ${year}`,
      provider: "THE",
      year,
      modelId: "the_default_v1",
      modelName: "THE Default Model",
      formulaId: "the_default_v1",
      formulaName: "THE Default Formula",
      resultSetId: `the_${year}_default_results`,
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export async function seedDefaultRankingScenarios() {
  const defaultScenarios = [
    getDefaultScenarioConfig("QS", 2024),
    getDefaultScenarioConfig("QS", 2025),
    getDefaultScenarioConfig("QS", 2026),

    getDefaultScenarioConfig("THE", 2024),
    getDefaultScenarioConfig("THE", 2025),
    getDefaultScenarioConfig("THE", 2026),
  ];

  const batch = writeBatch(db);

  defaultScenarios.forEach((scenario, index) => {
    const scenarioRef = doc(db, "RankingScenarios", scenario.scenarioId);

    batch.set(
      scenarioRef,
      {
        name: scenario.name,
        provider: scenario.provider,
        year: scenario.year,

        modelId: scenario.modelId,
        modelName: scenario.modelName,

        formulaId: scenario.formulaId,
        formulaName: scenario.formulaName,

        resultSetId: scenario.resultSetId,

        isActive: true,
        isGlobalDefault: true,
        isDefault: true,
        isAppDefault: false,

        sortOrder: index + 1,

        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  await batch.commit();
}

export async function createScenarioResultsFromDefault({
  provider,
  year,
  formulaId,
  targetResultSetId,
}: {
  provider: string;
  year: number;
  formulaId: string;
  targetResultSetId: string;
}) {
  const defaultResultSetId = getDefaultResultSetId(provider, year);

  const formula = await getRankingFormula(formulaId);

  if (!formula || !formula.weights) {
    throw new Error("Formula not found or missing weights.");
  }

  const sourceRowsRef = collection(
    db,
    "RankingResults",
    defaultResultSetId,
    "Rows",
  );

  const sourceSnapshot = await getDocs(sourceRowsRef);

  if (sourceSnapshot.empty) {
    throw new Error(`Default result set ${defaultResultSetId} has no rows.`);
  }

  const calculatedRows = sourceSnapshot.docs
    .map((docSnap) => {
      const sourceRow = {
        id: docSnap.id,
        ...docSnap.data(),
      } as RankingRow;

      const nextScore = calculateScenarioScore({
        row: sourceRow,
        weights: formula.weights || {},
        fallbackScore:
          typeof sourceRow.score === "number" ? sourceRow.score : 0,
      });

      return {
        id: docSnap.id,
        data: {
          ...sourceRow,

          provider: provider.trim().toUpperCase(),
          year,

          score: nextScore,
          originalScore:
            typeof sourceRow.score === "number" ? sourceRow.score : null,

          sourceResultSetId: defaultResultSetId,
          formulaId,

          updatedAt: serverTimestamp(),
        },
      };
    })
    .sort((a, b) => {
      const scoreA =
        typeof a.data.score === "number" ? a.data.score : -Infinity;
      const scoreB =
        typeof b.data.score === "number" ? b.data.score : -Infinity;

      return scoreB - scoreA;
    })
    .map((row, index) => ({
      ...row,
      data: {
        ...row.data,
        rank: index + 1,
      },
    }));

  const targetResultSetRef = doc(db, "RankingResults", targetResultSetId);

  await setDoc(
    targetResultSetRef,
    {
      provider: provider.trim().toUpperCase(),
      year,
      formulaId,
      sourceResultSetId: defaultResultSetId,
      isGenerated: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const writes = calculatedRows.map((row) => ({
    ref: doc(db, "RankingResults", targetResultSetId, "Rows", row.id),
    data: row.data,
  }));

  await commitBatches(writes);
}

export async function deleteRankingScenario({
  scenarioId,
  resultSetId,
  isDefault,
  isGlobalDefault,
  isAppDefault,
}: {
  scenarioId: string;
  resultSetId?: string;
  isDefault?: boolean;
  isGlobalDefault?: boolean;
  isAppDefault?: boolean;
}) {
  if (isDefault === true || isGlobalDefault === true || isAppDefault === true) {
    throw new Error("Default scenarios cannot be deleted.");
  }

  if (resultSetId) {
    const rowsRef = collection(db, "RankingResults", resultSetId, "Rows");
    const rowsSnapshot = await getDocs(rowsRef);

    const rowDocs = rowsSnapshot.docs;

    for (let i = 0; i < rowDocs.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = rowDocs.slice(i, i + 450);

      chunk.forEach((rowDoc) => {
        batch.delete(rowDoc.ref);
      });

      await batch.commit();
    }

    await deleteDoc(doc(db, "RankingResults", resultSetId));
  }

  await deleteDoc(doc(db, "RankingScenarios", scenarioId));
}

export async function updateRankingModelAndFormulaNames({
  modelId,
  formulaId,
  modelName,
  formulaName,
}: {
  modelId: string;
  formulaId: string;
  modelName: string;
  formulaName: string;
}) {
  const cleanModelName = modelName.trim();
  const cleanFormulaName = formulaName.trim();

  if (!cleanModelName) {
    throw new Error("Model name is required.");
  }

  if (!cleanFormulaName) {
    throw new Error("Formula name is required.");
  }

  if (cleanModelName.length > 30) {
    throw new Error("Model name cannot exceed 30 characters.");
  }

  if (cleanFormulaName.length > 30) {
    throw new Error("Formula name cannot exceed 30 characters.");
  }

  const batch = writeBatch(db);

  batch.update(doc(db, "RankingModels", modelId), {
    name: cleanModelName,
    formulaName: cleanFormulaName,
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, "RankingFormulas", formulaId), {
    name: cleanFormulaName,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}