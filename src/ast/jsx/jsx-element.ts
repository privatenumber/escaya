import { Node, NodeFlags, NodeKind } from '../node';
import { JsxOpeningElement } from './jsx-opening-element';
import { JsxClosingElement } from './jsx-closing-element';
import { JsxChildrenList } from './jsx-children-list';

/**
 * JsxElement
 */

export interface JsxElement extends Node {
  readonly openingElement: JsxOpeningElement;
  readonly childrenList: JsxChildrenList;
  readonly closingElement: JsxClosingElement;
}

export function createJsxElement(
  openingElement: JsxOpeningElement,
  childrenList: JsxChildrenList,
  closingElement: JsxClosingElement,
  start: number,
  end: number
): JsxElement {
  return {
    kind: NodeKind.JsxElement,
    openingElement,
    childrenList,
    closingElement,
    flags: NodeFlags.None,
    transformFlags: openingElement.transformFlags | childrenList.transformFlags | closingElement.transformFlags,
    parent: null,
    emitNode: null,
    start,
    end
  };
}
