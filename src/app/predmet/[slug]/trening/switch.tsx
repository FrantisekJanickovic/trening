"use client";

import { useParams } from "next/navigation";
import { isVerbSubject } from "@/data/subjects";
import Runner from "./runner";
import VerbsRunner from "./verbs-runner";

/** Tréning slovies si skladá otázky sám, nečíta cvičenia z databázy. */
export default function RunnerSwitch() {
  const slug = String(useParams().slug);
  return isVerbSubject(slug) ? <VerbsRunner /> : <Runner />;
}
