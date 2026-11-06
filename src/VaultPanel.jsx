import React, { useState } from 'react';
import { Lock, Shield, Eye, EyeOff, Trash2, Download, Upload, Bot } from 'lucide-react';

export default function VaultPanel({ currentToken, onUseToken }) {
  const [candidate, setCandidate] = useState('');
  const [password, setPassword] = useState('');
  const [bots, setBots] = useState([]);
  const [newToken, setNewToken] = useState(currentToken || '');
  const [revealed, setRevealed] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const request = async (path = '', method = 'GET', body, auth = password) => {
    const response = await fetch(`/api/vault${path}`, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Vault request failed.');
    return data;
  };
  const run = async fn => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const unlock = e => {
    e.preventDefault();
    run(async () => { const list = await request('', 'GET', undefined, candidate); setBots(list); setPassword(candidate); setCandidate(''); });
  };
  const save = e => {
    e.preventDefault();
    run(async () => { await request('/bots', 'POST', { token: newToken }); setNewToken(''); setRevealed(null); setBots(await request()); setNotice('Bot saved in the encrypted vault. Download a backup to keep it on Render Free.'); });
  };
  const backup = () => run(async () => {
    const data = await request('/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'relay-bots.enc.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const restore = e => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !window.confirm('Replace saved bots with this encrypted backup? It must use the same vault password.')) return;
    run(async () => {
      if (file.size > 500000) throw new Error('Backup is too large.');
      const backup = JSON.parse(await file.text());
      await request('/import', 'POST', { backup }); setRevealed(null); setBots(await request()); setNotice('Encrypted backup restored.');
    });
  };
  return <>
    <div className="modal-emblem"><Shield size={25}/></div>
    <h2>Private saved bots</h2>
    <p className="modal-sub">The vault holds tokens saved by the site owner and tokens from visitors who acknowledged owner access when connecting.</p>
    {!password ? <form onSubmit={unlock}>
      <label htmlFor="vault-password">VAULT PASSWORD</label>
      <input id="vault-password" className="modal-input" type="password" autoComplete="off" value={candidate} onChange={e => setCandidate(e.target.value)} placeholder="Your private vault password" required/>
      <p className="field-help"><Lock size={13}/> Use VAULT_PASSWORD from your Render service’s Environment settings. It is created when the updated Blueprint syncs.</p>
      <button className="primary-button" disabled={busy}>{busy ? 'Unlocking…' : 'Unlock saved bots'}</button>
    </form> : <>
      <div className="vault-toolbar"><span><Lock size={13}/> Unlocked for this dialog</span><button className="secondary-button" onClick={() => { setPassword(''); setCandidate(''); setBots([]); setRevealed(null); setNewToken(''); setError(''); setNotice(''); }}>Lock</button></div>
      <div className="vault-list">{!bots.length && <p className="field-help">No saved bots yet.</p>}{bots.map(bot => <div className="vault-bot" key={bot.id}>
        <div className="vault-bot-title"><Bot size={17}/><strong>{bot.name}</strong></div>
        <div className="vault-bot-actions">
          <button disabled={busy} className="secondary-button" onClick={() => run(async () => { const { token } = await request('/reveal', 'POST', { id: bot.id }); onUseToken(token); })}>Use bot</button>
          <button disabled={busy} className="icon-button" aria-label={`Reveal token for ${bot.name}`} title="Reveal token" onClick={() => revealed?.id === bot.id ? setRevealed(null) : run(async () => { const { token } = await request('/reveal', 'POST', { id: bot.id }); setRevealed({ id: bot.id, token }); })}>{revealed?.id === bot.id ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
          <button disabled={busy} className="icon-button" aria-label={`Remove ${bot.name}`} title="Remove saved bot" onClick={() => { if (window.confirm(`Remove ${bot.name} from the vault? This does not revoke its Discord token.`)) run(async () => { await request(`/bots/${bot.id}`, 'DELETE'); setRevealed(null); setBots(await request()); }); }}><Trash2 size={16}/></button>
        </div>
        {revealed?.id === bot.id && <input className="modal-input vault-token" aria-label={`Token for ${bot.name}`} value={revealed.token} readOnly onFocus={e => e.target.select()}/>}
      </div>)}</div>
      <form onSubmit={save}><label htmlFor="save-token">SAVE YOUR BOT TOKEN</label><input id="save-token" className="modal-input" type="password" autoComplete="off" placeholder="Paste your own bot token" value={newToken} onChange={e => setNewToken(e.target.value)} required/><p className="field-help">Discord verifies the token and supplies the bot’s name before saving.</p><button className="primary-button" disabled={busy}>Save bot to encrypted file</button></form>
      <div className="vault-backups"><button className="secondary-button" disabled={busy} onClick={backup}><Download size={15}/> Encrypted backup</button><label className="secondary-button import-button"><Upload size={15}/> Restore backup<input type="file" accept="application/json,.json" disabled={busy} onChange={restore}/></label></div>
      <p className="field-help">Render Free erases local files on restart or deployment. Keep an encrypted backup and the same vault password to restore your bots.</p>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="vault-notice" role="status">{notice}</p>}
  </>;
}
