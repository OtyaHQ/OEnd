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

function redactAiText(value, max = 900) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<email>")
    .replace(/\+?[0-9][0-9 ()-]{7,}[0-9]/g, "<phone>")
    .replace(/\b(?:bearer|token|authorization|api[_ -]?key)\s*[:=]?\s*[A-Za-z0-9._~-]{10,}/gi, "<secret>")
    .replace(/(?:\/data\/user\/\d+\/\S+|\/data\/data\/\S+)/gi, "<app-data>")
    .replace(/\/storage\/emulated\/\d+(?:\/\S*)?/gi, "<device-storage>")
    .replace(/[A-Z]:\\Users\\\S+/gi, "<user-path>")
    .replace(/\/home\/\S+/gi, "<user-path>")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
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

async function optionalMetric(db, sql) {
  try {
    const row = await first(db, sql);
    const value = row ? Object.values(row)[0] : null;
    return value == null ? 0 : Number(value);
  } catch {
    return null;
  }
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
    const [users, devices, activeDevices, downloads24h, crashes24h, feedbackTotal, feedbackPending, failedQueues, latestRelease] = await Promise.all([
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM users"),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM devices"),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM devices WHERE last_seen_at >= datetime('now','-24 hours')"),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM downloads WHERE created_at >= datetime('now','-24 hours')"),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM crash_reports WHERE created_at >= datetime('now','-24 hours')"),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM feedback"),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM feedback WHERE COALESCE(ai_processed,0)=0"),
      optionalMetric(env.DB, "SELECT COUNT(*) AS n FROM queue_delivery_events WHERE status IN ('failed','dead_letter')"),
      first(env.DB, "SELECT version, channel, status, created_at FROM releases ORDER BY created_at DESC LIMIT 1").catch(() => null),
    ]);
    return response({ ok: true, generatedAt: new Date().toISOString(), metrics: { users, devices, activeDevices24h: activeDevices, downloads24h, crashes24h, feedbackTotal, feedbackPending, failedQueueEvents: failedQueues }, latestRelease: latestRelease || null });
  }

  if (method === "GET" && path === "/internal/ai/feedback") {
    const limit = safeLimit(url.searchParams.get("limit"));
    try {
      const rows = await all(env.DB, "SELECT id, category, sentiment, description, ai_processed, ai_flagged, created_at FROM feedback ORDER BY created_at DESC LIMIT ?", limit);
      return response({ ok: true, items: rows.map(row => ({ id: String(row.id), category: row.category || null, sentiment: row.sentiment || null, description: redactAiText(row.description), aiProcessed: !!row.ai_processed, aiFlagged: !!row.ai_flagged, createdAt: row.created_at })) });
    } catch {
      return response({ error: "feedback_view_unavailable" }, 503);
    }
  }

  if (method === "GET" && path === "/internal/ai/crashes") {
    const limit = safeLimit(url.searchParams.get("limit"), 15);
    try {
      const rows = await all(env.DB, "SELECT COALESCE(NULLIF(error_type,''),'unknown') AS error_type, COUNT(*) AS occurrences, MAX(created_at) AS last_seen FROM crash_reports GROUP BY COALESCE(NULLIF(error_type,''),'unknown') ORDER BY occurrences DESC, last_seen DESC LIMIT ?", limit);
      return response({ ok: true, groups: rows.map(row => ({ errorType: redactAiText(row.error_type, 120), occurrences: Number(row.occurrences || 0), lastSeen: row.last_seen })) });
    } catch {
      return response({ error: "crash_view_unavailable" }, 503);
    }
  }

  if (method === "GET" && path === "/internal/ai/releases") {
    const limit = safeLimit(url.searchParams.get("limit"), 8);
    try {
      const rows = await all(env.DB, "SELECT version, channel, status, changelog, created_at FROM releases ORDER BY created_at DESC LIMIT ?", limit);
      return response({ ok: true, releases: rows.map(row => ({ version: row.version, channel: row.channel, status: row.status, changelog: redactAiText(row.changelog, 1800), createdAt: row.created_at })) });
    } catch {
      return response({ error: "release_view_unavailable" }, 503);
    }
  }

  if (method === "POST" && path === "/internal/ai/feedback/classify") {
    let body;
    try { body = await request.json(); } catch { return response({ error: "invalid_json" }, 400); }
    const id = String(body.feedbackId || "").trim().slice(0, 100);
    const categories = new Set(["bug","feature_request","support","billing","performance","other"]);
    const sentiments = new Set(["positive","neutral","negative","urgent"]);
    const category = String(body.category || "").trim().toLowerCase();
    const sentiment = String(body.sentiment || "").trim().toLowerCase();
    if (!id || !categories.has(category) || !sentiments.has(sentiment)) return response({ error: "invalid_classification" }, 400);
    const flagged = body.flagged === true ? 1 : 0;
    const suggestedReply = body.suggestedReply ? redactAiText(body.suggestedReply, 1200) : null;
    try {
      const result = await env.DB.prepare("UPDATE feedback SET category = ?, sentiment = ?, ai_processed = 1, ai_flagged = ?, ai_suggested_reply = ? WHERE id = ?")
        .bind(category, sentiment, flagged, suggestedReply, id).run();
      return response({ ok: true, updated: Number(result.meta?.changes || 0) });
    } catch {
      return response({ error: "feedback_update_failed" }, 503);
    }
  }

  if (method === "POST" && path === "/internal/ai/crashes/group") {
    let body;
    try { body = await request.json(); } catch { return response({ error: "invalid_json" }, 400); }
    const reportId = String(body.reportId || "").trim().slice(0, 100);
    const group = redactAiText(body.group || "", 100);
    const summary = redactAiText(body.summary || "", 500);
    if (!reportId || !group || !summary) return response({ error: "invalid_crash_triage" }, 400);
    try {
      const result = await env.DB.prepare("UPDATE crash_reports SET ai_group = ?, ai_summary = ?, ai_processed = 1 WHERE id = ?")
        .bind(group, summary, reportId).run();
      return response({ ok: true, updated: Number(result.meta?.changes || 0) });
    } catch {
      return response({ error: "crash_update_failed" }, 503);
    }
  }

  return response({ error: "not_found" }, 404);
}
