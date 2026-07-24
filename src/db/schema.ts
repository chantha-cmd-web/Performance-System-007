import { pgTable, text, serial, real, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Define the 'users' table.
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  password: text('password').notNull(),
  role: text('role').notNull(),
  email: text('email'),
  position: text('position'),
  department: text('department'),
  campus: text('campus'),
  supervisorId: text('supervisor_id'),
  supporterId: text('supporter_id'),
  evalModel: text('eval_model'),
  status: text('status').default('Active'),
});

// Define the 'employees' table.
export const employees = pgTable('employees', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  khmerName: text('khmer_name'),
  campus: text('campus'),
  department: text('department'),
  position: text('position'),
  category: text('category'),
  supervisorId: text('supervisor_id'),
  supporterId: text('supporter_id'),
  managementId: text('management_id'),
  evalCondition: text('eval_condition'),
  evalModel: text('eval_model'),
  evalPeriod: text('eval_period'),
  status: text('status').default('Active'),
  email: text('email'),
  role: text('role').default('user'),
});

// Define the 'evaluations' table.
export const evaluations = pgTable('evaluations', {
  id: serial('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  employeeName: text('employee_name').notNull(),
  campus: text('campus').notNull(),
  position: text('position').notNull(),
  appraiser: text('appraiser').notNull(),
  reviewDate: text('review_date').notNull(),
  weightScheme: text('weight_scheme').notNull(),
  evaluationType: text('evaluation_type').default('management'),
  totalSelf: real('total_self').notNull(),
  totalSuper: real('total_super').notNull(),
  overallScore: real('overall_score').notNull(),
  createdBy: text('created_by').notNull(),
  createdByName: text('created_by_name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  evaluatorComments: text('evaluator_comments').default(''),
  status: text('status').default('Draft'),
  department: text('department'),
  evalPeriod: text('eval_period'),
  supporter: text('supporter'),
});

// Define the 'criteria_scores' table.
export const criteriaScores = pgTable('criteria_scores', {
  id: serial('id').primaryKey(),
  evaluationId: integer('evaluation_id').references(() => evaluations.id),
  criteriaId: integer('criteria_id'),
  selfScore: real('self_score'),
  superScore: real('super_score'),
  supporterScore: real('supporter_score').default(0),
  managementScore: real('management_score').default(0),
  aspScore: real('asp_score').default(0),
});

// Define the 'peer_feedback' table.
export const peerFeedback = pgTable('peer_feedback', {
  id: serial('id').primaryKey(),
  evaluationId: integer('evaluation_id').references(() => evaluations.id),
  peerName: text('peer_name'),
  feedback: text('feedback'),
  score: real('score'),
});

// Define the 'app_settings' table.
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Define the 'audit_logs' table.
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  action: text('action').notNull(),
  details: text('details'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// Relations
export const evaluationsRelations = relations(evaluations, ({ many }) => ({
  scores: many(criteriaScores),
  feedbacks: many(peerFeedback),
}));

export const criteriaScoresRelations = relations(criteriaScores, ({ one }) => ({
  evaluation: one(evaluations, {
    fields: [criteriaScores.evaluationId],
    references: [evaluations.id],
  }),
}));

export const peerFeedbackRelations = relations(peerFeedback, ({ one }) => ({
  evaluation: one(evaluations, {
    fields: [peerFeedback.evaluationId],
    references: [evaluations.id],
  }),
}));
