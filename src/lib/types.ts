import type { SubjectSlug } from "@/data/subjects";
import type { Aspect, ExerciseType, Payload, YearsMode } from "./exercises";
import type { MindMapData } from "./mindmap";
import type { TimelineData } from "./timeline";

export type { SubjectSlug, Aspect, YearsMode, ExerciseType, Payload, MindMapData, TimelineData };

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
  /** myšlienková mapa alebo časová os — obe sa generujú a tlačia rovnako */
  kind: "mindmap" | "timeline";
  pages: number[];
  prompt: string;
  title: string;
  data: MindMapData | TimelineData;
  active: boolean;
  created_at: string;
};

export type Exercise = {
  id: string;
  /** krátky kód, unikátny cez celú tabuľku; rodič sa naň odvoláva v promptoch pre AI */
  code: string;
  lesson_id: string;
  type: ExerciseType;
  payload: Payload;
  concept: string;
  level: number;
  /** o akú časť učiva ide — podľa toho sa dajú vypnúť napríklad letopočty */
  aspect: Aspect;
  source_id: string | null;
  enabled: boolean;
  /** prešlo kontrolou AI; rodič vie príznak zhodiť a dať cvičenie skontrolovať znova */
  checked: boolean;
  /** čo kontrole vadilo, keď neprešla */
  check_note: string | null;
  position: number;
  created_at: string;
};

/** Pomenovaný výber cvičení — žiak ho spustí ako samostatný podtréning. */
export type ExerciseSet = {
  id: string;
  lesson_id: string;
  name: string;
  exercise_ids: string[];
  active: boolean;
  position: number;
  created_at: string;
};

/** Obrázok vyrezaný z nafotenej strany učebnice. */
export type Figure = {
  id: string;
  lesson_id: string;
  source_id: string | null;
  page: number;
  path: string;
  caption: string;
  explain: string;
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
  /** čo sa z učiva skúša vzhľadom na letopočty */
  years: YearsMode;
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
