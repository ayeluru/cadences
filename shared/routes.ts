import { z } from 'zod';
import { insertTaskSchema, insertCategorySchema, insertTagSchema, tasks, categories, tags, completions } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  tasks: {
    list: {
      method: 'GET' as const,
      path: '/api/tasks',
      input: z.object({
        search: z.string().optional(),
        categoryId: z.coerce.number().optional(),
        tagId: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<any>()), // Returns TaskWithDetails
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/tasks/:id',
      responses: {
        200: z.custom<any>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/tasks',
      input: insertTaskSchema.extend({
        tagIds: z.array(z.number()).optional(),
      }),
      responses: {
        201: z.custom<any>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/tasks/:id',
      input: insertTaskSchema.partial().extend({
        tagIds: z.array(z.number()).optional(),
      }),
      responses: {
        200: z.custom<any>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/tasks/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    complete: {
      method: 'POST' as const,
      path: '/api/tasks/:id/complete',
      input: z.object({
        notes: z.string().optional(),
        completedAt: z.string().optional(), // Allow manual date override
      }).optional(),
      responses: {
        200: z.custom<any>(), // Returns updated task
        404: errorSchemas.notFound,
      },
    },
  },
  categories: {
    list: {
      method: 'GET' as const,
      path: '/api/categories',
      responses: {
        200: z.array(z.custom<typeof categories.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/categories',
      input: insertCategorySchema,
      responses: {
        201: z.custom<typeof categories.$inferSelect>(),
      },
    },
  },
  tags: {
    list: {
      method: 'GET' as const,
      path: '/api/tags',
      responses: {
        200: z.array(z.custom<typeof tags.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/tags',
      input: insertTagSchema,
      responses: {
        201: z.custom<typeof tags.$inferSelect>(),
      },
    },
  },
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          totalCompletions: z.number(),
          completionsByMonth: z.array(z.object({ date: z.string(), count: z.number() })),
          overdueRate: z.number(),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
