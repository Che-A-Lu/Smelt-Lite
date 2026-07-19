import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { Upload, FileText, AlertCircle, Sparkles, AlertTriangle } from 'lucide-react';
import type { SummaryJSON, TrailEntry } from '../foundation/types';
import { t, getLang } from '../foundation/i18n';

interface DropInputProps {
  onSummaryParsed: (summary: SummaryJSON) => void;
  onTrailParsed: (trail: TrailEntry[]) => void;
  onFilesAdded: (files: File[]) => void;
  onCardFile: (file: File) => void;
  onOpenPrompts: () => void;
}

const tabs = [
  { id: 'drop' as const, labelKey: 'tabDrop' },
  { id: 'form' as const, labelKey: 'tabForm' },
  { id: 'paste' as const, labelKey: 'tabPaste' },
];

export default function DropInput({ onSummaryParsed, onTrailParsed, onFilesAdded, onCardFile, onOpenPrompts }: DropInputProps) {
  const [activeTab, setActiveTab] = useState<'drop' | 'form' | 'paste'>('drop');
  // -- 拖入区状态 --
  const [dragOver, setDragOver] = useState(false);
  const [hasSummary, setHasSummary] = useState(false);
  const [fileName, setFileName] = useState('');
  const [dropError, setDropError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  // -- 模板浮层 --
  const [showTemplate, setShowTemplate] = useState(false);

  // === 拖入区逻辑 ===
  const processFile = useCallback(async (file: File) => {
    setDropError(null);
    if (file.name.endsWith('.card')) {
      onCardFile(file);
      return;
    }
    if (file.name.endsWith('.json') || file.name.endsWith('.jsonl')) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data && typeof data === 'object') {
          if (data.format === 'card-v1' && data.title && data.human) {
            onSummaryParsed(data as SummaryJSON);
            setHasSummary(true);
            setFileName(file.name);
            return;
          }
          if (Array.isArray(data) && data.length > 0 && data[0].type && data[0].id) {
            onTrailParsed(data as TrailEntry[]);
            setFileName(file.name);
            return;
          }
        }
        setDropError(t('errorMissingField'));
      } catch {
        setDropError(t('errorParse'));
      }
    } else {
      onFilesAdded([file]);
    }
  }, [onSummaryParsed, onTrailParsed, onCardFile, onFilesAdded]);

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e: DragEvent) => { e.preventDefault(); setDragOver(false); };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const items = Array.from(e.dataTransfer.files);
    for (const file of items) processFile(file);
  };
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const items = Array.from(e.target.files ?? []);
    for (const file of items) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    try {
      const data = JSON.parse(text);
      if (data && typeof data === 'object') {
        if (data.format === 'card-v1' && data.title && data.human) {
          e.preventDefault();
          onSummaryParsed(data as SummaryJSON);
          setHasSummary(true);
          setFileName('pasted-json');
          return;
        }
        if (Array.isArray(data) && data.length > 0 && data[0].type && data[0].id) {
          e.preventDefault();
          onTrailParsed(data as TrailEntry[]);
          setFileName('pasted-trail');
          return;
        }
      }
    } catch { /* not JSON */ }
  };

  // === 表单逻辑 ===
  const handleFormSubmit = () => {
    if (!formTitle.trim()) {
      setFormError(t('formRequired'));
      return;
    }
    setFormError('');
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
  };

  // === 粘贴逻辑 ===
  const handlePasteSubmit = () => {
    setPasteError('');
    const text = pasteText.trim();
    if (!text) return;

    // 提取所有 JSON 候选
    const candidates: string[] = [];
    const codeBlockRe = /```(?:json|jsonl)?\s*([\s\S]*?)```/g;
    let m;
    while ((m = codeBlockRe.exec(text)) !== null) {
      candidates.push(m[1].trim());
    }
    // 也尝试裸 JSON
    candidates.push(text);

    let foundSummary = false;
    for (const cand of candidates) {
      try {
        const data = JSON.parse(cand);
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          if (data.format === 'card-v1' && data.title) {
            onSummaryParsed(data as SummaryJSON);
            foundSummary = true;
          }
        }
      } catch { /* not valid JSON, try next */ }
    }

    // 检查是否有 trail/worklog JSONL
    for (const cand of candidates) {
      const lines = cand.split('\n').filter(l => l.trim());
      if (lines.length === 0) continue;
      try {
        const parsed = lines.map(l => JSON.parse(l));
        if (parsed.length > 0 && parsed[0].id && parsed[0].type) {
          onTrailParsed(parsed as TrailEntry[]);
        }
      } catch { /* not JSONL */ }
    }

    if (!foundSummary) {
      setPasteError(t('pasteError'));
    }
  };

  return (
    <div style={containerStyle}>
      {/* 标签行 */}
      <div style={tabRowStyle}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={tab.id === activeTab ? activeTabStyle : tabStyle}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div style={contentStyle}>
        {activeTab === 'drop' && (
          <div className="animate-in">
            <DropContent
              dragOver={dragOver}
              hasSummary={hasSummary}
              fileName={fileName}
              error={dropError}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onPaste={handlePaste}
              onFileSelect={handleFileSelect}
              onReinject={() => { setHasSummary(false); setFileName(''); }}
              onClearError={() => setDropError(null)}
              onViewTemplate={() => setShowTemplate(true)}
              fileInputRef={fileInputRef}
            />
          </div>
        )}

        {activeTab === 'form' && (
          <div className="animate-in">
            <FormContent
              title={formTitle} desc={formDesc} status={formStatus}
              current={formCurrent} next={formNext} error={formError}
              onTitleChange={v => { setFormTitle(v); setFormError(''); }}
              onDescChange={setFormDesc}
              onStatusChange={setFormStatus}
              onCurrentChange={setFormCurrent}
              onNextChange={setFormNext}
              onSubmit={handleFormSubmit}
            />
          </div>
        )}

        {activeTab === 'paste' && (
          <div className="animate-in">
            <PasteContent
              text={pasteText}
              error={pasteError}
              onChange={setPasteText}
              onSubmit={handlePasteSubmit}
              onViewTemplate={() => setShowTemplate(true)}
            />
          </div>
        )}
      </div>

      {/* 提示词入口 */}
      <div style={promptRowStyle}>
        <button onClick={onOpenPrompts} style={promptLinkStyle}>
          {t('promptEntry')}
        </button>
      </div>

      {/* 模板浮层 */}
      {showTemplate && <TemplateModal onClose={() => setShowTemplate(false)} />}
    </div>
  );
}

// ===== DropContent =====
function DropContent({ dragOver, hasSummary, fileName, error, onDragOver, onDragLeave, onDrop, onPaste, onFileSelect, onReinject, onClearError, onViewTemplate, fileInputRef }: {
  dragOver: boolean; hasSummary: boolean; fileName: string; error: string | null;
  onDragOver: (e: DragEvent) => void; onDragLeave: (e: DragEvent) => void; onDrop: (e: DragEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void; onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onReinject: () => void; onClearError: () => void; onViewTemplate: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  if (hasSummary) {
    return (
      <div style={collapsedStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={16} style={{ color: 'var(--success)' }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{t('summaryRead')}</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{fileName}</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onReinject} style={textBtnStyle}>{t('reinject')}</button>
        </div>
      </div>
    );
  }

  const borderColor = dragOver ? 'var(--accent)' : 'var(--border-dashed)';
  const bgColor = dragOver ? 'var(--accent-soft)' : 'var(--surface)';

  return (
    <div>
      <div
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onPaste={onPaste} tabIndex={0}
        style={{ ...dropZoneStyle, borderColor, background: bgColor, transition: 'all 150ms ease-out' }}
      >
        <Upload size={40} style={{ color: dragOver ? 'var(--accent)' : 'var(--text-muted)', transition: 'color 150ms ease-out' }} />
        <span style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>{t('dragHint')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <div style={{ height: 1, width: 60, background: 'var(--border)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('dragOr')}</span>
          <div style={{ height: 1, width: 60, background: 'var(--border)' }} />
        </div>
        <button onClick={() => fileInputRef.current?.click()} style={selectBtnStyle}>{t('selectFile')}</button>
        <input ref={fileInputRef} type="file" accept=".json,.card,.jsonl,*" multiple onChange={onFileSelect} style={{ display: 'none' }} />
      </div>
      {error && (
        <div style={errorCardStyle} className="animate-in">
          <AlertCircle size={18} style={{ color: 'var(--error)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--error)' }}>{t('errorParse')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{error}</div>
          </div>
          <button onClick={onClearError} style={closeBtnStyle}>×</button>
        </div>
      )}
      <button onClick={onViewTemplate} style={{ ...secondaryBtnStyle, marginTop: 12, alignSelf: 'center' }}>
        {t('viewTemplate')}
      </button>
    </div>
  );
}

// ===== FormContent =====
function FormContent({ title, desc, status, current, next, error, onTitleChange, onDescChange, onStatusChange, onCurrentChange, onNextChange, onSubmit }: {
  title: string; desc: string; status: string; current: string; next: string; error: string;
  onTitleChange: (v: string) => void; onDescChange: (v: string) => void; onStatusChange: (v: string) => void;
  onCurrentChange: (v: string) => void; onNextChange: (v: string) => void; onSubmit: () => void;
}) {
  return (
    <div>
      <div style={{ textAlign: 'right', marginBottom: 16 }}>
        <Sparkles size={12} style={{ color: 'var(--success)' }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--success)', marginLeft: 4 }}>{t('costZero')}</span>
      </div>
      <FormField label={t('formTitle')} value={title} onChange={onTitleChange} placeholder={t('formTitlePlaceholder')} error={error} required />
      <FormField label={t('formDesc')} value={desc} onChange={onDescChange} placeholder={t('formDescPlaceholder')} multiline minHeight={60} />
      <FormField label={t('formStatus')} value={status} onChange={onStatusChange} placeholder={t('formStatusPlaceholder')} />
      <FormField label={t('formCurrent')} value={current} onChange={onCurrentChange} placeholder={t('formCurrentPlaceholder')} />
      <FormField label={t('formNext')} value={next} onChange={onNextChange} placeholder={t('formNextPlaceholder')} multiline minHeight={80} />
      <div style={{ textAlign: 'right', marginTop: 12 }}>
        <button onClick={onSubmit} disabled={!title.trim()} style={primaryBtnStyle}>{t('formSubmit')}</button>
      </div>
    </div>
  );
}

// ===== FormField =====
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

// ===== PasteContent =====
function PasteContent({ text, onChange, error, onSubmit, onViewTemplate }: {
  text: string; onChange: (v: string) => void; error: string;
  onSubmit: () => void; onViewTemplate: () => void;
}) {
  return (
    <div>
      <textarea
        value={text}
        onChange={e => onChange(e.target.value)}
        placeholder={t('pastePlaceholder')}
        style={pasteTextareaStyle}
      />
      {error && (
        <div style={pasteErrStyle}>
          <AlertTriangle size={16} style={{ color: 'var(--error)', flexShrink: 0 }} />
          <span style={{ fontSize: 13 }}>{error}</span>
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

// ===== TemplateModal =====
function TemplateModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const isZh = getLang() === 'zh';
  const template = JSON.stringify({
    format: 'card-v1',
    title: isZh ? '项目名称' : 'Project Name',
    description: isZh ? '一句话描述' : 'One sentence description',
    created: new Date().toISOString(),
    human: { name: isZh ? '你的名字' : 'Your Name', role: isZh ? '你的角色' : 'Your Role' },
    ai: { model: isZh ? 'AI 模型名' : 'AI Model', role: isZh ? 'AI 的角色' : 'AI Role' },
    status: isZh ? '当前阶段' : 'Current Stage',
    done: isZh ? '已完成事项' : 'Completed',
    current: isZh ? '正在做什么' : 'Working On',
    blocked: null,
    next: isZh ? ['下一步1', '下一步2'] : ['Next Step 1', 'Next Step 2'],
    branches: [{ id: 1, what: isZh ? '从A→B' : 'From A→B', why: isZh ? '原因' : 'Reason', who_decided: isZh ? '谁' : 'Who' }],
    decisions: [{ id: 1, what: isZh ? '决策' : 'Decision', why: isZh ? '理由' : 'Rationale', by: isZh ? '谁' : 'Who' }],
    files: [{ name: isZh ? '文件名' : 'filename', role: isZh ? '作用' : 'Purpose' }],
  }, null, 2);

  const handleCopy = () => { navigator.clipboard.writeText(template); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalContainerStyle} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{t('templateTitle')}</span>
          <button onClick={onClose} style={{ fontSize: 20, color: 'var(--text-secondary)', lineHeight: 1 }}>×</button>
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

// ===== Styles =====

const containerStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
};

const tabRowStyle: React.CSSProperties = {
  display: 'flex', gap: 8, height: 48, padding: '0 20px',
  borderBottom: '1px solid var(--border)',
};

const tabStyle: React.CSSProperties = {
  height: '100%', padding: '0 12px', fontSize: 13, fontWeight: 500,
  color: 'var(--text-secondary)', background: 'none', border: 'none',
  borderBottom: '2px solid transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center',
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle, color: 'var(--text)', borderBottomColor: 'var(--accent)',
};

const contentStyle: React.CSSProperties = { minHeight: 200, padding: 24 };

const promptRowStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border)', padding: '10px 20px',
  display: 'flex', justifyContent: 'flex-end',
};

const promptLinkStyle: React.CSSProperties = {
  fontSize: 13, color: 'var(--accent)', cursor: 'pointer',
  background: 'none', border: 'none',
};

// Drop zone styles
const dropZoneStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', height: 200, border: '2px dashed',
  borderRadius: 'var(--radius-lg)',
};

const collapsedStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  height: 200, padding: '0 16px', background: 'var(--surface)',
  borderRadius: 'var(--radius-lg)',
};

const selectBtnStyle: React.CSSProperties = {
  height: 36, padding: '0 20px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--surface)',
  color: 'var(--text)', marginTop: 8,
};

const textBtnStyle: React.CSSProperties = {
  fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer',
};

const errorCardStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 12,
  padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA',
  borderRadius: 'var(--radius-md)',
};

const closeBtnStyle: React.CSSProperties = {
  marginLeft: 'auto', fontSize: 18, color: 'var(--text-secondary)',
  background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1,
};

// Form styles
const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid', borderRadius: 6, fontSize: 14,
  color: 'var(--text)', outline: 'none', transition: 'border-color 150ms',
  fontFamily: 'inherit',
};

const primaryBtnStyle: React.CSSProperties = {
  height: 36, padding: '0 18px', background: 'var(--primary)',
  color: '#FFFFFF', borderRadius: 'var(--radius-sm)', fontSize: 14,
  fontWeight: 500, border: 'none', cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  height: 36, padding: '0 14px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text-secondary)',
  background: 'var(--surface)', cursor: 'pointer',
};

// Paste styles
const pasteTextareaStyle: React.CSSProperties = {
  width: '100%', minHeight: 140, border: '1px solid var(--border)',
  borderRadius: 10, padding: 12, fontSize: 13,
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  color: 'var(--text)', outline: 'none', resize: 'vertical',
};

const pasteErrStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
  padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA',
  borderRadius: 'var(--radius-md)',
};

// Modal styles
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100,
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
  borderRadius: 'var(--radius-md)', padding: 16, fontSize: 13,
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  whiteSpace: 'pre-wrap', overflowWrap: 'break-word',
};
