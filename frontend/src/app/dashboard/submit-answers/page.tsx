import { Suspense } from "react";
import SubmitAnswersPage from "./SubmitAnswersPage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SubmitAnswersPage />
    </Suspense>
  );
}