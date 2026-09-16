import type { ExternalTarget } from './types.ts';

export interface ExternalIdentity {
  readonly target: ExternalTarget;
  readonly selector?: string;
}

export function isExternalReference(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:/iu.test(value) || value.startsWith('//');
}

/** Recognition is offline; selectors stay on references and generic URL identity stays conservative. */
export function externalIdentity(value: string): ExternalIdentity | undefined {
  if (!isExternalReference(value)) return undefined;
  try {
    const relative = value.startsWith('//');
    const url = new URL(relative ? `https:${value}` : value);
    const recognized = relative ? undefined : githubIdentity(url);
    if (recognized !== undefined) return recognized;
    const canonical = relative ? url.href.slice('https:'.length) : url.href;
    return {
      target: { id: `external:${canonical}`, kind: 'external', url: canonical },
    };
  } catch {
    return undefined;
  }
}

interface GithubResource {
  readonly namespace: string;
  readonly resource: NonNullable<ExternalTarget['resource']>;
  readonly path: string;
}

function githubIdentity(url: URL): ExternalIdentity | undefined {
  if (
    url.hostname !== 'github.com' ||
    !['http:', 'https:'].includes(url.protocol)
  )
    return undefined;
  if (url.username !== '' || url.password !== '' || url.port !== '')
    return undefined;
  const resource = githubResource(url.pathname);
  if (resource === undefined) return undefined;
  const canonical = `https://${url.host}/${resource.namespace}/${resource.path}`;
  const selector = url.href.slice(url.origin.length + url.pathname.length);
  return {
    target: {
      id: `github:${url.host}:${resource.namespace}:${resource.path}`,
      kind: 'external',
      url: canonical,
      provider: 'github',
      host: url.host,
      namespace: resource.namespace,
      resource: resource.resource,
    },
    ...(selector === '' ? {} : { selector }),
  };
}

function githubResource(path: string): GithubResource | undefined {
  const parts = githubParts(path);
  if (parts === undefined) return undefined;
  const { namespace, kind } = parts;
  if (kind === 'blob') return fileResource(namespace, parts.remainder);
  const remainder = parts.remainder.replace(/\/$/u, '');
  if (kind === 'commit' && /^[a-f\d]{7,40}$/iu.test(remainder)) {
    return {
      namespace,
      resource: 'commit',
      path: `commit/${remainder.toLowerCase()}`,
    };
  }
  if (!/^[1-9]\d*$/u.test(remainder)) return undefined;
  if (kind === 'pull')
    return { namespace, resource: 'pull-request', path: `pull/${remainder}` };
  if (kind === 'issues')
    return { namespace, resource: 'issue', path: `issues/${remainder}` };
  return undefined;
}

function fileResource(
  namespace: string,
  remainder: string
): GithubResource | undefined {
  if (!/^[^/]+(?:\/[^/]+)+$/u.test(remainder)) return undefined;
  return { namespace, resource: 'file', path: `blob/${remainder}` };
}

interface GithubParts {
  readonly namespace: string;
  readonly kind: string;
  readonly remainder: string;
}

function githubParts(path: string): GithubParts | undefined {
  const match = /^\/([^/]+)\/([^/]+)\/(pull|issues|commit|blob)\/(.+)$/u.exec(
    path
  );
  const [, owner, repository, kind, remainder] = match ?? [];
  if (
    owner === undefined ||
    repository === undefined ||
    kind === undefined ||
    remainder === undefined
  )
    return undefined;
  return { namespace: `${owner}/${repository}`.toLowerCase(), kind, remainder };
}
