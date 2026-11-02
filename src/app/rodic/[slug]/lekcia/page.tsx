import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import LessonEditor from "./editor";

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <LessonEditor />
    </Suspense>
  );
}
