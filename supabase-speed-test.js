(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const projectUrl = $("projectUrl");
  const runButton = $("run");
  const summary = $("summary");
  const table = $("results");
  const tbody = table.querySelector("tbody");
  projectUrl.value = localStorage.getItem("historySupabaseProjectUrl") || "";

  function normalizedProjectUrl() {
    const value = projectUrl.value.trim().replace(/\/+$/, "").replace(/\/functions\/v1\/history-api$/i, "");
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value)) {
      throw new Error("Supabase 프로젝트 URL 형식을 확인해 주세요.");
    }
    localStorage.setItem("historySupabaseProjectUrl", value);
    return value;
  }

  async function call(baseUrl, action, payload, token) {
    const started = performance.now();
    const response = await fetch(`${baseUrl}/functions/v1/history-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload: payload || {}, token: token || undefined }),
    });
    const body = await response.json().catch(() => null);
    const elapsed = Math.round(performance.now() - started);
    if (!response.ok || !body?.ok) throw Object.assign(new Error(body?.message || `HTTP ${response.status}`), { elapsed });
    return { data: body.data, elapsed };
  }

  function resultClass(ms) {
    if (ms <= 2000) return "good";
    if (ms <= 5000) return "slow";
    return "bad";
  }

  function addRow(name, elapsed, message) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${name}</td><td class="${resultClass(elapsed)}">${elapsed.toLocaleString()} ms</td><td>${message}</td>`;
    tbody.append(row);
  }

  runButton.addEventListener("click", async () => {
    runButton.disabled = true;
    tbody.replaceChildren();
    table.hidden = false;
    summary.textContent = "시험 중입니다…";
    let token = "";
    const totalStarted = performance.now();
    try {
      const baseUrl = normalizedProjectUrl();
      const health = await call(baseUrl, "health");
      addRow("서버 깨우기", health.elapsed, "정상");

      const bootstrap = await call(baseUrl, "public.bootstrap");
      const school = bootstrap.data.schools?.find((item) => item.id === "dongju-middle");
      addRow("학교 목록", bootstrap.elapsed, school ? school.name : "동주중학교를 찾지 못함");
      if (!school) throw new Error("동주중학교 초기 자료가 없습니다.");

      const login = await call(baseUrl, "student.login", {
        schoolId: school.id,
        schoolYear: 2026,
        grade: Number($("grade").value),
        classNo: Number($("classNo").value),
        number: Number($("number").value),
        code: $("code").value.trim(),
        rememberDevice: true,
        deviceName: "Supabase 속도 시험",
      });
      token = login.data.token;
      addRow("학생 로그인", login.elapsed, `${login.data.student.profile.name} 확인`);

      const startRequestId = crypto.randomUUID();
      const playStarted = performance.now();
      const start = await call(baseUrl, "game.start", {
        gameId: "fr-beginner",
        requestId: startRequestId,
      }, token);
      addRow("게임 시작", start.elapsed, "초급 기록 생성");

      const completion = await call(baseUrl, "game.complete", {
        attemptId: start.data.attemptId,
        requestId: crypto.randomUUID(),
        elapsedMs: Math.max(0, Math.round(performance.now() - playStarted)),
        correctCount: 12,
        totalCount: 12,
        errorCount: 0,
        hintCount: 0,
      }, token);
      addRow("완료·보상", completion.elapsed, completion.data.rewarded ? "일반 카드팩 1개 지급" : "이미 최초 완료 보상을 받음");

      const state = await call(baseUrl, "student.state", {}, token);
      const generalPack = state.data.packs.find((item) => item.unit_id === "fr-revolution" && item.pack_id === "general");
      addRow("학생 화면 자료", state.elapsed, `게임 ${state.data.games.length}개 · 카드팩 ${generalPack?.quantity || 0}개`);

      if (generalPack?.quantity > 0) {
        const opened = await call(baseUrl, "pack.open", {
          unitId: "fr-revolution",
          packId: "general",
          requestId: crypto.randomUUID(),
        }, token);
        const shiny = opened.data.card.effect === "shiny" ? " · 이로치" : "";
        addRow("카드팩 개봉", opened.elapsed, `${opened.data.card.title} (${opened.data.card.rarity}${shiny})`);
      } else {
        addRow("카드팩 개봉", 0, "남은 시험용 카드팩 없음");
      }

      const logout = await call(baseUrl, "session.logout", {}, token);
      addRow("로그아웃", logout.elapsed, "정상");
      token = "";

      const total = Math.round(performance.now() - totalStarted);
      summary.innerHTML = `전체 <strong class="${resultClass(total)}">${total.toLocaleString()} ms</strong> — 실제 게임 저장·보상 시험까지 성공했습니다.`;
    } catch (error) {
      const elapsed = Number.isFinite(error.elapsed) ? ` (${error.elapsed.toLocaleString()} ms)` : "";
      summary.innerHTML = `<strong class="bad">실패:</strong> ${String(error.message || error)}${elapsed}`;
    } finally {
      runButton.disabled = false;
    }
  });
})();
