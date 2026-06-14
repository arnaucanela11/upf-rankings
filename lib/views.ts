import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export interface RankingView {
  id: string;
  name: string;
  ownerId: string;

  baseScenarioId: string;
  baseResultSetId: string;

  provider: string;
  year?: number | null;

  formulaId: string;

  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RankingOverride {
  id: string;
  universityId: string;
  changedFields: Record<string, number>;
  recalculatedScore: number;
  updatedAt?: unknown;
}

export async function getUserRankingViews({
  uid,
  scenarioId,
}: {
  uid: string;
  scenarioId: string;
}): Promise<RankingView[]> {
  const viewsRef = collection(db, "RankingViews");

  const q = query(
    viewsRef,
    where("ownerId", "==", uid),
    where("baseScenarioId", "==", scenarioId),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as RankingView[];
}

export async function createRankingView({
  uid,
  name,
  baseScenarioId,
  baseResultSetId,
  provider,
  year,
  formulaId,
}: {
  uid: string;
  name: string;
  baseScenarioId: string;
  baseResultSetId: string;
  provider: string;
  year?: number;
  formulaId: string;
}) {
  const viewsRef = collection(db, "RankingViews");

  const viewRef = await addDoc(viewsRef, {
    name,
    ownerId: uid,

    baseScenarioId,
    baseResultSetId,

    provider,
    year: year ?? null,

    formulaId,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return viewRef.id;
}

export async function getRankingViewOverrides(
  viewId: string,
): Promise<Record<string, RankingOverride>> {
  const overridesRef = collection(db, "RankingViews", viewId, "Overrides");

  const snapshot = await getDocs(overridesRef);

  const overrides: Record<string, RankingOverride> = {};

  snapshot.docs.forEach((docSnap) => {
    overrides[docSnap.id] = {
      id: docSnap.id,
      ...docSnap.data(),
    } as RankingOverride;
  });

  return overrides;
}

export async function saveRankingViewOverride({
  viewId,
  universityId,
  changedFields,
  recalculatedScore,
}: {
  viewId: string;
  universityId: string;
  changedFields: Record<string, number>;
  recalculatedScore: number;
}) {
  const overrideRef = doc(
    db,
    "RankingViews",
    viewId,
    "Overrides",
    universityId,
  );

  await setDoc(
    overrideRef,
    {
      universityId,
      changedFields,
      recalculatedScore,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteRankingView(viewId: string) {
  const viewRef = doc(db, "RankingViews", viewId);
  await deleteDoc(viewRef);
}

export async function updateRankingViewName({
  viewId,
  name,
}: {
  viewId: string;
  name: string;
}) {
  const viewRef = doc(db, "RankingViews", viewId);

  await updateDoc(viewRef, {
    name: name.trim(),
    updatedAt: serverTimestamp(),
  });
}