import { Suspense } from "react";
import { RequireAuth } from "@/components/auth";
import { Spinner } from "@/components/ui";
import PickerSwitch from "./switch";

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireAuth>
        <PickerSwitch />
      </RequireAuth>
    </Suspense>
  );
}
