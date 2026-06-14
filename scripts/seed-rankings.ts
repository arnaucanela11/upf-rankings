import admin from "firebase-admin";
import xlsx from "xlsx";
import path from "path";
import fs from "fs";

const serviceAccountPath = path.join(
  process.cwd(),
  "scripts",
  "serviceAccountKey.json"
);

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error("Missing scripts/serviceAccountKey.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
});

const db = admin.firestore();

type Provider = "QS" | "THE";

interface ImportConfig {
  provider: Provider;
  year: number;
  filePath: string;
}

const configs: ImportConfig[] = [
  {
    provider: "QS",
    year: 2025,
    filePath: "data/rankings/qs-2025.xlsx",
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") return value;

  const cleaned = String(value)
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function getScenarioId(provider: Provider, year: number) {
  return `${provider.toLowerCase()}_${year}_default`;
}

function getResultSetId(provider: Provider, year: number) {
  return `${provider.toLowerCase()}_${year}_default_results`;
}

function getFormulaId(provider: Provider) {
  return provider === "QS" ? "qs_default_v1" : "the_default_v1";
}

function getFormulaName(provider: Provider) {
  return provider === "QS" ? "QS Default Formula" : "THE Default Formula";
}

function getModelName(provider: Provider) {
  return provider === "QS" ? "QS Default Model" : "THE Default Model";
}

function readExcelRows(filePath: string) {
  const absolutePath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const workbook = xlsx.readFile(absolutePath);
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  return xlsx.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: null,
  });
}

async function seedFormulas() {
  const batch = db.batch();

  batch.set(
    db.collection("RankingFormulas").doc("qs_default_v1"),
    {
      name: "QS Default Formula",
      provider: "QS",
      version: "1.0",
      description: "Default formula used for QS ranking scenarios.",
      formulaText: "score = Σ(normalizedMetric * weight)",
      weights: {
        academicReputation: 0.3,
        employerReputation: 0.15,
        facultyStudentRatio: 0.1,
        citationsPerFaculty: 0.2,
        internationalFacultyRatio: 0.05,
        internationalStudentRatio: 0.05,
        internationalResearchNetwork: 0.05,
        employmentOutcomes: 0.05,
        sustainability: 0.05,
      },
      isDefault: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    db.collection("RankingFormulas").doc("the_default_v1"),
    {
      name: "THE Default Formula",
      provider: "THE",
      version: "1.0",
      description: "Default formula used for THE ranking scenarios.",
      formulaText: "score = Σ(indicatorScore * indicatorWeight)",
      weights: {
        teaching: 0.295,
        researchEnvironment: 0.29,
        researchQuality: 0.3,
        internationalOutlook: 0.075,
        industry: 0.04,
      },
      isDefault: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
}

async function seedScenarioAndParameters(provider: Provider, year: number) {
  const scenarioId = getScenarioId(provider, year);
  const resultSetId = getResultSetId(provider, year);
  const formulaId = getFormulaId(provider);

  const scenarioRef = db.collection("RankingScenarios").doc(scenarioId);
  const parametersRef = db.collection("RankingParameters").doc(scenarioId);

  const batch = db.batch();

  batch.set(
    scenarioRef,
    {
      name:
        provider === "QS"
          ? `QS World University Rankings ${year}`
          : `THE World University Rankings ${year}`,

      provider,
      year,

      modelId: formulaId,
      modelName: getModelName(provider),

      formulaId,
      formulaName: getFormulaName(provider),

      resultSetId,

      isGlobalDefault: true,
      isActive: true,
      isAppDefault: provider === "QS" && year === 2025,

      sortOrder:
        provider === "QS"
          ? 2025 - year + 1
          : 100 + (2025 - year + 1),

      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    parametersRef,
    {
      scenarioId,
      provider,
      year,
      normalizationMethod: "provider_original",
      missingDataPolicy: "provider_original",
      outlierTreatment: "provider_original",
      source: provider,
      isEditable: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();

  return { scenarioId, resultSetId };
}

function normalizeQsRow(row: Record<string, any>, year: number) {
  const institutionName = row.institutionName;

  if (!institutionName) return null;

  const country = row.country || null;
  const locationCode = row.locationCode || null;

  const universityId = slugify(
    `${institutionName}_${locationCode || country || ""}`
  );

  return {
    universityId,
    universityName: institutionName,

    country,
    locationCode,

    provider: "QS",
    year,

    rank: toNumber(row.rank),
    previousRank: toNumber(row.previousRank),

    size: row.size || null,
    focus: row.focus || null,
    research: row.research || null,
    status: row.status || null,

    score: toNumber(row.overallScore),

    metrics: {
      academicReputationScore: toNumber(row.academicReputationScore),
      academicReputationRank: toNumber(row.academicReputationRank),

      employerReputationScore: toNumber(row.employerReputationScore),
      employerReputationRank: toNumber(row.employerReputationRank),

      facultyStudentScore: toNumber(row.facultyStudentScore),
      facultyStudentRank: toNumber(row.facultyStudentRank),

      citationsPerFacultyScore: toNumber(row.citationsPerFacultyScore),
      citationsPerFacultyRank: toNumber(row.citationsPerFacultyRank),

      internationalFacultyScore: toNumber(row.internationalFacultyScore),
      internationalFacultyRank: toNumber(row.internationalFacultyRank),

      internationalStudentsScore: toNumber(row.internationalStudentsScore),
      internationalStudentsRank: toNumber(row.internationalStudentsRank),

      internationalResearchNetworkScore: toNumber(
        row.internationalResearchNetworkScore
      ),
      internationalResearchNetworkRank: toNumber(
        row.internationalResearchNetworkRank
      ),

      employmentOutcomesScore: toNumber(row.employmentOutcomesScore),
      employmentOutcomesRank: toNumber(row.employmentOutcomesRank),

      sustainabilityScore: toNumber(row.sustainabilityScore),
      sustainabilityRank: toNumber(row.sustainabilityRank),
    },

    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function normalizeTheRow(row: Record<string, any>, year: number) {
  const institutionName =
    row.institutionName ||
    row["Institution Name"] ||
    row["Name"] ||
    row["institution"];

  if (!institutionName) return null;

  const country = row.country || row["Country"] || row["Location"];

  const universityId = slugify(`${institutionName}_${country || ""}`);

  return {
    universityId,
    universityName: institutionName,
    country: country || null,

    provider: "THE",
    year,

    rank: toNumber(row.rank || row["Rank"]) || null,
    previousRank: toNumber(row.previousRank || row["Previous Rank"]) || null,
    score: toNumber(row.overallScore || row["Overall"] || row["Overall Score"]),

    metrics: {
      teachingScore: toNumber(row.teachingScore || row["Teaching"]),
      researchEnvironmentScore: toNumber(
        row.researchEnvironmentScore || row["Research Environment"]
      ),
      researchQualityScore: toNumber(
        row.researchQualityScore || row["Research Quality"]
      ),
      internationalOutlookScore: toNumber(
        row.internationalOutlookScore || row["International Outlook"]
      ),
      industryScore: toNumber(row.industryScore || row["Industry"]),
    },

    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function importRankingRows(config: ImportConfig) {
  const { provider, year, filePath } = config;

  const { resultSetId } = await seedScenarioAndParameters(provider, year);

  const rawRows = readExcelRows(filePath);

  const normalizedRows = rawRows
    .map((row) =>
      provider === "QS" ? normalizeQsRow(row, year) : normalizeTheRow(row, year)
    )
    .filter(Boolean) as any[];

  console.log(
    `Importing ${normalizedRows.length} rows for ${provider} ${year}...`
  );

  let batch = db.batch();
  let operationCount = 0;
  let committedCount = 0;

  for (const row of normalizedRows) {
    if (!row.universityId) continue;

    const rowRef = db
      .collection("RankingResults")
      .doc(resultSetId)
      .collection("Rows")
      .doc(row.universityId);

    batch.set(rowRef, row, { merge: true });
    operationCount++;

    // Conservative chunk size for reliable bulk imports.
    if (operationCount >= 400) {
      await batch.commit();
      committedCount += operationCount;

      batch = db.batch();
      operationCount = 0;

      console.log(`Committed ${committedCount} rows...`);
    }
  }

  if (operationCount > 0) {
    await batch.commit();
    committedCount += operationCount;
  }

  console.log(`Done: ${provider} ${year}. Total rows: ${committedCount}`);
}

async function main() {
  await seedFormulas();

  for (const config of configs) {
    await importRankingRows(config);
  }

  console.log("All rankings imported successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});