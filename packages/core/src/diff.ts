// SPDX-License-Identifier: AGPL-3.0-or-later

import { extractAnchorIds } from "./anchors";
import { isSpanComment, type Comment, type ParsedDocument } from "./types";

/**
 * Span comments in a document whose in-body anchor link is missing — i.e.
 * orphaned comments. (Position-independent: an anchor only counts as present if
 * the `#cmt-<id>` link exists somewhere in the body.)
 */
export function findOrphans(doc: ParsedDocument): Comment[] {
  const links = extractAnchorIds(doc.body);
  return doc.comments.filter((c) => isSpanComment(c) && !links.has(c.id));
}

/**
 * Comments that became orphaned by the change from `prev` to `next` — a span
 * comment still present in `next` whose anchor link disappeared. This is the set
 * the `wait` gate reports for agent edits (and that user edits auto-accept + log).
 *
 * Comments that were already orphaned in `prev` are not re-reported.
 */
export function detectLostComments(prev: ParsedDocument, next: ParsedDocument): Comment[] {
  const previouslyOrphaned = new Set(findOrphans(prev).map((c) => c.id));
  return findOrphans(next).filter((c) => !previouslyOrphaned.has(c.id));
}

/**
 * Comments that were a span comment in `prev` — regardless of whether their link still existed
 * there — but, while still present in `next`, are no longer classified as one (relabeled
 * `anchor: "doc"`, or given a `parentId`).
 *
 * This is a *different* dodge than orphaning: `findOrphans` only ever considers comments that are
 * STILL a span comment in the document being scanned, so the instant an edit reclassifies one away
 * from that shape, it stops being eligible for orphan detection at all — from that edit onward it
 * reads as an ordinary, always-valid doc-level/reply comment with no history of ever needing a
 * link. Relabeling instead of just dropping the link would otherwise let a comment slip out of the
 * orphan-confirmation gate entirely, never once appearing in `detectLostComments`.
 */
export function detectReclassifiedSpans(prev: ParsedDocument, next: ParsedDocument): Comment[] {
  const prevSpanIds = new Set(prev.comments.filter(isSpanComment).map((c) => c.id));
  const nextById = new Map(next.comments.map((c) => [c.id, c]));
  const out: Comment[] = [];
  for (const id of prevSpanIds) {
    const c = nextById.get(id);
    if (c !== undefined && !isSpanComment(c)) out.push(c);
  }
  return out;
}
