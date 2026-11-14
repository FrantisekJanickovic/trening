export type Lang = "en" | "sk";
export type Direction = "en_sk" | "sk_en" | "mixed";
export type HintMode = "blanks" | "audio" | "reveal";
export type AnswerMode = "written" | "oral";
export type GrammarMode = "choice" | "typing";
export type Level = "zaciatocnik" | "mierne_pokrocily" | "pokrocily";

export type MethodKey = "classic" | "flashcards" | "match" | "scramble" | "dictation" | "speed" | "shadowing" | "dualCoding" | "gamification";

export type ChildSettings = {
  voice: "female" | "male";
  encouragement: boolean;
  motivation: boolean;
  answerMode: AnswerMode;
  direction: Direction;
  hintMode: HintMode;
  grammarMode: GrammarMode;
  wordsPerSession: number; // 0 = all
  slowSpeech: boolean;
  dailyGoal: number;
  methods: Record<MethodKey, boolean>;
};

export type Questionnaire = {
  strengths?: string[];
  weaknesses?: string[];
  likes?: string[];
  attention?: "short" | "medium" | "long";
  notes?: string;
};

export type Child = {
  id: string;
  name: string;
  avatar: string;
  grade: number;
  level: Level;
  questionnaire: Questionnaire;
  settings: Partial<ChildSettings>;
  xp: number;
  streak_days: number;
  last_practice_date: string | null;
};

export type Lesson = {
  id: string;
  title: string;
  textbook: string | null;
  unit: string | null;
  grade: number | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type VocabItem = {
  id: string;
  lesson_id: string;
  en: string;
  sk: string;
  example_en: string | null;
  example_sk: string | null;
  emoji: string | null;
  position: number;
  source_id?: string | null;
};

export type GrammarItem = {
  id: string;
  lesson_id: string;
  prompt: string;
  answer: string;
  options: string[];
  translation_sk: string | null;
  explanation_sk: string | null;
  position: number;
  source_id?: string | null;
};

export type Sentence = { id?: string; en: string; sk: string };

/** What a text is used for in a session. */
export type TextUse = "reading" | "listening" | "writing";

export type LessonText = {
  id: string;
  lesson_id: string;
  title: string | null;
  sentences: Sentence[];
  uses: TextUse[];
  position: number;
  source_id?: string | null;
};

/** Practice types a parent can assign to an exercise from the textbook. */
export type SourceType = "vocab" | "grammar" | "reading" | "listening" | "writing" | "skip";

/** One exercise transcribed from a textbook photo. */
export type LessonSource = {
  id: string;
  lesson_id: string;
  page: number;
  label: string | null;
  instruction: string | null;
  content: string;
  note: string | null;
  types: SourceType[];
  suggested: SourceType[];
  applied_types: SourceType[] | null;
  applied_at: string | null;
  position: number;
};

export type ItemType = "vocab" | "grammar" | "sentence";

/** A question the child struggled with, kept per lesson until it is mastered. */
export type ProblemItem = {
  id: string;
  child_id: string;
  lesson_id: string;
  item_type: ItemType | "pronunciation";
  item_id: string;
  label: string;
  detail: string | null;
  last_answer: string | null;
  wrong_count: number;
  sessions_count: number;
  correct_streak: number;
  mastered: boolean;
  mastered_at: string | null;
  first_seen_at: string;
  last_wrong_at: string | null;
  last_session_id: string | null;
};

/** Training settings of the whole family account. */
export type GlobalConfig = {
  reviewPrevious: boolean;
  previousLessons: number;
  previousMax: number;
  masteryStreak: number;
  maxSavedPerSession: number;
};

export type ItemProgress = {
  child_id: string;
  item_type: ItemType;
  item_id: string;
  box: number;
  due_at: string;
  correct_count: number;
  wrong_count: number;
  last_seen: string | null;
};

export type SessionRow = {
  id: string;
  child_id: string;
  lesson_ids: string[];
  config: Record<string, unknown>;
  started_at: string;
  ended_at: string | null;
  total: number;
  correct: number;
  xp_earned: number;
  summary: SessionSummary;
};

export type SessionSummary = {
  durationSec?: number;
  activities?: { key: ActivityKey; label: string; total: number; correct: number }[];
  problemWords?: { id: string; en: string; sk: string }[];
  problems?: { label: string }[];
  lessonTitles?: string[];
  reviewCount?: number;
  masteredNow?: number;
};

export type ActivityKey =
  "flashcards" | "classic" | "match" | "scramble" | "dictation" | "speed" | "shadowing" | "grammar" | "writing" | "reading" | "listening";
