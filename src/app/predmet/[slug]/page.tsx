import { Suspense } from "react";
import { RequireAuth } from "@/components/auth";
import { Spinner } from "@/components/ui";
import LessonPicker from "./lessons";

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireAuth>
        <LessonPicker />
      </RequireAuth>
    </Suspense>
  );
}
