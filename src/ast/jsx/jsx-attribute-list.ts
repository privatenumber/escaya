import { Node, NodeFlags, NodeKind, TransformFlags } from '../node';
import { JsxAttribute } from './jsx-attribute';
import { JsxSpreadAttribute } from './jsx-spread-attribute';

/**
 * Jsx attributes list
 */

export interface JsxAttributesList extends Node {
  readonly attributes: (JsxSpreadAttribute | JsxAttribute)[];
}

export function createJsxAttributesList(
  attributes: (JsxSpreadAttribute | JsxAttribute)[],
  start: number,
  end: number
): JsxAttributesList {
  return {
    kind: NodeKind.JsxAttributesList,
    attributes,
    flags: NodeFlags.None,
    transformFlags: TransformFlags.Jsx,
    parent: null,
    emitNode: null,
    start,
    end
  };
}
