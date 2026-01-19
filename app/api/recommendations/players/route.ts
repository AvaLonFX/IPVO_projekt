import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function normalizePos(pos: any): string {
  return String(pos ?? "").toUpperCase();
}

function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// bucket: low / mid / high na temelju mean/std
function statBin(value: number | null, mean: number, std: number) {
  if (value === null) return "mid"; // ako fali, tretiraj kao sredina
  const hi = mean + 0.5 * std;
  const lo = mean - 0.5 * std;
  if (value >= hi) return "high";
  if (value <= lo) return "low";
  return "mid";
}

function decadeBucket(fromYear: any, toYear: any): string | null {
  const fy = toNum(fromYear);
  const ty = toNum(toYear);
  if (fy === null || ty === null) return null;
  const mid = (fy + ty) / 2;
  const dec = Math.floor(mid / 10) * 10;
  return `${dec}s`; // npr "1990s"
}

export async function GET() {
  const supabase = await createClient();

  // 1) Auth
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2) Interakcije korisnika
  const { data: interactions, error: iErr } = await supabase
    .from("user_interactions")
    .select("item_id, weight, created_at")
    .eq("user_id", auth.user.id)
    .eq("item_type", "player")
    .order("created_at", { ascending: false })
    .limit(300);

  if (iErr) {
    return NextResponse.json({ error: "Failed to load interactions", details: iErr.message }, { status: 500 });
  }
  if (!interactions || interactions.length === 0) {
    return NextResponse.json({ recommendations: [], reason: "no_interactions" });
  }

  // 3) Igrači (dodajemo PTS/REB/AST + era)
  const { data: players, error: pErr } = await supabase
    .from("Osnovno_NBA")
    .select(
      "PERSON_ID, PLAYER_FIRST_NAME, PLAYER_LAST_NAME, POSITION, TEAM_ID, PTS, REB, AST, FROM_YEAR, TO_YEAR"
    );

  if (pErr) {
    return NextResponse.json({ error: "Failed to load players", details: pErr.message }, { status: 500 });
  }
  if (!players || players.length === 0) {
    return NextResponse.json({ recommendations: [], reason: "no_players" });
  }

  // 4) Feature space
  const POS_TOKENS = ["G", "F", "C"];

  // Teams (one-hot)
  const teams: (string | number)[] = [];
  const teamSet: Record<string, boolean> = {};
  for (const p of players as any[]) {
    const t = p.TEAM_ID;
    if (t === null || t === undefined) continue;
    const key = String(t);
    if (!teamSet[key]) {
      teamSet[key] = true;
      teams.push(t);
    }
  }

  // Era buckets 
  const eras: string[] = [];
  const eraSet: Record<string, boolean> = {};
  for (const p of players as any[]) {
    const era = decadeBucket(p.FROM_YEAR, p.TO_YEAR);
    if (!era) continue;
    if (!eraSet[era]) {
      eraSet[era] = true;
      eras.push(era);
    }
  }
  eras.sort();

  // 5) Izračun mean/std za PTS/REB/AST 
  let ptsSum = 0, ptsSum2 = 0, ptsN = 0;
  let rebSum = 0, rebSum2 = 0, rebN = 0;
  let astSum = 0, astSum2 = 0, astN = 0;

  for (const p of players as any[]) {
    const pts = toNum(p.PTS);
    const reb = toNum(p.REB);
    const ast = toNum(p.AST);

    if (pts !== null) { ptsSum += pts; ptsSum2 += pts * pts; ptsN++; }
    if (reb !== null) { rebSum += reb; rebSum2 += reb * reb; rebN++; }
    if (ast !== null) { astSum += ast; astSum2 += ast * ast; astN++; }
  }

  const ptsMean = ptsN ? ptsSum / ptsN : 0;
  const rebMean = rebN ? rebSum / rebN : 0;
  const astMean = astN ? astSum / astN : 0;

  const ptsVar = ptsN ? Math.max(0, ptsSum2 / ptsN - ptsMean * ptsMean) : 0;
  const rebVar = rebN ? Math.max(0, rebSum2 / rebN - rebMean * rebMean) : 0;
  const astVar = astN ? Math.max(0, astSum2 / astN - astMean * astMean) : 0;

  const ptsStd = Math.sqrt(ptsVar) || 1;
  const rebStd = Math.sqrt(rebVar) || 1;
  const astStd = Math.sqrt(astVar) || 1;

  // 6) Vector builder
  // Stats -> one-hot: [low, mid, high] za svaki stat => 9 dimenzija
  function statsOneHot(p: any) {
    const pts = statBin(toNum(p.PTS), ptsMean, ptsStd);
    const reb = statBin(toNum(p.REB), rebMean, rebStd);
    const ast = statBin(toNum(p.AST), astMean, astStd);

    const v: number[] = [];

    // PTS
    v.push(pts === "low" ? 1 : 0, pts === "mid" ? 1 : 0, pts === "high" ? 1 : 0);
    // REB
    v.push(reb === "low" ? 1 : 0, reb === "mid" ? 1 : 0, reb === "high" ? 1 : 0);
    // AST
    v.push(ast === "low" ? 1 : 0, ast === "mid" ? 1 : 0, ast === "high" ? 1 : 0);

    return v;
  }

  function vec(p: any): number[] {
    const v: number[] = [];
    const pos = normalizePos(p.POSITION);

    // position multi-hot (G/F/C)
    for (const tok of POS_TOKENS) v.push(pos.includes(tok) ? 1 : 0);

    // team one-hot
    for (const t of teams) v.push(String(p.TEAM_ID) === String(t) ? 1 : 0);

    // era one-hot 
    const era = decadeBucket(p.FROM_YEAR, p.TO_YEAR);
    for (const e of eras) v.push(era === e ? 1 : 0);

    // stats buckets one-hot (PTS/REB/AST)
    v.push(...statsOneHot(p));

    return v;
  }

  // 7) Map players by id + user profile
  const playerById: Record<string, any> = {};
  for (const p of players as any[]) playerById[String(p.PERSON_ID)] = p;

  const dim = 3 + teams.length + eras.length + 9;
  const userVec = new Array(dim).fill(0);

  const seen: Record<string, boolean> = {};

  for (const it of interactions as any[]) {
    const id = String(it.item_id);
    seen[id] = true;

    const p = playerById[id];
    if (!p) continue;

    const w = Number(it.weight ?? 1);
    const pv = vec(p);

    for (let i = 0; i < dim; i++) userVec[i] += w * pv[i];
  }

  // 8) Score kandidata koje user nije vidio
  const scored = (players as any[])
    .filter((p: any) => !seen[String(p.PERSON_ID)])
    .map((p: any) => {
      const sim = cosine(userVec, vec(p));
      return {
        id: p.PERSON_ID,
        name: `${p.PLAYER_FIRST_NAME} ${p.PLAYER_LAST_NAME}`,
        team: p.TEAM_ID,
        similarity: Number(sim.toFixed(3)),
        // (opcionalno za debug) bins:
        ptsBin: statBin(toNum(p.PTS), ptsMean, ptsStd),
        rebBin: statBin(toNum(p.REB), rebMean, rebStd),
        astBin: statBin(toNum(p.AST), astMean, astStd),
        era: decadeBucket(p.FROM_YEAR, p.TO_YEAR),
      };
    })
    .sort((a: any, b: any) => b.similarity - a.similarity);

  const top = scored.slice(0, 6);

  return NextResponse.json({
    mode: "content-based-cosine-user-profile",
    recommendations: top,
    // ovo je korisno za opis u zadatku:
    usedFeatures: ["POSITION(G/F/C)", "TEAM_ID", "ERA(decade)", "PTS/REB/AST(buckets)"],
  });
}
