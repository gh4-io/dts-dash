import { Suspense } from "react";
import { PostList } from "@/components/feedback/post-list";

export default function FeedbackPage() {
  return (
    <div className="container max-w-4xl py-6">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <i className="fa-solid fa-spinner fa-spin text-xl text-muted-foreground" />
          </div>
        }
      >
        <PostList />
      </Suspense>
    </div>
  );
}
