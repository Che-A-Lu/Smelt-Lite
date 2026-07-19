import { useState, useEffect, useRef } from 'react';
import { Download, ArrowLeft, Check, AlertTriangle, Shield, Key, ChevronDown, Plus } from 'lucide-react';
import type { SummaryJSON, IdentityKey } from '../foundation/types';
import { t } from '../foundation/i18n';
import { buildCardPackage, downloadBlob, scanContent, type ScanResult } from '../features/export';
import { generateKeyPair, saveIdentity, importIdentityKey, exportIdentityKey } from '../features/identity';

interface PackPanelProps {
  summary: SummaryJSON;
  files: File[];
  identity: IdentityKey | null;
  onBack: () => void;
  onIdentityChange: (key: IdentityKey) => void;
  onReset: () => void;
}

export default function PackPanel({ summary, files, identity, onBack, onIdentityChange, onReset }: PackPanelProps) {
  const [encryptChecked, setEncryptChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showIdentityMenu, setShowIdentityMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scanContent(files).then(setScanResult);
  }, [files]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowIdentityMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const blob = await buildCardPackage({
        summary,
        trail: null,
        files,
        identity: identity,
        encrypt: encryptChecked,
        password: encryptChecked ? password : undefined,
      });
      const safeName = summary.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_') + '.card';
      downloadBlob(blob, safeName);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch (err) {
      console.error('Pack failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    const key = await generateKeyPair();
    saveIdentity(key);
    onIdentityChange(key);
    setShowIdentityMenu(false);
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
          setShowIdentityMenu(false);
        } catch { /* ignore */ }
      }
    };
    input.click();
  };

  const handleExportKey = () => {
    if (identity) {
      exportIdentityKey(identity);
      setShowIdentityMenu(false);
    }
  };

  return (
    <div className="animate-in" style={panelStyle}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={backBtnStyle}>
          <ArrowLeft size={16} />
        </button>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{t('packConfirm')}</h3>
      </div>

      {/* 摘要卡片 */}
      <div style={summaryCardStyle}>
        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>{t('autoSummary')}</span>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{summary.title}</div>
        {summary.description && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {summary.description.slice(0, 100)}{summary.description.length > 100 ? '...' : ''}
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{summary.created}</div>
      </div>

      {/* 签名身份 */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('identity')}</div>
        <div style={identityCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} style={{ color: 'var(--accent)' }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{summary.human.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {identity ? identity.fingerprint.slice(0, 8) : t('noKey')}
              </div>
            </div>
          </div>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowIdentityMenu(!showIdentityMenu)} style={switchBtnStyle}>
              {t('identity')} <ChevronDown size={12} />
            </button>
            {showIdentityMenu && (
              <div style={menuStyle}>
                <button onClick={handleGenerateKey} style={menuItemStyle}>{t('generateKey')}</button>
                <button onClick={handleImportKey} style={menuItemStyle}>{t('importKey')}</button>
                <button onClick={handleExportKey} style={menuItemStyle}>{t('exportKey')}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 选项 */}
      <div style={sectionStyle}>
        <label style={checkboxStyle}>
          <input type="checkbox" checked disabled style={{ accentColor: 'var(--accent)' }} />
          <span style={{ marginLeft: 8 }}>{t('signature')}</span>
        </label>
        <label style={checkboxStyle}>
          <input type="checkbox" checked={encryptChecked} onChange={e => setEncryptChecked(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          <span style={{ marginLeft: 8 }}>{t('encrypt')}</span>
        </label>
        {encryptChecked && (
          <input
            type="password"
            placeholder={t('password')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={passwordInputStyle}
          />
        )}
      </div>

      {/* 隐私扫描 */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('privacyScan')}</div>
        {scanResult === null ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('scanning')}</div>
        ) : scanResult.clean ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--success)' }}>
            <Check size={16} /> {t('privacyClean')}
          </div>
        ) : (
          <div style={riskCardStyle}>
            <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--warning)' }}>{t('privacyRisk')}</div>
              {scanResult.risks.map((r, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {r.fileName} · {r.type} · {r.detail}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 下载按钮 */}
      <button
        onClick={handleDownload}
        disabled={loading}
        style={{
          ...downloadBtnStyle,
          opacity: loading ? 0.7 : 1,
          background: downloaded ? 'var(--success)' : 'var(--primary)',
        }}
      >
        {downloaded ? (
          <>
            <Check size={16} /> {t('downloaded')}
          </>
        ) : (
          <>
            <Download size={16} /> {t('download')}
          </>
        )}
      </button>

      {/* 打包新的 */}
      {downloaded && (
        <button onClick={onReset} style={newCardBtnStyle}>
          <Plus size={14} />
          {t('newCard')}
        </button>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  marginTop: 16,
  background: 'var(--surface)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
  boxShadow: 'var(--shadow-card)',
};

const backBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-secondary)',
};

const summaryCardStyle: React.CSSProperties = {
  background: 'var(--accent-soft)',
  border: '1px solid #BFDBFE',
  borderRadius: 'var(--radius-md)',
  padding: 16,
  marginBottom: 20,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 20,
};

const identityCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: 'var(--bg)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 16px',
};

const switchBtnStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--accent)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '100%',
  marginTop: 4,
  background: 'var(--surface)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-panel)',
  border: '1px solid var(--border)',
  padding: 4,
  minWidth: 140,
  zIndex: 10,
};

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 13,
  color: 'var(--text)',
  borderRadius: 'var(--radius-sm)',
};

const checkboxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: 14,
  marginBottom: 8,
  cursor: 'pointer',
};

const passwordInputStyle: React.CSSProperties = {
  height: 36,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '0 12px',
  fontSize: 14,
  width: '100%',
  maxWidth: 300,
  background: 'var(--surface)',
  marginLeft: 28,
};

const riskCardStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  padding: '12px 16px',
  background: '#FFFBEB',
  border: '1px solid #FDE68A',
  borderRadius: 'var(--radius-md)',
};

const downloadBtnStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 'var(--radius-sm)',
  color: '#FFFFFF',
  fontSize: 15,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  transition: 'all 150ms ease-out',
};

const newCardBtnStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  marginTop: 10,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)',
  fontSize: 14,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  background: 'var(--surface)',
};
