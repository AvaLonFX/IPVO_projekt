const base = process.env.QNBA_URL || "http://localhost:3001";
let cookie = "";
async function call(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { ...(options.headers || {}), ...(cookie ? { Cookie: cookie } : {}) } });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const data = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
const setup = (ids, tactic = "balanced") => ({ ids, minutes: ids.map(() => 48), tactic, secondHalfTactic: tactic });
const a = setup([101108, 200768, 2544, 201142, 201143]);
const b = setup([201144, 201566, 201145, 201567, 201572], "fast");
const created = await call("/api/match-challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creator: a, bestOf: 3, mode: "draft" }) });
await call(`/api/match-challenges/${created.code}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opponent: b }) });
let games = 0, status = "coaching";
while (status !== "completed" && games < 3) {
  await call(`/api/match-challenges/${created.code}/ready`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setup: a, role: "creator" }) });
  const played = await call(`/api/match-challenges/${created.code}/ready`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setup: b, role: "opponent" }) });
  if (played.status !== "playing_first_half" || !played.game) throw new Error("Shared first half did not start");
  const shared = await call(`/api/match-challenges?code=${created.code}`);
  if (JSON.stringify(shared.currentGame?.score) !== JSON.stringify(played.game.score)) throw new Error("Participants did not receive the same game");
  await call(`/api/match-challenges/${created.code}/halftime`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "creator" }) });
  const secondHalf = await call(`/api/match-challenges/${created.code}/halftime`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "opponent" }) });
  if (secondHalf.status !== "playing_second_half") throw new Error("Shared second half did not start");
  const finished = await call(`/api/match-challenges/${created.code}/finish`, { method: "POST" });
  games = finished.games?.length || games + 1; status = finished.status;
}
const lobby = await call(`/api/match-challenges?code=${created.code}`);
if (lobby.status !== "completed" || lobby.games.length < 2 || lobby.games.length > 3) throw new Error("Series did not complete correctly");
console.log(JSON.stringify({ code: created.code, status: lobby.status, score: lobby.wins, games: lobby.games.length, mode: lobby.mode }, null, 2));
