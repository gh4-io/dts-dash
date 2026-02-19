import { PostDetail } from "@/components/feedback/post-detail";
import Link from "next/link";

export default async function FeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);

  if (isNaN(numericId)) {
    return (
      <div className="container max-w-4xl py-6">
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <h2 className="text-lg font-semibold">Invalid post ID</h2>
          <Link href="/feedback" className="mt-2 text-sm text-primary hover:underline">
            Back to Feedback Board
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6">
      <PostDetail postId={numericId} />
    </div>
  );
}
