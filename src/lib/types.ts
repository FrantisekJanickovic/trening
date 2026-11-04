import type { SubjectSlug } from "@/data/subjects";
import type { ExerciseType, Payload } from "./exercises";
import type { MindMapData } from "./mindmap";

export type { SubjectSlug, ExerciseType, Payload, MindMapData };

export type Child = { id: string; name: string; avatar: string; grade: number };

export type Subject = { id: string; slug: SubjectSlug; name: string; icon: string; position: number };

export type Lesson = {
  id: string;
  subject: SubjectSlug;
  grade: number | null;
  title: string;
  position: number;
  created_at: string;
};

export type LessonWithCounts = Lesson & { exercises: number; sources: number };

/** Prepísaná časť materiálu, z ktorej vznikli cvičenia. */
export type Source = {
  id: string;
  lesson_id: string;
  page: number;
  heading: string | null;
  text: string;
  position: number;
};

/** Myšlienková mapa k lekcii; prázdne `pages` znamená celú kapitolu. */
export type Mindmap = {
  id: string;
  lesson_id: string;
  pages: number[];
  prompt: string;
  title: string;
  data: MindMapData;
  active: boolean;
  created_at: string;
};

export type Exercise = {
  id: string;
  lesson_id: string;
  type: ExerciseType;
  payload: Payload;
  concept: string;
  level: number;
  source_id: string | null;
  enabled: boolean;
  position: number;
  created_at: string;
};

export type Progress = {
  id: string;
  child_id: string;
  exercise_id: string;
  wrong_count: number;
  sessions_count: number;
  correct_streak: number;
  mastered: boolean;
  mastered_at: string | null;
  first_seen_at: string;
  last_wrong_at: string | null;
  last_session_id: string | null;
};

export type SessionRow = {
  id: string;
  child_id: string;
  subject: SubjectSlug;
  lesson_ids: string[];
  mode: "normal" | "focus";
  planned: number;
  correct: number;
  score: number;
  duration_sec: number;
  summary: { wrong?: { id: string; concept: string; preview: string }[]; masteredNow?: number; byType?: Record<string, { total: number; correct: number }> };
  created_at: string;
};

export type Notification = {
  id: string;
  child_id: string | null;
  subject: SubjectSlug;
  session_id: string | null;
  kind: "session_done" | "low_score";
  title: string;
  body: string;
  score: number | null;
  read_at: string | null;
  created_at: string;
};

/** Nastavenia predmetu pre celú rodinu. */
export type SubjectConfig = {
  enabled: boolean;
  /** ktoré typy cvičení sa generujú a trénujú */
  types: Record<ExerciseType, boolean>;
  /** koľko cvičení vyrobiť z jedného materiálu */
  generateCount: number;
  /** koľko správnych odpovedí za sebou znamená zvládnuté */
  masteryStreak: number;
  encouragement: boolean;
  sounds: boolean;
  allowExit: boolean;
  /** notifikácia rodičovi po dokončení tréningu a pri slabom skóre */
  notifyOnFinish: boolean;
  lowScore: number;
};
