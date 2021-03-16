/**
 * Every single valid AST Node type.
 */
export interface Node {
  type?: string;
  meta?: NodeMeta;
  flags?: NodeFlags;
  start?: number;
  end?: number;
}

/**
 * Every single valid CST Node type.
 */
export interface NodeMeta {
  asi?: boolean;
  newlineBeforeNextToken?: boolean;
}

export const enum NodeFlags {
  /**
   * This node has no flags.
   */
  None = 0,
  /**
   * This node has some diagnostics associated with it.
   */
  HasErrors = 1 << 1,
  /**
   * This node was inserted by the compiler.
   */
  Synthetic = 1 << 2,
  /**
   * This node has side effects.
   */
  HasSideEffects = 1 << 3
}
