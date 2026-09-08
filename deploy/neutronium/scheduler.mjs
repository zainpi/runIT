if (!process.env.NEUTRONIUM_CRON_SECRET) throw new Error('Missing scheduler secret');
async function run() {
  try {
    const response = await fetch('http://app:3000/neutronium/api/worker/', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.NEUTRONIUM_CRON_SECRET}` },
      signal: AbortSignal.timeout(300000),
    });
    if (!response.ok) console.error(`Neutronium scheduler failed: HTTP ${response.status}`);
  } catch (error) { console.error('Neutronium scheduler request failed', error.message); }
  setTimeout(run, 60000);
}
await run();
