# 施工-B：Smelt Lite 输入区 v3

> 角色 B（阿澈），2026-07-19。
> 合并《施工计划-输入区v3》和《视觉-A-smelt-lite-输入区v3》。
> 角色 C 按本文档逐文件实现。

---

## 零、改动范围

| # | 文件 | 改动 |
|---|---|---|
| 1 | `DropInput.tsx` | 重构：三标签切换 + 三个内容区 + 模板浮层 + 提示词入口 |
| 2 | `App.tsx` | 新增提示词浮层（内嵌） |
| 3 | `i18n.ts` | 新增 18 个 key（zh+en） |
| 4 | `styles.css` | 无需改动（全部使用现有 CSS 变量） |

---

## 一、i18n.ts 新增 key

在 `zh` 对象末尾追加：

```ts
// 三标签
tabDrop: "拖入文件",
tabForm: "手填表单",
tabPaste: "粘贴代码",
// 手填表单
formTitle: "标题",
formDesc: "描述",
formStatus: "当前阶段",
formCurrent: "正在做",
formNext: "下一步（一行一个）",
formRequired: "请填写标题",
formSubmit: "生成预览",
costZero: "✨ 零 token 消耗",
// 粘贴代码
pastePlaceholder: "粘贴 AI 输出的 JSON 代码块……",
pasteError: "未识别到有效 JSON。请检查是否包含 \"format\": \"card-v1\"。",
viewTemplate: "查看模板",
parseSubmit: "解析并生成预览",
costHigh: "⚠️ 此方式需 AI 提取对话历史。对话越长，token 消耗越大。",
// 模板浮层
templateTitle: "summary.json 模板",
copy: "复制",
copied: "✅ 已复制",
// 提示词
promptEntry: "不知道怎么生成？复制提示词 →",
promptTitle: ".card 标准提示词",
promptNotice: "使用须知",
promptNoticeText: "恢复模式会重读全部对话。对话越长，token 消耗越大。推荐在对话开头就装提示词。",
promptSceneA: "场景 A：对话前安装（推荐）",
promptSceneADesc: "在对话开始时粘贴以下提示词，AI 全程维护协作记录。结尾输出 JSON。",
promptSceneB: "场景 B：对话后提取（高 Token）",
promptSceneBDesc: "如果已经聊完了。可选极简（仅摘要）或完整（含过程记录）。",
```

在 `en` 对象对应追加英文字段，不再逐个列出——工程师自行翻译。

新增的函数需要支持 `t(key, replacements)` 参数化（如果当前 `t()` 不支持，先升级 i18n.ts 的 `t` 函数）。

---

## 二、DropInput.tsx 重构

### 2.1 组件结构

```tsx
export default function DropInput({ onSummaryParsed, onTrailParsed, onFilesAdded, onCardFile }: DropInputProps) {
  const [activeTab, setActiveTab] = useState<'drop' | 'form' | 'paste'>('drop');
  // -- 拖入区状态（保持现有逻辑） --
  const [dragOver, setDragOver] = useState(false);
  const [hasSummary, setHasSummary] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  // -- 表单状态 --
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const [formCurrent, setFormCurrent] = useState('');
  const [formNext, setFormNext] = useState('');
  const [formError, setFormError] = useState('');
  // -- 粘贴区状态 --
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  // -- 浮层 --
  const [showTemplate, setShowTemplate] = useState(false);
  const [templateCopied, setTemplateCopied] = useState(false);

  // ... handlers ...
}
```

### 2.2 渲染结构

```tsx
<div style={containerStyle}>
  {/* 标签行 */}
  <div style={tabRowStyle}>
    {tabs.map(tab => (
      <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tab.id === activeTab ? activeTabStyle : tabStyle}>
        {tab.label}
      </button>
    ))}
  </div>

  {/* 内容区 */}
  <div style={contentStyle}>
    {activeTab === 'drop' && <DropContent ... />}
    {activeTab === 'form' && <FormContent ... />}
    {activeTab === 'paste' && <PasteContent ... />}
  </div>

  {/* 提示词入口 */}
  <div style={promptRowStyle}>
    <button onClick={onOpenPrompts} style={promptLinkStyle}>
      {t('promptEntry')}
    </button>
  </div>

  {/* 模板浮层 */}
  {showTemplate && <TemplateModal onClose={...} />}
</div>
```

新增 prop：`onOpenPrompts: () => void`——点击提示词入口时调用 App 层的回调，打开提示词浮层。

### 2.3 标签行样式

```ts
const containerStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
};

const tabRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  height: 48,
  padding: '0 20px',
  borderBottom: '1px solid var(--border)',
};

const tabStyle: React.CSSProperties = {
  height: '100%',
  padding: '0 12px',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  color: 'var(--text)',
  borderBottomColor: 'var(--accent)',
};
```

### 2.4 内容区容器

```ts
const contentStyle: React.CSSProperties = {
  minHeight: 200,
  padding: 24,
};
```

切换动画：给每个内容区根 div 加 `className="animate-in"`（现有全局动画），切换标签时 React 重建 DOM 自然触发 fadeIn。

### 2.5 标签一：DropContent（现有拖放逻辑移入）

将当前 DropInput 中 `hasSummary ? 已输入状态 : 拖放区` 的逻辑完整封装为 `DropContent` 内部组件（同一文件内，不需要单独文件）。样式和交互保持不变。已有的 `dragOver`、`hasSummary`、`fileName`、`error` 状态移到 DropInput 顶层，通过 props 传入。

### 2.6 标签二：FormContent

```tsx
function FormContent({ title, desc, status, current, next, error, onChange, onSubmit }: FormContentProps) {
  return (
    <div>
      {/* 右上角标注 */}
      <div style={{ textAlign: 'right', marginBottom: 16 }}>
        <Sparkles size={12} style={{ color: 'var(--success)' }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--success)', marginLeft: 4 }}>{t('costZero')}</span>
      </div>

      {/* 标题（必填） */}
      <FormField label="标题 *" value={title} onChange={...} placeholder="这次协作的项目名称" error={error} required />

      {/* 描述 */}
      <FormField label="描述" value={desc} onChange={...} placeholder="一句话描述这次协作在做什么" multiline minHeight={60} />

      {/* 当前阶段 */}
      <FormField label="当前阶段" value={status} onChange={...} placeholder="如：方案讨论中 / 已确定 / 已发布" />

      {/* 正在做 */}
      <FormField label="正在做" value={current} onChange={...} placeholder="当前卡在哪里、正在做什么" />

      {/* 下一步 */}
      <FormField label="下一步（一行一个）" value={next} onChange={...} placeholder={"弱工具变量检验\n过度识别检验\n2SLS 回归"} multiline minHeight={80} />

      {/* 按钮 */}
      <div style={{ textAlign: 'right', marginTop: 12 }}>
        <button onClick={onSubmit} disabled={!title.trim()} style={primaryBtnStyle}>{t('formSubmit')}</button>
      </div>
    </div>
  );
}
```

**FormField 辅助组件**（同一文件内）：

```tsx
function FormField({ label, value, onChange, placeholder, error, required, multiline, minHeight }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  error?: string; required?: boolean; multiline?: boolean; minHeight?: number;
}) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: 'var(--error)', fontSize: 12, marginLeft: 2 }}> *</span>}
      </div>
      <Tag
        type={multiline ? undefined : 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...inputStyle,
          minHeight: multiline ? (minHeight ?? 60) : 36,
          height: multiline ? 'auto' : 36,
          padding: multiline ? '10px 12px' : '0 12px',
          borderColor: error ? 'var(--error)' : 'var(--border)',
          resize: multiline ? 'vertical' : 'none',
        }}
      />
      {error && <div style={{ fontSize: 12, color: 'var(--error)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid',
  borderRadius: 6,
  fontSize: 14,
  color: 'var(--text)',
  outline: 'none',
  transition: 'border-color 150ms',
  fontFamily: 'inherit',
};
```

**onSubmit 逻辑**：检查 title 非空 → 组装 SummaryJSON：

```ts
const summary: SummaryJSON = {
  format: 'card-v1',
  title: formTitle.trim(),
  description: formDesc.trim() || '(未填写)',
  created: new Date().toISOString(),
  human: { name: '', role: '' },
  ai: { model: '', role: '' },
  status: formStatus.trim() || '(未填写)',
  done: '',
  current: formCurrent.trim() || '(未填写)',
  blocked: null,
  next: formNext.trim() ? formNext.split('\n').filter(Boolean) : [],
  branches: [],
  decisions: [],
  files: [],
};
onSummaryParsed(summary);
```

标题为空时不提交，给标题输入框加 `formError` 并触发 shake 动画（`className="animate-shake"`）。

### 2.7 标签三：PasteContent

```tsx
function PasteContent({ text, onChange, error, onSubmit, onViewTemplate }: PasteContentProps) {
  return (
    <div>
      <textarea
        value={text}
        onChange={e => onChange(e.target.value)}
        placeholder={t('pastePlaceholder')}
        style={pasteTextareaStyle}
      />

      {error && (
        <div style={pasteErrorStyle}>
          <AlertTriangle size={16} style={{ color: 'var(--error)', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={onViewTemplate} style={secondaryBtnStyle}>{t('viewTemplate')}</button>
        <button onClick={onSubmit} style={primaryBtnStyle}>{t('parseSubmit')}</button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertTriangle size={12} />
        {t('costHigh')}
      </div>
    </div>
  );
}

const pasteTextareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 140,
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: 12,
  fontSize: 13,
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  color: 'var(--text)',
  outline: 'none',
  resize: 'vertical',
};
```

**onSubmit 解析逻辑**（模糊匹配）：

1. 从文本中提取所有 JSON 代码块（` ```json ... ``` `）和裸 JSON 对象
2. 尝试 `JSON.parse` 每个候选
3. 找到 `format: "card-v1"` 且含 `title` 的对象 → 作为 summary.json → 调用 `onSummaryParsed`
4. 如果同时找到 JSONL 数组（每行是 JSON），检查是否含 `id` + `type` 字段 → trail.jsonl；含 `step` + `action` 字段 → worklog.jsonl → 调用 `onTrailParsed`
5. 一个都没找到 → `setPasteError(t('pasteError'))`

### 2.8 模板浮层（TemplateModal）

```tsx
function TemplateModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const template = JSON.stringify({
    format: 'card-v1',
    title: '项目名称',
    description: '一句话描述',
    created: new Date().toISOString(),
    human: { name: '你的名字', role: '你的角色' },
    ai: { model: 'AI 模型名', role: 'AI 的角色' },
    status: '当前阶段',
    done: '已完成事项',
    current: '正在做什么',
    blocked: null,
    next: ['下一步1', '下一步2'],
    branches: [{ id: 1, what: '从A→B', why: '原因', who_decided: '谁' }],
    decisions: [{ id: 1, what: '决策', why: '理由', by: '谁' }],
    files: [{ name: '文件名', role: '作用' }],
  }, null, 2);

  const handleCopy = () => { navigator.clipboard.writeText(template); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalContainerStyle} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{t('templateTitle')}</span>
          <button onClick={onClose} style={{ fontSize: 20, color: 'var(--text-secondary)' }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          <pre style={codeBlockStyle}>{template}</pre>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <button onClick={handleCopy} style={secondaryBtnStyle}>
              {copied ? t('copied') : t('copy')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

浮层样式：

```ts
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, animation: 'fadeIn 150ms ease-out',
};

const modalContainerStyle: React.CSSProperties = {
  width: 480, maxWidth: 'calc(100% - 32px)', maxHeight: '70vh',
  background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-panel)', overflow: 'auto',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  height: 52, padding: '0 20px', borderBottom: '1px solid var(--border)',
};

const codeBlockStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', padding: 16,
  fontSize: 13, fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
};
```

---

## 三、App.tsx 改动

### 3.1 新增状态

```ts
const [showPrompts, setShowPrompts] = useState(false);
```

### 3.2 DropInput 传 prop

```tsx
<DropInput
  onSummaryParsed={handleSummaryParsed}
  onTrailParsed={handleTrailParsed}
  onFilesAdded={handleFilesAdded}
  onCardFile={handleCardFile}
  onOpenPrompts={() => setShowPrompts(true)}
/>
```

### 3.3 提示词浮层（内嵌组件 PromptModal）

在 App.tsx 底部定义 `PromptModal` 组件，与 Header 同级。

浮层结构（参照视觉稿第九章）：
- 宽度 520px，max-height 75vh，居中
- 背景遮罩 `rgba(0,0,0,0.35)`，点击遮罩关闭
- 标题行 52px："提示词" + `×` 关闭
- 使用须知区：标题 + 说明文字
- 场景 A 卡片：背景 `--bg`，标题 + 描述 + 提示词预览（12px 等宽，4 行截断）+ 复制按钮
- 场景 B 卡片：同上

```tsx
function PromptModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalContainerStyle, width: 520 }} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{t('promptTitle')}</span>
          <button onClick={onClose} style={{ fontSize: 20, color: 'var(--text-secondary)' }}>×</button>
        </div>

        <div style={{ padding: '20px 20px 12px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('promptNotice')}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '20px' }}>{t('promptNoticeText')}</div>
        </div>

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PromptCard title={t('promptSceneA')} desc={t('promptSceneADesc')} preview={SCENE_A_START_PROMPT} full={SCENE_A_START_PROMPT + '\n\n' + SCENE_A_END_PROMPT} />
          <PromptCard title={t('promptSceneB')} desc={t('promptSceneBDesc')} preview={SCENE_B_PROMPT} full={SCENE_B_PROMPT} />
        </div>
      </div>
    </div>
  );
}

function PromptCard({ title, desc, preview, full }: { title: string; desc: string; preview: string; full: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={promptCardStyle}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{desc}</div>
      <div style={promptPreviewStyle}>{preview.slice(0, 300)}{preview.length > 300 ? '...' : ''}</div>
      <div style={{ textAlign: 'right', marginTop: 8 }}>
        <button onClick={handleCopy} style={secondaryBtnStyle}>{copied ? t('copied') : t('copy')}</button>
      </div>
    </div>
  );
}

const promptCardStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', padding: 16,
};

const promptPreviewStyle: React.CSSProperties = {
  fontSize: 12, fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  color: 'var(--text-muted)', whiteSpace: 'pre-wrap',
  maxHeight: 72, overflow: 'hidden',
};
```

**提示词字符串常量**：

在 App.tsx 文件顶部定义三个常量（从 `提示词.md` 复制完整内容）：

```ts
const SCENE_A_START_PROMPT = `在接下来的协作中，请你在后台维护一份协作记录。不需要输出，不需要回复。需要记忆的内容取决于对话类型——如果是讨论决策型，记住方向变更和关键决策；如果是工程执行型，记住每一步做了什么和结果；如果是问答咨询型，记住问题和答案。协作结束时我会让你输出结构化 JSON。在此之前不要输出。`;

const SCENE_A_END_PROMPT = `（从提示词.md 场景 A-2 复制完整内容，约 500 字）`;

const SCENE_B_PROMPT = `（从提示词.md 场景 B-完整 复制完整内容，约 600 字）`;
```

### 3.4 渲染

```tsx
// App 组件 return 末尾
{showPrompts && <PromptModal onClose={() => setShowPrompts(false)} />}
```

---

## 四、组件交互验证

| 操作 | 预期 |
|---|---|
| 切换到「手填表单」标签 | 看到 5 个字段 + 零 token 标注 + 生成预览按钮 |
| 标题为空点生成预览 | 标题框边框变红 + shake + "请填写标题" |
| 填完标题点生成预览 | `onSummaryParsed` 触发 → 进入预览卡 |
| 切换到「粘贴代码」标签 | 看到 textarea + 双按钮 + 警告标注 |
| 粘贴不含 card-v1 的文本点解析 | 红色错误提示 |
| 粘贴合法 summary JSON 点解析 | `onSummaryParsed` 触发 |
| 粘贴 summary + trail JSON 点解析 | 两个回调分别触发 |
| 点查看模板 | 浮层显示格式完整的 summary.json 模板 |
| 点模板浮层复制 | 按钮变"✅ 已复制"，2 秒恢复 |
| 点输入区底部提示词链接 | 提示词浮层出现 |
| 提示词浮层点复制 | 对应场景的完整提示词复制到剪贴板 |
| 点浮层遮罩或 × | 浮层关闭 |

---

## 五、验收清单

- [ ] `npx tsc --noEmit` 零错误
- [ ] `npm run dev` 正常启动
- [ ] 三标签切换正常，内容区切换有淡入动画
- [ ] 拖入文件标签保持原有功能（拖入/粘贴/选择 .json / .card）
- [ ] 手填表单：标题为空不能提交
- [ ] 手填表单：生成预览进入 PreviewCard
- [ ] 粘贴代码：合法 JSON 正确解析
- [ ] 粘贴代码：非法输入提示错误
- [ ] 粘贴代码：同时有 summary + trail 自动拆分
- [ ] 模板浮层：打开/复制/关闭
- [ ] 提示词浮层：两个场景卡片 + 复制功能
- [ ] 浮层关闭（遮罩点击 + × 按钮）
- [ ] 全部新增文案中英文切换正常
- [ ] 输入区外框有 `--shadow-card` 和 `--radius-lg`

---

> 角色 C：按本文档逐文件实现。不接受自由发挥。
