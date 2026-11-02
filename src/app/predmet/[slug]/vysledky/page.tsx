import { Suspense } from "react";
import { RequireAuth } from "@/components/auth";
import { Spinner } from "@/components/ui";
import Results from "./results";

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireAuth>
        <Results />
      </RequireAuth>
    </Suspense>
  );
}
