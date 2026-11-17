import React, { useState } from 'react';
const colors = ['#edb6ac','#8caac5','#b5a2cc','#a6bda8','#d2a16e'];
function ProfileImage({ sources, name, fallback }) {
  const [index, setIndex] = useState(0);
  return index < sources.length
    ? <img src={sources[index]} alt={`${name || 'User'}'s profile picture`} onError={() => setIndex(current => current + 1)} />
    : fallback;
}
export default function Avatar({ person, size = 'normal' }) {
  const sources = [...new Set([...(person?.avatars || []), person?.avatar].filter(Boolean))];
  const fallback = person?.bot ? <span className="bot-face">✦</span> : (person?.name || '?').slice(0, 1).toUpperCase();
  return <span className={`avatar ${size}`} style={{ background: person?.bot ? '#7066cf' : colors[(person?.name?.charCodeAt(0) || 0) % colors.length] }}>
    <ProfileImage key={JSON.stringify(sources)} sources={sources} name={person?.name} fallback={fallback} />
    {person?.status && <i className={'presence ' + person.status} aria-hidden="true" />}
  </span>;
}
