# 施工-B-smelt-lite：功能施工指令

> 角色 B（阿澈），2026-07-19。
> 合并了《施工计划》（功能）和《视觉-A-smelt-lite.md》（视觉）。
> 角色 C 按本文档逐文件实现。不接受自由发挥。

---

## 零、项目概览

**Smelt Lite**：一个静态网页。用户拖入 summary.json → 预览 → 加素材 → 打包 → 下载 .card。拖入 .card → 看到摘要、来源链、文件、签名验证。

**技术栈**：React 19 + TypeScript + Vite + JSZip + Lucide React。纯 CSS（CSS 变量），不用 Tailwind。

**源文件目标**：~10 个 `.ts`/`.tsx` + 1 个 `.css`。

---

## 一、CSS 变量（styles.css 开头，全局可用）

```css
:root {
  --bg: #F8F9FB;
  --surface: #FFFFFF;
  --surface-hover: #F9FAFB;
  --primary: #1E3A5F;
  --primary-hover: #152A45;
  --accent: #3B82F6;
  --accent-soft: #EFF6FF;
  --border: #E5E7EB;
  --border-dashed: #D1D5DB;
  --text: #111827;
  --text-secondary: #6B7280;
  --text-muted: #9CA3AF;
  --success: #10B981;
  --warning: #F59E0B;
  --error: #EF4444;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-card-hover: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-panel: 0 8px 30px rgba(0,0,0,0.10);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-5: 20px; --space-6: 24px;
  --space-8: 32px; --space-10: 40px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 22px;
  -webkit-font-smoothing: antialiased;
}

/* 通用过渡 */
button, input, select, textarea { font: inherit; }
button { cursor: pointer; border: none; background: none; }
input { outline: none; }
```

全局动画定义（写在 styles.css 末尾）：
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-3px); }
  75%      { transform: translateX(3px); }
}
.animate-in { animation: fadeIn 200ms ease-out; }
.animate-shake { animation: shake 200ms ease-out; }
```

---

## 二、项目文件清单（按创建顺序）

### 2.1 骨架文件

**`smelt-lite/package.json`**
```json
{
  "name": "smelt-lite",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "jszip": "^3.10.1",
    "lucide-react": "^0.400.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

**`smelt-lite/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

**`smelt-lite/vite.config.ts`**
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });
```

**`smelt-lite/index.html`**
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Smelt Lite · .card 打包工具</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### 2.2 源文件

| 顺序 | 文件 | 职责 | 行数估计 |
|---|---|---|---|
| 1 | `src/main.tsx` | React 入口 | 5 |
| 2 | `src/styles.css` | 全部 CSS | 150 |
| 3 | `src/foundation/types.ts` | 类型 + 常量 | 80 |
| 4 | `src/foundation/i18n.ts` | 中英双语 | 50 |
| 5 | `src/features/identity.ts` | ECDSA 密钥 + 签名 | 70 |
| 6 | `src/features/import.ts` | 解包 .card | 60 |
| 7 | `src/features/export.ts` | 打包 .card | 80 |
| 8 | `src/features/snapshot.ts` | 文件缩略图 | 40 |
| 9 | `src/ui/DropInput.tsx` | 输入区 | 80 |
| 10 | `src/ui/PreviewCard.tsx` | 预览卡 | 120 |
| 11 | `src/ui/PackPanel.tsx` | 打包面板 | 100 |
| 12 | `src/ui/ImportView.tsx` | 导入视图 | 120 |
| 13 | `src/App.tsx` | 顶层状态管理 | 80 |

共 **13 个源文件**，目标总计 ~1000 行 TSX/CSS。

---

## 三、逐文件施工指令

### 文件 1：`src/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
```

### 文件 3：`src/foundation/types.ts`

定义以下类型（完整字段参照 `.card格式规范-v2.md` 一、二章）：

```ts
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
  files: File[];               // 素材文件（不含 JSON 本身）
  importedManifest: ManifestJSON | null;
  importedEdits: EditEntry[] | null;
  importedFiles: { name: string; size: number; blob: Blob }[] | null;
  signatureValid: boolean | null;
  identity: IdentityKey | null;
  error: string | null;
}
```

**提示**：如果已有旧 `features/export/index.ts` 中的哈希和签名函数，作为参考但不直接复用——将所有 OPFS 依赖替换为纯函数签名。

### 文件 4：`src/foundation/i18n.ts`

精简版，~30 个 key。中英双语。导出一个 `t(key: string, lang?: "zh"|"en"): string` 函数。语言从 `navigator.language` 自动检测（`zh-*` → `zh`，其他 → `en`）。

必含 key：`title`, `dragHint`, `dragOr`, `selectFile`, `summaryRead`, `reinject`, `packAsCard`, `packConfirm`, `signature`, `encrypt`, `password`, `download`, `privacyScan`, `privacyClean`, `privacyRisk`, `preview`, `status`, `next`, `branches`, `decisions`, `files`, `provenance`, `signatureValid`, `signatureBroken`, `identity`, `generateKey`, `importKey`, `exportKey`, `close`, `back`, `errorParse`, `errorMissingField`。中文和英文值参照已有机翻质量编写。

### 文件 5：`src/features/identity.ts`

**复用策略**：从旧 `features/identity/index.ts` 提取以下函数，去掉所有 OPFS 依赖，改为纯函数或 `localStorage` 存储：

```ts
// 生成密钥对
export async function generateKeyPair(): Promise<IdentityKey>

// 计算指纹（SHA-256 of x+y）
export async function computeFingerprint(jwk: JsonWebKey): Promise<string>

// 签名内容（ECDSA sign(contentHash)）
export async function signContent(contentHash: string, privateKeyJWK: JsonWebKey): Promise<string>

// 验证签名
export async function verifySignature(contentHash: string, signature: string, publicKeyJWK: JsonWebKey): Promise<boolean>

// 保存密钥到 localStorage
export function saveIdentity(key: IdentityKey): void

// 从 localStorage 加载密钥
export function loadIdentity(): IdentityKey | null

// 导出密钥为 JSON 文件（触发下载）
export function exportIdentityKey(key: IdentityKey): void

// 导入密钥（从文件读取 JSON → 返回 IdentityKey）
export function importIdentityKey(file: File): Promise<IdentityKey>
```

**签名流程**：
1. 对每个文件计算 SHA-256
2. 所有文件哈希 + manifest 字段排序后拼接为一个字符串
3. 对拼接结果 SHA-256 → contentHash
4. ECDSA sign(contentHash) → base64 签名

**验证流程**：同流程反向，拿公钥验签名。

### 文件 6：`src/features/import.ts`

**复用策略**：从旧 `features/import/index.ts` 提取 parseCardFile 逻辑。去掉 Web Worker（zip bomb 检测改为同步——检查文件数 < 1000 且解压后总大小 < 100MB），去掉 OPFS 写入（返回内存中的数据结构），去掉脚本检测（不再禁止可执行文件）。

```ts
export interface ImportedCard {
  manifest: ManifestJSON;
  edits: EditEntry[];
  files: { name: string; size: number; blob: Blob }[];
  signatureResults: { entry: ProvenanceEntry; valid: boolean }[];
}

export async function parseCardFile(file: File): Promise<ImportedCard>
```

内部步骤：
1. JSZip 解压
2. 读取 manifest.json → 解析为 ManifestJSON
3. 读取 edits.json（如果有）
4. 读取 signature.json → 逐条验证签名
5. 枚举 artifacts/ 下所有文件 → 返回 name + size + Blob
6. 校验：manifest.files 和 artifacts/ 实际文件是否一致（缺失文件标出）

### 文件 7：`src/features/export.ts`

**复用策略**：从旧 `features/export/index.ts` 提取 `buildCardPackage` 和 `scanContent`。去掉 OPFS 写入，去掉 AES 加密（Lite 版加密只对 artifacts/ 做，且只在用户勾选时做）。

```ts
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

// 扫描隐私风险（纯文本匹配，不需外部依赖）
export async function scanContent(files: File[]): Promise<ScanResult>

// 打包为 .card Blob
export async function buildCardPackage(opts: PackOptions): Promise<Blob>

// 触发浏览器下载
export function downloadBlob(blob: Blob, filename: string): void
```

`buildCardPackage` 内部步骤：
1. 生成 manifest.json（从 summary 提取 + 自动补充 provenance + 计算文件哈希）
2. 如果有 identity，生成 edits.json 初始条目 + signature.json
3. 创建 JSZip：
   - 根：manifest.json, signature.json, edits.json, README.md（自动生成）
   - 根：summary.json, trail.jsonl（如果有）
   - artifacts/：所有素材文件（如果加密则 AES-GCM 加密后放入）
4. 返回 ZIP blob

README.md 自动生成模板见 `.card格式规范-v2.md` 五章 5.2 节。

### 文件 8：`src/features/snapshot.ts`

**复用策略**：几乎不动。从旧 `features/snapshot.ts` 提取 `generateSnapshot` 和 `canSnapshot`。

```ts
export function canSnapshot(file: File): boolean
export async function generateSnapshot(file: File): Promise<string | null> // 返回 data URL 或 null
```

用法：预览卡中的文件列表项用小缩略图（32px）展示。只有图片能生成缩略图，文本/CSV 用字面量缩略无法在 32px 内看清——回退为图标。

### 文件 9：`src/ui/DropInput.tsx`

**组件接口**：
```tsx
interface DropInputProps {
  onSummaryParsed: (summary: SummaryJSON) => void;
  onTrailParsed: (trail: TrailEntry[]) => void;
  onFilesAdded: (files: File[]) => void;
  onCardFile: (file: File) => void;
}
```

**视觉规格**（参照 `视觉-A-smelt-lite.md` 第五章）：
- 默认：200px 高，2px dashed 边框 `--border-dashed`，圆角 18px
- 内部内容：上传图标（Lucide `Upload`，40px，`--text-muted`）+ 文案（16px/500）+ 分隔线 "或" + 文件选择按钮（36px 高，1px solid border）
- 拖入悬停：边框变 `--accent`，背景变 `--accent-soft`，图标变蓝，150ms ease-out
- 拖入非法文件：边框变 `--error`，背景 `#FEF2F2`，200ms shake 动画

**交互行为**：
1. 用户拖入 `.json` 文件 → 读取内容 → 尝试解析为 SummaryJSON。成功 → `onSummaryParsed`。失败 → 尝试解析为 TrailEntry[]。成功 → `onTrailParsed`
2. 用户拖入 `.card` 文件 → `onCardFile`
3. 用户拖入其他文件 → `onFilesAdded`
4. 用户粘贴 JSON 文本（Ctrl+V 在输入区焦点上）→ 同逻辑 1
5. 用户点击"选择文件"按钮 → 打开文件选择器，accept=".json,.card,.jsonl,*"

**已输入状态**：
- 收起为 48px 状态条：✅ + 文件名 + 右侧「重新输入」「×」按钮（12px/`--text-secondary`）
- 点击「重新输入」回到默认状态
- 下方 16px 开始出现预览卡

**解析错误状态**：
- 红色错误卡片（参照视觉稿 9.2 节）
- 显示具体错误信息（缺少哪个字段）

### 文件 10：`src/ui/PreviewCard.tsx`

**组件接口**：
```tsx
interface PreviewCardProps {
  summary: SummaryJSON;
  files: File[];
  onRemoveFile: (index: number) => void;
  onPack: () => void;
  onFilesAdded: (files: File[]) => void;
}
```

**视觉规格**（参照视觉稿第六章）：

从上到下布局，flex column，内部间距 20px：

1. **标题区**：标题 20px/600 + 状态标签（12px/500，蓝色药丸形，圆角 999px）+ 打包按钮（36px 高，`--primary` 背景白色文字，右侧对齐）。标题和标签同行。打包按钮在同一行的最右。

2. **描述**：14px/400/`--text-secondary`，最多 3 行。超出用 CSS `mask-image: linear-gradient(to bottom, black 60%, transparent)` 淡出。如果没有描述，不显示此行。

3. **元信息网格**：2 列 grid，gap 16px。每格：标签 12px/`--text-muted` + 值 14px/500/`--text`。内容：「定义者」/「AI 模型」、「已完成」/「当前」。值的来源：
   - 左列上：`summary.human.name` / `summary.human.role`
   - 右列上：`summary.ai.model` / `summary.ai.role`
   - 左列下：`summary.done`（如果没有则不显示）
   - 右列下：`summary.current`

4. **进度区**：标题「进度」14px/600。进度条 6px 高，背景 `--border`，蓝色已完成部分 `--primary`，圆角 999px。下方文字「已完成：...」「当前：...」。完成比例粗略计算：`done` 和 `next` 的条目比例。

5. **下一步**：标题 14px/600。有序列表，每项左侧 6px 蓝色圆点，文字 14px，行高 26px。

6. **转折点**：标题「转折（N 次）」14px/600。仅当 `summary.branches` 存在且非空时显示。每个转折一张小卡片（背景 `--bg`，边框 1px `--border`，圆角 10px，内边距 12px 16px）：编号 14px/600/`--primary` + what 14px/500 + why 13px/`--text-secondary`。

7. **文件清单**：标题「文件清单（N）」14px/600 + 右侧「拖入追加」按钮（次按钮样式 36px）。列表容器背景 `--bg`，圆角 10px，内边距 4px。每项 44px 高，左侧文件图标 16px，文件名 14px，角色描述 13px/`--text-secondary`，右侧 `×` 删除按钮（hover 变红）。空状态：居中 13px/`--text-muted`「拖入文件追加到清单」。

**交互**：
- 文件清单区接受拖入 → `onFilesAdded`
- 每个文件项右侧 `×` → `onRemoveFile(index)`
- 打包按钮 → `onPack`

### 文件 11：`src/ui/PackPanel.tsx`

**组件接口**：
```tsx
interface PackPanelProps {
  summary: SummaryJSON;
  files: File[];
  identity: IdentityKey | null;
  onBack: () => void;
}
```

**视觉规格**（参照视觉稿第七章）：

出现方式：替换预览卡位置，带 `fadeIn` 动画（200ms）。顶部标题「打包确认」16px/600 + ← 返回按钮。

内容从上到下：

1. **摘要卡片**：背景 `--accent-soft`，边框 1px `#BFDBFE`（硬编码，不在全局变量里），圆角 10px，内边距 16px。标签「自动摘要」12px/`--accent`。内容：`summary.title` + `summary.description` 前 100 字 + `summary.created` 时间。如果没有 description，只显示 title。

2. **签名身份**：标题「签名身份」14px/600。身份卡：背景 `--bg`，圆角 10px，内边距 12px 16px。显示 `summary.human.name` + 指纹（`identity.fingerprint` 前 8 字符）。右侧「切换」按钮 13px/`--accent`。点击展开身份管理（生成新密钥/导入/导出）。

3. **选项**：复选框列表。
   - ☑ 签名（默认选中）。标签 14px/`--text`。
   - ☐ 加密（默认不选）。勾选后下方出现密码输入框（36px 高，1px `--border`，圆角 6px）。密码框缩进 28px。

4. **隐私扫描**：调用 `scanContent(files)` → 显示结果。
   - 干净：✅ 绿色「未检测到风险」
   - 有风险：⚠️ 黄色警告卡片，列出每条风险的文件名 + 类型

5. **下载按钮**：100% 宽度，44px 高，`--primary` 背景，白色文字 15px/600，左侧下载图标（Lucide `Download`，16px）。点击触发：

```
1. 如果勾选签名 + identity 非空：签名
2. 如果勾选加密 + 密码非空：加密 artifacts
3. buildCardPackage() → Blob
4. downloadBlob()
5. 按钮变为 "✅ 已下载" 2 秒后恢复
```

**状态管理**：
- `useState`：`encryptChecked: boolean`, `password: string`, `downloaded: boolean`

### 文件 12：`src/ui/ImportView.tsx`

**组件接口**：
```tsx
interface ImportViewProps {
  imported: ImportedCard; // 来自 features/import.ts 的返回类型
  onClose: () => void;
}
```

**视觉规格**（参照视觉稿第八章）：

出现方式：替换输入区和预览卡，独占主体。带 `fadeIn` 动画 200ms。

布局，flex column，间距 24px：

1. **摘要区**：标题 20px/600 + 状态标签（同预览卡）+ 协作信息 13px/`--text-secondary`（"{human.name} 与 {ai.model} 协作 · {created}"）+ 描述 14px（最多 3 行）

2. **来源链**：标题「来源链」14px/600。垂直时间线：每个 provenance 条目一个圆点 10px/`--primary` + 竖线 2px/`--border` + 名字 14px/600 + 动作 13px/`--text-secondary` + 时间 12px/`--text-muted`。最底部：链完整性标签（✅ 绿色药丸 or ⚠️ 红色药丸）。

3. **当前进度**：标题 14px/600。列表，每项用 emoji 图标 + 文字。已完成（✅ + `--success`），进行中（🔄 + `--accent`），待办（⏳ + `--text-muted`）。数据来自 `manifest.next`，根据是否有 `edits` 推测进度。

4. **转折**（如果 summary.json 中的 branches 被包含在文件列表中）：同预览卡转折显示，但只读。

5. **文件列表**：标题右侧「下载全部」次按钮。列表项 48px 高：文件图标 + 文件名 14px + 大小 13px/`--text-secondary` + 右侧下载图标 16px/`--accent`。点击下载图标 → 下载单个文件 Blob。点击「下载全部」→ 打包 artifacts 为 zip 下载。

6. **签名验证**：14px/500。有效：✅ 绿色「所有签名有效（N/N）」。断裂：⚠️ 黄色「第 N 条签名无法验证：签名链断裂」。

### 文件 13：`src/App.tsx`

顶层状态管理。**不渲染 Canvas、不初始化 OPFS、不创建 AI 连接。**

```tsx
export default function App() {
  // 状态（参照 types.ts 的 AppState）
  const [view, setView] = useState<AppView>("input");
  const [summary, setSummary] = useState<SummaryJSON | null>(null);
  const [trail, setTrail] = useState<TrailEntry[] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [imported, setImported] = useState<ImportedCard | null>(null);
  const [identity, setIdentity] = useState<IdentityKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 初始化：加载已有密钥
  useEffect(() => { setIdentity(loadIdentity()); }, []);

  // 回调函数（传给子组件）：
  // handleSummaryParsed → setSummary, setView("preview"), setError(null)
  // handleTrailParsed → setTrail
  // handleFilesAdded → setFiles(prev => [...prev, ...newFiles])
  // handleRemoveFile → setFiles(prev => prev.filter((_,i) => i !== idx))
  // handleCardFile → parseCardFile → setImported, setView("import")
  // handlePack → setView("pack")
  // handleBack → setView("preview")
  // handleCloseImport → setView("input"), setImported(null)

  return (
    <>
      <Header identity={identity} onIdentityChange={setIdentity} />
      <main style={mainStyle}>
        {view === "import" && imported ? (
          <ImportView imported={imported} onClose={handleCloseImport} />
        ) : (
          <>
            <DropInput
              onSummaryParsed={handleSummaryParsed}
              onTrailParsed={handleTrailParsed}
              onFilesAdded={handleFilesAdded}
              onCardFile={handleCardFile}
            />
            {view === "preview" && summary && (
              <PreviewCard
                summary={summary}
                files={files}
                onRemoveFile={handleRemoveFile}
                onPack={handlePack}
                onFilesAdded={handleFilesAdded}
              />
            )}
            {view === "pack" && summary && (
              <PackPanel
                summary={summary}
                files={files}
                identity={identity}
                onBack={handleBack}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 640, margin: "0 auto", padding: "32px 0 80px",
};
```

**Header 组件内嵌在 App.tsx 中**（简化，不单独建文件）：

参照视觉稿第四章顶栏规范：
- 56px 高，`fixed top:0`，背景 `--surface`，下边框 1px `--border`，z-index 50
- 内部 max-width 640px，居中，flex justify-between align-center
- 左侧：Lucide `Diamond` 图标 16px/`--primary` + "Smelt Lite" 文字 18px/600，间距 8px
- 右侧：身份按钮 "{human.name} · {指纹前 8 位}"，13px/500/`--text-secondary`，右侧 `▼` 8px
- 点击身份按钮 → 浮层（参照视觉稿 4.3 节）：当前身份信息 +「生成新密钥」「导入密钥」「导出备份」三个操作

---

## 四、全局行为

### 4.1 响应式

参照视觉稿 3.2 节。`>= 680px` 主体 640px 居中。`480px~679px` 主体 `calc(100% - 32px)`。`< 480px` 全宽，卡片圆角保持不变。

### 4.2 无障碍

- 所有可交互元素 focus 状态：`outline: 2px solid var(--accent)`，`outline-offset: 2px`
- 按钮最小点击区域：36px × 36px
- 文本对比度 ≥ 4.5:1
- 状态不用颜色作为唯一通道（同时有图标 + 文字）

### 4.3 通用交互

所有过渡 `transition: all 150ms ease-out`。按钮悬停背景变深。按下 `transform: scale(0.98)`（100ms）。禁用状态 `opacity: 0.5; cursor: not-allowed`。

---

## 五、数据流图（供工程师理解整体）

```
用户拖入 summary.json
    ↓
DropInput.onSummaryParsed
    ↓
App.handleSummaryParsed → setSummary → setView("preview")
    ↓
PreviewCard 渲染预览
    ↓
用户拖入素材文件 → DropInput.onFilesAdded → App.handleFilesAdded → files 数组更新
    ↓
用户点「打包」
    ↓
App.handlePack → setView("pack")
    ↓
PackPanel 渲染打包确认
    ↓
用户点「下载 .card」
    ↓
buildCardPackage({summary, trail, files, identity, encrypt, password})
    ↓
downloadBlob(blob, "filename.card")

---

用户拖入 .card
    ↓
DropInput.onCardFile
    ↓
App.handleCardFile → parseCardFile(file) → setImported → setView("import")
    ↓
ImportView 渲染导入详情
```

---

## 六、验收清单

工程师实现完成后，角色 B 逐条验收：

- [ ] `npx tsc --noEmit` 零错误
- [ ] `npm run dev` 正常启动
- [ ] 拖入合法 summary.json → 预览卡正确展示所有字段
- [ ] 拖入缺失必填字段的 JSON → 红色错误卡片显示具体错误
- [ ] 拖入 .card 文件 → 导入视图展示摘要/来源链/文件/签名
- [ ] 拖入素材文件 → 文件清单追加，可逐个删除
- [ ] 打包 → 下载 .card → 改名为 .zip 解压 → 内部结构正确
- [ ] 签名开启 + 有密钥 → signature.json 有有效签名
- [ ] 签名关闭 → 不生成签名
- [ ] 加密开启 + 输入密码 → artifacts/ 被加密
- [ ] 隐私扫描 → 检测到 API Key/邮箱/手机号时正常告警
- [ ] 密钥生成/导入/导出均可正常使用
- [ ] 响应式：桌面/平板/手机均可正常使用
- [ ] 中英文根据浏览器语言自动切换
- [ ] 按钮/accent 边框/文件项 hover 过渡平滑无闪烁
- [ ] 导入视图：签名链完整显示 ✅，签名断裂显示 ⚠️
- [ ] 拖入非 JSON 文件不会崩溃
- [ ] 主体 CSS 变量全部可用，无硬编码颜色（除 `#BFDBFE` / `#FEF2F2` / `#FFFBEB` 三个语义色）

---

> 角色 C：按本文档逐文件实现。不接受自由发挥。完成后通知角色 B 验收。
