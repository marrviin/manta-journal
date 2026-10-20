//! Server-side i18n: error/localizable strings answered to HTTP clients follow
//! the request's `X-App-Language` header (attached by the renderer's api-http
//! interceptor; default zh). A fastify onRequest hook records the language in
//! an AsyncLocalStorage scope, so core code (memory-core, journal-gen) can call
//! tReq() without threading a lang parameter through every signature. Outside
//! a request (startup, the hourly journal scheduler) tReq falls back to zh —
//! the scheduler reads its own language from the stored journal_language
//! setting and passes it explicitly.

import { AsyncLocalStorage } from 'node:async_hooks';

import { t, normalizeLang, type I18nKey, type Lang } from '@manta-journal/shared';

const requestLang = new AsyncLocalStorage<Lang>();

/** Language for the current async context: the request's X-App-Language when
 *  inside one, zh otherwise (logs and startup paths). */
export function currentLang(): Lang {
  return requestLang.getStore() ?? 'zh';
}

/** Translate against the current async context's language ({0} params). */
export function tReq(key: I18nKey, ...params: (string | number)[]): string {
  return t(currentLang(), key, ...params);
}

/** Fastify onRequest hook: scope every downstream await of this request to its
 *  declared language. Registers itself on the instance passed in. */
export function registerRequestLanguage(app: {
  addHook: (name: 'onRequest', hook: (req: { headers: Record<string, unknown> }, reply: unknown, done: () => void) => void) => void;
}): void {
  app.addHook('onRequest', (req, _reply, done) => {
    const header = req.headers['x-app-language'];
    const lang = normalizeLang(Array.isArray(header) ? header[0] : header);
    requestLang.run(lang, () => done());
  });
}
