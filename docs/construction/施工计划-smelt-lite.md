# Smelt Lite 施工计划

> 阿澈（角色 B），2026-07-19。
> 基于 `.card格式规范-v2.md` 和 `提示词.md`。
> 视觉方案由角色 A（Kimi 2.7）输出后合并。

---

## 零、这是什么

**一个静态网页 + 三段标准提示词。**

用户把提示词贴进任何 AI 工具 → AI 输出 summary.json + trail.jsonl → 拖进网页 → 预览 → 打包 → 下载 .card。收到 .card 的人拖进来 → 看到摘要、来源链、差异记录、文件清单、签名验证。

不需要安装、注册、服务器、AI 模型。三十秒。

## 一、Smelt Lite 做什么

### 功能清单

| # | 功能 | 说明 |
|---|---|---|
| 1 | **输入 summary.json** | 拖入或粘贴 → 解析 → 展示预览卡（标题、状态、角色、进度、下一步） |
| 2 | **输入 trail.jsonl**（可选） | 拖入或粘贴 → 追加到打包清单 |
| 3 | **输入素材文件**（可选） | 拖入 → 计算哈希 → 加入文件清单 |
| 4 | **打包为 .card** | 点打包 → 面板显示签名身份、加密选项、自动提取的摘要 → 下载 |
| 5 | **导入 .card** | 拖入 → 展示摘要 + 来源链 + 差异记录 + 文件列表 + 签名验证 |
| 6 | **密钥管理** | 自动生成 ECDSA P-256 / 导入自有密钥 / 导出备份 |
| 7 | **隐私扫描** | 打包前自动检测 API Key、邮箱、手机号 |

### 不做什么

- 不调 AI
- 不管理项目（一次一个 .card）
- 不持久化（关掉页面数据消失）
- 不做加密的密码管理（加密只在打包时让用户设密码，不解密）
- 不做联系人信任网络
- 不做画布/拖拽物理/卡座/工作台

## 二、页面结构（4 个区）

```
┌─────────────────────────────────────┐
│  Smelt Lite                         │  ← 固定顶栏（标题 + 密钥管理入口）
├─────────────────────────────────────┤
│                                     │
│   ┌─ 输入区 ────────────────────┐   │
│   │                             │   │
│   │   拖入 summary.json          │   │
│   │   或粘贴 JSON 文本           │   │
│   │                             │   │
│   └─────────────────────────────┘   │
│                                     │
│   ┌─ 预览卡 ────────────────────┐   │
│   │  标题 + 状态 + 描述          │   │
│   │  角色 + 进度 + 下一步         │   │
│   │  文件清单（可追加/移除）       │   │
│   │  [打包为 .card]              │   │
│   └─────────────────────────────┘   │
│                                     │
│   打包面板（点打包后弹出，覆盖预览卡）│
│   ┌─ 打包面板 ──────────────────┐   │
│   │  签名身份：Dalu (a1b2..)     │   │
│   │  自动摘要 + 时间              │   │
│   │  [x] 签名  [ ] 加密（密码）   │   │
│   │  [下载 .card]                │   │
│   └─────────────────────────────┘   │
│                                     │
│   导入视图（拖入 .card 后替换全部）   │
│   ┌─ 导入视图 ──────────────────┐   │
│   │  摘要 + 状态                 │   │
│   │  来源链（时间线）             │   │
│   │  差异记录（每次改了什么）      │   │
│   │  文件列表（可下载单个）        │   │
│   │  签名验证状态                 │   │
│   └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**4 个 UI 组件：** 输入区。预览卡。打包面板。导入视图。

没有卡片列表。没有勾选。没有右键菜单。没有 Header 语言切换（浏览器自动检测中文/英文，网页跟着走）。

## 三、数据流

### 流 A：打包

```
用户拖入 summary.json
    ↓
解析 → 提取 title/description/status/human/ai/next/files
    ↓
渲染预览卡
    ↓
用户拖入素材文件（可选）
    ↓
追加到文件清单，显示文件名 + 大小
    ↓
用户可选拖入 trail.jsonl
    ↓
追加到文件清单
    ↓
用户点「打包为 .card」
    ↓
打包面板替换预览卡
    ├── 签名身份：当前密钥指纹（可切换/导入）
    ├── 加密：可选，设密码
    └── 摘要：自动从 summary.json 提取
    ↓
用户点「下载 .card」
    ↓
浏览器组装 .card：
    manifest.json（自动生成）
    + summary.json（用户提供）
    + trail.jsonl（如果有）
    + artifacts/（素材文件）
    + edits.json（初始创建条目）
    + signature.json（ECDSA 签名）
    + README.md（自动生成）
    ↓
打包为 ZIP → 下载
```

### 流 B：导入

```
用户拖入 .card
    ↓
解包 → 读取 manifest.json
    ↓
渲染导入视图：
    ├── 摘要区：manifest.summary → 标题/状态/描述/下一步
    ├── 来源链：manifest.provenance → 时间线（谁→谁→谁）
    ├── 差异记录：edits.json → 每次改动（新增/修改/删除/未动）
    ├── 文件列表：每个文件的名字/类型/哈希 → 可下载单个
    └── 签名验证：signature.json → 每条签名 ✅/⚠️
```

### 流 C：重新打包（接手的人修改后）

```
用户在导入视图 → 下载某个文件 → 在外部修改
    ↓
拖回网页 + 新的 summary.json
    ↓
打包 → edits.json 自动追加新条目：
    who + when + changes（added/modified/removed/unchanged）
    + hash_before + hash_after
    ↓
signature.json 自动追加新签名（链式）
    ↓
下载新的 .card
```

## 四、代码架构

```
smelt-lite/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx              ← React 入口
│   ├── App.tsx               ← 状态管理：当前视图（输入/导入）
│   ├── foundation/
│   │   ├── types.ts          ← .card v2 类型 + 常量
│   │   └── i18n.ts           ← 中英双语（精简 ~30 key）
│   ├── features/
│   │   ├── import.ts         ← parseCardFile：解包 .card
│   │   ├── export.ts         ← buildCardPackage + downloadBlob + scanContent
│   │   ├── identity.ts       ← ECDSA 密钥生成/签名/验签 + 导入/导出密钥
│   │   └── snapshot.ts       ← 文件缩略图（图片/文本/CSV）
│   ├── ui/
│   │   ├── DropInput.tsx     ← 输入区：拖入/粘贴 summary.json + 素材
│   │   ├── PreviewCard.tsx   ← 预览卡：解析后的摘要展示 + 文件清单
│   │   ├── PackPanel.tsx     ← 打包面板：签名身份/加密/下载按钮
│   │   └── ImportView.tsx    ← 导入视图：摘要+来源链+差异+文件+签名验证
│   └── styles.css            ← 全部样式
```

## 五、从旧 Smelt 复用

| 旧文件 | 复用度 | 改动 |
|---|---|---|
| `features/import/index.ts` | 85% | 去掉 zip bomb Web Worker，同步解析 |
| `features/export/index.ts` | 85% | 去掉 AES 加密（Lite 版加密在打包时可选，简化为只加密 artifacts） |
| `features/identity/index.ts` | 90% | 保留 `exportIdentityKey` / `importIdentityKey`，去掉 OPFS 依赖 |
| `features/snapshot.ts` | 95% | 几乎不动 |
| `features/ai/` | 0% | 不用 |
| `features/mode/` | 0% | 不用 |
| `features/templates/` | 0% | 不用 |
| `features/tool-registry.ts` | 0% | 不用 |
| `features/sandbox/` | 0% | 不用 |
| `platform/storage.ts` | 0% | 不用 OPFS |
| `platform/settings.ts` | 0% | 不用 API Key |
| `foundation/types.ts` | 20% | 重写，只留 .card v2 相关 |
| `foundation/i18n.ts` | 30% | 砍掉 70% key |
| 全部 `ui/` | 0% | 全部重写 |

## 六、角色分工

```
角色 A：视觉设计师（Kimi 2.7）
  输入：本施工计划 + Dalu 的视觉期望
  输出：视觉设计稿（px/颜色/间距/布局/动画/UI 技术选型）
  文件：视觉-A-smelt-lite.md

角色 B：分析策划师（阿澈）
  输入：Dalu 的需求确认 + 角色 A 的视觉设计稿
  输出：精确功能施工指令（合并视觉 + 功能 + 数据流 + 验收清单）
  文件：施工-B-smelt-lite.md

角色 C：工程师
  输入：施工-B-smelt-lite.md
  输出：smelt-lite/src/ 下的代码，npx tsc --noEmit 零错误
```

## 七、施工顺序

| 步骤 | 内容 | 依赖 |
|---|---|---|
| 1 | 角色 A 输出视觉设计稿 | Dalu 确认需求 |
| 2 | 角色 B 合并视觉+功能 → 功能施工指令 | 步骤 1 |
| 3 | 角色 C 搭建项目骨架（vite + React + package.json） | 步骤 2 |
| 4 | 角色 C 实现 foundation/（types + i18n） | 步骤 3 |
| 5 | 角色 C 实现 features/（import + export + identity + snapshot） | 步骤 4 |
| 6 | 角色 C 实现 ui/（DropInput + PreviewCard） | 步骤 2 + 5 |
| 7 | 角色 C 实现 ui/（PackPanel + ImportView） | 步骤 6 |
| 8 | 角色 B 逐条验收 + 提交到 GitHub | 步骤 7 |
| 9 | 部署到 GitHub Pages | 步骤 8 |

---

> **当前状态：格式规范 v2 ✅ / 提示词 ✅ / 施工计划 ✅。下一步：Dalu 把施工计划 + 格式规范 v2 发给角色 A（Kimi 2.7），出视觉设计稿。**
