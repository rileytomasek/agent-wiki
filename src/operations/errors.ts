export class OperationError extends Error {
  readonly code: string;
  readonly candidates: readonly string[];

  constructor(
    code: string,
    message: string,
    candidates: readonly string[] = []
  ) {
    super(message);
    this.name = 'OperationError';
    this.code = code;
    this.candidates = candidates;
  }
}
