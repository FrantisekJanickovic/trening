import { Suspense } from "react";
import { RequireAuth } from "@/components/auth";
import { Spinner } from "@/components/ui";
import RunnerSwitch from "./switch";

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireAuth>
        <RunnerSwitch />
      </RequireAuth>
    </Suspense>
  );
}
