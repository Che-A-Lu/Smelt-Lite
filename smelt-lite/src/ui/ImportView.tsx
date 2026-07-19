import { useState } from 'react';
import JSZip from 'jszip';
import { Download, File, Check, AlertTriangle, HelpCircle, Lock, Unlock } from 'lucide-react';
import type { ImportedCard, ImportedCardFile } from '../features/import';
import { decryptCardFiles } from '../features/import';
import { t } from '../foundation/i18n';

interface ImportViewProps {
  imported: ImportedCard;
  onClose: () => void;
}

export default function ImportView({ imported, onClose }: ImportViewProps) {
  const { manifest, signatureResults } = imported;
  const [files, setFiles] = useState(imported.files);
  const [password, setPassword] = useState('');
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState('');

  const hasEncrypted = files.some(f => f.encrypted);
  const allDecrypted = files.every(f => !f.encrypted);

  const statusCounts = {
    valid: signatureResults.filter(r => r.status === 'valid').length,
    broken: signatureResults.filter(r => r.status === 'broken').length,
    unverifiable: signatureResults.filter(r => r.status === 'unverifiable').length,
  };
  const totalCount = signatureResults.length;

  const downloadFile = (file: { name: string; blob: Blob }) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    for (const f of files) {
      zip.file(f.name, f.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const safeName = manifest.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}-files.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDecrypt = async () => {
    if (!password.trim()) return;
    setDecrypting(true);
    setDecryptError('');
    try {
      const decrypted = await decryptCardFiles(files, password);
      setFiles(decrypted);
      setPassword('');
    } catch {
      setDecryptError(t('decryptFailed'));
    } finally {
      setDecrypting(false);
    }
  };

  const sigBadge = () => {
    if (totalCount === 0) return null;
    if (statusCounts.broken > 0) {
      const idx = signatureResults.findIndex(r => r.status === 'broken') + 1;
      return (
        <div style={badgeStyle('#FFFBEB', 'var(--warning)')}>
          <AlertTriangle size={12} />
          {t('signatureBrokenAt', { n: idx })}
        </div>
      );
    }
    if (statusCounts.unverifiable > 0) {
      const idx = signatureResults.findIndex(r => r.status === 'unverifiable') + 1;
      return (
        <div style={badgeStyle('#F3F4F6', 'var(--text-secondary)')}>
          <HelpCircle size={12} />
          {t('signatureUnverifiableAt', { n: idx })}
        </div>
      );
    }
    return (
      <div style={badgeStyle('#ECFDF5', 'var(--success)')}>
        <Check size={12} />
        {t('signatureValid')} ({statusCounts.valid}/{totalCount})
      </div>
    );
  };

  return (
    <div className="animate-in" style={viewStyle}>
      {/* 摘要区 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{manifest.title}</h2>
          <span style={statusBadgeStyle}>{manifest.status}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {manifest.participants.map(p => p.name).join(t('and'))}{t('collaborated')}{manifest.created}
        </div>
        {manifest.description && (
          <p style={descStyle}>{manifest.description}</p>
        )}
      </div>

      {/* 来源链 */}
      <div>
        <div style={sectionTitleStyle}>{t('provenance')}</div>
        <div style={{ marginTop: 12 }}>
          {manifest.provenance.map((entry, i) => (
            <div key={i} style={timelineItemStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                {i < manifest.provenance.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 4 }} />
                )}
              </div>
              <div style={{ paddingBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{entry.who}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{entry.action}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{entry.when}</div>
              </div>
            </div>
          ))}
        </div>
        {sigBadge()}
      </div>

      {/* 当前进度 */}
      <div>
        <div style={sectionTitleStyle}>{t('currentProgress')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {manifest.next.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <span>{i === 0 ? '\u{1F504}' : '\u{23F3}'}</span>
              <span style={{ color: i === 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 加密文件解密 */}
      {hasEncrypted && !allDecrypted && (
        <div style={decryptSectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Lock size={16} style={{ color: 'var(--warning)' }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>此 .card 包含加密文件，需要密码解密</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              placeholder={t('password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDecrypt()}
              style={passwordInputStyle}
            />
            <button onClick={handleDecrypt} disabled={decrypting} style={decryptBtnStyle}>
              <Unlock size={14} />
              {decrypting ? '解密中...' : '解密'}
            </button>
          </div>
          {decryptError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 13, color: 'var(--error)' }}>
              <AlertTriangle size={14} /> {decryptError}
            </div>
          )}
        </div>
      )}

      {/* 文件列表 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={sectionTitleStyle}>{t('filesCount', { n: files.length })}</div>
          <button onClick={downloadAll} style={secondaryBtnStyle}>{t('downloadAll')}</button>
        </div>
        <div style={fileListStyle}>
          {files.map((f, i) => (
            <div key={i} style={fileItemStyle}>
              {f.encrypted ? (
                <Lock size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              ) : (
                <File size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                  {f.encrypted && (
                    <span style={{ fontSize: 12, color: 'var(--warning)', marginLeft: 6 }}>🔒</span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginRight: 8 }}>{formatSize(f.size)}</span>
              <button onClick={() => downloadFile({ name: f.name, blob: f.blob })} style={iconBtnStyle}>
                <Download size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 关闭 */}
      <button onClick={onClose} style={closeBtnStyle}>{t('close')}</button>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const badgeStyle = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 500,
  background: bg,
  color,
  marginTop: 8,
});

const viewStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
  boxShadow: 'var(--shadow-card)',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const statusBadgeStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--accent)',
  background: 'var(--accent-soft)',
  padding: '2px 10px',
  borderRadius: 999,
};

const descStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-secondary)',
  lineHeight: '22px',
  maxHeight: 66,
  overflow: 'hidden',
  maskImage: 'linear-gradient(to bottom, black 60%, transparent)',
  WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text)',
};

const timelineItemStyle: React.CSSProperties = {
  display: 'flex',
};

const fileListStyle: React.CSSProperties = {
  background: 'var(--bg)',
  borderRadius: 'var(--radius-md)',
  padding: 4,
};

const fileItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  height: 48,
  padding: '0 12px',
};

const iconBtnStyle: React.CSSProperties = {
  color: 'var(--accent)',
  cursor: 'pointer',
  padding: 4,
};

const secondaryBtnStyle: React.CSSProperties = {
  height: 32,
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13,
  color: 'var(--text-secondary)',
  background: 'var(--surface)',
};

const decryptSectionStyle: React.CSSProperties = {
  padding: 16,
  background: '#FFFBEB',
  border: '1px solid #FDE68A',
  borderRadius: 'var(--radius-md)',
};

const passwordInputStyle: React.CSSProperties = {
  flex: 1,
  height: 36,
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 14,
  background: 'var(--surface)',
};

const decryptBtnStyle: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  background: 'var(--warning)',
  color: '#FFFFFF',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
};

const closeBtnStyle: React.CSSProperties = {
  alignSelf: 'center',
  padding: '8px 24px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 14,
  color: 'var(--text-secondary)',
  background: 'var(--surface)',
};
