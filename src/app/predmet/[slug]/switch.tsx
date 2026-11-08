"use client";

import { useParams } from "next/navigation";
import { isVerbSubject } from "@/data/subjects";
import LessonPicker from "./lessons";
import VerbsSetupScreen from "./verbs-setup";

/** Slovesá nemajú lekcie ani strany — majú vlastnú prípravu tréningu. */
export default function PickerSwitch() {
  const slug = String(useParams().slug);
  return isVerbSubject(slug) ? <VerbsSetupScreen /> : <LessonPicker />;
}
