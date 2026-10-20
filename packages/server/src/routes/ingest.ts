import type { Static } from '@sinclair/typebox';
import { tReq } from '../i18n';
import type { FastifyInstance } from 'fastify';

import { IngestBody, IngestResponse } from '../schemas';

export default async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: Static<typeof IngestBody> }>(
    '/ingest',
    { schema: { body: IngestBody, response: { 200: IngestResponse }, operationId: 'ingestFacts' } },
    async (req) => {
      const b = req.body;
      const projectId = b.projectId.trim();
      if (!projectId) throw app.httpErrors.badRequest(tReq('err.projectIdRequired'));
      const raw = b.raw.trim();
      if (!raw) throw app.httpErrors.badRequest(tReq('err.contentRequired'));
      const meta = {
        agent: b.meta?.agent ?? 'unknown',
        type: b.meta?.type ?? 'local-memory',
        source: b.meta?.source ?? '',
      };
      return app.core.ingest(projectId, raw, meta, new Set(b.preferExisting ?? []), b.sourceMtime);
    },
  );
}
