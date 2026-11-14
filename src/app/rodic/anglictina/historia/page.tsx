import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import History from "./history";

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <History />
    </Suspense>
  );
}
