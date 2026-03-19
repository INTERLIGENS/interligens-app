/**
 * src/lib/surveillance/social/providers/types.ts
 */

export interface PostRef {
  postId: string;
  postUrl: string;
  postedAtUtc?: Date;
  textSnippet?: string;
}

export interface SocialProvider {
  name: string;
  fetchLatest(handle: string, sincePostId?: string): Promise<PostRef[]>;
}
