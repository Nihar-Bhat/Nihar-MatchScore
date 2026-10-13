(() => {
  const $ = id => document.getElementById(id);
  const STORAGE = "nihar-matchpoint-matches";

  let matches = JSON.parse(localStorage.getItem(STORAGE) || "[]");
  let current = null;
  let editPin = "";

  $("year").textContent = new Date().getFullYear();

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  function save() {
    localStorage.setItem(STORAGE, JSON.stringify(matches));
  }

  function notice(message) {
    $("notice").textContent = message;
    $("notice").classList.remove("hidden");
  }

  function activeGame(m) {
    return m.games[m.games.length - 1];
  }

  function gameWon(g, points) {
    return (g.a >= points || g.b >= points) &&
      Math.abs(g.a - g.b) >= 2;
  }

  function matchWinner(m) {
    const target = Math.ceil(m.bestOf / 2);
    if (m.gameWins.a >= target) return m.nameA;
    if (m.gameWins.b >= target) return m.nameB;
    return "";
  }

  function renderMatches() {
    if (!matches.length) {
      $("matches").innerHTML = `
        <div class="empty-card">
          <div class="empty-icon">🏸</div>
          <h3>Your first match starts here</h3>
          <p>Create a match to start keeping score.</p>
          <button class="primary-btn" id="empty-create">＋ Create a match</button>
        </div>`;
      $("empty-create").onclick = () => $("create-dialog").showModal();
      return;
    }

    $("matches").innerHTML = matches.map(m => {
      const g = activeGame(m);
      const winner = matchWinner(m);

      return `<article class="match-card">
        <div class="card-top">
          <span class="badge ${winner ? "done" : ""}">
            ${winner ? "MATCH COMPLETE" : "IN PROGRESS"}
          </span>
          <span class="card-meta">${m.points} PTS · BEST OF ${m.bestOf}</span>
        </div>
        <div class="card-teams">
          <div class="card-team">
            <strong>${esc(m.nameA)}</strong>
            <small>${m.gameWins.a} game wins</small>
            <div class="card-score">${g.a}</div>
          </div>
          <span class="versus">VS</span>
          <div class="card-team">
            <strong>${esc(m.nameB)}</strong>
            <small>${m.gameWins.b} game wins</small>
            <div class="card-score">${g.b}</div>
          </div>
        </div>
        <div class="card-bottom">
          <span>${new Date(m.createdAt).toLocaleString()}</span>
          <button class="open-match" data-open="${m.id}">Open scoreboard ↗</button>
        </div>
      </article>`;
    }).join("");

    document.querySelectorAll("[data-open]").forEach(b => {
      b.onclick = () => openMatch(b.dataset.open);
    });
  }

  function openMatch(id) {
    current = matches.find(m => m.id === id);
    if (!current) return;
    editPin = "";
    renderCurrent();
    $("match-dialog").showModal();
  }

  function renderCurrent() {
    if (!current) return;

    const m = current;
    const g = activeGame(m);
    const winner = matchWinner(m);

    $("match-kicker").textContent =
      `${m.type.toUpperCase()} · ${m.points} POINTS · BEST OF ${m.bestOf}`;
    $("match-title").textContent = `${m.nameA} vs ${m.nameB}`;
    $("score-name-a").textContent = m.nameA;
    $("score-name-b").textContent = m.nameB;
    $("score-a").textContent = g.a;
    $("score-b").textContent = g.b;
    $("game-label").textContent = `GAME ${m.games.length}`;
    $("match-status").textContent = winner ? "MATCH COMPLETE" :
      editPin ? "EDITING UNLOCKED" : "IN PROGRESS";

    $("winner-banner").classList.toggle("hidden", !winner);
    if (winner) $("winner-banner").textContent = `🏆 ${winner} wins the match!`;

    $("game-history").innerHTML = m.games.map((x, i) =>
      `<span class="game-chip">Game ${i + 1}<b>${x.a} – ${x.b}</b></span>`
    ).join("");

    document.querySelectorAll("[data-score]").forEach(b => {
      b.disabled = !editPin || !!winner;
    });

    $("next-game-btn").disabled = !editPin || !!winner ||
      !gameWon(g, m.points) || m.games.length >= m.bestOf;

    $("edit-score-btn").textContent =
      editPin ? "✓ Editing unlocked" : "🔐 Edit score";
  }

  $("open-create").onclick = () => $("create-dialog").showModal();
  $("refresh-btn").onclick = renderMatches;

  $("match-type").onchange = () => {
    const doubles = $("match-type").value === "doubles";
    $("label-a").firstChild.textContent = doubles ? "Team A names" : "Player A name";
    $("label-b").firstChild.textContent = doubles ? "Team B names" : "Player B name";
    $("name-a").placeholder = doubles ? "e.g. Nihar / Arjun" : "e.g. Nihar";
    $("name-b").placeholder = doubles ? "e.g. Kiran / Rahul" : "e.g. Arjun";
  };

  document.querySelectorAll("[data-close]").forEach(b => {
    b.onclick = () => $(b.dataset.close).close();
  });

  $("create-form").onsubmit = e => {
    e.preventDefault();
    $("create-error").textContent = "";

    const pin = $("create-pin").value.trim();
    if (!/^\d{4,12}$/.test(pin)) {
      $("create-error").textContent = "Use a PIN containing 4–12 digits.";
      return;
    }

    const m = {
      id: crypto.randomUUID(),
      type: $("match-type").value,
      nameA: $("name-a").value.trim(),
      nameB: $("name-b").value.trim(),
      points: Number($("points").value),
      bestOf: Number($("best-of").value),
      pin,
      games: [{a: 0, b: 0}],
      gameWins: {a: 0, b: 0},
      createdAt: new Date().toISOString()
    };

    if (!m.nameA || !m.nameB) {
      $("create-error").textContent = "Enter both player or team names.";
      return;
    }

    matches.unshift(m);
    save();
    $("create-dialog").close();
    $("create-form").reset();
    $("points").value = 21;
    $("best-of").value = "3";
    renderMatches();
    openMatch(m.id);
    notice("Match created on this device.");
  };

  $("edit-score-btn").onclick = () => {
    if (editPin) {
      editPin = "";
      renderCurrent();
      return;
    }

    $("pin-error").textContent = "";
    $("edit-pin").value = "";
    $("pin-dialog").showModal();
  };

  $("pin-form").onsubmit = e => {
    e.preventDefault();
    const pin = $("edit-pin").value.trim();

    if (pin !== current.pin) {
      $("pin-error").textContent = "Incorrect PIN.";
      return;
    }

    editPin = pin;
    $("pin-dialog").close();
    renderCurrent();
  };

 
