/** UTF-16 offsets into the unchanged decoded source; locations are one-based. */
export interface SourceSpan {
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly column: number;
}

export interface Diagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly path: string;
  readonly span?: SourceSpan;
}

export interface WikiFrontmatter {
  readonly type?: string;
  readonly aliases?: readonly string[];
  readonly about?: readonly string[];
  readonly stale_after?: string;
  readonly url?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly address?: string;
  readonly starts_at?: string;
  readonly ends_at?: string;
  readonly published_at?: string;
  readonly authors?: readonly string[];
  readonly participants?: readonly string[];
  readonly location?: string;
}

export interface Section {
  readonly depth: number;
  readonly text: string;
  readonly anchor: string;
  readonly heading: SourceSpan;
  readonly content: SourceSpan;
  readonly parent?: string;
}

export interface Footnote {
  readonly identifier: string;
  readonly definition?: SourceSpan;
  readonly uses: readonly SourceSpan[];
}

export type ReferenceOrigin = 'link' | 'image' | 'citation' | 'frontmatter';
export type DestinationSyntax =
  | 'markdown'
  | 'angle'
  | 'yaml-plain'
  | 'yaml-single'
  | 'yaml-double'
  | 'yaml-block';

/** One editable destination can have several reference/citation use sites. */
export interface Reference {
  readonly destination: string;
  readonly destinationSpan?: SourceSpan;
  readonly uses: readonly SourceSpan[];
  readonly origin: ReferenceOrigin;
  readonly syntax: DestinationSyntax;
  readonly field?: keyof WikiFrontmatter;
  readonly citation?: string;
  readonly section?: string;
  readonly definition?: string;
}

export interface ParsedDocument {
  readonly path: string;
  readonly sourceHash: string;
  readonly title: string;
  readonly metadata: WikiFrontmatter;
  readonly body: SourceSpan;
  readonly sections: readonly Section[];
  readonly footnotes: readonly Footnote[];
  readonly references: readonly Reference[];
  readonly diagnostics: readonly Diagnostic[];
  /** False when a complete, exact reference rewrite cannot be guaranteed. */
  readonly referencesComplete: boolean;
}

export interface DocumentSnapshot {
  readonly document: ParsedDocument;
  readonly source: string;
}

export interface ParseInput {
  readonly path: string;
  readonly source: string;
  readonly sourceHash: string;
}
