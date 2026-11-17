// The message deliberately contains no bot token or other credential.
export function createEmailNotifier({ apiKey, from, to, fetchImpl = fetch, endpoint = 'https://api.resend.com/emails' }) {
  if (!apiKey || !from || !to) return async () => {};
  return async ({ name }) => {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: 'Tocken Login Relay', text: `A bot was connected to Relay. Bot name: ${name}` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Email notification rejected');
  };
}
