import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { RequireAuth } from "@/components/auth";
import SessionPage from "./session";

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireAuth>
        <SessionPage />
      </RequireAuth>
    </Suspense>
  );
}
