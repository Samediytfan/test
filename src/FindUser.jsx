import React, { useState } from 'react';

// Looks up a member of the selected server by numeric user ID or username.
// Only members of this server can be found, so the bot always shares a server with them.
export default function FindUser({ demo, api, guildId, onOpenDM }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const normalise = (m) => {
    const u = m.user || m;
    return {
      id: u.id,
      username: u.username || '',
      name: m.nick || u.global_name || u.username || 'User',
      bot: Boolean(u.bot),
    };
  };

  const find = async (e) => {
    e.preventDefault();
    const q = query.trim().replace(/^@/, '');
    if (!q) return;
    setBusy(true);
    setError('');
    setResult(null);
    setCopied(false);
    try {
      if (demo) {
        setError('Lookup works with a live server. Sign in with your bot to search real members.');
        return;
      }
      if (/^\d{15,25}$/.test(q)) {
        const member = await api(`/guilds/${guildId}/members/${q}`);
        setResult(normalise(member));
      } else {
        const list = await api(`/guilds/${guildId}/members/search?query=${encodeURIComponent(q)}&limit=5`);
        if (!Array.isArray(list) || !list.length) setError('No member in this server matches that name.');
        else setResult(normalise(list[0]));
      }
    } catch (err) {
      setError(err.message.includes('404') || /Unknown Member/i.test(err.message) ? 'That user is not in this server.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  const openDM = async () => {
    if (!result) return;
    setBusy(true);
    setError('');
    try {
      const channel = await api('/users/@me/channels', 'POST', { recipient_id: result.id });
      onOpenDM?.(channel, { id: result.id, name: result.name, username: result.username });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(result.id);
      setCopied(true);
    } catch {
      setError('Copy failed. Select the ID and copy it manually.');
    }
  };

  return (
    <div className="find-user">
      <form onSubmit={find} className="find-user-form">
        <input
          className="modal-input"
          aria-label="Find user by ID or username"
          placeholder="Find user by ID or username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="secondary-button" type="submit" disabled={busy}>Find</button>
      </form>
      {error && <p className="field-help">{error}</p>}
      {result && (
        <div className="find-user-result">
          <strong>{result.name}</strong>
          {result.username && <span>@{result.username}</span>}
          <span>ID: {result.id}</span>
          <div className="find-user-actions">
            <button className="secondary-button" type="button" onClick={copyId}>{copied ? 'Copied!' : 'Copy ID'}</button>
            <button className="primary-button" type="button" disabled={busy || demo} onClick={openDM}>Message</button>
          </div>
        </div>
      )}
    </div>
  );
}
