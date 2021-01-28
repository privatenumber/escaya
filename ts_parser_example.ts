
// ScriptBody : StatementList
export function parseScriptBody(parser: ParserState, context: Context): ScriptBody {
  const start = parser.startPos;
  const statements: Statement[] = [];

  while (parser.token !== Token.EndOfSource) {
    if (parser.token & Constants.SourceElements) {
      statements.push(getCurrentNode(parser, context, parseStatementListItem));
      continue;
    }

    reportErrorDiagnostic(
      parser,
      0,
      parser.token === Token.PrivateIdentifier
        ? DiagnosticCode.Private_identifiers_are_not_allowed_outside_class_bodies
        : DiagnosticCode.Declaration_or_statement_expected
    );

    // '/' in an statement position should be parsed as an unterminated regular expression
    nextToken(parser, context | Context.AllowRegExp);
  }
  return createScriptBody(statements, parser.nodeflags, start, parser.startPos);
}

// ScriptBody : StatementList
// ModuleBody :
//   ModuleItemList
export function parseModuleBody(parser: ParserState, context: Context): ModuleBody {
  const start = parser.startPos;
  const statements: Statement[] = [];

  while (parser.token !== Token.EndOfSource) {
    if (parser.token & Constants.SourceElements) {
      statements.push(getCurrentNode(parser, context, parseModuleItemList));
      continue;
    }

    reportErrorDiagnostic(
      parser,
      0,
      parser.token === Token.PrivateIdentifier
        ? DiagnosticCode.Private_identifiers_are_not_allowed_outside_class_bodies
        : DiagnosticCode.Declaration_or_statement_expected
    );

    // '/' in an statement position should be parsed as an unterminated regular expression
    nextToken(parser, context | Context.AllowRegExp);
  }

  return createModuleBody(statements, parser.nodeflags, start, parser.startPos);
}

function parseModuleItemList(parser: ParserState, context: Context): Statement {
  switch (parser.token) {
    case Token.ImportKeyword:
      if (lookAhead(parser, context, nextTokenCanFollowImportKeyword)) {
        return parseImportDeclaration(parser, context);
      }
      return parseExpressionOrLabeledStatement(parser, context, /* allowFunction */ false);
    case Token.ExportKeyword:
      return parseExportDeclaration(parser, context);
    default:
      return parseStatementListItem(parser, context);
  }
}

function nextTokenIsFunctionKeywordOnSameLine(parser: ParserState, context: Context): boolean {
  nextToken(parser, context);
  return parser.token === Token.FunctionKeyword && (parser.nodeflags & NodeFlags.PrecedingLineBreak) === 0;
}

// StatementListItem :
//   Statement
//   Declaration
//
// Declaration :
//   HoistableDeclaration
//   ClassDeclaration
//   LexicalDeclaration
function parseStatementListItem(parser: ParserState, context: Context): Statement {
  switch (parser.token) {
    case Token.FunctionKeyword:
      return parseFunctionDeclaration(parser, context, false);
    case Token.Decorator:
    case Token.ClassKeyword:
      return parseClassDeclaration(parser, context);
    case Token.AbstractKeyword:
      if (tryParse(parser, context, nextTokenIsDeclareOrAbstractKeywordOnSameLine)) {
        parser.nodeflags |= NodeFlags.Abstract;
        if (parser.token !== Token.ClassKeyword) {
          reportErrorDiagnostic(
            parser,
            8,
            DiagnosticCode._abstract_modifier_can_only_appear_on_a_class_method_or_property_declaration
          );
          return parseModuleItemList(parser, context);
        }
        return parseClassDeclaration(parser, context);
      }
      return parseExpressionOrLabeledStatement(parser, context, /* allowFunction */ true);
    case Token.ConstKeyword:
      return parseLexicalOrEnumDeclaration(parser, context);
    case Token.AsyncKeyword: {
      if (lookAhead(parser, context, nextTokenIsFunctionKeywordOnSameLine)) {
        return parseFunctionDeclaration(parser, context, false);
      }
      return parseStatement(parser, context, /* allowFunction */ true);
    }
    case Token.LetKeyword: {
      const start = parser.startPos;
      const flags = parser.nodeflags;
      if (tryParse(parser, context, nextKeywordCanFollowLexicalLet)) {
        return parseLexicalDeclaration(parser, context, /* isConst */ false, flags, start);
      }
      return parseStatement(parser, context, /* allowFunction */ true);
    }
    case Token.DeclareKeyword:
      if (tryParse(parser, context, nextTokenIsDeclareOrAbstractKeywordOnSameLine)) {
        parser.nodeflags |= NodeFlags.Declared | NodeFlags.Ambient;
        return context & Context.Module
          ? parseModuleItemList(parser, context)
          : parseStatementListItem(parser, context);
      }
    case Token.TypeKeyword:
      return parseTypeAliasDeclaration(parser, context);
    case Token.InterfaceKeyword:
      const start = parser.startPos;
      const nodeFlags = parser.nodeflags;
      if (tryParse(parser, context, nextTokenIsIdentifierOnSameLine)) {
        return parseInterfaceDeclaration(parser, context, /* isExported */ false, nodeFlags, start);
      }
      return parseStatement(parser, context, /* allowFunction */ true);
    case Token.ImportKeyword:
      if (lookAhead(parser, context, nextTokenCanFollowImportKeyword)) {
        reportErrorDiagnostic(parser, 0, DiagnosticCode.The_import_keyword_can_only_be_used_with_the_module_goal);
        return parseImportDeclaration(parser, context);
      }
      return parseExpressionOrLabeledStatement(parser, context, /* allowFunction */ true);
    case Token.ExportKeyword:
      reportErrorDiagnostic(parser, 0, DiagnosticCode.The_export_keyword_can_only_be_used_with_the_module_goal);
      return parseExportDeclaration(parser, context);
    default:
      return parseStatement(parser, context, /* allowFunction */ true);
  }
}

// prettier-ignore
function canFollowAbstractOrDeclareKeyword(token: Token): boolean {
  switch (token) {
    case Token.ClassKeyword: // abstract class x {};
    // this case is the only legal case that can follow a declare keyword.
    case Token.FunctionKeyword:  // declare function x();
    case Token.AsyncKeyword:     // declare async function x();
    // these cases can't legally follow a declare or abstract keyword. However, we choose too
    // allow this so that we can report them in the grammar checker.
    case Token.VarKeyword:       // declare var x;
    case Token.LetKeyword:       // declare let x;
    case Token.ConstKeyword:     // declare const x = y;
    case Token.ExportKeyword:    // declare export let x;
    case Token.ImportKeyword:    // declare import x from "y";
    case Token.InterfaceKeyword: // declare interface x {};
    case Token.TypeKeyword:      // declare type x = y;
    case Token.EnumKeyword:      // declare enum x {};
      return true;
    default:
      return false;
  }
}

function nextTokenCanFollowImportKeyword(parser: ParserState, context: Context): boolean {
  nextToken(parser, context);
  return (parser.token & Token.IsPropertyOrCall) === 0;
}

function nextTokenIsDeclareOrAbstractKeywordOnSameLine(parser: ParserState, context: Context): boolean {
  nextToken(parser, context);
  return (parser.nodeflags & NodeFlags.PrecedingLineBreak) === 0 && canFollowAbstractOrDeclareKeyword(parser.token);
}

function nextKeywordCanFollowLexicalLet(parser: ParserState, context: Context): number | boolean {
  nextToken(parser, context);
  // 'function *x() { let yield; }'
  if (context & 0b00000000001000000000010000000000 && parser.token === Token.YieldKeyword) return false;
  // 'async function *x() { let await; }'
  if (context & 0b00000000010000000000100000000000 && parser.token === Token.AwaitKeyword) return false;
  return parser.token & 0b00000000000010000101000000000000;
}

// Statement ::
//   Block
//   VariableStatement
//   EmptyStatement
//   ExpressionStatement
//   IfStatement
//   IterationStatement
//   ContinueStatement
//   BreakStatement
//   ReturnStatement
//   WithStatement
//   LabelledStatement
//   SwitchStatement
//   ThrowStatement
//   TryStatement
//   DebuggerStatement
function parseStatement(parser: ParserState, context: Context, allowFunction: boolean): Statement {
  switch (parser.token) {
    case Token.LeftBrace:
      return parseBlockStatement(parser, context);
    case Token.Semicolon:
      return parseEmptyStatement(parser, context);
    case Token.IfKeyword:
      return parseIfStatement(parser, context);
    case Token.DoKeyword:
      return parseDoWhileStatement(parser, context);
    case Token.WhileKeyword:
      return parseWhileStatement(parser, context);
    case Token.ForKeyword:
      return parseForStatement(parser, context);
    case Token.VarKeyword:
      return parseVariableStatement(parser, context);
    case Token.ContinueKeyword:
      return parseBreakOrContinueStatement(parser, context, /* isContinue */ true);
    case Token.BreakKeyword:
      return parseBreakOrContinueStatement(parser, context, /* isContinue */ false);
    case Token.ReturnKeyword:
      return parseReturnStatement(parser, context);
    case Token.ThrowKeyword:
      return parseThrowStatement(parser, context);
    case Token.TryKeyword:
    // Miscellaneous error cases arguably better caught here than elsewhere.
    case Token.CatchKeyword:
    case Token.FinallyKeyword:
      return parseTryStatement(parser, context);
    case Token.DebuggerKeyword:
      return parseDebuggerStatement(parser, context);
    case Token.SwitchKeyword:
      return parseSwitchStatement(parser, context);
    case Token.WithKeyword:
      return parseWithStatement(parser, context);
    case Token.FunctionKeyword:
      // FunctionDeclaration are only allowed as a StatementListItem, not in
      // an arbitrary Statement position.
      reportErrorDiagnostic(
        parser,
        0,
        context & Context.Strict
          ? DiagnosticCode.In_strict_mode_code_functions_can_only_be_declared_at_top_level_or_inside_a_block
          : context & Context.OptionsDisableWebCompat
          ? DiagnosticCode.Without_web_compability_enabled_functions_can_not_be_declared_at_top_level_inside_a_block_or_as_the_body_of_an_if_statement
          : DiagnosticCode.In_non_strict_mode_code_functions_can_only_be_declared_at_top_level_inside_a_block_or_as_the_body_of_an_if_statement
      );
      return parseFunctionDeclaration(parser, context, /* isDefault */ false);
    case Token.ClassKeyword:
      reportErrorDiagnostic(parser, 0, DiagnosticCode.Class_declaration_cannot_appear_in_single_statement_context);
      return parseClassDeclaration(parser, context);
    case Token.EnumKeyword:
      const start = parser.startPos;
      if (tryParse(parser, context, nextTokenIsIdentifierOnSameLine)) {
        return parseEnumDeclaration(parser, context, /* isConst */ false, start);
      }
      return parseExpressionOrLabeledStatement(parser, context, /* allowFunction */ true);
    default:
      return parseExpressionOrLabeledStatement(parser, context, allowFunction);
  }
}

function parseInterfaceDeclaration(
  parser: ParserState,
  context: Context,
  isExported: boolean,
  nodeFlags: NodeFlags,
  start: number
): InterfaceDeclaration {
  return createInterfaceDeclaration(
    parseIdentifierReference(parser, context),
    parseTypeParameters(parser, context | Context.AllowConditionalTypes),
    parseHeritageClauses(parser, context),
    parseObjectType(parser, context),
    isExported,
    nodeFlags | parser.nodeflags,
    start,
    parser.startPos
  );
}
