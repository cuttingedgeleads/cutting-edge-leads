// Test-only coordinates: host, database and role are fixed. Only owned local ports vary.
function fixturePort(value, fallback) {
  const text = value ?? String(fallback);
  if (!/^\d{4,5}$/.test(text)) throw new Error('LOCAL_PORT_GUARD');
  const number = Number(text);
  if (number < 1024 || number > 65535) throw new Error('LOCAL_PORT_GUARD');
  return number;
}
export function authLocalFixture(env = process.env) {
  const dbPort = fixturePort(env.AUTH_QA_PG_PORT, 55474);
  const httpPort = fixturePort(env.AUTH_QA_HTTP_PORT, 3100);
  return {
    dbPort, httpPort,
    databaseURL: `postgresql://leads_qa@127.0.0.1:${dbPort}/leads_auth_qa`,
    origin: `http://127.0.0.1:${httpPort}`,
  };
}
