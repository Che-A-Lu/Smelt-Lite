// ---- summary.json 相关 ----
export interface SummaryMeta {
  format: "card-v1";
  title: string;
  description: string;
  created: string;
  human: { name: string; role: string };
  ai: { model: string; role: string };
  status: string;
}

export interface SummaryFile { name: string; role: string; }

export interface Branch { id: number; what: string; why: string; who_decided: string; }

export interface Decision { id: number; what: string; why: string; by: string; }

export interface SummaryJSON {
  format: "card-v1";
  title: string;
  description: string;
  created: string;
  human: { name: string; role: string };
  ai: { model: string; role: string };
  status: string;
  done?: string;
  current: string;
  blocked?: string | null;
  next: string[];
  branches?: Branch[];
  decisions?: Decision[];
  files?: SummaryFile[];
}

// ---- trail.jsonl 相关 ----
export interface TrailContextItem { role: "human" | "ai"; text: string; }

export interface TrailEntry {
  id: string;
  type: "branch" | "decision" | "progress" | "block" | "file";
  summary: string;
  context: TrailContextItem[];
  before: string;
  after: string;
  confidence: "high" | "medium" | "low";
  collab_ids: number[];
}

// ---- manifest.json 相关 ----
export interface ProvenanceEntry {
  action: "created" | "modified" | "exported";
  who: string;
  when: string;
  what?: string;
  signature: string;
  pubKey?: JsonWebKey;
}

export interface ManifestJSON {
  format: "card-v1";
  title: string;
  description: string;
  created: string;
  status: string;
  next: string[];
  participants: { name: string; role: string }[];
  branches: number;
  decisions: number;
  files: string[];
  provenance: ProvenanceEntry[];
}

// ---- edits.json 相关 ----
export interface EditEntry {
  sequence: number;
  who: string;
  when: string;
  action: "created" | "modified";
  changes: { added: string[]; modified: string[]; removed: string[]; unchanged: string[] };
  hash_before: string | null;
  hash_after: string;
  signature: string;
}

// ---- 密钥 ----
export interface IdentityKey {
  publicKeyJWK: JsonWebKey;
  privateKeyJWK: JsonWebKey;
  fingerprint: string; // SHA-256(公钥 x+y) 前 16 字符
}

// ---- 应用状态 ----
export type AppView = "input" | "preview" | "pack" | "import";

export interface AppState {
  view: AppView;
  summary: SummaryJSON | null;
  trail: TrailEntry[] | null;
  files: File[];
  importedManifest: ManifestJSON | null;
  importedEdits: EditEntry[] | null;
  importedFiles: { name: string; size: number; blob: Blob }[] | null;
  signatureValid: boolean | null;
  identity: IdentityKey | null;
  error: string | null;
}
