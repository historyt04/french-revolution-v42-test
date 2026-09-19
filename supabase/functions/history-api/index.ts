import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("HISTORY_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = new Set([
  "https://historyt04.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);
const encoder = new TextEncoder();
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type RequestBody = { action?: string; payload?: Record<string, unknown>; token?: string };

class ApiError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://historyt04.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function response(origin: string | null, body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function requireInteger(value: unknown, name: string, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError("INVALID_INPUT", `${name} 값을 확인해 주세요.`);
  }
  return parsed;
}

function requireText(value: unknown, name: string, max = 100) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new ApiError("INVALID_INPUT", `${name} 값을 확인해 주세요.`);
  return text;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

function randomToken() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function bootstrap() {
  const { data, error } = await db
    .from("schools")
    .select("id,name")
    .eq("active", true)
    .order("name");
  if (error) {
    console.error("bootstrap database error", error);
    throw new ApiError("SERVER_ERROR", "학교 목록을 불러오지 못했습니다.", 500);
  }
  return { schools: data ?? [], schoolYear: 2026, serverNow: Date.now(), apiVersion: "supabase-1" };
}

async function studentLogin(payload: Record<string, unknown>) {
  const schoolId = requireText(payload.schoolId, "학교");
  const schoolYear = requireInteger(payload.schoolYear, "학년도", 2020, 2200);
  const grade = requireInteger(payload.grade, "학년", 1, 6);
  const classNo = requireInteger(payload.classNo, "반", 1, 30);
  const number = requireInteger(payload.number, "번호", 1, 100);
  const code = requireText(payload.code, "접속 코드", 20);
  if (!/^\d{5}$/.test(code)) throw new ApiError("AUTH_FAILED", "학번 또는 5자리 접속 코드를 확인해 주세요.", 401);

  const { data: verified, error } = await db.rpc("verify_student_credentials", {
    p_school_id: schoolId,
    p_year: schoolYear,
    p_grade: grade,
    p_class_no: classNo,
    p_student_no: number,
    p_code: code,
  });
  const student = Array.isArray(verified) ? verified[0] : verified;
  if (error || !student) throw new ApiError("AUTH_FAILED", "학번 또는 5자리 접속 코드를 확인해 주세요.", 401);

  const token = randomToken();
  const rememberDevice = payload.rememberDevice === true || payload.rememberDevice === "true" || payload.rememberDevice === "on";
  const expiresAt = new Date(Date.now() + (rememberDevice ? 30 * 86400000 : 12 * 3600000)).toISOString();
  const deviceName = String(payload.deviceName ?? "").trim().slice(0, 80) || null;
  const { error: sessionError } = await db.from("app_sessions").insert({
    actor_type: "student",
    actor_id: student.student_id,
    token_hash: await sha256(token),
    session_version: student.session_version,
    device_name: deviceName,
    expires_at: expiresAt,
  });
  if (sessionError) throw new ApiError("SERVER_ERROR", "로그인 세션을 만들지 못했습니다.", 500);

  return {
    role: "student",
    token,
    expiresAt,
    rememberDevice,
    student: await studentState(student.student_id),
  };
}

async function authenticate(token: unknown) {
  const raw = requireText(token, "로그인 정보", 200);
  const { data, error } = await db
    .from("app_sessions")
    .select("id,actor_type,actor_id,session_version,expires_at,revoked_at,last_seen_at")
    .eq("token_hash", await sha256(raw))
    .maybeSingle();
  if (error || !data) throw new ApiError("AUTH_REQUIRED", "다시 로그인해 주세요.", 401);
  if (data.revoked_at || Date.parse(data.expires_at) <= Date.now()) {
    throw new ApiError("SESSION_EXPIRED", "로그인 시간이 만료되었습니다.", 401);
  }
  if (data.actor_type !== "student") throw new ApiError("ACCESS_DENIED", "학생 로그인이 필요합니다.", 403);

  const { data: student } = await db.from("students").select("session_version,active").eq("id", data.actor_id).maybeSingle();
  if (!student?.active || student.session_version !== data.session_version) {
    throw new ApiError("SESSION_REVOKED", "로그인 정보가 변경되었습니다. 다시 로그인해 주세요.", 401);
  }
  // Avoid a database write on every click. Five-minute presence accuracy is
  // sufficient for the teacher dashboard and keeps normal gameplay read-only.
  if (Date.now() - Date.parse(data.last_seen_at) >= 5 * 60 * 1000) {
    await db.from("app_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);
  }
  return data;
}

async function studentState(studentId: string) {
  const { data: student, error } = await db
    .from("students")
    .select("id,name,nickname,student_no,class_id,classes!inner(grade,class_no,school_year_id,school_years!inner(year,school_id,schools!inner(name)))")
    .eq("id", studentId)
    .single();
  if (error || !student) throw new ApiError("NOT_FOUND", "학생 정보를 찾지 못했습니다.", 404);

  const [{ data: progress }, { data: packs }, { data: games }] = await Promise.all([
    db.from("student_progress").select("unit_id,progress,total_xp,level,updated_at").eq("student_id", studentId),
    db.from("pack_inventory").select("unit_id,pack_id,quantity,pity_state").eq("student_id", studentId).gt("quantity", 0),
    db.from("games").select("id,unit_id,mode,title,settings,sort_order,active").eq("active", true).order("sort_order"),
  ]);
  const cls = student.classes as unknown as {
    grade: number;
    class_no: number;
    school_years: { year: number; school_id: string; schools: { name: string } };
  };
  return {
    profile: {
      id: student.id,
      name: student.name,
      nickname: student.nickname ?? "",
      schoolId: cls.school_years.school_id,
      schoolName: cls.school_years.schools.name,
      schoolYear: cls.school_years.year,
      grade: cls.grade,
      classNo: cls.class_no,
      number: student.student_no,
    },
    units: progress ?? [],
    packs: packs ?? [],
    games: games ?? [],
    serverNow: Date.now(),
  };
}

async function logout(sessionId: string) {
  await db.from("app_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", sessionId);
  return { loggedOut: true };
}

async function startGame(studentId: string, payload: Record<string, unknown>) {
  const gameId = requireText(payload.gameId, "게임", 80);
  const requestId = requireText(payload.requestId, "요청 번호", 80);
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new ApiError("INVALID_INPUT", "요청 번호를 확인해 주세요.");

  const { data: game, error: gameError } = await db
    .from("games")
    .select("id,unit_id,mode,title,settings,units!inner(content_version)")
    .eq("id", gameId)
    .eq("active", true)
    .maybeSingle();
  if (gameError || !game) throw new ApiError("NOT_FOUND", "게임을 찾지 못했습니다.", 404);

  const challenge = randomToken().slice(0, 24);
  const contentVersion = Number((game.units as unknown as { content_version: number }).content_version || 1);
  const { data: attempt, error } = await db.from("game_attempts").insert({
    request_id: requestId,
    student_id: studentId,
    game_id: game.id,
    content_version: contentVersion,
    status: "started",
    challenge,
  }).select("id,started_at").single();

  if (error?.code === "23505") {
    const { data: existing } = await db
      .from("game_attempts")
      .select("id,student_id,game_id,status,started_at")
      .eq("request_id", requestId)
      .maybeSingle();
    if (!existing || existing.student_id !== studentId || existing.game_id !== game.id) {
      throw new ApiError("REQUEST_CONFLICT", "이미 사용된 요청 번호입니다.", 409);
    }
    return { attemptId: existing.id, startedAt: existing.started_at, status: existing.status, game };
  }
  if (error || !attempt) throw new ApiError("SERVER_ERROR", "게임을 시작하지 못했습니다.", 500);
  return { attemptId: attempt.id, startedAt: attempt.started_at, status: "started", game };
}

async function completeGame(studentId: string, payload: Record<string, unknown>) {
  const attemptId = requireText(payload.attemptId, "게임 기록", 80);
  const requestId = requireText(payload.requestId, "요청 번호", 80);
  const elapsedMs = requireInteger(payload.elapsedMs, "진행 시간", 0, 86400000);
  const correctCount = requireInteger(payload.correctCount, "정답 수", 0, 1000);
  const totalCount = requireInteger(payload.totalCount, "문제 수", 1, 1000);
  const errorCount = requireInteger(payload.errorCount ?? 0, "오답 수", 0, 10000);
  const hintCount = requireInteger(payload.hintCount ?? 0, "힌트 수", 0, 10000);
  if (!/^[0-9a-f-]{36}$/i.test(attemptId) || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    throw new ApiError("INVALID_INPUT", "게임 기록 번호를 확인해 주세요.");
  }

  const { data, error } = await db.rpc("complete_game_attempt", {
    p_student_id: studentId,
    p_attempt_id: attemptId,
    p_request_id: requestId,
    p_elapsed_ms: elapsedMs,
    p_correct_count: correctCount,
    p_total_count: totalCount,
    p_error_count: errorCount,
    p_hint_count: hintCount,
  });
  if (error) {
    console.error("complete game database error", error);
    const known = String(error.message ?? "");
    if (known.includes("ATTEMPT_NOT_FOUND")) throw new ApiError("NOT_FOUND", "진행 중인 게임을 찾지 못했습니다.", 404);
    if (known.includes("INVALID_")) throw new ApiError("INVALID_COMPLETION", "완료 정보를 확인해 주세요.", 400);
    throw new ApiError("SERVER_ERROR", "완료 기록을 저장하지 못했습니다.", 500);
  }
  return data;
}

async function openPack(studentId: string, payload: Record<string, unknown>) {
  const unitId = requireText(payload.unitId, "단원", 80);
  const packId = requireText(payload.packId, "카드팩", 80);
  const requestId = requireText(payload.requestId, "요청 번호", 80);
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new ApiError("INVALID_INPUT", "요청 번호를 확인해 주세요.");

  const { data, error } = await db.rpc("open_student_pack", {
    p_student_id: studentId,
    p_unit_id: unitId,
    p_pack_id: packId,
    p_request_id: requestId,
  });
  if (error) {
    console.error("open pack database error", error);
    const known = String(error.message ?? "");
    if (known.includes("PACK_EMPTY")) throw new ApiError("PACK_EMPTY", "열 수 있는 카드팩이 없습니다.", 409);
    if (known.includes("CARD_CATALOG_EMPTY")) throw new ApiError("CARD_CATALOG_EMPTY", "이 단원의 카드가 아직 준비되지 않았습니다.", 409);
    throw new ApiError("SERVER_ERROR", "카드팩을 열지 못했습니다.", 500);
  }
  return data;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return response(origin, { ok: false, code: "METHOD_NOT_ALLOWED", message: "POST 요청만 지원합니다." }, 405);
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return response(origin, { ok: false, code: "ORIGIN_DENIED", message: "허용되지 않은 접속 주소입니다." }, 403);
  }

  try {
    const body = await req.json() as RequestBody;
    const action = String(body.action ?? "");
    const payload = body.payload ?? {};
    let data: unknown;
    if (action === "health") data = { status: "ok", serverNow: Date.now(), apiVersion: "supabase-1" };
    else if (action === "public.bootstrap") data = await bootstrap();
    else if (action === "student.login") data = await studentLogin(payload);
    else {
      const session = await authenticate(body.token);
      if (action === "student.state") data = await studentState(session.actor_id);
      else if (action === "game.start") data = await startGame(session.actor_id, payload);
      else if (action === "game.complete") data = await completeGame(session.actor_id, payload);
      else if (action === "pack.open") data = await openPack(session.actor_id, payload);
      else if (action === "session.logout") data = await logout(session.id);
      else throw new ApiError("UNKNOWN_ACTION", "아직 지원하지 않는 요청입니다.", 404);
    }
    return response(origin, { ok: true, data: data as Json });
  } catch (error) {
    const known = error instanceof ApiError ? error : new ApiError("SERVER_ERROR", "서버 처리 중 오류가 발생했습니다.", 500);
    console.error(known.code, error);
    return response(origin, { ok: false, code: known.code, message: known.message }, known.status);
  }
});
