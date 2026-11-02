"use client";

import type { SubjectSlug } from "@/data/subjects";
import type { ExerciseType, Payload } from "./exercises";
import { supabase } from "./supabase";
import type { Child, Exercise, Lesson, LessonWithCounts, Notification, Progress, SessionRow, Source, Subject } from "./types";

export async function listChildren(): Promise<Child[]> {
  const { data, error } = await supabase().from("children").select("id, name, avatar, grade").order("created_at");
  if (error) throw error;
  return (data ?? []) as Child[];
}

export async function getChild(id: string): Promise<Child | null> {
  const { data } = await supabase().from("children").select("id, name, avatar, grade").eq("id", id).maybeSingle();
  return (data as Child | null) ?? null;
}

export async function loadSubjects(): Promise<Subject[]> {
  const { data, error } = await supabase().from("tr_subjects").select("*").order("position");
  if (error) throw error;
  return (data ?? []) as Subject[];
}

export async function loadLessons(subject: SubjectSlug): Promise<LessonWithCounts[]> {
  const { data, error } = await supabase()
    .from("tr_lessons")
    .select("*, tr_exercises(count), tr_sources(count)")
    .eq("subject", subject)
    .order("grade")
    .order("position");
  if (error) throw error;
  type Row = Lesson & { tr_exercises?: { count: number }[]; tr_sources?: { count: number }[] };
  return ((data ?? []) as Row[]).map((l) => ({ ...l, exercises: l.tr_exercises?.[0]?.count ?? 0, sources: l.tr_sources?.[0]?.count ?? 0 }));
}

export async function getLesson(id: string): Promise<Lesson | null> {
  const { data } = await supabase().from("tr_lessons").select("*").eq("id", id).maybeSingle();
  return (data as Lesson | null) ?? null;
}

export async function loadSources(lessonId: string): Promise<Source[]> {
  const { data, error } = await supabase().from("tr_sources").select("*").eq("lesson_id", lessonId).order("position");
  if (error) throw error;
  return (data ?? []) as Source[];
}

export async function loadExercises(lessonIds: string[], onlyEnabled = false): Promise<Exercise[]> {
  if (!lessonIds.length) return [];
  let q = supabase().from("tr_exercises").select("*").in("lesson_id", lessonIds).order("position").limit(2000);
  if (onlyEnabled) q = q.eq("enabled", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Exercise[];
}

export async function loadProgress(childId: string, exerciseIds?: string[]): Promise<Progress[]> {
  let q = supabase().from("tr_progress").select("*").eq("child_id", childId).limit(3000);
  if (exerciseIds?.length) q = q.in("exercise_id", exerciseIds);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Progress[];
}

export async function loadSessions(subject?: SubjectSlug, childId?: string, limit = 200): Promise<SessionRow[]> {
  let q = supabase().from("tr_sessions").select("*").order("created_at", { ascending: false }).limit(limit);
  if (subject) q = q.eq("subject", subject);
  if (childId) q = q.eq("child_id", childId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}

export async function loadNotifications(limit = 30): Promise<Notification[]> {
  const { data, error } = await supabase().from("tr_notifications").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  await supabase().from("tr_notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
}

export type NewExercise = { lesson_id: string; type: ExerciseType; payload: Payload; concept: string; level: number; source_id?: string | null };

export async function insertExercises(rows: NewExercise[]) {
  if (!rows.length) return;
  const { error } = await supabase().from("tr_exercises").insert(rows);
  if (error) throw error;
}
