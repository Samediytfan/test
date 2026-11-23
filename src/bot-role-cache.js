export function createBotRoleCache({ maxAge = 60000, failureBackoff = 10000, now = Date.now } = {}) {
  const entries = new Map();
  return {
    clear: () => entries.clear(),
    update(guildId, roles) { entries.set(guildId, { roles, expires: now() + maxAge }); },
    get(guildId, load) {
      const previous = entries.get(guildId);
      if (previous?.error && previous.expires > now()) return Promise.reject(previous.error);
      if (previous?.promise) return previous.promise;
      if (previous && previous.expires > now()) return Promise.resolve(previous.roles);
      const entry = {};
      entry.promise = Promise.resolve().then(load).then(member => {
        const current = entries.get(guildId);
        if (current !== entry && current?.roles) return current.roles;
        if (current === entry) entries.set(guildId, { roles: member.roles || [], expires: now() + maxAge });
        return member.roles || [];
      }, error => {
        const current = entries.get(guildId);
        if (current !== entry && current?.roles) return current.roles;
        if (current === entry) entries.set(guildId, { error, expires: now() + failureBackoff });
        throw error;
      });
      entries.set(guildId, entry);
      return entry.promise;
    },
  };
}
