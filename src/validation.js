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
