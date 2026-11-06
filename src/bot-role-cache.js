export function createBotRoleCache({ maxAge = 60000, now = Date.now } = {}) {
  const entries = new Map();
  return {
    clear: () => entries.clear(),
    update(guildId, roles) { entries.set(guildId, { roles, expires: now() + maxAge }); },
    get(guildId, load) {
      const previous = entries.get(guildId);
      if (previous?.promise) return previous.promise;
      if (previous && previous.expires > now()) return Promise.resolve(previous.roles);
      const entry = {};
      entry.promise = Promise.resolve().then(load).then(member => {
        if (entries.get(guildId) === entry) entries.set(guildId, { roles: member.roles || [], expires: now() + maxAge });
        return member.roles || [];
      }, error => { if (entries.get(guildId) === entry) entries.delete(guildId); throw error; });
      entries.set(guildId, entry);
      return entry.promise;
    },
  };
}
