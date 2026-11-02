import { Suspense } from "react";
import { RequireAuth } from "@/components/auth";
import { Spinner } from "@/components/ui";
import SubjectPicker from "./picker";

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireAuth>
        <SubjectPicker />
      </RequireAuth>
    </Suspense>
  );
}
