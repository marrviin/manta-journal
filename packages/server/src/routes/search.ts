import type { Static } from '@sinclair/typebox';
import { tReq } from '../i18n';
import type { FastifyInstance } from 'fastify';

import { SearchBody, SearchResponse } from '../schemas';

export default async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: Static<typeof SearchBody> }>(
    '/search',
    { schema: { body: SearchBody, response: { 200: SearchResponse }, operationId: 'searchMemories' } },
    async (req) => {
      const b = req.body;
      const projectId = b.projectId.trim();
      if (!projectId) throw app.httpErrors.badRequest(tReq('err.projectIdRequired'));
      const query = b.query.trim();
      if (!query) throw app.httpErrors.badRequest(tReq('err.queryRequired'));
      const topK = b.topK !== undefined && b.topK > 0 ? b.topK : 8;
      return { hits: await app.core.semanticSearch(projectId, query, topK) };
    },
  );
}
