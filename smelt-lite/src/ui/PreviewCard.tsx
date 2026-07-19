import { useState, useEffect, type DragEvent } from 'react';
import { File, X, Download, Plus } from 'lucide-react';
import type { SummaryJSON } from '../foundation/types';
import { t } from '../foundation/i18n';
import { canSnapshot, generateSnapshot } from '../features/snapshot';

interface PreviewCardProps {
  summary: SummaryJSON;
  files: File[];
  onRemoveFile: (index: number) => void;
  onPack: () => void;
  onFilesAdded: (files: File[]) => void;
}

export default function PreviewCard({ summary, files, onRemoveFile, onPack, onFilesAdded }: PreviewCardProps) {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [dragOverCard, setDragOverCard] = useState(false);

  useEffect(() => {
    for (const f of files) {
      if (canSnapshot(f) && !thumbnails[f.name]) {
        generateSnapshot(f).then(url => {
          if (url) setThumbnails(prev => ({ ...prev, [f.name]: url }));
        });
      }
    }
  }, [files]);

  const doneCount = summary.done ? 1 : 0;
  const totalCount = doneCount + summary.next.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setDragOverCard(true); };
  const handleDragEnter = (e: DragEvent) => { e.preventDefault(); setDragOverCard(true); };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverCard(false);
    }
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOverCard(false);
    const items = Array.from(e.dataTransfer.files);
    if (items.length > 0) onFilesAdded(items);
  };

  const cardBorder = dragOverCard ? 'var(--accent)' : 'transparent';
  const cardBg = dragOverCard ? 'var(--accent-soft)' : 'var(--surface)';

  return (
    <div
      className="animate-in"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ ...cardStyle, borderColor: cardBorder, background: cardBg, transition: 'border-color 150ms ease-out, background 150ms ease-out' }}
    >
      {/* 标题区 */}
      <div style={titleRowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.title}</h2>
          <span style={statusBadgeStyle}>{summary.status}</span>
        </div>
        <button onClick={onPack} style={packBtnStyle}>
          <Download size={14} />
          {t('packAsCard')}
        </button>
      </div>

      {/* 描述 */}
      {summary.description && (
        <p style={descStyle}>{summary.description}</p>
      )}

      {/* 元信息网格 */}
      <div style={gridStyle}>
        <div>
          <div style={labelStyle}>{t('definer')}</div>
          <div style={valueStyle}>{summary.human.name} / {summary.human.role}</div>
        </div>
        <div>
          <div style={labelStyle}>{t('aiModel')}</div>
          <div style={valueStyle}>{summary.ai.model} / {summary.ai.role}</div>
        </div>
        {summary.done && (
          <div>
            <div style={labelStyle}>{t('doneLabel')}</div>
            <div style={valueStyle}>{summary.done}</div>
          </div>
        )}
        <div>
          <div style={labelStyle}>{t('currentLabel')}</div>
          <div style={valueStyle}>{summary.current}</div>
        </div>
      </div>

      {/* 进度区 */}
      <div>
        <div style={sectionTitleStyle}>{t('progress')}</div>
        <div style={progressBarOuter}>
          <div style={{ ...progressBarInner, width: `${progressPct}%` }} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
          {t('doneLabel')}：{summary.done ?? '—'}　{t('currentLabel')}：{summary.current}
        </div>
      </div>

      {/* 下一步 */}
      {summary.next.length > 0 && (
        <div>
          <div style={sectionTitleStyle}>{t('next')}</div>
          <ol style={nextListStyle}>
            {summary.next.map((item, i) => (
              <li key={i} style={nextItemStyle}>{item}</li>
            ))}
          </ol>
        </div>
      )}

      {/* 转折 */}
      {summary.branches && summary.branches.length > 0 && (
        <div>
          <div style={sectionTitleStyle}>{t('branchesCount', { n: summary.branches.length })}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summary.branches.map(b => (
              <div key={b.id} style={branchCardStyle}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>#{b.id}</span>
                <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 8 }}>{b.what}</span>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{b.why}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文件清单 */}
      <div>
        <div style={{ ...titleRowStyle, marginBottom: 8 }}>
          <div style={sectionTitleStyle}>{t('filesCount', { n: files.length })}</div>
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.onchange = () => {
                const items = Array.from(input.files ?? []);
                if (items.length > 0) onFilesAdded(items);
              };
              input.click();
            }}
            style={secondaryBtnStyle}
          >
            <Plus size={14} />
            {t('dragToAdd')}
          </button>
        </div>

        {files.length === 0 ? (
          <div style={emptyHintStyle}>
            {t('dragFilesToAddHint')}
          </div>
        ) : (
          <>
            <div style={fileListStyle}>
              {files.map((f, i) => (
                <div key={i} style={fileItemStyle}>
                  {thumbnails[f.name] ? (
                    <img src={thumbnails[f.name]} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />
                  ) : (
                    <File size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{(f.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <button
                    onClick={() => onRemoveFile(i)}
                    style={removeBtnStyle}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div style={keepDropStyle}>
              <Plus size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('keepDropping')}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  marginTop: 16,
  borderRadius: 'var(--radius-lg)',
  border: '2px solid transparent',
  padding: 24,
  boxShadow: 'var(--shadow-card)',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const statusBadgeStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--accent)',
  background: 'var(--accent-soft)',
  padding: '2px 10px',
  borderRadius: 999,
  flexShrink: 0,
};

const packBtnStyle: React.CSSProperties = {
  height: 36,
  padding: '0 18px',
  background: 'var(--primary)',
  color: '#FFFFFF',
  borderRadius: 'var(--radius-sm)',
  fontSize: 14,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
};

const descStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 400,
  color: 'var(--text-secondary)',
  lineHeight: '22px',
  maxHeight: 66,
  overflow: 'hidden',
  maskImage: 'linear-gradient(to bottom, black 60%, transparent)',
  WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent)',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  marginBottom: 2,
};

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--text)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text)',
};

const progressBarOuter: React.CSSProperties = {
  height: 6,
  background: 'var(--border)',
  borderRadius: 999,
  marginTop: 8,
  overflow: 'hidden',
};

const progressBarInner: React.CSSProperties = {
  height: '100%',
  background: 'var(--primary)',
  borderRadius: 999,
  transition: 'width 300ms ease-out',
};

const nextListStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  marginTop: 8,
};

const nextItemStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: '26px',
  paddingLeft: 16,
  position: 'relative',
};

const branchCardStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 16px',
};

const emptyHintStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: 13,
  color: 'var(--text-secondary)',
  padding: '20px 24px',
  background: 'var(--bg)',
  borderRadius: 'var(--radius-md)',
  lineHeight: '22px',
};

const fileListStyle: React.CSSProperties = {
  background: 'var(--bg)',
  borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
  padding: 4,
  minHeight: 48,
};

const fileItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  height: 44,
  padding: '0 12px',
};

const removeBtnStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: 4,
  borderRadius: 4,
  transition: 'color 150ms',
};

const keepDropStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 36,
  border: '2px dashed var(--border-dashed)',
  borderRadius: '0 0 var(--radius-md) var(--radius-md)',
  borderTop: 'none',
};

const secondaryBtnStyle: React.CSSProperties = {
  height: 36,
  padding: '0 14px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13,
  color: 'var(--text-secondary)',
  background: 'var(--surface)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};
