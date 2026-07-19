import JSZip from 'jszip';
import type { SummaryJSON, TrailEntry, ManifestJSON, IdentityKey, EditEntry, ProvenanceEntry } from '../foundation/types';
import { signContent } from './identity';

export interface PackOptions {
  summary: SummaryJSON;
  trail: TrailEntry[] | null;
  files: File[];
  identity: IdentityKey | null;
  encrypt: boolean;
  password?: string;
}

export interface ScanResult {
  clean: boolean;
  risks: { fileName: string; type: "api_key" | "email" | "phone"; detail: string }[];
}

export async function scanContent(files: File[]): Promise<ScanResult> {
  const risks: ScanResult['risks'] = [];
  const apiKeyPattern = /(?:api[_-]?key|apikey|secret|token|password|access_key)\s*[:=]\s*['"]?[\w\-.]{8,}['"]?/gi;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?(?:\d{3}[-.\s]?){2}\d{4}/g;

  for (const file of files) {
    try {
      const text = await file.text();
      let match;
      while ((match = apiKeyPattern.exec(text)) !== null) {
        risks.push({ fileName: file.name, type: 'api_key', detail: match[0].slice(0, 40) });
      }
      while ((match = emailPattern.exec(text)) !== null) {
        risks.push({ fileName: file.name, type: 'email', detail: match[0] });
      }
      while ((match = phonePattern.exec(text)) !== null) {
        risks.push({ fileName: file.name, type: 'phone', detail: match[0] });
      }
    } catch {
      // 二进制文件跳过文本扫描
    }
  }

  return { clean: risks.length === 0, risks };
}

export async function buildCardPackage(opts: PackOptions): Promise<Blob> {
  const { summary, trail, files, identity, encrypt, password } = opts;
  const zip = new JSZip();
  const now = new Date().toISOString();

  // 1. 生成 manifest.json
  const branchCount = summary.branches?.length ?? 0;
  const decisionCount = summary.decisions?.length ?? 0;
  const fileNames = files.map(f => f.name);

  const provenance: ProvenanceEntry[] = [{
    action: 'exported',
    who: identity ? `key:${identity.fingerprint.slice(0, 8)}` : 'anonymous',
    when: now,
    signature: '',
    pubKey: identity ? identity.publicKeyJWK : undefined,
  }];

  const manifest: ManifestJSON = {
    format: 'card-v1',
    title: summary.title,
    description: summary.description,
    created: summary.created,
    status: summary.status,
    next: summary.next,
    participants: [
      { name: summary.human.name, role: summary.human.role },
      { name: summary.ai.model, role: summary.ai.role },
    ],
    branches: branchCount,
    decisions: decisionCount,
    files: fileNames,
    provenance,
  };

  // 2. 如果有 identity，生成 edits.json + signature.json
  let edits: EditEntry[] | null = null;
  if (identity) {
    const fileHashes: Record<string, string> = {};
    for (const f of files) {
      fileHashes[f.name] = await computeFileHash(f);
    }

    edits = [{
      sequence: 1,
      who: summary.human.name,
      when: now,
      action: 'created',
      changes: { added: fileNames, modified: [], removed: [], unchanged: [] },
      hash_before: null,
      hash_after: await computeManifestHash(manifest),
      signature: '',
    }];

    // 签名 edits
    for (const edit of edits) {
      const contentHash = await sha256(JSON.stringify(edit.changes) + (edit.hash_after ?? ''));
      edit.signature = await signContent(contentHash, identity.privateKeyJWK);
    }

    // 签名 provenance（不含 signature，含 pubKey）
    const entryToSign = {
      action: provenance[0].action,
      who: provenance[0].who,
      when: provenance[0].when,
      what: provenance[0].what,
      pubKey: provenance[0].pubKey,
    };
    const provContent = await sha256(JSON.stringify(entryToSign));
    provenance[0].signature = await signContent(provContent, identity.privateKeyJWK);

    zip.file('edits.json', JSON.stringify(edits, null, 2));
    zip.file('signature.json', JSON.stringify(provenance, null, 2));
  }

  // 3. 写入根文件
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('summary.json', JSON.stringify(summary, null, 2));
  if (trail && trail.length > 0) {
    const trailText = trail.map(t => JSON.stringify(t)).join('\n');
    zip.file('trail.jsonl', trailText);
  }

  // README.md
  const readme = generateReadme(manifest);
  zip.file('README.md', readme);

  // 4. artifacts/
  const artifactsFolder = zip.folder('artifacts');
  if (artifactsFolder) {
    for (const f of files) {
      let data: ArrayBuffer | Uint8Array = await f.arrayBuffer();
      if (encrypt && password) {
        data = await encryptAES(data, password);
        artifactsFolder.file(f.name + '.enc', data);
      } else {
        artifactsFolder.file(f.name, data);
      }
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// -- 内部辅助 --

async function computeFileHash(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return sha256(buf);
}

async function computeManifestHash(m: ManifestJSON): Promise<string> {
  const content = m.files.join(',') + m.title + m.created;
  return sha256(content);
}

async function sha256(data: string | ArrayBuffer): Promise<string> {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function encryptAES(data: ArrayBuffer, password: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  // 格式: salt(16) + iv(12) + ciphertext
  const result = new Uint8Array(16 + 12 + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, 16);
  result.set(new Uint8Array(encrypted), 28);
  return result;
}

function generateReadme(m: ManifestJSON): string {
  const title = m.title || 'Untitled';
  const zh = navigator.language.startsWith('zh');
  if (zh) {
    return [
      `# ${title}`,
      '',
      m.description ? `> ${m.description}` : '',
      '',
      '这是一张 .card ——人机协作的数字资产卡片。',
      '',
      '## 这是什么',
      '一张 .card 记录了你和 AI 共同创造内容的**过程**和**结果**。',
      '它不只是最终文件，还包含了：',
      '- 谁参与了协作',
      '- 经过了哪些转折和决策',
      '- 文件的完整历史',
      '- 可验证的签名链',
      '',
      '## 如何打开',
      '拖入 Smelt Lite（或其它兼容 .card 格式的工具）即可查看完整内容。',
      '也可以改名为 `.zip` 解压查看原始文件。',
      '',
      '## 协作信息',
      participantsTable(m),
      '',
      `- 转折次数：${m.branches}`,
      `- 决策次数：${m.decisions}`,
      `- 文件数量：${m.files.length}`,
      `- 创建时间：${m.created}`,
      m.description ? '' : '',
    ].filter(l => l !== '').join('\n');
  }
  return [
    `# ${title}`,
    '',
    m.description ? `> ${m.description}` : '',
    '',
    'This is a .card — a digital asset from human-AI collaboration.',
    '',
    '## What is this',
    'A .card records both the **process** and **result** of your collaboration with AI.',
    'It contains:',
    '- Who participated',
    '- Branches and decisions made',
    '- Complete file history',
    '- Verifiable signature chain',
    '',
    '## How to open',
    'Drop into Smelt Lite (or any .card-compatible tool) to view its full contents.',
    'You can also rename it to `.zip` and extract the raw files.',
    '',
    '## Collaboration Info',
    participantsTable(m),
    '',
    `- Branches: ${m.branches}`,
    `- Decisions: ${m.decisions}`,
    `- Files: ${m.files.length}`,
    `- Created: ${m.created}`,
  ].filter(l => l !== '').join('\n');
}

function participantsTable(m: ManifestJSON): string {
  const rows = m.participants.map(p => `| ${p.name} | ${p.role} |`).join('\n');
  return [
    '| 参与者 | 角色 |',
    '|--------|------|',
    rows,
  ].join('\n');
}
