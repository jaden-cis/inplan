// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { detectLostComments, detectReclassifiedSpans, findOrphans } from "../src/diff";
import type { ParsedDocument } from "../src/types";

const comment = { id: "cmt-abc123", author: "a", date: "d", resolved: false, text: "?" };

describe("findOrphans", () => {
  it("flags a span comment with no link", () => {
    const doc: ParsedDocument = { body: "no links", comments: [comment] };
    expect(findOrphans(doc).map((c) => c.id)).toEqual(["cmt-abc123"]);
  });

  it("does not flag an anchored span comment", () => {
    const doc: ParsedDocument = { body: "[x](#cmt-abc123)", comments: [comment] };
    expect(findOrphans(doc)).toEqual([]);
  });

  it("does not flag replies or doc comments", () => {
    const doc: ParsedDocument = {
      body: "no links",
      comments: [
        { id: "cmt-rep001", parentId: "cmt-abc123", author: "a", date: "d", resolved: false, text: "r" },
        { id: "cmt-doc001", anchor: "doc", author: "a", date: "d", resolved: false, text: "d" },
      ],
    };
    expect(findOrphans(doc)).toEqual([]);
  });
});

describe("detectLostComments", () => {
  it("detects a link removed between versions", () => {
    const prev: ParsedDocument = { body: "[x](#cmt-abc123)", comments: [comment] };
    const next: ParsedDocument = { body: "the span was deleted", comments: [comment] };
    expect(detectLostComments(prev, next).map((c) => c.id)).toEqual(["cmt-abc123"]);
  });

  it("treats cut & paste (link moved) as not lost", () => {
    const prev: ParsedDocument = { body: "intro [x](#cmt-abc123) end", comments: [comment] };
    const next: ParsedDocument = { body: "end [x](#cmt-abc123) intro", comments: [comment] };
    expect(detectLostComments(prev, next)).toEqual([]);
  });

  it("does not re-report comments already orphaned in prev", () => {
    const prev: ParsedDocument = { body: "already no link", comments: [comment] };
    const next: ParsedDocument = { body: "still no link", comments: [comment] };
    expect(detectLostComments(prev, next)).toEqual([]);
  });
});

describe("detectReclassifiedSpans", () => {
  it("flags a span comment relabeled anchor: doc, even though it's no longer eligible for findOrphans", () => {
    const prev: ParsedDocument = { body: "[x](#cmt-abc123)", comments: [comment] };
    const reclassified = { ...comment, anchor: "doc" as const };
    const next: ParsedDocument = { body: "no link anymore", comments: [reclassified] };
    // The reclassified comment is invisible to the orphan detector entirely — it's not a span
    // comment in `next`, so findOrphans/detectLostComments never look at it.
    expect(findOrphans(next)).toEqual([]);
    expect(detectLostComments(prev, next)).toEqual([]);
    expect(detectReclassifiedSpans(prev, next).map((c) => c.id)).toEqual(["cmt-abc123"]);
  });

  it("flags a span comment given a parentId instead of anchor: doc", () => {
    const prev: ParsedDocument = { body: "[x](#cmt-abc123)", comments: [comment] };
    const reclassified = { id: comment.id, parentId: "cmt-other", author: "a", date: "d", resolved: false, text: "?" };
    const next: ParsedDocument = { body: "no link anymore", comments: [reclassified] };
    expect(detectReclassifiedSpans(prev, next).map((c) => c.id)).toEqual(["cmt-abc123"]);
  });

  it("does not flag a comment that was already a reply/doc comment in prev", () => {
    const reply = { id: "cmt-rep001", parentId: "cmt-abc123", author: "a", date: "d", resolved: false, text: "r" };
    const prev: ParsedDocument = { body: "x", comments: [reply] };
    const next: ParsedDocument = { body: "x", comments: [{ ...reply, anchor: undefined }] };
    expect(detectReclassifiedSpans(prev, next)).toEqual([]);
  });

  it("does not flag a span comment that's simply still a span comment (orphaned or not)", () => {
    const prev: ParsedDocument = { body: "[x](#cmt-abc123)", comments: [comment] };
    const next: ParsedDocument = { body: "no link anymore", comments: [comment] };
    expect(detectReclassifiedSpans(prev, next)).toEqual([]);
  });

  it("does not flag a span comment deleted outright (that's a different concern — outright deletion)", () => {
    const prev: ParsedDocument = { body: "[x](#cmt-abc123)", comments: [comment] };
    const next: ParsedDocument = { body: "gone", comments: [] };
    expect(detectReclassifiedSpans(prev, next)).toEqual([]);
  });
});
