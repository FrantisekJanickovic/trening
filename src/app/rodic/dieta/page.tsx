import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import ChildEditor from "./editor";

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <ChildEditor />
    </Suspense>
  );
}
