(() => {
  const cfg = window.MATCHPOINT_CONFIG || {};
  const API = (cfg.apiBaseUrl || "").replace(/\/+$/, "");
  const $ = (id) => document.getElementById(id);
  const state = { matches: [], current: null, editPin: "", poller: null };
  $("year").textContent = new Date().getFullYear();

  function apiReady() { return API && !API.includes("PASTE_YOUR"); }
  async function request(path, options = {}) {
    if (!apiReady()) throw new Error("The online database is not connected yet. Follow SETUP.md to configure Firebase.");
    const response = await fetch(API + path, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }
  function notice(message) { $("notice").textContent = message; $("notice").classList.remove("hidden"); }
  function clearNotice() { $("notice").classList.add("hidden"); }
  function esc(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function safeDate(value) { try { return new Date(value).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); } catch { return ""; } }
  function activeGame(match) { return match.games[Math.max(0, match.games.length - 1)] || {a:0,b:0}; }
  function winnerOf(match) { return match.winner || ""; }

  async function loadMatches() {
    try {
      const data = await request("/matches");
      state.matches = data.matches || [];
      renderMatches();
      clearNotice();
    } catch (e) {
      $("matches").innerHTML = `<div class="empty-card"><div class="empty-icon">🏸</div><h3>Connect your match centre</h3><p>${esc(e.message)}</p></div>`;
    }
  }
  function renderMatches() {
    if (!state.matches.length) {
      $("matches").innerHTML = `<div class="empty-card"><div class="empty-icon">🏸</div><h3>Your first match starts here</h3><p>Create a match to start keeping score. Your matches will appear here and remain saved online.</p><button class="primary-btn" id="empty-create">＋ Create a match</button></div>`;
      $("empty-create").addEventListener("click", () => $("create-dialog").showModal());
      return;
    }
    $("matches").innerHTML = state.matches.map(m => {
      const g = activeGame(m), done = !!m.winner;
      return `<article class="match-card">
        <div class="card-top"><span class="badge ${done?'done':''}">${done?'MATCH COMPLETE':'IN PROGRESS'}</span><span class="card-meta">${esc(m.points)} PTS · BEST OF ${esc(m.bestOf)}</span></div>
        <div class="card-teams">
          <div class="card-team"><strong>${esc(m.nameA)}</strong><small>${m.gameWins?.a||0} game wins</small><div class="card-score">${g.a}</div></div>
          <span class="versus">VS</span>
          <div class="card-team"><strong>${esc(m.nameB)}</strong><small>${m.gameWins?.b||0} game wins</small><div class="card-score">${g.b}</div></div>
        </div>
        <div class="card-bottom"><span>${esc(safeDate(m.createdAt))}</span><button class="open-match" data-open="${esc(m.id)}">Open scoreboard ↗</button></div>
      </article>`;
    }).join("");
    document.querySelectorAll("[data-open]").forEach(btn => btn.addEventListener("click", () => openMatch(btn.dataset.open)));
  }
  $("open-create").addEventListener("click", () => $("create-dialog").showModal());
  $("refresh-btn").addEventListener("click", loadMatches);
  $("match-type").addEventListener("change", () => {
    const doubles = $("match-type").value === "doubles";
    $("label-a").firstChild.textContent = doubles ? "Team A names" : "Player A name";
    $("label-b").firstChild.textContent = doubles ? "Team B names" : "Player B name";
    $("name-a").placeholder = doubles ? "e.g. Nihar / Arjun" : "e.g. Nihar";
    $("name-b").placeholder = doubles ? "e.g. Kiran / Rahul" : "e.g. Arjun";
  });
  document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => $(btn.dataset.close).close()));

  $("create-form").addEventListener("submit", async e => {
    e.preventDefault(); $("create-error").textContent = "";
    const pin = $("create-pin").value.trim();
    if (!/^\d{4,12}$/.test(pin)) { $("create-error").textContent = "Use a PIN containing 4–12 digits."; return; }
    const body = {
      type: $("match-type").value, nameA: $("name-a").value.trim(), nameB: $("name-b").value.trim(),
      points: Number($("points").value), bestOf: Number($("best-of").value), pin
    };
    if (!body.nameA || !body.nameB) { $("create-error").textContent = "Enter both player or team names."; return; }
    try {
      const data = await request("/matches", {method:"POST", body});
      $("create-dialog").close(); $("create-form").reset(); $("points").value = 21; $("best-of").value = "3";
      notice("Match created. Remember the PIN you chose — it cannot be recovered.");
      await loadMatches(); await openMatch(data.id);
    } catch (err) { $("create-error").textContent = err.message; }
  });

  async function openMatch(id) {
    try {
      const data = await request("/matches/" + encodeURIComponent(id));
      state.current = data.match; state.editPin = "";
      renderCurrent();
      $("match-dialog").showModal();
      if (state.poller) clearInterval(state.poller);
      state.poller = setInterval(async () => {
        if (!$("match-dialog").open || !state.current) return;
        try {
          const latest = await request("/matches/" + encodeURIComponent(id));
          state.current = latest.match; renderCurrent();
        } catch (_) {}
      }, 4000);
    } catch (e) { notice(e.message); }
  }
  $("match-dialog").addEventListener("close", () => { if (state.poller) clearInterval(state.poller); state.poller = null; state.current = null; });
  function renderCurrent() {
    const m = state.current; if (!m) return;
    const g = activeGame(m), gameNo = m.games.length;
    $("match-kicker").textContent = `${m.type.toUpperCase()} · ${m.points} POINTS · BEST OF ${m.bestOf}`;
    $("match-title").textContent = `${m.nameA} vs ${m.nameB}`;
    $("score-name-a").textContent = m.nameA; $("score-name-b").textContent = m.nameB;
    $("score-a").textContent = g.a; $("score-b").textContent = g.b;
    $("game-label").textContent = `GAME ${gameNo}`;
    $("match-status").textContent = m.winner ? "MATCH COMPLETE" : (state.editPin ? "EDITING UNLOCKED" : "IN PROGRESS");
    $("winner-banner").classList.toggle("hidden", !m.winner);
    if (m.winner) $("winner-banner").textContent = `🏆 ${m.winner} wins the match!`;
    $("game-history").innerHTML = m.games.map((x,i)=>`<span class="game-chip">Game ${i+1}<b>${x.a} – ${x.b}</b></span>`).join("");
    document.querySelectorAll("[data-score]").forEach(btn => btn.disabled = !state.editPin || !!m.winner);
    $("next-game-btn").disabled = !state.editPin || !!m.winner || !isGameWon(g, m.points) || m.games.length >= m.bestOf;
    $("edit-score-btn").textContent = state.editPin ? "✓ Editing unlocked" : "🔐 Edit score";
  }
  function isGameWon(g, points) { return (g.a >= points || g.b >= points) && Math.abs(g.a-g.b) >= 2; }

  $("edit-score-btn").addEventListener("click", () => {
    if (state.editPin) { state.editPin = ""; renderCurrent(); return; }
    $("pin-error").textContent = ""; $("edit-pin").value = ""; $("pin-dialog").showModal();
  });
  $("pin-form").addEventListener("submit", async e => {
    e.preventDefault(); $("pin-error").textContent = "";
    const pin = $("edit-pin").value.trim();
    try {
      await request(`/matches/${encodeURIComponent(state.current.id)}/verify`, {method:"POST", body:{pin}});
      state.editPin = pin; $("pin-dialog").close(); renderCurrent();
    } catch (err) { $("pin-error").textContent = err.message; }
  });
  document.querySelectorAll("[data-score]").forEach(btn => btn.addEventListener("click", async () => {
    if (!state.current || !state.editPin) return;
    const g = activeGame(state.current), side = btn.dataset.score, delta = Number(btn.dataset.delta);
    const newScore = Math.max(0, g[side] + delta);
    const games = state.current.games.map(x=>({...x})); games[games.length-1][side] = newScore;
    await saveScore(games);
  }));
  $("next-game-btn").addEventListener("click", async () => {
    if (!state.current || !state.editPin) return;
    const games = state.current.games.map(x=>({...x})); games.push({a:0,b:0});
    await saveScore(games);
  });
  async function saveScore(games) {
    $("match-error").textContent = "";
    try {
      const data = await request(`/matches/${encodeURIComponent(state.current.id)}/score`, {method:"POST", body:{pin:state.editPin, games}});
      state.current = data.match; renderCurrent(); await loadMatches();
    } catch (e) { $("match-error").textContent = e.message; }
  }
  loadMatches();
  setInterval(loadMatches, 15000);
})();
