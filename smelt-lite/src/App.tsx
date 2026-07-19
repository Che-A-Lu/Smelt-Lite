import { useState, useEffect, useRef } from 'react';
import { Diamond, ChevronDown, Shield, Key } from 'lucide-react';
import type { AppView, SummaryJSON, TrailEntry, IdentityKey } from './foundation/types';
import { t, setLang, getLang } from './foundation/i18n';
import { loadIdentity, saveIdentity, generateKeyPair, importIdentityKey, exportIdentityKey } from './features/identity';
import { parseCardFile, type ImportedCard } from './features/import';
import DropInput from './ui/DropInput';
import PreviewCard from './ui/PreviewCard';
import PackPanel from './ui/PackPanel';
import ImportView from './ui/ImportView';

// === 提示词常量 ===

const SCENE_A_START_PROMPT = `在接下来的协作中，请你在后台维护一份协作记录。不需要输出，不需要回复。需要记忆的内容取决于对话类型——如果是讨论决策型，记住方向变更和关键决策；如果是工程执行型，记住每一步做了什么和结果；如果是问答咨询型，记住问题和答案。协作结束时我会让你输出结构化 JSON。在此之前不要输出。`;

const SCENE_A_START_DISPLAY = `在接下来的协作中，请你在后台维护一份协作记录。不需要输出，不需要回复。需要记忆的内容取决于对话类型——如果是讨论决策型，记住方向变更和关键决策；如果是工程执行型，记住每一步做了什么和结果；如果是问答咨询型，记住问题和答案。协作结束时我会让你输出结构化 JSON。在此之前不要输出。`;
const SCENE_A_END_DISPLAY = `步骤 0：判断对话类型
决策记录 → 输出 summary.json + trail.jsonl
工作日志 → 输出 summary.json + worklog.jsonl
速记 → 仅输出 summary.json
输出方式：支持生成文件则直接创建；网页版 AI 用代码块输出。
summary.json（所有类型必输出）
{
  "format": "card-v1",
  "title": "项目名称",
  "description": "一句话摘要",
  "created": "2026-07-19T10:30:00Z",
  "human": { "name": "名", "role": "角色定位" },
  "ai": { "model": "模型名", "role": "角色定位" },
  "status": "当前阶段",
  "done": "已完成事项，一句话",
  "current": "正在做什么",
  "blocked": null,
  "next": ["下一步1", "下一步2"],
  "branches": [],
  "decisions": [],
  "files": []
}
branches: {id, what, why, who_decided}。decisions: {id, what, why, by}。files: {name, role}。
不确定的地方不要编造。
trail.jsonl（仅决策记录）
{"id":"s1","type":"branch|decision|progress|block|file","summary":"一句话","context":[{"role":"human|ai","text":"触发变更的关键原话"}],"before":"变更前","after":"变更后","confidence":"high|medium|low","collab_ids":[1]}
context 最多 3 条消息，每条 ≤150 字。是原话，不是摘要。只放触发变更的关键句。
worklog.jsonl（仅工作日志）
{"step":1,"action":"搭建 Vite + React 项目骨架","result":"成功，npm run dev 正常","files":["package.json"],"note":""}
{"step":2,"action":"实现 DropInput 组件","result":"拖入解析正常","files":["DropInput.tsx"],"note":""}
只记有产出的步骤。中间调试不记。通常 5-15 条。
现在请输出。`;
const SCENE_B_DISPLAY = `步骤 0：判断对话类型
决策记录 → summary.json + trail.jsonl
工作日志 → summary.json + worklog.jsonl
速记 → 仅 summary.json
步骤 1：扫描状态变更
决策记录型找：方向变更、关键决策、进度推进、被阻塞、产出文件。
工作日志型找：有明确产出的步骤，跳过中间调试。
维持性对话不标。
步骤 2：提取关键原文（仅决策记录）
找到触发变更的那句话。1-3 条消息，每条 ≤150 字。是原话。
步骤 3：输出（网页版 AI 用代码块）
summary.json（所有类型必输出）
{
  "format": "card-v1",
  "title": "项目名",
  "description": "一句话",
  "created": "2026-07-19T10:30:00Z",
  "human": { "name": "名", "role": "角色" },
  "ai": { "model": "模型名", "role": "角色" },
  "status": "当前阶段",
  "done": "已完成",
  "current": "正在做",
  "blocked": null,
  "next": ["下一步1", "下一步2"],
  "branches": [],
  "decisions": [],
  "files": []
}
branches: {id, what, why, who_decided}。decisions: {id, what, why, by}。files: {name, role}。
trail.jsonl（仅决策记录）
{"id":"s1","type":"branch|decision|progress|block|file","summary":"一句话","context":[{"role":"human|ai","text":"触发变更的关键原话"}],"before":"变更前","after":"变更后","confidence":"high|medium|low","collab_ids":[1]}
context 最多 3 条，每条 ≤150 字。只记状态变更点。
worklog.jsonl（仅工作日志）
{"step":1,"action":"搭建 Vite + React 项目骨架","result":"成功，npm run dev 正常","files":["package.json"],"note":""}
{"step":2,"action":"实现 DropInput 组件","result":"拖入解析正常","files":["DropInput.tsx"],"note":""}
只记有产出的步骤。通常 5-15 条。
不确定的标记 confidence: "low"。不要编造。
现在请输出。`;

const SCENE_A_END_PROMPT = `## 输出协作记录

### 步骤 0：判断对话类型

先判断这次对话属于哪种类型：
- **决策记录**：有方向讨论、方案对比、关键决策、转折。输出 summary.json + trail.jsonl
- **工作日志**：执行性任务为主（写代码、调试、搭环境、处理文件）。输出 summary.json + worklog.jsonl
- **速记**：问答咨询、概念解释、推荐建议。仅输出 summary.json

### 输出方式

支持生成文件：直接创建对应文件。
网页版 AI：用代码块输出（\`\`\`json、\`\`\`jsonl）。用户手动保存。

---

### 所有类型必输出：summary.json

\`\`\`jsonc
{
  "format": "card-v1",
  "title": "项目名称",
  "description": "一句话摘要",
  "created": "2026-07-19T10:30:00Z",
  "human": { "name": "名", "role": "角色定位" },
  "ai": { "model": "模型名", "role": "角色定位" },
  "status": "当前阶段（自由文本）",
  "done": "已完成事项，一句话",
  "current": "正在做什么",
  "blocked": null,
  "next": ["下一步1", "下一步2"],
  "branches": [],
  "decisions": [],
  "files": []
}
\`\`\`

**字段说明**：title/description/human/ai/status/current/next 必填。done/blocked 推荐。branches 每项 {id, what, why, who_decided}。decisions 每项 {id, what, why, by}。files 每项 {name, role}。

---

### 决策记录追加：trail.jsonl

每行一条状态变更。**不是对话记录——只记录状态变更点。** 维持性对话（追问、解释、确认细节）不进入。

\`\`\`jsonc
{"id":"s1","type":"branch|decision|progress|block|file","summary":"一句话","context":[{"role":"human|ai","text":"触发变更的关键原话"}],"before":"变更前","after":"变更后","confidence":"high|medium|low","collab_ids":[1]}
\`\`\`

**约束**：context 最多 3 条消息，每条 ≤150 字。是原话，不是摘要。只放触发变更的关键句。不确定时保留并标 confidence: "low"。

---

### 工作日志追加：worklog.jsonl

每行一个工作步骤。记录动作、结果、产出的文件。不记录调试过程、报错排查细节。

\`\`\`jsonc
{"step":1,"action":"搭建 Vite + React 项目骨架","result":"成功，npm run dev 正常","files":["package.json","vite.config.ts"],"note":""}
\`\`\`

**字段**：step（递增）、action（做了什么）、result（结果）、files（产出的文件）、note（可选，注意事项/遇到但绕过的问题）。
**约束**：只记录有产出或状态推进的步骤。中间调试、试错、小修不记录。通常 5-15 条。

现在请输出。`;

const SCENE_B_PROMPT = `## 从对话历史提取协作记录（补救模式）

### 步骤 0：判断对话类型

先判断这次对话属于哪种：
- **决策记录**：有方向讨论、方案对比、转折。输出 summary.json + trail.jsonl
- **工作日志**：执行性任务为主。输出 summary.json + worklog.jsonl
- **速记**：问答咨询。仅输出 summary.json

### 步骤 1：扫描状态变更

**如果对话 ≤100 轮**：通读全文，标出所有状态变更点。
**如果对话 >100 轮**：不要逐轮重读。基于你全程的记忆回忆最重要的变更点（通常 5-15 个），再从对话里定位到原文验证。

判断标准按对话类型有所不同：

**决策记录**——寻找：
- 方向变更（"换方向""试试这个角度""不对"）
- 关键决策（明确说了"用 X""选 X""定 X"）
- 进度推进（"XX 做完了""下一步"）
- 被阻塞（"需要你确认""等你回来"）
- 产出文件

**工作日志**——寻找：
- 有明确产出的步骤（建了文件、跑通了功能、修了 bug）
- 跳过中间调试、试错、报错排查

维持性对话（追问、解释、确认格式）不标。

### 步骤 2：提取关键原文（仅决策记录需要）

对每个变更点，找到触发它的那句话。1-3 条消息。每条 ≤150 字。是原话，不是摘要。

### 步骤 3：输出

支持生成文件：直接创建文件。
网页版 AI：用代码块输出（\`\`\`json、\`\`\`jsonl）。

#### summary.json（所有类型必输出）

\`\`\`jsonc
{
  "format": "card-v1",
  "title": "项目名",
  "description": "一句话",
  "created": "2026-07-19T10:30:00Z",
  "human": { "name": "名", "role": "角色" },
  "ai": { "model": "模型名", "role": "角色" },
  "status": "当前阶段",
  "done": "已完成",
  "current": "正在做",
  "blocked": null,
  "next": ["下一步1", "下一步2"],
  "branches": [],
  "decisions": [],
  "files": []
}
\`\`\`

branches 每项：{id, what, why, who_decided}。decisions 每项：{id, what, why, by}。files 每项：{name, role}。

#### trail.jsonl（仅决策记录）

\`\`\`jsonc
{"id":"s1","type":"branch|decision|progress|block|file","summary":"一句话","context":[{"role":"human|ai","text":"触发变更的关键原话"}],"before":"变更前","after":"变更后","confidence":"high|medium|low","collab_ids":[1]}
\`\`\`

约束同上：context 最多 3 条，每条 ≤150 字。只记录状态变更。

#### worklog.jsonl（仅工作日志）

\`\`\`jsonc
{"step":1,"action":"做了什么","result":"结果","files":["产出文件"],"note":"可选备注"}
\`\`\`

只记录有产出的步骤。中间调试不记。通常 5-15 条。

### 重要约束

- **不要编造。** 不确定的字段标记 confidence: "low"
- 不确定对话类型时，默认为决策记录
- branches/decisions 的 id 从 1 递增，trail 的 id 从 "s1" 递增，worklog 的 step 从 1 递增

现在请输出。`;

// === English prompts ===

const SCENE_A_START_PROMPT_EN = `In this collaboration, maintain a collaboration record in the background. No output needed, no reply needed. What to remember depends on the conversation type: for discussion/decision type, track direction changes and key decisions; for engineering/execution type, track each step and result; for Q&A type, track questions and answers. At the end of the collaboration, I will ask you to output structured JSON. Do not output before then.`;

const SCENE_A_END_PROMPT_EN = `## Output Collaboration Record

### Step 0: Determine conversation type

First determine which type this conversation falls into:
- **Decision record**: has direction discussions, option comparisons, key decisions, turning points. Output summary.json + trail.jsonl
- **Work log**: primarily execution tasks (coding, debugging, setting up environments, processing files). Output summary.json + worklog.jsonl
- **Quick note**: Q&A, concept explanations, recommendations. Output summary.json only

### Output method

If you can generate files: create the files directly.
If web-based AI: output using code blocks (\`\`\`json, \`\`\`jsonl). User will save manually.

---

### All types must output: summary.json

\`\`\`jsonc
{
  "format": "card-v1",
  "title": "Project name",
  "description": "One sentence summary",
  "created": "2026-07-19T10:30:00Z",
  "human": { "name": "Name", "role": "Role description" },
  "ai": { "model": "Model name", "role": "Role description" },
  "status": "Current stage (free text)",
  "done": "What's been completed, one sentence",
  "current": "What you're working on",
  "blocked": null,
  "next": ["Next step 1", "Next step 2"],
  "branches": [],
  "decisions": [],
  "files": []
}
\`\`\`

**Field notes**: title/description/human/ai/status/current/next are required. done/blocked recommended. branches items: {id, what, why, who_decided}. decisions items: {id, what, why, by}. files items: {name, role}.

---

### Decision record: trail.jsonl

One state change per line. **Not a conversation log — only record state change points.** Maintenance dialogue (follow-up questions, explanations, confirming details) should not be included.

\`\`\`jsonc
{"id":"s1","type":"branch|decision|progress|block|file","summary":"one sentence","context":[{"role":"human|ai","text":"the key original words that triggered this change"}],"before":"before change","after":"after change","confidence":"high|medium|low","collab_ids":[1]}
\`\`\`

**Constraints**: context max 3 messages, each ≤150 chars. Use original words, not summaries. Only include the key sentence that triggered the change. If unsure, keep and mark confidence: "low".

---

### Work log: worklog.jsonl

One work step per line. Record action, result, and produced files. Do not record debugging process or error resolution details.

\`\`\`jsonc
{"step":1,"action":"Set up Vite + React project skeleton","result":"Success, npm run dev works","files":["package.json","vite.config.ts"],"note":""}
\`\`\`

**Fields**: step (incrementing), action (what was done), result (outcome), files (produced files), note (optional, notes/edge cases encountered).
**Constraints**: only record steps with tangible output or state progress. Intermediate debugging, trial-and-error, minor fixes not recorded. Typically 5-15 entries.

Now please output.`;

const SCENE_B_PROMPT_EN = `## Extract collaboration record from conversation history (Recovery mode)

### Step 0: Determine conversation type

First determine which type:
- **Decision record**: has direction discussions, option comparisons, turning points. Output summary.json + trail.jsonl
- **Work log**: primarily execution tasks. Output summary.json + worklog.jsonl
- **Quick note**: Q&A. Output summary.json only

### Step 1: Scan for state changes

**Decision record** — look for:
- Direction changes ("change direction", "try this angle", "that's wrong")
- Key decisions (explicitly said "use X", "choose X", "decide X")
- Progress milestones ("X is done", "next step")
- Blocked ("need your confirmation", "waiting for you")
- Produced files

**Work log** — look for:
- Steps with tangible output (created files, got features working, fixed bugs)
- Skip intermediate debugging, trial-and-error, error resolution

Maintenance dialogue (follow-up questions, explanations, confirming format) should not be marked.

### Step 2: Extract key original text (Decision record only)

For each change point, find the sentence that triggered it. 1-3 messages. Each ≤150 chars. Use original words, not summaries.

### Step 3: Output

If you can generate files: create files directly.
If web-based AI: output using code blocks (\`\`\`json, \`\`\`jsonl).

#### summary.json (all types required)

\`\`\`jsonc
{
  "format": "card-v1",
  "title": "Project name",
  "description": "One sentence",
  "created": "2026-07-19T10:30:00Z",
  "human": { "name": "Name", "role": "Role" },
  "ai": { "model": "Model name", "role": "Role" },
  "status": "Current stage",
  "done": "Completed",
  "current": "Working on",
  "blocked": null,
  "next": ["Step 1", "Step 2"],
  "branches": [],
  "decisions": [],
  "files": []
}
\`\`\`

branches items: {id, what, why, who_decided}. decisions items: {id, what, why, by}. files items: {name, role}.

#### trail.jsonl (Decision record only)

\`\`\`jsonc
{"id":"s1","type":"branch|decision|progress|block|file","summary":"one sentence","context":[{"role":"human|ai","text":"key original words triggering the change"}],"before":"before","after":"after","confidence":"high|medium|low","collab_ids":[1]}
\`\`\`

Constraints: context max 3 messages, each ≤150 chars. Only record state change points.

#### worklog.jsonl (Work log only)

\`\`\`jsonc
{"step":1,"action":"What was done","result":"Outcome","files":["produced file"],"note":"optional"}
\`\`\`

Only record steps with output. Typically 5-15 entries.

### Important constraints

- Do not fabricate. Mark uncertain fields confidence: "low".
- If unsure about conversation type, default to decision record.
- branches/decisions id starts from 1. trail id starts from "s1". worklog step starts from 1.

Now please output.`;

// === English display constants ===

const SCENE_A_START_DISPLAY_EN = SCENE_A_START_PROMPT_EN;

const SCENE_A_END_DISPLAY_EN = `Step 0: Determine conversation type
Decision record → output summary.json + trail.jsonl
Work log → output summary.json + worklog.jsonl
Quick note → output summary.json only
Output method: create files directly if supported; web-based AI use code blocks.
summary.json (all types required)
{
  "format": "card-v1",
  "title": "Project name",
  "description": "One sentence summary",
  "created": "2026-07-19T10:30:00Z",
  "human": { "name": "Name", "role": "Role description" },
  "ai": { "model": "Model name", "role": "Role description" },
  "status": "Current stage",
  "done": "What's been completed, one sentence",
  "current": "What you're working on",
  "blocked": null,
  "next": ["Next step 1", "Next step 2"],
  "branches": [],
  "decisions": [],
  "files": []
}
branches: {id, what, why, who_decided}. decisions: {id, what, why, by}. files: {name, role}.
Do not fabricate uncertain information.
trail.jsonl (decision record only)
{"id":"s1","type":"branch|decision|progress|block|file","summary":"one sentence","context":[{"role":"human|ai","text":"key original words"}],"before":"before","after":"after","confidence":"high|medium|low","collab_ids":[1]}
context max 3 messages, each ≤150 chars. Original words, not summaries.
worklog.jsonl (work log only)
{"step":1,"action":"Set up Vite + React project skeleton","result":"Success, npm run dev works","files":["package.json"],"note":""}
{"step":2,"action":"Implement DropInput component","result":"Drag-and-drop parsing works","files":["DropInput.tsx"],"note":""}
Only record steps with output. Typically 5-15 entries.
Now please output.`;

const SCENE_B_DISPLAY_EN = `Step 0: Determine conversation type
Decision record → summary.json + trail.jsonl
Work log → summary.json + worklog.jsonl
Quick note → summary.json only
Step 1: Scan for state changes
Decision record: direction changes, key decisions, progress, blocks, files.
Work log: steps with tangible output. Skip debugging.
Maintenance dialogue: do not mark.
Step 2: Extract key original text (decision record only)
Find the triggering sentence. 1-3 messages, each ≤150 chars. Original words.
Step 3: Output (web-based AI use code blocks)
summary.json (all types required)
{
  "format": "card-v1",
  "title": "Project name",
  "description": "One sentence",
  "created": "2026-07-19T10:30:00Z",
  "human": { "name": "Name", "role": "Role" },
  "ai": { "model": "Model name", "role": "Role" },
  "status": "Current stage",
  "done": "Completed",
  "current": "Working on",
  "blocked": null,
  "next": ["Step 1", "Step 2"],
  "branches": [],
  "decisions": [],
  "files": []
}
branches: {id, what, why, who_decided}. decisions: {id, what, why, by}. files: {name, role}.
trail.jsonl (decision record only)
{"id":"s1","type":"branch|decision|progress|block|file","summary":"one sentence","context":[{"role":"human|ai","text":"key original words"}],"before":"before","after":"after","confidence":"high|medium|low","collab_ids":[1]}
context max 3, each ≤150 chars. Only state change points.
worklog.jsonl (work log only)
{"step":1,"action":"What was done","result":"Outcome","files":["file"],"note":""}
Only record steps with output. Typically 5-15 entries.
Mark uncertainty as confidence: "low". Do not fabricate.
Now please output.`;

// === App ===

export default function App() {
  const [view, setView] = useState<AppView>('input');
  const [summary, setSummary] = useState<SummaryJSON | null>(null);
  const [trail, setTrail] = useState<TrailEntry[] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [imported, setImported] = useState<ImportedCard | null>(null);
  const [identity, setIdentity] = useState<IdentityKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrompts, setShowPrompts] = useState(false);

  useEffect(() => { setIdentity(loadIdentity()); }, []);

  const handleReset = () => {
    setView('input');
    setSummary(null);
    setTrail(null);
    setFiles([]);
    setImported(null);
    setError(null);
  };

  const handleSummaryParsed = (s: SummaryJSON) => {
    setSummary(s);
    setView('preview');
    setError(null);
  };

  const handleTrailParsed = (t: TrailEntry[]) => setTrail(t);

  const handleFilesAdded = (newFiles: File[]) => setFiles(prev => [...prev, ...newFiles]);

  const handleRemoveFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleCardFile = async (file: File) => {
    try {
      const result = await parseCardFile(file);
      setImported(result);
      setView('import');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse .card');
    }
  };

  const handlePack = () => setView('pack');
  const handleBack = () => setView('preview');
  const handleCloseImport = () => { setView('input'); setImported(null); };

  return (
    <>
      <Header identity={identity} onIdentityChange={setIdentity} onReset={handleReset} />
      <main style={mainStyle}>
        {view === 'import' && imported ? (
          <ImportView imported={imported} onClose={handleCloseImport} />
        ) : (
          <>
            <DropInput
              onSummaryParsed={handleSummaryParsed}
              onTrailParsed={handleTrailParsed}
              onFilesAdded={handleFilesAdded}
              onCardFile={handleCardFile}
              onOpenPrompts={() => setShowPrompts(true)}
            />
            {error && (
              <div style={errorBarStyle}>{error}</div>
            )}
            {view === 'preview' && summary && (
              <PreviewCard
                summary={summary}
                files={files}
                onRemoveFile={handleRemoveFile}
                onPack={handlePack}
                onFilesAdded={handleFilesAdded}
              />
            )}
            {view === 'pack' && summary && (
              <PackPanel
                summary={summary}
                files={files}
                identity={identity}
                onBack={handleBack}
                onIdentityChange={setIdentity}
                onReset={handleReset}
              />
            )}
          </>
        )}
      </main>
      {showPrompts && <PromptModal onClose={() => setShowPrompts(false)} />}
    </>
  );
}

// -- Header 组件（内嵌） --

function Header({ identity, onIdentityChange, onReset }: {
  identity: IdentityKey | null;
  onIdentityChange: (key: IdentityKey) => void;
  onReset: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleGenerateKey = async () => {
    const key = await generateKeyPair();
    saveIdentity(key);
    onIdentityChange(key);
    setShowMenu(false);
  };

  const handleImportKey = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        try {
          const key = await importIdentityKey(file);
          saveIdentity(key);
          onIdentityChange(key);
          setShowMenu(false);
        } catch { /* ignore */ }
      }
    };
    input.click();
  };

  const handleExportKey = () => {
    if (identity) {
      exportIdentityKey(identity);
      setShowMenu(false);
    }
  };

  return (
    <header style={headerStyle}>
      <div style={headerInnerStyle}>
        <button onClick={onReset} style={logoBtnStyle}>
          <Diamond size={16} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>{t('title')}</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => {
            const next = getLang() === 'zh' ? 'en' : 'zh';
            setLang(next);
            window.location.reload();
          }} style={langBtnStyle}>
            {t('langToggle')}
          </button>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={identityBtnStyle}>
              <Shield size={14} style={{ color: 'var(--accent)' }} />
            {identity ? (
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                {identity.fingerprint.slice(0, 8)}
              </span>
            ) : (
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
                {t('noIdentity')}
              </span>
            )}
            <ChevronDown size={8} style={{ color: 'var(--text-muted)' }} />
          </button>
          {showMenu && (
            <div style={dropdownStyle}>
              {identity && (
                <div style={identityInfoStyle}>
                  <Key size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {identity.fingerprint}
                  </span>
                </div>
              )}
              <button onClick={handleGenerateKey} style={dropdownItemStyle}>
                <Key size={14} />
                {t('generateKey')}
              </button>
              <button onClick={handleImportKey} style={dropdownItemStyle}>
                {t('importKey')}
              </button>
              {identity && (
                <button onClick={handleExportKey} style={dropdownItemStyle}>
                  {t('exportKey')}
                </button>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </header>
  );
}

// -- 提示词浮层 --

function PromptModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...pmContainerStyle }} onClick={e => e.stopPropagation()}>
        <div style={pmHeaderStyle}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{t('promptTitle')}</span>
          <button onClick={onClose} style={{ fontSize: 20, color: 'var(--text-secondary)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '20px 20px 12px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('promptNotice')}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '20px' }}>{t('promptNoticeText')}</div>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PromptCard title={t('promptSceneA')} desc={t('promptSceneADesc')} display={getLang() === 'zh' ? SCENE_A_START_DISPLAY : SCENE_A_START_DISPLAY_EN} full={SCENE_A_START_PROMPT + '\n\n' + SCENE_A_END_PROMPT} fullEn={SCENE_A_START_PROMPT_EN + '\n\n' + SCENE_A_END_PROMPT_EN} />
          <PromptCard title={t('promptSceneB')} desc={t('promptSceneBDesc')} display={getLang() === 'zh' ? SCENE_B_DISPLAY : SCENE_B_DISPLAY_EN} full={SCENE_B_PROMPT} fullEn={SCENE_B_PROMPT_EN} />
        </div>
      </div>
    </div>
  );
}

function PromptCard({ title, desc, display, full, fullEn }: { title: string; desc: string; display: string; full: string; fullEn: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const text = getLang() === 'zh' ? full : fullEn;
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={promptCardStyle}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: '22px', marginBottom: 12 }}>{desc}</div>
      <div style={promptPreviewStyle}>{display}</div>
      <div style={{ textAlign: 'right', marginTop: 10 }}>
        <button onClick={handleCopy} style={primaryCopyBtnStyle}>{copied ? t('copied') : t('copy')}</button>
      </div>
    </div>
  );
}

// === Styles ===

const headerStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, height: 56,
  background: 'var(--surface)', borderBottom: '1px solid var(--border)',
  zIndex: 50, display: 'flex', alignItems: 'center',
};

const headerInnerStyle: React.CSSProperties = {
  maxWidth: 640, width: '100%', margin: '0 auto',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px',
};

const logoBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
  background: 'none', border: 'none', color: 'var(--text)',
  borderRadius: 'var(--radius-sm)', padding: '4px 8px',
};

const langBtnStyle: React.CSSProperties = {
  height: 32, padding: '0 10px', fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)', background: 'var(--bg)',
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
  cursor: 'pointer',
};

const identityBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg)',
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', right: 0, top: '100%', marginTop: 4,
  background: 'var(--surface)', borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-panel)', border: '1px solid var(--border)',
  padding: 6, minWidth: 180, zIndex: 60,
};

const identityInfoStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4,
};

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  textAlign: 'left', padding: '8px 10px', fontSize: 13,
  color: 'var(--text)', borderRadius: 'var(--radius-sm)',
};

const errorBarStyle: React.CSSProperties = {
  marginTop: 12, padding: '10px 16px', background: '#FEF2F2',
  border: '1px solid #FECACA', borderRadius: 'var(--radius-md)',
  fontSize: 13, color: 'var(--error)',
};

const mainStyle: React.CSSProperties = {
  maxWidth: 640, margin: '0 auto', padding: '72px 0 80px',
};

// Modal shared
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};

// Prompt modal
const pmContainerStyle: React.CSSProperties = {
  width: 520, maxWidth: 'calc(100% - 32px)', maxHeight: '75vh',
  background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-panel)', overflow: 'auto',
};

const pmHeaderStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  height: 52, padding: '0 20px', borderBottom: '1px solid var(--border)',
};

const promptCardStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', padding: 20,
};

const promptPreviewStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 14,
  fontSize: 14,
  color: 'var(--text-secondary)',
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  lineHeight: '22px',
  maxHeight: 180,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
};

const primaryCopyBtnStyle: React.CSSProperties = {
  height: 36, padding: '0 16px', background: 'var(--primary)',
  color: '#FFFFFF', borderRadius: 6, fontSize: 13,
  fontWeight: 600, cursor: 'pointer', border: 'none',
};
