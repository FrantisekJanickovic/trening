import { Suspense } from "react";
import { RequireAuth } from "@/components/auth";
import { Spinner } from "@/components/ui";
import GalleryView from "./view";

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireAuth>
        <GalleryView />
      </RequireAuth>
    </Suspense>
  );
}
