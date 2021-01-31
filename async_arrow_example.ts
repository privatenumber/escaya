function parseCoverCallExpressionAndAsyncArrowHead(
  parser: ParserState,
  context: Context
): ArrowParameters | ArgumentList {
  let expression!: Expression;
  let pos = parser.pos;
  let trailingComma = false;
  let elements: any = [];
  let state = Tristate.False;

  nextToken(parser, context | Context.AllowRegExp);

  // Simple cases: "async () =>", "async (): ", and  "async () {".
  if (parser.token === Token.RightParen) {
    state = Tristate.True;
  }

  while (parser.token & 0b00000110001001100101000000000000) {
    pos = parser.startPos;
    if (parser.token & Token.IsAccessModifier && lookAhead(parser, context, nextTokenIsIdentifierOrPatternOnSameLine)) {
      state = Tristate.True;
      expression = parseFormalParameter(parser, context);
    } else if (parser.token & 0b00000000000010000101000000000000) {
      if (context & Context.InYieldContext && parser.token === Token.YieldKeyword) {
        state = Tristate.False;
        expression = parseYieldExpression(parser, context, pos);
      } else {
        const token = parser.token;
        expression = parseBinaryExpression(parser, context, parseUnaryExpression(parser, context), 4, pos);
        if (expression.kind & (NodeKind.IsIdentifier | NodeKind.IsArrayOrObjectLiteral)) {
          // If we have "async (a?:" or "async (a?," or "async (a?=" or "async (a?)" then this must be a optional
          // type-annotated parameter in an arrow function expression or a conditional expression
          // in an argument list.
          if (consumeOpt(parser, context, Token.QuestionMark)) {
            if (parser.token & 0b00000000001101100101000000000000) {
              // If we have "(a?b:" then this is part of an conditional expression in an argument list
              const consequent = tryParse(parser, context, nextIsMaybeConditionalExpr);

              if (consequent) {
                state = Tristate.False;
                expression = createConditionalExpression(
                  expression,
                  consequent,
                  parseAssignmentExpression(parser, context),
                  parser.nodeflags, // this *could* contain a parse error bit
                  pos,
                  parser.startPos
                );
              } else {
                state = Tristate.True;
                expression = createFormalParameter(
                  false,
                  expression as any,
                  true,
                  null,
                  parseInitializer(parser, context),
                  null,
                  null as any,
                  NodeFlags.None,
                  pos,
                  parser.startPos
                );
              }
            } else if (parser.token === Token.Colon) {
              state = Tristate.True;
              expression = createFormalParameter(
                false,
                expression as any,
                true,
                parseTypeAnnotation(parser, context),
                parseInitializer(parser, context),
                null,
                null as any,
                NodeFlags.None,
                pos,
                parser.startPos
              );
              // This has to be something like "async (a?"
            } else {
              state = Tristate.True;
            }
            // If we have something like "(a:", then we must have a
            // type-annotated parameter in an arrow function expression.
          } else if (parser.token === Token.Colon) {
            state = Tristate.True;
            expression = createFormalParameter(
              false,
              expression as any,
              false,
              parseTypeAnnotation(parser, context),
              parseInitializer(parser, context),
              null,
              null as any,
              parser.nodeflags,
              pos,
              parser.startPos
            );
          } else {
            // If we have "async a," or "async (a=" or "async (a)" this *could* be an async arrow function
            state = Tristate.Unknown;
            if (parser.token & Token.IsAssignOp) {
              // If we have "(a %= b:" then this is definitely not an arrow function
              if (parser.token !== Token.Assign) state = Tristate.False;
              const operator: any = KeywordDescTable[parser.token & Token.Type];
              nextToken(parser, context | Context.AllowRegExp);
              expression = createAssignmentExpression(
                expression,
                operator,
                parseAssignmentExpression(parser, context) as any,
                parser.nodeflags,
                pos,
                parser.startPos
              );
            }

            // If we have "(async=>" then this is definitely not an arrow function
            if (
              token === Token.AsyncKeyword &&
              parser.token & (Token.FutureReserved | Token.IsIdentifier) &&
              (parser.nodeflags & NodeFlags.PrecedingLineBreak) === 0 &&
              lookAhead(parser, context, nextTokenIsArrow)
            ) {
              state = Tristate.False;
              expression = parseArrowFunction(
                parser,
                context,
                createArrowParameters(
                  null as any,
                  [convertToSingleNameBinding(parseIdentifierReference(parser, context))],
                  null,
                  null as any,
                  /* trailingComma */ false,
                  parser.nodeflags,
                  pos,
                  parser.startPos
                ),
                token === Token.AsyncKeyword,
                /* isParenthesized */ false,
                pos
              );
            }
          }
        } else if (parser.token === Token.Assign) {
          state = Tristate.False;
          const operator = KeywordDescTable[parser.token & Token.Type];
          nextToken(parser, context | Context.AllowRegExp);
          expression = createAssignmentExpression(
            expression,
            operator as any,
            parseAssignmentExpression(parser, context),
            parser.nodeflags,
            pos,
            parser.startPos
          );
        }

        // If we have something like "a(x && y ? 1 : 2" then this is definitely not an async arrow function.
        if (parser.token === Token.QuestionMark) {
          state = Tristate.False;
          expression = parseConditionalExpression(parser, context, expression, pos);
        }

        if (
          parser.token === Token.Arrow &&
          (token & (Token.FutureReserved | Token.IsIdentifier) || expression.kind === NodeKind.ArrowParameters)
        ) {
          const isParenthesized = expression.kind === NodeKind.ArrowParameters;
          if (!isParenthesized) {
            expression = createArrowParameters(
              createTypeParameters([], parser.nodeflags, pos, pos),
              [convertToSingleNameBinding(expression)],
              null,
              null,
              /* trailingComma */ false,
              parser.nodeflags,
              pos,
              parser.startPos
            );
          }
          expression = parseArrowFunction(
            parser,
            context,
            expression,
            token === Token.AsyncKeyword,
            isParenthesized,
            pos
          );
        }
      }
    } else if (parser.token & Token.IsEllipsis) {
      state = Tristate.Unknown;
      nextToken(parser, context | Context.AllowRegExp);
      if (context & Context.InYieldContext && parser.token === Token.YieldKeyword) {
        state = Tristate.False;
        expression = parseYieldExpression(parser, context, pos);
      } else if (parser.token & 0b00000000000010000101000000000000) {
        const token = parser.token;
        expression = parseBinaryExpression(parser, context, parseUnaryExpression(parser, context), 4, pos);

        if (expression.kind & (NodeKind.IsIdentifier | NodeKind.IsArrayOrObjectLiteral)) {
          if (consumeOpt(parser, context, Token.QuestionMark)) {
            if (parser.token & 0b00000000001101100101000000000000) {
              // If we have "(...a?b:" or "(...[a]?b:" then this is part of an conditional expression in an argument list
              const consequent = tryParse(parser, context, nextIsMaybeConditionalExpr);

              if (consequent) {
                state = Tristate.False;
                expression = createConditionalExpression(
                  expression,
                  consequent,
                  parseAssignmentExpression(parser, context),
                  parser.nodeflags, // this *could* contain a parse error bit
                  pos,
                  parser.startPos
                );
              } else if (parser.token === Token.Assign) {
                state = Tristate.True;
                expression = createFormalParameter(
                  true,
                  expression as any,
                  true,
                  null,
                  parseInitializer(parser, context),
                  null,
                  null as any,
                  NodeFlags.None,
                  pos,
                  parser.startPos
                );
              }
            } else if (parser.token === Token.Colon) {
              state = Tristate.True;
              expression = createFormalParameter(
                true,
                expression as any,
                true,
                parseTypeAnnotation(parser, context),
                parseInitializer(parser, context),
                null,
                null as any,
                NodeFlags.None,
                pos,
                parser.startPos
              );
              // This has to be something like "async (a?"
            } else {
              state = Tristate.True;
            }
            // If we have something like "(...a:" or "(...[a]?b:", then we must have a
            // type-annotated parameter in an arrow function expression.
          } else if (parser.token === Token.Colon) {
            state = Tristate.True;

            expression = createFormalParameter(
              true,
              expression as any,
              false,
              parseTypeAnnotation(parser, context),
              parseInitializer(parser, context),
              null,
              null as any,
              parser.nodeflags,
              pos,
              parser.startPos
            );
          } else {
            // If we have something like "(...a," or "(...a=" or "(...[]" or "(...{a}" this *could* be an arrow function
            // However, "=" can't legally follow "(...a=" or "(...{x}=" or "(...[]=" in formal parameters, but we allow this so that
            // we can report them in the grammar checker.
            state = Tristate.Unknown;
            if (parser.token & Token.IsAssignOp) {
              // If we have "(a %= b:" then this is definitely not an arrow function
              if (parser.token !== Token.Assign) state = Tristate.False;
              const operator: any = KeywordDescTable[parser.token & Token.Type];
              nextToken(parser, context | Context.AllowRegExp);
              expression = createAssignmentExpression(
                expression,
                operator,
                parseAssignmentExpression(parser, context) as any,
                parser.nodeflags,
                pos,
                parser.startPos
              );
            }
          }
        }

        if (expression.kind === NodeKind.ArrowParameters && parser.token === Token.Arrow) {
          expression = parseArrowFunction(
            parser,
            context,
            expression,
            token === Token.AsyncKeyword,
            /* isParenthesized */ true,
            pos
          );
        }

        // If we have something like "a(...x && y ? 1 : 2" then this is definitely not an async arrow function.
        if (parser.token === Token.QuestionMark) {
          state = Tristate.False;
          expression = parseConditionalExpression(parser, context, expression, pos);
        }

        // IdentifierReference [no LineTerminator here] `=>`
        if (
          parser.token === Token.Arrow &&
          (token & (Token.FutureReserved | Token.IsIdentifier) || expression.kind === NodeKind.ArrowParameters)
        ) {
          const isParenthesized = expression.kind === NodeKind.ArrowParameters;

          if (!isParenthesized) {
            expression = createArrowParameters(
              createTypeParameters([], parser.nodeflags, pos, pos),
              [convertToSingleNameBinding(expression)],
              null,
              null,
              /* trailingComma */ false,
              parser.nodeflags,
              pos,
              parser.startPos
            );
          }
          expression = parseArrowFunction(
            parser,
            context,
            expression,
            token === Token.AsyncKeyword,
            isParenthesized,
            pos
          );
        }

        expression = createSpreadElement(expression, parser.nodeflags, pos, parser.startPos);
      } else {
        state = Tristate.False;
        expression = createSpreadElement(
          parseAssignmentExpression(parser, context),
          parser.nodeflags,
          pos,
          parser.startPos
        );
      }
      // If we had "(" followed by something that's not an identifier, '...' or binding pattern,
      // then this definitely is an call expression.
    } else {
      state = Tristate.False;
      expression =
        parser.token & Token.IsComma
          ? createOmittedExpression(NodeFlags.None, pos, pos)
          : parseAssignmentExpression(parser, context);
    }

    elements.push(expression);

    if (parser.token === Token.RightParen) break;
    if (consumeOpt(parser, context | Context.AllowRegExp, Token.Comma)) {
      if (parser.token === Token.RightParen) {
        trailingComma = true;
        break;
      }
      continue;
    }
    // We didn't get a comma, and the list wasn't terminated, explicitly so give
    // a good error message instead
    reportErrorDiagnostic(parser, 0, DiagnosticCode._0_expected, ',');
  }

  consumeOpt(parser, context, Token.RightParen);

  if (state) {
    if (parser.token === Token.Colon) {
      const isType =
        context & Context.InConditionalContext
          ? lookAhead(parser, context, () => {
              nextToken(parser, context);
              parseAssignmentExpression(parser, context);
              return parser.token === Token.Arrow;
            })
          : true;

      if (isType && consumeOpt(parser, context, Token.Colon)) {
        const type = parseTypeOrTypePredicate(parser, context);
        if (parser.token !== Token.Arrow) {
          reportErrorDiagnostic(parser, 0, DiagnosticCode._0_expected, '=>');
        }

        return createArrowParameters(
          null as any,
          elements,
          type,
          null as any,
          false,
          parser.nodeflags,
          pos,
          parser.startPos
        );
      }
    }

    if (parser.token === Token.Arrow) {
      return createArrowParameters(
        createTypeParameters([], parser.nodeflags, pos, pos),
        elements,
        null,
        null,
        trailingComma,
        NodeFlags.None,
        pos,
        parser.startPos
      );
    }
  }

  return createArgumentList(elements, trailingComma, parser.nodeflags, pos, parser.startPos);
}
