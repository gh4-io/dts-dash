import { permanentRedirect } from "next/navigation";
import Link from "next/link";
import { PostDetail } from "@/components/feedback/post-detail";
import { resolveFeedbackPostId } from "@/lib/messages/repository";

/**
 * A post id that resolves to nothing. Kept deliberately plain: the most likely
 * visitor is someone following a link saved before v1.0.0 remapped the ids
 * (OI-099), so the page has to explain that rather than just say "404".
 */
function PostNotFound({ id, reason }: { id?: string; reason: "invalid" | "missing" }) {
  return (
    <div className="container max-w-4xl py-6">
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <i
          className="fa-regular fa-comment-slash mb-4 text-3xl text-muted-foreground"
          aria-hidden
        />
        <h2 className="text-lg font-semibold">Post not found</h2>

        {reason === "invalid" ? (
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            <span className="font-mono">{id}</span> is not a valid post ID.
          </p>
        ) : (
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Post <span className="font-mono">#{id}</span> doesn&apos;t exist. It may have been
            deleted — or the link predates v1.0.0, which renumbered every feedback post. Older links
            are redirected automatically when the original post can still be found.
          </p>
        )}

        <Link
          href="/feedback"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <i className="fa-solid fa-arrow-left" aria-hidden />
          Back to Feedback Board
        </Link>
      </div>
    </div>
  );
}

export default async function FeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Reject anything non-numeric before it reaches the database.
  if (!/^\d+$/.test(id)) return <PostNotFound id={id} reason="invalid" />;

  const resolved = resolveFeedbackPostId(Number(id));
  if (!resolved) return <PostNotFound id={id} reason="missing" />;

  // A pre-v1.0.0 id. Send the browser to the canonical URL so the address bar
  // stops lying and a re-bookmark records the id that actually exists.
  // permanentRedirect (308) rather than redirect (307): the move is permanent.
  if (resolved.moved) permanentRedirect(`/feedback/${resolved.id}`);

  return (
    <div className="container max-w-4xl py-6">
      <PostDetail postId={resolved.id} />
    </div>
  );
}
