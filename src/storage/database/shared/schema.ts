import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

// 试卷表
export const exams = pgTable(
  "exams",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    total_score: integer("total_score").notNull().default(100),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("exams_created_at_idx").on(table.created_at),
  ]
);

// 题目表
export const questions = pgTable(
  "questions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    exam_id: varchar("exam_id", { length: 36 }).notNull().references(() => exams.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(), // choice: 选择题, blank: 填空题
    content: text("content").notNull(),
    options: jsonb("options"), // 选择题的选项 [{"label": "A", "content": "..."}]
    correct_answer: text("correct_answer").notNull(),
    score: integer("score").notNull().default(5),
    order_index: integer("order_index").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("questions_exam_id_idx").on(table.exam_id),
    index("questions_order_idx").on(table.exam_id, table.order_index),
  ]
);

// 提交记录表
export const submissions = pgTable(
  "submissions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    exam_id: varchar("exam_id", { length: 36 }).notNull().references(() => exams.id, { onDelete: "cascade" }),
    student_name: varchar("student_name", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, scored
    total_score: integer("total_score"),
    submitted_at: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    scored_at: timestamp("scored_at", { withTimezone: true }),
  },
  (table) => [
    index("submissions_exam_id_idx").on(table.exam_id),
    index("submissions_status_idx").on(table.status),
    index("submissions_submitted_at_idx").on(table.submitted_at),
  ]
);

// 答案表
export const answers = pgTable(
  "answers",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    submission_id: varchar("submission_id", { length: 36 }).notNull().references(() => submissions.id, { onDelete: "cascade" }),
    question_id: varchar("question_id", { length: 36 }).notNull().references(() => questions.id, { onDelete: "cascade" }),
    user_answer: text("user_answer"),
    is_correct: boolean("is_correct"),
    score: integer("score").default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("answers_submission_id_idx").on(table.submission_id),
    index("answers_question_id_idx").on(table.question_id),
  ]
);

// Zod Schema 生成
const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({ coerce: { date: true } });

// 试卷 Schema
export const insertExamSchema = createCoercedInsertSchema(exams).pick({ 
  title: true, 
  description: true,
  total_score: true,
});
export type Exam = typeof exams.$inferSelect;
export type InsertExam = z.infer<typeof insertExamSchema>;

// 题目 Schema
export const insertQuestionSchema = createCoercedInsertSchema(questions).pick({
  exam_id: true,
  type: true,
  content: true,
  options: true,
  correct_answer: true,
  score: true,
  order_index: true,
});
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

// 提交记录 Schema
export const insertSubmissionSchema = createCoercedInsertSchema(submissions).pick({
  exam_id: true,
  student_name: true,
  status: true,
  total_score: true,
  scored_at: true,
});
export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;

// 答案 Schema
export const insertAnswerSchema = createCoercedInsertSchema(answers).pick({
  submission_id: true,
  question_id: true,
  user_answer: true,
  is_correct: true,
  score: true,
});
export type Answer = typeof answers.$inferSelect;
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;
