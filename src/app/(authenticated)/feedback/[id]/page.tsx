import { PostDetail } from "@/components/feedback/post-detail";

export default async function FeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="container max-w-4xl py-6">
      <PostDetail postId={id} />
    </div>
  );
}
