type Scalar = string | number | boolean;
type ScalarArray = readonly string[] | readonly number[] | readonly boolean[];

export type Metadata = Readonly<Record<string, Scalar | ScalarArray>>;

/** Native QMD predicates; all conditions are applied during retrieval. */
export type MetadataFilter =
  | {
      readonly operator: 'and' | 'or';
      readonly operands: readonly MetadataFilter[];
    }
  | { readonly operator: 'not'; readonly operand: MetadataFilter }
  | {
      readonly key: string;
      readonly operator: 'eq' | 'ne';
      readonly value: Scalar;
    }
  | {
      readonly key: string;
      readonly operator: 'lt' | 'lte' | 'gt' | 'gte';
      readonly value: string | number;
    }
  | {
      readonly key: string;
      readonly operator: 'in' | 'nin' | 'all';
      readonly value: ScalarArray;
    }
  | {
      readonly key: string;
      readonly operator: 'exists';
      readonly value: boolean;
    };
