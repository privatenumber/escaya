import { Node, NodeFlags, NodeKind } from '../node';
import { JsxIdentifier } from './jsx-identifier';
import { JsxNamespacedName } from './jsx-namespaced-name';
import { JsxTagNamePropertyAccess } from './jsx-tag-name-property-access';
import { ThisExpression } from '../expressions/this-expr';
import { JsxAttributesList } from './jsx-attribute-list';

/**
 * Jsx opening element
 */

export interface JsxOpeningElement extends Node {
  readonly tagName: ThisExpression | JsxNamespacedName | JsxIdentifier | JsxTagNamePropertyAccess;
  readonly attributesList: JsxAttributesList;
  readonly typeArguments: any;
}

export function createJsxOpeningElement(
  tagName: ThisExpression | JsxNamespacedName | JsxIdentifier | JsxTagNamePropertyAccess,
  attributesList: JsxAttributesList,
  typeArguments: any,
  start: number,
  end: number
): JsxOpeningElement {
  return {
    kind: NodeKind.JsxOpeningElement,
    tagName,
    attributesList,
    typeArguments,
    flags: NodeFlags.None,
    transformFlags: tagName.transformFlags | attributesList.transformFlags,
    parent: null,
    emitNode: null,
    start,
    end
  };
}
