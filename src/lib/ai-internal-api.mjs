function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ""));
  const b = new TextEncoder().encode(String(right || ""));
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

function safeLimit(value, fallback = 20) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(50, parsed)) : fallback;
}

function safeWindow(value, fallback = "-24 hours") {
  const allowed = new Set(["-1 hour", "-24 hours", "-7 days", "-14 days"]);
  return allowed.has(String(value || "")) ? String(value) : fallback;
}

function redactAiText(value, max = 900) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi, "<email>")
    .replace(/\\+?[0-9][0-9 ()-]{7,}[0-9]/g, "<phone>")
    .replace(/\\b(?:bearer|token|authorization|api[_ -]?key)\\s*[:=]?\\s*[A-Za-z0-9._~-]{10,}/gi, "<secret>")
    .replace(/(?:\\/data\\/user\\/\\d+\\/\\S+|\\/data\\/data\\/\\S+)/gi, "<app-data>")
    .replace(/\\/storage\\/emulated\\/\\d+(?:\\/\\S*)?/gi, "<device-storage>")
    .replace(/[A-Z]:\\\\Users\\\\\\S+/gi, "<user-path>")
    .replace(/\\/home\\/\\S+/gi, "<user-path>")
    .replace(/[\\u0000-\\u001F\\u007F]/g, " ")
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, max);
}

async function first(db, sql, ...params) {
  let statement = db.prepare(sql);
  if (params.length) statement = statement.bind(...params);
  return statement.first();
}

async function all(db, sql, ...params) {
  let statement = db.prepare(sql);
  if (params.length) statement = statement.bind(...params);
  const result = await statement.all();
  return result.results || [];
}

async function optionalMetric(db, sql, ...params) {
  try {
    const row = await first(db, sql, ...params);
    const value = row ? Object.values(row)[0] : null;
    return value == null ? 0 : Number(value);
  } catch {
    return null;
  }
}

async function readCrashGroups(db, window, limit) {
  return all(db, `
    WITH recent AS (
      SELECT id,group_id,error_type,device_id,app_version,version_code,description,stack_trace,created_at
      FROM crash_reports
      WHERE created_at >= datetime('now', ?1)
    ), grouped AS (
      SELECT group_id,error_type,COUNT(*) AS count,
        COUNT(DISTINCT NULLIF(device_id,'')) AS devices,
        MAX(created_at) AS latest
      FROM recent
      GROUP BY group_id,error_type
      ORDER BY count DESC
      LIMIT ?2
    )
    SELECT grouped.*,
      (SELECT id FROM recent r
        WHERE COALESCE(r.group_id,'')=COALESCE(grouped.group_id,'')
          AND COALESCE(r.error_type,'')=COALESCE(grouped.error_type,'')
        ORDER BY r.created_at DESC LIMIT 1) AS sample_id,
      (SELECT app_version FROM recent r
        WHERE COALESCE(r.group_id,'')=COALESCE(grouped.group_id,'')
          AND COALESCE(r.error_type,'')=COALESCE(grouped.error_type,'')
        ORDER BY r.created_at DESC LIMIT 1) AS app_version,
      (SELECT version_code FROM recent r
        WHERE COALESCE(r.group_id,'')=COALESCE(grouped.group_id,'')
          AND COALESCE(r.error_type,'')=COALESCE(grouped.error_type,'')
        ORDER BY r.created_at DESC LIMIT 1) AS version_code,
      (SELECT description FROM recent r
        WHERE COALESCE(r.group_id,'')=COALESCE(grouped.group_id,'')
          AND COALESCE(r.error_type,'')=COALESCE(grouped.error_type,'')
        ORDER BY r.created_at DESC LIMIT 1) AS sample_description,
      (SELECT stack_trace FROM recent r
        WHERE COALESCE(r.group_id,'')=COALESCE(grouped.group_id,'')
          AND COALESCE(r.error_type,'')=COALESCE(grouped.error_type,'')
        ORDER BY r.created_at DESC LIMIT 1) AS sample_stack
    FROM grouped
    ORDER BY count DESC
  `, window, limit);
}

export async function handleAiInternalRequest(request, env) {
  const expected = String(env?.OTYA_AI_CORE_SERVICE_TOKEN || "");
  const provided = String(request.headers.get("x-otya-ai-core-token") || "");
  if (expected.length < 32 || !constantTimeEqual(expected, provided)) {
    return response({ error: "unauthorized" }, 401);
  }
  if (!env?.DB) return response({ error: "core_database_unavailable" }, 503);

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "/internal/ai/operations-snapshot") {
    const window = safeWindow(url.searchParams.get("window"));
    const [
      users, devices, activeDevices, downloads, crashes, feedback, feedbackPending,
      queueFailures, queueDelivery, crashGroups, feedbackItems, latestRelease,
    ] = await Promise.all([
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM users"),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM devices"),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM devices WHERE last_seen_at >= datetime('now', ?1)", window),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM downloads WHERE created_at >= datetime('now', ?1)", window),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM crash_reports WHERE created_at >= datetime('now', ?1)", window),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM feedback WHERE created_at >= datetime('now', ?1)", window),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM feedback WHERE category IS NULL AND created_at >= datetime('now', ?1)", window),
      optionalMetric(env.DB, "SELECT COALESCE(SUM(failed_count),0) AS n FROM queue_delivery_events WHERE created_at >= datetime('now', ?1)", window),
      all(env.DB, "SELECT queue_name,outcome,COUNT(*) AS events,COALESCE(SUM(sent_count),0) AS sent,COALESCE(SUM(failed_count),0) AS failed,COALESCE(SUM(transient_failed),0) AS transient_failed,COALESCE(SUM(removed_count),0) AS removed,COALESCE(SUM(total_count),0) AS total,MAX(created_at) AS latest FROM queue_delivery_events WHERE created_at >= datetime('now', ?1) GROUP BY queue_name,outcome ORDER BY failed DESC,events DESC LIMIT 12", window),
      readCrashGroups(env.DB, window, 8),
      all(env.DB, "SELECT id,category,description,created_at FROM feedback WHERE created_at >= datetime('now', ?1) ORDER BY created_at DESC LIMIT 12", window),
      first(env.DB, "SELECT tag,version,version_code,changelog,released_at FROM releases ORDER BY released_at DESC LIMIT 1").catch(() => null),
    ]);
    return response({
      ok: true,
      generatedAt: new Date().toISOString(),
      window,
      metrics: { users, devices, activeDevices24h: activeDevices, downloads, crashes, feedback, feedbackPending, failedQueueEvents: queueFailures },
      queueDelivery,
      crashGroups: crashGroups.map(row => ({
        ...row,
        error_type: redactAiText(row.error_type, 120),
        sample_description: redactAiText(row.sample_description, 500),
        sample_stack: redactAiText(row.sample_stack, 900),
      })),
      feedbackItems: feedbackItems.map(row => ({
        id: String(row.id),
        category: row.category || null,
        description: redactAiText(row.description, 700),
        created_at: row.created_at,
      })),
      latestRelease: latestRelease || null,
    });
  }

  if (method === "GET" && path === "/internal/ai/feedback") {
    const limit = safeLimit(url.searchParams.get("limit"));
    const rows = await all(env.DB, "SELECT id,category,description,created_at FROM feedback ORDER BY created_at DESC LIMIT ?1", limit);
    return response({ ok: true, items: rows.map(row => ({
      id: String(row.id),
      category: row.category || null,
      description: redactAiText(row.description, 900),
      createdAt: row.created_at,
    })) });
  }

  if (method === "GET" && path === "/internal/ai/crashes") {
    const window = safeWindow(url.searchParams.get("window"), "-1 hour");
    const limit = safeLimit(url.searchParams.get("limit"), 8);
    const count = await optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM crash_reports WHERE created_at >= datetime('now', ?1)", window);
    const groups = await readCrashGroups(env.DB, window, limit);
    return response({ ok: true, count, window, groups: groups.map(row => ({
      ...row,
      error_type: redactAiText(row.error_type, 120),
      sample_description: redactAiText(row.sample_description, 500),
      sample_stack: redactAiText(row.sample_stack, 900),
    })) });
  }

  if (method === "GET" && path === "/internal/ai/downloads/hourly") {
    const rows = await all(env.DB, "SELECT strftime('%Y-%m-%d %H:00', created_at) AS hour,COUNT(*) AS count FROM downloads WHERE created_at >= datetime('now','-24 hours') GROUP BY hour ORDER BY hour");
    return response({ ok: true, items: rows.map(row => ({ hour: row.hour, count: Number(row.count || 0) })) });
  }

  if (method === "GET" && path === "/internal/ai/users/churn-candidates") {
    const limit = safeLimit(url.searchParams.get("limit"), 50);
    const rows = await all(env.DB, "SELECT user_id,MAX(last_seen_at) AS last_seen_at FROM devices WHERE user_id IS NOT NULL GROUP BY user_id HAVING MAX(last_seen_at) >= datetime('now','-14 days') AND MAX(last_seen_at) < datetime('now','-7 days') ORDER BY last_seen_at ASC LIMIT ?1", limit);
    return response({ ok: true, users: rows.map(row => ({ user_id: String(row.user_id), last_seen_at: row.last_seen_at })) });
  }

  if (method === "GET" && path === "/internal/ai/releases") {
    const limit = safeLimit(url.searchParams.get("limit"), 8);
    const rows = await all(env.DB, "SELECT tag,version,version_code,changelog,released_at FROM releases ORDER BY released_at DESC LIMIT ?1", limit);
    return response({ ok: true, releases: rows.map(row => ({
      tag: row.tag, version: row.version, versionCode: row.version_code,
      changelog: redactAiText(row.changelog, 1800), releasedAt: row.released_at,
    })) });
  }

  if (method === "POST" && path === "/internal/ai/feedback/classify") {
    let body;
    try { body = await request.json(); } catch { return response({ error: "invalid_json" }, 400); }
    const id = String(body.feedbackId || "").trim().slice(0, 100);
    const categories = new Set(["bug","feature_request","support","billing","performance","other","complaint","praise","crash_report"]);
    const category = String(body.category || "").trim().toLowerCase();
    if (!id || !categories.has(category)) return response({ error: "invalid_classification" }, 400);
    try {
      const result = await env.DB.prepare("UPDATE feedback SET category = ?1 WHERE id = ?2").bind(category, id).run();
      return response({ ok: true, updated: Number(result.meta?.changes || 0) });
    } catch {
      return response({ error: "feedback_update_failed" }, 503);
    }
  }

  if (method === "POST" && path === "/internal/ai/crashes/group") {
    let body;
    try { body = await request.json(); } catch { return response({ error: "invalid_json" }, 400); }
    const id = String(body.reportId || "").trim().slice(0, 100);
    const group = redactAiText(body.group || "", 100);
    if (!id || !group) return response({ error: "invalid_crash_triage" }, 400);
    try {
      const result = await env.DB.prepare("UPDATE crash_reports SET group_id = ?1 WHERE id = ?2").bind(group, id).run();
      return response({ ok: true, updated: Number(result.meta?.changes || 0) });
    } catch {
      return response({ error: "crash_update_failed" }, 503);
    }
  }

  if (method === "POST" && path === "/internal/ai/releases/changelog") {
    let body;
    try { body = await request.json(); } catch { return response({ error: "invalid_json" }, 400); }
    const tag = String(body.tag || "").trim().slice(0, 100);
    const changelog = redactAiText(body.changelog || "", 12000);
    if (!tag || !changelog) return response({ error: "invalid_changelog" }, 400);
    try {
      const result = await env.DB.prepare("UPDATE releases SET changelog = ?1 WHERE tag = ?2").bind(changelog, tag).run();
      return response({ ok: true, updated: Number(result.meta?.changes || 0) });
    } catch {
      return response({ error: "changelog_update_failed" }, 503);
    }
  }

  return response({ error: "not_found" }, 404);
}
