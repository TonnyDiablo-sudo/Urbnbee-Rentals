export type BlogPost = {
  slug: string;
  title: string;
  /** ISO date YYYY-MM-DD */
  publishedAt: string;
  excerpt: string;
  paragraphs: string[];
};
