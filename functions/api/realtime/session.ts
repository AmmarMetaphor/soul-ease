/**
 * Cloudflare Pages Function — POST /api/realtime/session
 *
 * Thin host adapter. All logic lives in server/realtime/session.ts so the
 * same code serves Cloudflare and Netlify; swapping hosts means adding an
 * adapter, not rewriting the endpoint.
 *
 * Configure the secrets in Cloudflare under
 * Workers & Pages → your project → Settings → Variables and Secrets.
 */
import { handleRealtimeSessionRequest, type RealtimeEnv } from '../../../server/realtime/session';

/** Minimal shape of the Pages Functions context we use (no extra dependency). */
interface PagesContext<Env> {
  request: Request;
  env: Env;
}

export const onRequest = (context: PagesContext<RealtimeEnv>): Promise<Response> =>
  handleRealtimeSessionRequest(context.request, context.env);
