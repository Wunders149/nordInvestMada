import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email format').max(200),
  phone: z.string().max(50).default(''),
  projectType: z.string().min(1, 'Project type is required').max(100),
  budget: z.string().max(100).default(''),
  message: z.string().min(1, 'Message is required').max(5000),
  serviceType: z.string().max(100).optional()
});

export const newsletterSchema = z.object({
  email: z.string().email('Email invalide')
});

export const quoteSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email format').max(200),
  serviceType: z.string().min(1, 'Service type is required').max(100),
  details: z.string().min(1, 'Details are required').max(10000),
  location: z.string().max(200).default('')
});

export const pricingSchema = z.object({
  serviceType: z.string().min(1, 'Service type is required'),
  squareMeters: z.string().or(z.number()).refine(
    v => { const n = typeof v === 'string' ? parseFloat(v) : v; return !isNaN(n) && n > 0; },
    { message: 'Invalid square meters value' }
  ),
  finishingLevel: z.string().min(1, 'Finishing level is required'),
  location: z.string().optional(),
  projectType: z.string().optional()
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

const contentCommonSchema = {
  order: z.coerce.number().int().min(0).max(100000).optional(),
  visible: z.boolean().optional()
};

export const adminContentSchemas = {
  team: {
    create: z.object({
      name: z.string().trim().min(1).max(200),
      role: z.string().trim().min(1).max(200),
      groupType: z.enum(['office', 'field']).default('office'),
      bio: z.string().max(5000).default(''),
      imageSlot: z.string().max(200).default(''),
      ...contentCommonSchema
    }),
    update: z.object({
      name: z.string().trim().min(1).max(200).optional(),
      role: z.string().trim().min(1).max(200).optional(),
      groupType: z.enum(['office', 'field']).optional(),
      bio: z.string().max(5000).optional(),
      imageSlot: z.string().max(200).optional(),
      ...contentCommonSchema
    }).partial()
  },
  services: {
    create: z.object({
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().min(1).max(5000),
      icon: z.string().max(40).default(''),
      imageSlot: z.string().max(200).default(''),
      ...contentCommonSchema
    }),
    update: z.object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().min(1).max(5000).optional(),
      icon: z.string().max(40).optional(),
      imageSlot: z.string().max(200).optional(),
      ...contentCommonSchema
    }).partial()
  },
  projects: {
    create: z.object({
      title: z.string().trim().min(1).max(200),
      location: z.string().max(200).default(''),
      description: z.string().max(5000).default(''),
      category: z.enum(['construction', 'rehabilitation', 'forage']).optional(),
      image: z.string().max(2000).default(''),
      ...contentCommonSchema
    }),
    update: z.object({
      title: z.string().trim().min(1).max(200).optional(),
      location: z.string().max(200).optional(),
      description: z.string().max(5000).optional(),
      category: z.enum(['construction', 'rehabilitation', 'forage']).optional(),
      image: z.string().max(2000).optional(),
      ...contentCommonSchema
    }).partial()
  },
  blog: {
    create: z.object({
      title: z.string().trim().min(1).max(200),
      slug: z.string().trim().max(220).regex(/^[a-z0-9-]*$/, 'Slug invalide').default(''),
      date: z.string().max(40).default(''),
      excerpt: z.string().max(2000).default(''),
      content: z.string().max(50000).default(''),
      categoryId: z.string().max(200).default(''),
      image: z.string().max(2000).default(''),
      published: z.boolean().default(true)
    }),
    update: z.object({
      title: z.string().trim().min(1).max(200).optional(),
      slug: z.string().trim().max(220).regex(/^[a-z0-9-]*$/, 'Slug invalide').optional(),
      date: z.string().max(40).optional(),
      excerpt: z.string().max(2000).optional(),
      content: z.string().max(50000).optional(),
      categoryId: z.string().max(200).optional(),
      image: z.string().max(2000).optional(),
      published: z.boolean().optional()
    }).partial()
  }
};

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }));
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    req.body = result.data;
    next();
  };
}
