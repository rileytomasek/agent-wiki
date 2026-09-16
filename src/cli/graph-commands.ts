import { related } from '../operations/related.ts';
import { validate } from '../operations/validate.ts';
import type { Arguments } from './arguments.ts';
import {
  relationshipOptions,
  rejectFilters,
  requireOperands,
} from './command-options.ts';
import { renderRelated, renderValidation } from './graph-output.ts';
import type { CliResult } from './output.ts';

export async function executeGraphCommand(
  args: Arguments,
  root: string
): Promise<CliResult> {
  if (args.command === 'validate') {
    rejectFilters(args);
    return renderValidation(await validate(root, args.operands), args.json);
  }
  requireOperands(args, 1);
  const target = args.operands[0];
  if (target === undefined) throw new Error('related requires a target');
  const result = await related(root, target, relationshipOptions(args));
  return renderRelated(result, args.json);
}
