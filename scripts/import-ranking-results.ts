import admin from "firebase-admin";
import xlsx from "xlsx";
import path from "path";
import fs from "fs";

const serviceAccountPath = path.join(process.cwd(), "scripts/serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error("Missing serviceAccountKey.json in project root.");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
});

const db = admin.firestore();

type ImportConfig = {
  filePath: string;
  provider: "QS";
  year: number;
  resultSetId: string;
};

const imports: ImportConfig[] = [
  {
    filePath: "data/rankings/qs-2024.xlsx",
    provider: "QS",
    year: 2024,
    resultSetId: "qs_2024_default_results",
  },
  {
    filePath: "data/rankings/qs-2025.xlsx",
    provider: "QS",
    year: 2025,
    resultSetId: "qs_2025_default_results",
  },
  {
    filePath: "data/rankings/qs-2026.xlsx",
    provider: "QS",
    year: 2026,
    resultSetId: "qs_2026_default_results",
  },
];

function getValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  return null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const cleaned = String(value)
    .trim()
    .replace("%", "")
    .replace(",", ".")
    .replace("=", "")
    .replace("+", "");

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getUniversityId(row: Record<string, unknown>) {
  const existingId = getValue(row, ["universityId", "University ID", "id"]);

  if (existingId) {
    return slugify(String(existingId));
  }

  const institutionName = toStringValue(
    getValue(row, ["institutionName", "Institution Name", "institution name"]),
  );

  const locationCode = toStringValue(
    getValue(row, ["locationCode", "location code", "Location Code"]),
  );

  if (!institutionName) {
    throw new Error("Missing institutionName in row.");
  }

  const suffix = locationCode ? `_${locationCode.toLowerCase()}` : "";

  return `${slugify(institutionName)}${suffix}`;
}

function mapQsRow(row: Record<string, unknown>, year: number) {
  const universityName = toStringValue(
    getValue(row, ["institutionName", "Institution Name", "institution name"]),
  );

  const universityId = getUniversityId(row);

  return {
    universityId,
    universityName,

    provider: "QS",
    year,

    rank: toNumber(getValue(row, ["rank", "Rank"])),
    previousRank: toNumber(
      getValue(row, ["previousRank", "previous rank", "Previous Rank"]),
    ),

    locationCode: toStringValue(
      getValue(row, ["locationCode", "location code", "Location Code"]),
    ),
    country: toStringValue(getValue(row, ["country", "Country"])),
    size: toStringValue(getValue(row, ["size", "Size"])),
    focus: toStringValue(getValue(row, ["focus", "Focus"])),
    research: toStringValue(getValue(row, ["research", "Research"])),
    status: toStringValue(getValue(row, ["status", "Status"])),

    score: toNumber(
      getValue(row, ["Overall Score", "overallScore", "overall score"]),
    ),

    metrics: {
      academicReputationScore: toNumber(getValue(row, ["ar score", "arScore"])),
      academicReputationRank: toNumber(getValue(row, ["ar rank", "arRank"])),

      employerReputationScore: toNumber(getValue(row, ["er score", "erScore"])),
      employerReputationRank: toNumber(getValue(row, ["er rank", "erRank"])),

      facultyStudentScore: toNumber(getValue(row, ["fsr score", "fsrScore"])),
      facultyStudentRank: toNumber(getValue(row, ["fsr rank", "fsrRank"])),

      citationsPerFacultyScore: toNumber(getValue(row, ["cpf score", "cpfScore"])),
      citationsPerFacultyRank: toNumber(getValue(row, ["cpf rank", "cpfRank"])),

      internationalFacultyScore: toNumber(getValue(row, ["ifr score", "ifrScore"])),
      internationalFacultyRank: toNumber(getValue(row, ["ifr rank", "ifrRank"])),

      internationalStudentsScore: toNumber(getValue(row, ["isr score", "isrScore"])),
      internationalStudentsRank: toNumber(getValue(row, ["isr rank", "isrRank"])),

      internationalResearchNetworkScore: toNumber(
        getValue(row, ["irn score", "irnScore"]),
      ),
      internationalResearchNetworkRank: toNumber(
        getValue(row, ["irn rank", "irnRank"]),
      ),

      employmentOutcomesScore: toNumber(getValue(row, ["ger score", "gerScore"])),
      employmentOutcomesRank: toNumber(getValue(row, ["ger rank", "gerRank"])),

      sustainabilityScore: toNumber(
        getValue(row, ["SUS SCORE", "sus score", "sustainabilityScore"]),
      ),
      sustainabilityRank: toNumber(
        getValue(row, ["SUS RANK", "sus rank", "sustainabilityRank"]),
      ),
    },

    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function commitInChunks(
  writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: unknown }>,
) {
  const chunkSize = 450;

  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = writes.slice(i, i + chunkSize);

    chunk.forEach(({ ref, data }) => {
      batch.set(ref, data as FirebaseFirestore.DocumentData, { merge: true });
    });

    await batch.commit();

    console.log(`Committed ${Math.min(i + chunk.length, writes.length)}/${writes.length}`);
  }
}

async function importRankingFile(config: ImportConfig) {
  const absolutePath = path.join(process.cwd(), config.filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const workbook = xlsx.readFile(absolutePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  console.log(`Importing ${rows.length} rows from ${config.filePath}`);

  const resultSetRef = db.collection("RankingResults").doc(config.resultSetId);

  await resultSetRef.set(
    {
      provider: config.provider,
      year: config.year,
      resultSetId: config.resultSetId,
      importedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const writes = rows
    .filter((row) => getValue(row, ["institutionName", "Institution Name", "institution name"]))
    .map((row) => {
      const mappedRow = mapQsRow(row, config.year);

      return {
        ref: resultSetRef.collection("Rows").doc(mappedRow.universityId),
        data: mappedRow,
      };
    });

  await commitInChunks(writes);

  console.log(`Finished ${config.resultSetId}`);
}

async function main() {
  for (const config of imports) {
    await importRankingFile(config);
  }

  console.log("Import completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});