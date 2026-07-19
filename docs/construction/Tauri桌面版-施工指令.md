# Smelt Tauri 桌面版 · 施工指令

## 目标

做一个 Tauri 桌面应用。自动监控 Codex / Claude Code 的 session 文件 → 对话解析为卡片 → Smelt 空间里编辑 → 打包 .card → 双击 .card 自动打开。

---

## 第一步：搭建 Tauri 壳 + 搬前端

### 1.1 创建 Tauri 项目

在 `smelt-github` 旁新建 `smelt-tauri/`：

```bash
npm create tauri-app@latest smelt-tauri
# 选：React + TypeScript + Vite
cd smelt-tauri
npm install
```

### 1.2 搬现有前端代码

把 `.card概念/app/src/` 全部复制到 `smelt-tauri/src/` 下。目录结构：

```
smelt-tauri/src/
├── foundation/     ← 原样搬
├── platform/       ← 原样搬
├── features/       ← 原样搬
├── ui/             ← 原样搬
├── App.tsx         ← 原样搬（稍后改）
├── main.tsx        ← 粘到 Tauri 的 main.tsx
└── styles.css      ← 原样搬
```

### 1.3 适配入口

`main.tsx` 改为：

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 1.4 跑通

```bash
cd smelt-tauri
npm install
# 装 Rust 工具链（如果没装）：
# curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# rustup target add x86_64-pc-windows-msvc
npm run tauri dev
```

验收：Smelt 空间在原生窗口里打开，和浏览器版行为一致。

---

## 第二步：标准消息格式

### 2.1 定义 `foundation/session.ts`

```typescript
// 标准消息格式——所有 AI 工具的输出都转译成这个
export interface StandardMessage {
  role: "user" | "assistant" | "system" | "tool_call" | "tool_result";
  content: string;
  thinking?: string;
  toolName?: string;         // tool_call 时：工具名
  toolArgs?: Record<string, unknown>;  // tool_call 时：参数
  toolResult?: string;       // tool_result 时：返回值
  timestamp: number;
}

// Session 摘要——在画布上显示为会话卡片
export interface SessionSummary {
  id: string;
  source: "codex" | "claude" | "cursor" | "unknown";
  fileName: string;
  filePath: string;
  messageCount: number;
  toolCallCount: number;
  detectedAt: number;         // 捕获时间
  startedAt: number;          // 会话开始时间
}
```

---

## 第三步：Rust 文件监控

### 3.1 `src-tauri/Cargo.toml` 加依赖

```toml
[dependencies]
notify = "6"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### 3.2 `src-tauri/src/monitor.rs`

```rust
use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::path::{Path, PathBuf};
use std::sync::mpsc;

pub struct SessionWatcher {
    watcher: Box<dyn Watcher>,
    rx: mpsc::Receiver<Event>,
}

impl SessionWatcher {
    pub fn new(dirs: Vec<PathBuf>) -> Result<Self, String> {
        let (tx, rx) = mpsc::channel();
        let mut watcher = notify::recommended_watcher(move |res| {
            if let Ok(event) = res { tx.send(event).ok(); }
        }).map_err(|e| e.to_string())?;
        
        for dir in &dirs {
            if dir.exists() {
                watcher.watch(dir, RecursiveMode::NonRecursive)
                    .map_err(|e| e.to_string())?;
            }
        }
        
        Ok(SessionWatcher { watcher: Box::new(watcher), rx })
    }
    
    // 阻塞等待下一个新建的 .jsonl 文件
    pub fn wait_for_new_session(&self) -> Option<PathBuf> {
        loop {
            match self.rx.recv() {
                Ok(event) => {
                    if matches!(event.kind, EventKind::Create(_)) {
                        for path in event.paths {
                            if path.extension()?.to_str()? == "jsonl" {
                                return Some(path);
                            }
                        }
                    }
                }
                Err(_) => return None,
            }
        }
    }
}
```

### 3.3 `src-tauri/src/parser.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StandardMessage {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub thinking: String,
    #[serde(default)]
    pub tool_name: Option<String>,
    #[serde(default)]
    pub tool_args: Option<serde_json::Value>,
    #[serde(default)]
    pub tool_result: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct SessionSummary {
    pub id: String,
    pub source: String,
    pub file_name: String,
    pub file_path: String,
    pub message_count: usize,
    pub tool_call_count: usize,
    pub detected_at: u64,
    pub started_at: u64,
}

pub fn parse_codex_session(path: &Path, content: &str) -> (Vec<StandardMessage>, SessionSummary) {
    let messages: Vec<StandardMessage> = content
        .lines()
        .filter_map(|line| {
            let json: serde_json::Value = serde_json::from_str(line).ok()?;
            Some(StandardMessage {
                role: json["role"].as_str()?.to_string(),
                content: json["content"].as_str().unwrap_or("").to_string(),
                thinking: json["thinking"].as_str().unwrap_or("").to_string(),
                tool_name: json["tool_name"].as_str().map(String::from),
                tool_args: json["tool_args"].clone(),
                tool_result: json["tool_result"].as_str().map(String::from),
                timestamp: json["timestamp"].as_u64().unwrap_or(0),
            })
        })
        .collect();
    
    let tool_call_count = messages.iter().filter(|m| m.role == "tool_call").count();
    let summary = SessionSummary {
        id: uuid_v4(),
        source: "codex".to_string(),
        file_name: path.file_name().unwrap().to_string_lossy().into(),
        file_path: path.to_string_lossy().into(),
        message_count: messages.len(),
        tool_call_count,
        detected_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64,
        started_at: messages.first().map(|m| m.timestamp).unwrap_or(0),
    };
    
    (messages, summary)
}
```

### 3.4 `src-tauri/src/commands.rs`

```rust
use tauri::State;
use std::sync::Mutex;
use crate::parser::{StandardMessage, SessionSummary};

pub struct AppState {
    pub sessions: Vec<(SessionSummary, Vec<StandardMessage>)>,
}

impl AppState {
    pub fn new() -> Self { AppState { sessions: vec![] } }
}

// Tauri Command: 获取所有已捕获的会话列表
#[tauri::command]
pub fn get_sessions(state: State<Mutex<AppState>>) -> Vec<SessionSummary> {
    let state = state.lock().unwrap();
    state.sessions.iter().map(|(s, _)| s.clone()).collect()
}

// Tauri Command: 获取某个会话的完整消息
#[tauri::command]
pub fn get_session_messages(session_id: String, state: State<Mutex<AppState>>) -> Option<Vec<StandardMessage>> {
    let state = state.lock().unwrap();
    state.sessions.iter()
        .find(|(s, _)| s.id == session_id)
        .map(|(_, m)| m.clone())
}

// Tauri Command: 把 .card 写入磁盘
#[tauri::command]
pub fn save_card(blob_base64: String, file_path: String) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&blob_base64).map_err(|e| e.to_string())?;
    std::fs::write(&file_path, bytes).map_err(|e| e.to_string())
}

// Tauri Command: 手动打开一个 session 文件
#[tauri::command]
pub fn open_session_file(file_path: String, state: State<Mutex<AppState>>) -> Result<SessionSummary, String> {
    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let path = std::path::Path::new(&file_path);
    let (messages, summary) = crate::parser::parse_codex_session(path, &content);
    let summary_clone = summary.clone();
    let mut state = state.lock().unwrap();
    state.sessions.push((summary, messages));
    Ok(summary_clone)
}
```

### 3.5 `src-tauri/src/main.rs`

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod monitor;
mod parser;
mod commands;

use commands::AppState;
use std::sync::Mutex;
use std::path::PathBuf;

fn main() {
    let app_state = Mutex::new(AppState::new());
    
    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::get_sessions,
            commands::get_session_messages,
            commands::save_card,
            commands::open_session_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 第四步：前端会话卡片

### 4.1 新增 `ui/session/SessionCard.tsx`

会话摘要卡片——在画布上显示一次 AI 会话：

```typescript
interface SessionCardProps {
  session: SessionSummary;
  onClick: () => void;  // 点击 → 打开 ExportPanel
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  const timeAgo = Math.floor((Date.now() - session.detectedAt) / 1000);
  const timeStr = timeAgo < 60 ? `${timeAgo}秒前`
    : timeAgo < 3600 ? `${Math.floor(timeAgo / 60)}分钟前`
    : `${Math.floor(timeAgo / 3600)}小时前`;

  return (
    <div onClick={onClick}
      style={{
        position: "absolute", left: 0, top: 0,
        width: CARD_W, height: CARD_H,
        background: "#fff", border: "1px solid #e5e7eb",
        borderRadius: 6, cursor: "pointer",
        /* ... 同 CardView 样式 */
      }}
    >
      <div>{session.source.toUpperCase()} 会话</div>
      <div>{timeStr}</div>
      <div>{session.messageCount} 条消息</div>
      <div>{session.toolCallCount} 个工具调用</div>
    </div>
  );
}
```

### 4.2 修改 `App.tsx`

初始化时调 `invoke("get_sessions")` 加载已有会话。Rust 侧检测到新 session → 通过 Tauri event 推给前端。

```typescript
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// 启动时加载
useEffect(() => {
  invoke<SessionSummary[]>("get_sessions").then(setSessions);
  
  // 监听新会话
  listen<SessionSummary>("new-session", (event) => {
    setSessions((prev) => [...prev, event.payload]);
  });
}, []);
```

---

## 第五步：SessionExportPanel 改造

### 5.1 改 `ExportPanel.tsx`

加一个 `messages` prop —— 当它是外部传入时，读取 messages 而不是当前 Workbench 状态：

```typescript
interface ExportPanelProps {
  cardIds?: Set<string>;              // 旧：打包画布卡片
  messages?: StandardMessage[];       // 新：打包外部会话
  onClose: () => void;
}
```

消息清单渲染分两列：
- 左：勾选框 + 消息来源颜色条
- 右：消息预览（首行截断 60 字）+ 批注输入框 + 隐藏切换 + 隐藏原因

**批注和隐藏的存储：**

```typescript
interface MessageEdit {
  msgIndex: number;
  checked: boolean;
  hidden: boolean;
  hideReason: string;
  annotation: string;
}
```

导出时写入 `edits.json`：

```json
{
  "annotations": {
    "msg-3": "这里读了销售表",
    "msg-5": "华东区已验证"
  },
  "hidden": {
    "msg-4": { "reason": "后来放弃了", "originalLength": 45 },
    "msg-6": { "reason": "内部项目代号", "originalLength": 23 }
  }
}
```

**附加文件：**

`<input type="file" multiple>` → 读取 → 存进 `extraFiles[]` → 打包时写入 .card 的 `content/`。

**工具文件关联：**

消息列表里识别出所有 tool_call 消息 → 提取工具名 → 在附加文件区上方显示：

```
此会话用到了这些工具：
· cleanup.py — 未找到本地文件  [+ 添加]
· data_formatter.py — 未找到本地文件  [+ 添加]
```

点 `[+ 添加]` → 系统文件选择器 → 添加到附件。

---

## 第六步：.card 文件关联

### 6.1 `src-tauri/tauri.conf.json` 加文件关联

```json
{
  "bundle": {
    "active": true,
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"],
    "fileAssociations": [
      {
        "ext": "card",
        "name": "Smelt Card",
        "description": "Smelt .card File",
        "role": "Viewer"
      }
    ]
  }
}
```

### 6.2 监听文件打开事件

```rust
// main.rs 中
.use_default_fc() // enable file association handling
```

前端：

```typescript
import { getCurrent } from "@tauri-apps/api/window";
// 如果 App 是用一个文件路径启动的，读取路径 → 打开 ImportDialog
```

---

## 第七步：施工顺序总结

| 步骤 | 内容 | 文件 | 验收 |
|------|------|------|------|
| 1 | 建 Tauri 壳 + 搬前端 | 全项目 | `npm run tauri dev` 打开原生窗口 |
| 2 | 标准消息格式 | `foundation/session.ts` | TypeScript 类型定义完成 |
| 3 | Rust 文件监控 + 解析 | `monitor.rs`、`parser.rs`、`commands.rs`、`main.rs` | `npx tauri dev` → 监控生效 |
| 4 | 前端会话卡片 | `SessionCard.tsx` + `App.tsx` | 新会话自动出现在画布上 |
| 5 | ExportPanel 改造 | `ExportPanel.tsx` | 消息勾选、隐藏、批注、附加文件 |
| 6 | 文件关联 | `tauri.conf.json` + main.rs | 双击 .card → Smelt 打开 |

## 第八步：验收总览

1. Smelt 桌面应用启动，原生窗口，系统托盘常驻
2. 用户在终端跑 Codex → Smelt 自动检测 → 画布上出现会话卡片
3. 点击会话卡片 → ExportPanel 打开 → 消息清单、勾选、隐藏批注、工具文件
4. 打包 → .card 保存到桌面
5. 双击 .card → Smelt 打开 → ImportDialog → 四步验证 → 卡片出现
