import { isAlias, isNode, isScalar, isSeq } from 'yaml';
import type { Document, Scalar } from 'yaml';

import { resolveYamlNode } from './frontmatter-fields.ts';
import { sourceSpan } from './spans.ts';
import type {
  DestinationSyntax,
  ParseInput,
  Reference,
  SourceSpan,
  WikiFrontmatter,
} from './types.ts';

export interface FrontmatterContext {
  readonly input: ParseInput;
  readonly document: Document;
  readonly offset: number;
}

export function yamlSpan(
  node: unknown,
  context: FrontmatterContext
): SourceSpan {
  const range = isNode(node) ? node.range : undefined;
  return sourceSpan(
    context.input.source,
    context.offset + (range?.[0] ?? 0),
    context.offset + (range?.[1] ?? 0)
  );
}

function scalarSyntax(node: Scalar): DestinationSyntax {
  if (node.type === 'QUOTE_SINGLE') return 'yaml-single';
  if (node.type === 'QUOTE_DOUBLE') return 'yaml-double';
  if (node.type === 'BLOCK_FOLDED' || node.type === 'BLOCK_LITERAL') {
    return 'yaml-block';
  }
  return 'yaml-plain';
}

function scalarReference(
  node: unknown,
  field: keyof WikiFrontmatter,
  context: FrontmatterContext
): Reference | undefined {
  const scalar = resolveYamlNode(node, context.document);
  if (!isScalar(scalar) || typeof scalar.value !== 'string') return undefined;
  const span = yamlSpan(node, context);
  const editable = !isAlias(node) && scalar.anchor === undefined;
  return {
    destination: scalar.value,
    ...(editable ? { destinationSpan: span } : {}),
    uses: [span],
    origin: 'frontmatter',
    syntax: scalarSyntax(scalar),
    field,
  };
}

/** Alias-backed destinations remain visible but cannot safely share an edit. */
export function frontmatterReferences(
  field: keyof WikiFrontmatter,
  node: unknown,
  context: FrontmatterContext
): readonly Reference[] {
  const resolved = resolveYamlNode(node, context.document);
  const values = isSeq(resolved) ? resolved.items : [node];
  return values.flatMap((value) => {
    const reference = scalarReference(value, field, context);
    if (reference === undefined) return [];
    if (!isAlias(node)) return [reference];
    const { destinationSpan: _destinationSpan, ...readonlyReference } =
      reference;
    return [{ ...readonlyReference, uses: [yamlSpan(node, context)] }];
  });
}
