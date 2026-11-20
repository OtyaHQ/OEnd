// Minimal Cloudflare Workers type stubs used across route handlers.
// These mirror the real types from @cloudflare/workers-types without
// requiring the package to be installed as a direct dependency.

// ── Workers AI ────────────────────────────────────────────────────────────────
declare interface AiBinding {
  run(model: string, input: unknown): Promise<unknown>
}

// ── AI processing queue ───────────────────────────────────────────────────────
declare interface AiQueueProducer {
  send(body: unknown): Promise<void>
}

// ── Vectorize ─────────────────────────────────────────────────────────────────
declare interface VectorizeMatch {
  id:       string
  score:    number
  metadata: Record<string, unknown> | null
}

declare interface VectorizeQueryResult {
  matches: VectorizeMatch[]
}

declare interface VectorizeVector {
  id:       string
  values:   number[]
  metadata?: Record<string, unknown>
}

declare interface VectorizeIndex {
  insert(vectors: VectorizeVector[]): Promise<void>
  upsert(vectors: VectorizeVector[]): Promise<void>
  query(vector: number[], options: { topK: number }): Promise<VectorizeQueryResult>
}

// ── Auth Service Binding ──────────────────────────────────────────────────────
// Service Binding to the oend-identity worker (configured in wrangler.toml).
// Called via env.AUTH.fetch() to verify JWTs without network round-trips.
declare interface AuthService {
  fetch(request: Request): Promise<Response>
}

// ── Cloudflare env augmentation ───────────────────────────────────────────────
// These are added to the env object available via getCloudflareContext().
declare interface CloudflareEnvExtensions {
  AI:              AiBinding
  AI_QUEUE:        AiQueueProducer
  VECTORIZE:       VectorizeIndex
  AUTH:            AuthService   // Service Binding to oend-identity worker
  RESEND_API_KEY?: string
  INTERNAL_SECRET?: string       // Shared secret for /internal/delete-user
  TURNSTILE_SITE_KEY?: string    // Public Cloudflare Turnstile site key
  TURNSTILE_SECRET_KEY?: string  // Server-only Cloudflare Turnstile secret
  // Payment providers
  GOOGLE_PLAY_PACKAGE_NAME?:   string
  GOOGLE_PLAY_SERVICE_ACCOUNT?: string  // service account JSON for Play Developer API
  FLUTTERWAVE_SECRET_HASH?:    string
}

declare interface KVNamespace {
  get(key: string, options?: { type?: 'text' }): Promise<string | null>
  get(key: string, options: { type: 'json' }): Promise<unknown>
  get(key: string, options: { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>
  get(key: string, options: { type: 'stream' }): Promise<ReadableStream | null>
  put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: { expirationTtl?: number; expiration?: number; metadata?: unknown }
  ): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string; expiration?: number; metadata?: unknown }[]
    list_complete: boolean
    cursor?: string
  }>
}

declare interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | string,
    options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }
  ): Promise<R2Object>
  delete(key: string): Promise<void>
  head(key: string): Promise<R2Object | null>
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    objects: R2Object[]
    truncated: boolean
    cursor?: string
  }>
}

declare interface R2Object {
  key: string
  size: number
  etag: string
  httpEtag: string
  uploaded: Date
  httpMetadata?: Record<string, string>
  customMetadata?: Record<string, string>
}

declare interface R2ObjectBody extends R2Object {
  body: ReadableStream
  bodyUsed: boolean
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
  blob(): Promise<Blob>
}