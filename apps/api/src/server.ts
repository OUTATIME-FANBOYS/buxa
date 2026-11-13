import { errorMessage } from '@buxa/db';
import { createRuntime } from './runtime';

/** The local server (`npm run api`). Production runs the same runtime as a Vercel function; see deploy/vercel. */
async function startServer(): Promise<void> {
  let runtime;
  try { runtime = createRuntime(); } catch (error) { console.error(errorMessage(error)); process.exit(1); }
  const { app, pool, config, startupCheck } = runtime;

  if ((await startupCheck) === 'refuse') process.exit(1);

  // Finish in-flight requests, then release the database. Runs once however many signals arrive.
  let shutdown: Promise<void> | undefined;
  const stop = (signal: string): Promise<void> => (shutdown ??= (async () => {
    app.log.info({ signal }, 'shutting down');
    try { await app.close(); await pool.end(); process.exit(0); }
    catch (error) { app.log.error({ err: error }, 'shutdown failed'); process.exit(1); }
  })());
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));

  app.listen({ port: config.PORT, host: config.HOST }).catch(error => { app.log.error({ err: error }, 'failed to start'); process.exit(1); });
}

startServer().catch(error => { console.error(error); process.exit(1); });
