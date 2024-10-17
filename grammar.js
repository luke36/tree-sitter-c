/**
 * @file C grammar for tree-sitter
 * @author Max Brunsfeld <maxbrunsfeld@gmail.com>
 * @author Amaan Qureshi <amaanq12@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  PAREN_DECLARATOR: -10,
  ASSIGNMENT: -2,
  CONDITIONAL: -1,
  DEFAULT: 0,
  QUANTIFIER: 1,
  CONNECTIVE: 2,
  LOGICAL_OR: 3,
  LOGICAL_AND: 4,
  INCLUSIVE_OR: 5,
  EXCLUSIVE_OR: 6,
  BITWISE_AND: 7,
  EQUAL: 8,
  RELATIONAL: 9,
  OFFSETOF: 10,
  SHIFT: 11,
  TYPED: 12,
  ADD: 13,
  MULTIPLY: 14,
  CAST: 15,
  SIZEOF: 16,
  UNARY: 17,
  OLDMARK: 18,
  CALL: 19,
  FIELD: 20,
  SUBSCRIPT: 21,
};

module.exports = grammar({
  name: 'c',

  conflicts: $ => [
    [$.type_specifier, $._declarator],
    [$.type_specifier, $._declarator, $.macro_type_specifier],
    [$.type_specifier, $.expression],
    [$.type_specifier, $.expression, $.macro_type_specifier],
    [$.type_specifier, $.macro_type_specifier],
    [$.type_specifier, $.sized_type_specifier],
    [$.sized_type_specifier],
    [$.attributed_statement],
    [$._declaration_modifiers, $.attributed_statement],
    [$.enum_specifier],
    [$.type_specifier, $._old_style_parameter_list],
    [$.parameter_list, $._old_style_parameter_list],
    [$.function_declarator, $._function_declaration_declarator],
    [$._block_item, $.statement],
    [$._top_level_item, $._top_level_statement],
    [$.type_specifier, $._top_level_expression_statement],
    [$.type_qualifier, $.extension_expression],

    [$.type_specifier, $.assertion],
    [$.type_specifier, $.assertion, $.macro_type_specifier],
  ],

  extras: $ => [
    /\s|\\\r?\n/,
    $.comment,
  ],

  inline: $ => [
    $._type_identifier,
    $._field_identifier,
    $._statement_identifier,
    $._non_case_statement,
    $._assignment_left_expression,
    $._expression_not_binary,
    $._assertion_not_binary,
  ],

  supertypes: $ => [
    $.expression,
    $.statement,
    $.assertion,
    $.annotation,
    $.kind,
    $.atype,
    $.type_specifier,
    $._declarator,
    $._field_declarator,
    $._type_declarator,
    $._abstract_declarator,
  ],

  word: $ => $.identifier,

  rules: {
    translation_unit: $ => repeat($._top_level_item),

    // Top level items are block items with the exception of the expression statement
    _top_level_item: $ => choice(
      $.function_definition,
      alias($._old_style_function_definition, $.function_definition),
      $.linkage_specification,
      $.declaration,
      $.annotation,
      $._top_level_statement,
      $.attributed_statement,
      $.type_definition,
      $._empty_declaration,
      $.preproc_if,
      $.preproc_ifdef,
      $.preproc_include,
      $.preproc_def,
      $.preproc_function_def,
      $.preproc_call,
    ),

    _block_item: $ => choice(
      $.function_definition,
      alias($._old_style_function_definition, $.function_definition),
      $.linkage_specification,
      $.declaration,
      $.statement,
      $.annotation,
      $.attributed_statement,
      $.type_definition,
      $._empty_declaration,
      $.preproc_if,
      $.preproc_ifdef,
      $.preproc_include,
      $.preproc_def,
      $.preproc_function_def,
      $.preproc_call,
    ),

    // Preprocesser

    preproc_include: $ => seq(
      preprocessor('include'),
      field('path', choice(
        $.string_literal,
        $.system_lib_string,
        $.identifier,
        alias($.preproc_call_expression, $.call_expression),
      )),
      token.immediate(/\r?\n/),
    ),

    preproc_def: $ => seq(
      preprocessor('define'),
      field('name', $.identifier),
      field('value', optional($.preproc_arg)),
      token.immediate(/\r?\n/),
    ),

    preproc_function_def: $ => seq(
      preprocessor('define'),
      field('name', $.identifier),
      field('parameters', $.preproc_params),
      field('value', optional($.preproc_arg)),
      token.immediate(/\r?\n/),
    ),

    preproc_params: $ => seq(
      token.immediate('('), commaSep(choice($.identifier, '...')), ')',
    ),

    preproc_call: $ => seq(
      field('directive', $.preproc_directive),
      field('argument', optional($.preproc_arg)),
      token.immediate(/\r?\n/),
    ),

    ...preprocIf('', $ => $._block_item),
    ...preprocIf('_in_field_declaration_list', $ => $._field_declaration_list_item),
    ...preprocIf('_in_enumerator_list', $ => seq($.enumerator, ',')),
    ...preprocIf('_in_enumerator_list_no_comma', $ => $.enumerator, -1),

    preproc_arg: _ => token(prec(-1, /\S([^/\n]|\/[^*]|\\\r?\n)*/)),
    preproc_directive: _ => /#[ \t]*[a-zA-Z0-9]\w*/,

    _preproc_expression: $ => choice(
      $.identifier,
      alias($.preproc_call_expression, $.call_expression),
      $.number_literal,
      $.char_literal,
      $.preproc_defined,
      alias($.preproc_unary_expression, $.unary_expression),
      alias($.preproc_binary_expression, $.binary_expression),
      alias($.preproc_parenthesized_expression, $.parenthesized_expression),
    ),

    preproc_parenthesized_expression: $ => seq(
      '(',
      $._preproc_expression,
      ')',
    ),

    preproc_defined: $ => choice(
      prec(PREC.CALL, seq('defined', '(', $.identifier, ')')),
      seq('defined', $.identifier),
    ),

    preproc_unary_expression: $ => prec.left(PREC.UNARY, seq(
      field('operator', choice('!', '~', '-', '+')),
      field('argument', $._preproc_expression),
    )),

    preproc_call_expression: $ => prec(PREC.CALL, seq(
      field('function', $.identifier),
      field('arguments', alias($.preproc_argument_list, $.argument_list)),
    )),

    preproc_argument_list: $ => seq(
      '(',
      commaSep($._preproc_expression),
      ')',
    ),

    preproc_binary_expression: $ => {
      const table = [
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULTIPLY],
        ['/', PREC.MULTIPLY],
        ['%', PREC.MULTIPLY],
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['|', PREC.INCLUSIVE_OR],
        ['^', PREC.EXCLUSIVE_OR],
        ['&', PREC.BITWISE_AND],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
        ['>', PREC.RELATIONAL],
        ['>=', PREC.RELATIONAL],
        ['<=', PREC.RELATIONAL],
        ['<', PREC.RELATIONAL],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', $._preproc_expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $._preproc_expression),
        ));
      }));
    },

    // Main Grammar

    function_definition: $ => seq(
      optional($.ms_call_modifier),
      $._declaration_specifiers,
      optional($.ms_call_modifier),
      field('declarator', $._declarator),
      optional(field('specification', $.specification)),
      field('body', $.compound_statement),
    ),

    _old_style_function_definition: $ => seq(
      optional($.ms_call_modifier),
      $._declaration_specifiers,
      field('declarator', alias($._old_style_function_declarator, $.function_declarator)),
      repeat($.declaration),
      field('body', $.compound_statement),
    ),

    declaration: $ => seq(
      $._declaration_specifiers,
      commaSep1(field('declarator', choice(
        seq(
          optional($.ms_call_modifier),
          $._declaration_declarator,
          optional($.gnu_asm_expression),
        ),
        $.init_declarator,
      ))),
      ';',
    ),

    type_definition: $ => seq(
      optional('__extension__'),
      'typedef',
      $._type_definition_type,
      $._type_definition_declarators,
      repeat($.attribute_specifier),
      ';',
    ),
    _type_definition_type: $ => seq(repeat($.type_qualifier), field('type', $.type_specifier), repeat($.type_qualifier)),
    _type_definition_declarators: $ => commaSep1(field('declarator', $._type_declarator)),

    _declaration_modifiers: $ => choice(
      $.storage_class_specifier,
      $.type_qualifier,
      $.attribute_specifier,
      $.attribute_declaration,
      $.ms_declspec_modifier,
    ),

    _declaration_specifiers: $ => prec.right(seq(
      repeat($._declaration_modifiers),
      field('type', $.type_specifier),
      repeat($._declaration_modifiers),
    )),

    linkage_specification: $ => seq(
      'extern',
      field('value', $.string_literal),
      field('body', choice(
        $.function_definition,
        $.declaration,
        $.declaration_list,
      )),
    ),

    attribute_specifier: $ => seq(
      choice('__attribute__', '__attribute'),
      '(',
      $.argument_list,
      ')',
    ),

    attribute: $ => seq(
      optional(seq(field('prefix', $.identifier), '::')),
      field('name', $.identifier),
      optional($.argument_list),
    ),

    attribute_declaration: $ => seq(
      '[[',
      commaSep1($.attribute),
      ']]',
    ),

    ms_declspec_modifier: $ => seq(
      '__declspec',
      '(',
      $.identifier,
      ')',
    ),

    ms_based_modifier: $ => seq(
      '__based',
      $.argument_list,
    ),

    ms_call_modifier: _ => choice(
      '__cdecl',
      '__clrcall',
      '__stdcall',
      '__fastcall',
      '__thiscall',
      '__vectorcall',
    ),

    ms_restrict_modifier: _ => '__restrict',

    ms_unsigned_ptr_modifier: _ => '__uptr',

    ms_signed_ptr_modifier: _ => '__sptr',

    ms_unaligned_ptr_modifier: _ => choice('_unaligned', '__unaligned'),

    ms_pointer_modifier: $ => choice(
      $.ms_unaligned_ptr_modifier,
      $.ms_restrict_modifier,
      $.ms_unsigned_ptr_modifier,
      $.ms_signed_ptr_modifier,
    ),

    declaration_list: $ => seq(
      '{',
      repeat($._block_item),
      '}',
    ),

    _declarator: $ => choice(
      $.attributed_declarator,
      $.pointer_declarator,
      $.function_declarator,
      $.array_declarator,
      $.parenthesized_declarator,
      $.identifier,
    ),

    _declaration_declarator: $ => choice(
      $.attributed_declarator,
      $.pointer_declarator,
      alias($._function_declaration_declarator, $.function_declarator),
      $.array_declarator,
      $.parenthesized_declarator,
      $.identifier,
    ),

    _field_declarator: $ => choice(
      alias($.attributed_field_declarator, $.attributed_declarator),
      alias($.pointer_field_declarator, $.pointer_declarator),
      alias($.function_field_declarator, $.function_declarator),
      alias($.array_field_declarator, $.array_declarator),
      alias($.parenthesized_field_declarator, $.parenthesized_declarator),
      $._field_identifier,
    ),

    _type_declarator: $ => choice(
      alias($.attributed_type_declarator, $.attributed_declarator),
      alias($.pointer_type_declarator, $.pointer_declarator),
      alias($.function_type_declarator, $.function_declarator),
      alias($.array_type_declarator, $.array_declarator),
      alias($.parenthesized_type_declarator, $.parenthesized_declarator),
      $._type_identifier,
      alias(choice('signed', 'unsigned', 'long', 'short'), $.primitive_type),
      $.primitive_type,
    ),

    _abstract_declarator: $ => choice(
      $.abstract_pointer_declarator,
      $.abstract_function_declarator,
      $.abstract_array_declarator,
      $.abstract_parenthesized_declarator,
    ),

    parenthesized_declarator: $ => prec.dynamic(PREC.PAREN_DECLARATOR, seq(
      '(',
      optional($.ms_call_modifier),
      $._declarator,
      ')',
    )),
    parenthesized_field_declarator: $ => prec.dynamic(PREC.PAREN_DECLARATOR, seq(
      '(',
      optional($.ms_call_modifier),
      $._field_declarator,
      ')',
    )),
    parenthesized_type_declarator: $ => prec.dynamic(PREC.PAREN_DECLARATOR, seq(
      '(',
      optional($.ms_call_modifier),
      $._type_declarator,
      ')',
    )),
    abstract_parenthesized_declarator: $ => prec(1, seq(
      '(',
      optional($.ms_call_modifier),
      $._abstract_declarator,
      ')',
    )),


    attributed_declarator: $ => prec.right(seq(
      $._declarator,
      repeat1($.attribute_declaration),
    )),
    attributed_field_declarator: $ => prec.right(seq(
      $._field_declarator,
      repeat1($.attribute_declaration),
    )),
    attributed_type_declarator: $ => prec.right(seq(
      $._type_declarator,
      repeat1($.attribute_declaration),
    )),

    pointer_declarator: $ => prec.dynamic(1, prec.right(seq(
      optional($.ms_based_modifier),
      '*',
      repeat($.ms_pointer_modifier),
      repeat($.type_qualifier),
      field('declarator', $._declarator),
    ))),
    pointer_field_declarator: $ => prec.dynamic(1, prec.right(seq(
      optional($.ms_based_modifier),
      '*',
      repeat($.ms_pointer_modifier),
      repeat($.type_qualifier),
      field('declarator', $._field_declarator),
    ))),
    pointer_type_declarator: $ => prec.dynamic(1, prec.right(seq(
      optional($.ms_based_modifier),
      '*',
      repeat($.ms_pointer_modifier),
      repeat($.type_qualifier),
      field('declarator', $._type_declarator),
    ))),
    abstract_pointer_declarator: $ => prec.dynamic(1, prec.right(seq('*',
      repeat($.ms_pointer_modifier),
      repeat($.type_qualifier),
      field('declarator', optional($._abstract_declarator)),
    ))),

    function_declarator: $ => prec.right(1,
      seq(
        field('declarator', $._declarator),
        field('parameters', $.parameter_list),
        optional(field('specification', $.specification)),
        optional($.gnu_asm_expression),
        repeat(choice(
          $.attribute_specifier,
          $.identifier,
          alias($.preproc_call_expression, $.call_expression),
        )),
      ),
    ),

    _function_declaration_declarator: $ => prec.right(1,
      seq(
        field('declarator', $._declarator),
        field('parameters', $.parameter_list),
        optional(field('specification', $.specification)),
        optional($.gnu_asm_expression),
        repeat($.attribute_specifier),
      )),

    function_field_declarator: $ => prec(1, seq(
      field('declarator', $._field_declarator),
      field('parameters', $.parameter_list),
    )),
    function_type_declarator: $ => prec(1, seq(
      field('declarator', $._type_declarator),
      field('parameters', $.parameter_list),
    )),
    abstract_function_declarator: $ => prec(1, seq(
      field('declarator', optional($._abstract_declarator)),
      field('parameters', $.parameter_list),
    )),

    _old_style_function_declarator: $ => seq(
      field('declarator', $._declarator),
      field('parameters', alias($._old_style_parameter_list, $.parameter_list)),
    ),

    array_declarator: $ => prec(1, seq(
      field('declarator', $._declarator),
      '[',
      repeat(choice($.type_qualifier, 'static')),
      field('size', optional(choice($.expression, '*'))),
      ']',
    )),
    array_field_declarator: $ => prec(1, seq(
      field('declarator', $._field_declarator),
      '[',
      repeat(choice($.type_qualifier, 'static')),
      field('size', optional(choice($.expression, '*'))),
      ']',
    )),
    array_type_declarator: $ => prec(1, seq(
      field('declarator', $._type_declarator),
      '[',
      repeat(choice($.type_qualifier, 'static')),
      field('size', optional(choice($.expression, '*'))),
      ']',
    )),
    abstract_array_declarator: $ => prec(1, seq(
      field('declarator', optional($._abstract_declarator)),
      '[',
      repeat(choice($.type_qualifier, 'static')),
      field('size', optional(choice($.expression, '*'))),
      ']',
    )),

    init_declarator: $ => seq(
      field('declarator', $._declarator),
      '=',
      field('value', choice($.initializer_list, $.expression)),
    ),

    compound_statement: $ => seq(
      '{',
      repeat($._block_item),
      '}',
    ),

    storage_class_specifier: _ => choice(
      'extern',
      'static',
      'auto',
      'register',
      'inline',
      '__inline',
      '__inline__',
      '__forceinline',
      'thread_local',
      '__thread',
    ),

    type_qualifier: $ => choice(
      'const',
      'constexpr',
      'volatile',
      'restrict',
      '__restrict__',
      '__extension__',
      '_Atomic',
      '_Noreturn',
      'noreturn',
      '_Nonnull',
      $.alignas_qualifier,
    ),

    alignas_qualifier: $ => seq(
      choice('alignas', '_Alignas'),
      '(',
      choice($.expression, $.type_descriptor),
      ')',
    ),

    type_specifier: $ => choice(
      $.struct_specifier,
      $.union_specifier,
      $.enum_specifier,
      $.macro_type_specifier,
      $.sized_type_specifier,
      $.primitive_type,
      $._type_identifier,
    ),

    sized_type_specifier: $ => choice(
      seq(
        repeat(choice(
          'signed',
          'unsigned',
          'long',
          'short',
        )),
        field('type', optional(choice(
          prec.dynamic(-1, $._type_identifier),
          $.primitive_type,
        ))),
        repeat1(choice(
          'signed',
          'unsigned',
          'long',
          'short',
        )),
      ),
      seq(
        repeat1(choice(
          'signed',
          'unsigned',
          'long',
          'short',
        )),
        repeat($.type_qualifier),
        field('type', optional(choice(
          prec.dynamic(-1, $._type_identifier),
          $.primitive_type,
        ))),
        repeat(choice(
          'signed',
          'unsigned',
          'long',
          'short',
        )),
      ),
    ),

    primitive_type: _ => token(choice(
      'bool',
      'char',
      'int',
      'float',
      'double',
      'void',
      'size_t',
      'ssize_t',
      'ptrdiff_t',
      'intptr_t',
      'uintptr_t',
      'charptr_t',
      'nullptr_t',
      'max_align_t',
      ...[8, 16, 32, 64].map(n => `int${n}_t`),
      ...[8, 16, 32, 64].map(n => `uint${n}_t`),
      ...[8, 16, 32, 64].map(n => `char${n}_t`),
    )),

    enum_specifier: $ => seq(
      'enum',
      choice(
        seq(
          field('name', $._type_identifier),
          optional(seq(':', field('underlying_type', $.primitive_type))),
          field('body', optional($.enumerator_list)),
        ),
        field('body', $.enumerator_list),
      ),
      optional($.attribute_specifier),
    ),

    enumerator_list: $ => seq(
      '{',
      repeat(choice(
        seq($.enumerator, ','),
        alias($.preproc_if_in_enumerator_list, $.preproc_if),
        alias($.preproc_ifdef_in_enumerator_list, $.preproc_ifdef),
        seq($.preproc_call, ','),
      )),
      optional(seq(
        choice(
          $.enumerator,
          alias($.preproc_if_in_enumerator_list_no_comma, $.preproc_if),
          alias($.preproc_ifdef_in_enumerator_list_no_comma, $.preproc_ifdef),
          $.preproc_call,
        ),
      )),
      '}',
    ),

    struct_specifier: $ => prec.right(seq(
      'struct',
      optional($.attribute_specifier),
      optional($.ms_declspec_modifier),
      choice(
        seq(
          field('name', $._type_identifier),
          field('body', optional($.field_declaration_list)),
        ),
        field('body', $.field_declaration_list),
      ),
      optional($.attribute_specifier),
    )),

    union_specifier: $ => prec.right(seq(
      'union',
      optional($.ms_declspec_modifier),
      choice(
        seq(
          field('name', $._type_identifier),
          field('body', optional($.field_declaration_list)),
        ),
        field('body', $.field_declaration_list),
      ),
      optional($.attribute_specifier),
    )),

    field_declaration_list: $ => seq(
      '{',
      repeat($._field_declaration_list_item),
      '}',
    ),

    _field_declaration_list_item: $ => choice(
      $.field_declaration,
      $.preproc_def,
      $.preproc_function_def,
      $.preproc_call,
      alias($.preproc_if_in_field_declaration_list, $.preproc_if),
      alias($.preproc_ifdef_in_field_declaration_list, $.preproc_ifdef),
    ),

    field_declaration: $ => seq(
      $._declaration_specifiers,
      optional($._field_declaration_declarator),
      optional($.attribute_specifier),
      ';',
    ),
    _field_declaration_declarator: $ => commaSep1(seq(
      field('declarator', $._field_declarator),
      optional($.bitfield_clause),
    )),

    bitfield_clause: $ => seq(':', $.expression),

    enumerator: $ => seq(
      field('name', $.identifier),
      optional(seq('=', field('value', $.expression))),
    ),

    variadic_parameter: _ => '...',

    parameter_list: $ => seq(
      '(',
      choice(
        commaSep(choice($.parameter_declaration, $.variadic_parameter)),
        $.compound_statement,
      ),
      ')',
    ),
    _old_style_parameter_list: $ => seq(
      '(',
      commaSep(choice($.identifier, $.variadic_parameter)),
      ')',
    ),

    parameter_declaration: $ => seq(
      $._declaration_specifiers,
      optional(field('declarator', choice(
        $._declarator,
        $._abstract_declarator,
      ))),
      repeat($.attribute_specifier),
    ),

    // Statements

    attributed_statement: $ => seq(
      repeat1($.attribute_declaration),
      $.statement,
    ),

    statement: $ => choice(
      $.case_statement,
      $._non_case_statement,
    ),

    _non_case_statement: $ => choice(
      $.attributed_statement,
      $.labeled_statement,
      $.compound_statement,
      $.expression_statement,
      $.if_statement,
      $.switch_statement,
      $.do_statement,
      $.while_statement,
      $.for_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.goto_statement,
      $.seh_try_statement,
      $.seh_leave_statement,
    ),

    _top_level_statement: $ => choice(
      $.case_statement,
      $.attributed_statement,
      $.labeled_statement,
      $.compound_statement,
      alias($._top_level_expression_statement, $.expression_statement),
      $.if_statement,
      $.switch_statement,
      $.do_statement,
      $.while_statement,
      $.for_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.goto_statement,
    ),

    labeled_statement: $ => seq(
      field('label', $._statement_identifier),
      ':',
      choice($.declaration, $.statement),
    ),

    // This is missing binary expressions, others were kept so that macro code can be parsed better and code examples
    _top_level_expression_statement: $ => seq(
      optional($._expression_not_binary),
      ';',
    ),

    expression_statement: $ => seq(
      optional(choice(
        $.expression,
        $.comma_expression,
      )),
      ';',
    ),

    if_statement: $ => prec.right(seq(
      'if',
      field('condition', $.parenthesized_expression),
      field('consequence', $.statement),
      optional(field('alternative', $.else_clause)),
    )),

    else_clause: $ => seq('else', $.statement),

    switch_statement: $ => seq(
      'switch',
      field('condition', $.parenthesized_expression),
      field('body', $.compound_statement),
    ),

    case_statement: $ => prec.right(seq(
      choice(
        seq('case', field('value', $.expression)),
        'default',
      ),
      ':',
      repeat(choice(
        $._non_case_statement,
        $.declaration,
        $.type_definition,
      )),
    )),

    while_statement: $ => seq(
      'while',
      field('condition', $.parenthesized_expression),
      field('body', $.statement),
    ),

    do_statement: $ => seq(
      'do',
      field('body', $.statement),
      'while',
      field('condition', $.parenthesized_expression),
      ';',
    ),

    for_statement: $ => seq(
      'for',
      '(',
      $._for_statement_body,
      ')',
      field('body', $.statement),
    ),
    _for_statement_body: $ => seq(
      choice(
        field('initializer', $.declaration),
        seq(field('initializer', optional(choice($.expression, $.comma_expression))), ';'),
      ),
      field('condition', optional(choice($.expression, $.comma_expression))),
      ';',
      field('update', optional(choice($.expression, $.comma_expression))),
    ),

    return_statement: $ => seq(
      'return',
      optional(choice($.expression, $.comma_expression)),
      ';',
    ),

    break_statement: _ => seq(
      'break', ';',
    ),

    continue_statement: _ => seq(
      'continue', ';',
    ),

    goto_statement: $ => seq(
      'goto',
      field('label', $._statement_identifier),
      ';',
    ),

    seh_try_statement: $ => seq(
      '__try',
      field('body', $.compound_statement),
      choice($.seh_except_clause, $.seh_finally_clause),
    ),

    seh_except_clause: $ => seq(
      '__except',
      field('filter', $.parenthesized_expression),
      field('body', $.compound_statement),
    ),

    seh_finally_clause: $ => seq(
      '__finally',
      field('body', $.compound_statement),
    ),

    seh_leave_statement: _ => seq(
      '__leave', ';',
    ),

    // Annotations

    _mark_identifier: $ => alias($.identifier, $.mark_identifier),
    _scope_identifier: $ => alias($.identifier, $.scope_identifier),
    _spec_identifier: $ => alias($.identifier, $.spec_identifier),

    annotation: $ => choice(
      $.assertion_annotation,
      $.invariant_annotation,
      $.which_implies_annotation,
      $.do_annotation,
      $.extern_term_annotation,
      $.extern_type_annotation,
      $.import_coq_annotation,
      $.include_strategy_annotation,
      $.extern_alias_annotation,
      $.extern_field_annotation,
      $.extern_record_annotation,
    ),

    assertion_annotation: $ => annotation(seq(
      optional(seq('Given', field('ghost', repeat1($._term_decl_infer)), ',')),
      optional('Assert'),
      field('assertion', $.assertion),
      optional(seq('@mark', field('mark', $._mark_identifier))),
      optional(seq('by', field('scope', repeat1($._scope_identifier)))),
    )),

    invariant_annotation: $ => annotation(seq(
      optional('Assert'),
      'Inv',
      field('assertion', $.assertion),
      optional(seq('by', field('scope', repeat1($._scope_identifier)))),
    )),

    which_implies_annotation: $ => annotation(seq(
      field('precondition', $.assertion),
      optional(seq('by', field('scope', repeat1($._scope_identifier)))),
      'which', 'implies',
      field('postcondition', $.assertion),
      optional(seq('by', field('scope', repeat1($._scope_identifier)))),
    )),

    do_annotation: $ => annotation(seq(
      'do',
      $._scope_identifier,
    )),

    term_decl: $ => seq(
      '(',
      field('variable', repeat1($.identifier)),
      ':',
      field('type', $.full_atype),
      ')',
    ),

    extern_term_annotation: $ => annotation(seq(
      'Extern', 'Coq', repeat1($.term_decl),
    )),

    atype_decl: $ => seq(
      '(',
      field('variable', repeat1($.identifier)),
      '::',
      field('kind', $.kind),
      ')',
    ),

    extern_type_annotation: $ => annotation(seq(
      'Extern', 'Coq', repeat1($.atype_decl),
    )),

    import_coq_annotation: $ => annotation(seq(
      'Import', 'Coq',
      /[.A-Za-z0-9_ \t]*/
    )),

    include_strategy_annotation: $ => annotation(seq(
      'include', 'strategies', $.string_literal,
    )),

    definitional_identifier: $ => $.identifier,

    _term_decl_infer: $ => choice($.definitional_identifier, $.term_decl),

    implicit_atype_decl: $ => seq(
      '{',
      field('variable', repeat1($.identifier)),
      optional(seq(
        '::',
        field('kind', $.kind),
      )),
      '}',
    ),

    specification: $ => annotation(choice(seq(
      optional(seq(
        field('name', $._spec_identifier),
        optional(seq('<=', field('parent', $._spec_identifier))),
      )),
      optional(seq(
        'With',
        field('type_variables', repeat($.implicit_atype_decl)),
        field('variables', repeat($._term_decl_infer)),
      )),
      'Require',
      field('precondition', $.assertion),
      'Ensure',
      field('postcondition', $.assertion),
    ), field('name', $._spec_identifier))),

    // todo

    term_argument: $ => seq(
      field('parameter', $.identifier),
      '=',
      field('argument', $.assertion),
    ),

    atype_argument: $ => seq(
      field('parameter', $.identifier),
      '=',
      field('argument', $.atype),
    ),

    virtual_argument: $ => annotation(seq(
      'where',
      optional(seq('(', $._scope_identifier, ')')),
      field('term_arguments', commaSep($.term_argument)),
      optional(seq(
        ';',
        field('type_argument', commaSep($.atype_argument)),
      )),
      optional(seq('by', repeat1($._scope_identifier))),
    )),

    extern_alias_annotation: $ => annotation(seq(
      'Extern', 'Coq',
      field('variable', $.identifier),
      ':=',
      field('type', $.atype),
    )),

    extern_field_annotation: $ => annotation(seq(
      'Extern', 'Coq',
      'Field', repeat1($.term_decl),
    )),

    record_field: $ => seq(
      field('field', $.identifier),
      ':',
      field('type', $.full_atype),
      ';',
    ),

    _atype_decl_infer: $ => choice($.definitional_identifier, $.atype_decl),

    extern_record_annotation: $ => annotation(seq(
      'Extern', 'Coq',
      'Record',
      field('record', $.identifier),
      field('parameter', repeat($._atype_decl_infer)),
      optional(seq('=', field('constructor', $.identifier))),
      '{',
      field('fields', repeat($.record_field)),
      '}',
    )),

    // Kinds

    kind: $ => choice(
      $.star_kind,
      $.arrow_kind,
      $.parenthesized_kind,
    ),

    star_kind: $ => '*',

    arrow_kind: $ => prec.right(seq(
      field('left', $.kind),
      '=>',
      field('right', $.kind),
    )),

    parenthesized_kind: $ => seq(
      '(',
      $.kind,
      ')',
    ),

    // Types

    atype: $ => choice(
      $.z_atype,
      $.nat_atype,
      $.bool_atype,
      $.list_atype,
      $.prod_atype,
      $.prop_atype,
      $.assertion_atype,
      $.identifier,
      $.arrow_atype,
      $.apply_atype,
      $.parenthesized_atype,
    ),

    z_atype: $ => 'Z',

    nat_atype: $ => 'nat',

    bool_atype: $ => 'bool',

    list_atype: $ => 'list',

    prod_atype: $ => 'prod',

    prop_atype: $ => 'Prop',

    assertion_atype: $ => 'Assertion',

    arrow_atype: $ => prec.right(0, seq(
      field('left', $.atype),
      '->',
      field('right', $.atype),
    )),

    apply_atype: $ => prec.left(1, seq(
      field('left', $.atype),
      field('right', $.atype),
    )),

    parenthesized_atype: $ => seq(
      '(',
      $.atype,
      ')',
    ),

    full_atype: $ => seq(
      optional(seq(field('parameter', repeat1($.implicit_atype_decl)), '->')),
      field('body', $.atype)
    ),

    // Assertions

    assertion: $ => choice(
      $._assertion_not_binary,
      $.binary_assertion,
    ),

    assertion_argument_list: $ => seq('(', commaSep($.assertion), ')'),

    _assertion_not_binary: $ => choice(
      $.unary_assertion,
      $.cast_assertion,
      $.pointer_assertion,
      $.sizeof_assertion,
      $.subscript_assertion,
      $.call_assertion,
      $.field_assertion,
      $.identifier,
      $.number_literal,
      $.parenthesized_assertion,

      // new
      $.typed_assertion,
      $.quantified_assertion,
      $.emp_assertion,
      $.underline_return_assertion,
      $.int_max_assertion,
      $.int_min_assertion,
      $.oldmark_assertion,
      $.shadow_assertion,
      $.data_at_assertion,
      $.undef_data_at_assertion,
      $.field_address_assertion,
      // TODO: $.spec_assertion
    ),

    unary_assertion: $ => prec.left(PREC.UNARY, seq(
      field('operator', choice('!', '~', '-', '+')),
      field('argument', $.assertion),
    )),

    binary_assertion: $ => {
      const table = [
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULTIPLY],
        ['/', PREC.MULTIPLY],
        ['%', PREC.MULTIPLY],
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['|', PREC.INCLUSIVE_OR],
        ['^', PREC.EXCLUSIVE_OR],
        ['&', PREC.BITWISE_AND],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
        ['>', PREC.RELATIONAL],
        ['>=', PREC.RELATIONAL],
        ['<=', PREC.RELATIONAL],
        ['<', PREC.RELATIONAL],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
        ['=>', PREC.CONNECTIVE],
        ['<=>', PREC.CONNECTIVE],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', $.assertion),
          // @ts-ignore
          field('operator', operator),
          field('right', $.assertion),
        ));
      }));
    },

    cast_assertion: $ => prec(PREC.CAST, seq(
      '(',
      field('type', $.type_descriptor),
      ')',
      field('value', $.assertion),
    )),

    pointer_assertion: $ => prec.left(PREC.CAST, seq(
      field('operator', choice('*', '&')),
      field('argument', $.assertion),
    )),

    sizeof_assertion: $ => prec(PREC.SIZEOF, seq(
      'sizeof',
      seq('(', field('type', $.type_descriptor), ')'),
    )),

    subscript_assertion: $ => prec(PREC.SUBSCRIPT, seq(
      field('argument', $.assertion),
      '[',
      field('index', $.assertion),
      ']',
    )),

    call_assertion: $ => prec(PREC.CALL, seq(
      field('function', $.assertion),
      field('arguments', $.assertion_argument_list),
    )),

    field_assertion: $ => seq(
      prec(PREC.FIELD, seq(
        field('argument', $.assertion),
        field('operator', choice('.', '->')),
      )),
      field('field', $._field_identifier),
    ),

    parenthesized_assertion: $ => seq(
      '(',
      $.assertion,
      ')',
    ),

    bracket_exist_decl: $ => seq(
      '[',
      field('variable', repeat1($.identifier)),
      optional(seq(
        ':',
        field('type', $.full_atype),
      )),
      ']'
    ),

    _quantified_term_decl: $ => choice(
      $._term_decl_infer,
      $.bracket_exist_decl,
    ),

    quantified_assertion: $ => prec.left(PREC.QUANTIFIER, seq(
      field('operator', choice('exists', 'forall')),
      field('variables', repeat1($._quantified_term_decl)),
      ',',
      field('argument', $.assertion),
    )),

    emp_assertion: $ => 'emp',

    underline_return_assertion: $ => '__return',

    int_max_assertion: $ => 'INT_MAX',

    int_min_assertion: $ => 'INT_MIN',

    typed_assertion: $ => prec(PREC.TYPED, seq(
      field('argument', $.assertion),
      ':',
      field('type', $.atype),
    )),

    shadow_assertion: $ => seq(
      '#',
      choice($.shadow_assertion, $.identifier),
    ),

    oldmark_assertion: $ => prec(PREC.OLDMARK, seq(
      field('argument', $.assertion),
      '@',
      field('mark', $._mark_identifier),
    )),

    data_at_assertion: $ => prec(PREC.CALL, seq(
      'data_at',
      '(',
      field('address', $.assertion),
      ',',
      optional(seq(field('type', $.type_descriptor), ',')),
      field('value', $.assertion),
      ')',
    )),

    undef_data_at_assertion: $ => prec(PREC.CALL, seq(
      'undef_data_at',
      '(',
      field('address', $.assertion),
      optional(seq(',', field('type', $.type_descriptor))),
      ')',
    )),

    field_address_assertion: $ => prec(PREC.CALL, seq(
      'field_address',
      '(',
      field('pointer', $.assertion),
      optional(seq(',', field('type', $.type_descriptor))),
      ',',
      field('field', $._field_identifier),
      ')',
    )),

    // Expressions

    expression: $ => choice(
      $._expression_not_binary,
      $.binary_expression,
    ),

    _expression_not_binary: $ => choice(
      $.conditional_expression,
      $.assignment_expression,
      $.unary_expression,
      $.update_expression,
      $.cast_expression,
      $.pointer_expression,
      $.sizeof_expression,
      $.alignof_expression,
      $.offsetof_expression,
      $.generic_expression,
      $.subscript_expression,
      $.call_expression,
      $.field_expression,
      $.compound_literal_expression,
      $.identifier,
      $.number_literal,
      $._string,
      $.true,
      $.false,
      $.null,
      $.char_literal,
      $.parenthesized_expression,
      $.gnu_asm_expression,
      $.extension_expression,
    ),

    _string: $ => prec.left(choice(
      $.string_literal,
      $.concatenated_string,
    )),

    comma_expression: $ => seq(
      field('left', $.expression),
      ',',
      field('right', choice($.expression, $.comma_expression)),
    ),

    conditional_expression: $ => prec.right(PREC.CONDITIONAL, seq(
      field('condition', $.expression),
      '?',
      optional(field('consequence', choice($.expression, $.comma_expression))),
      ':',
      field('alternative', $.expression),
    )),

    _assignment_left_expression: $ => choice(
      $.identifier,
      $.call_expression,
      $.field_expression,
      $.pointer_expression,
      $.subscript_expression,
      $.parenthesized_expression,
    ),

    assignment_expression: $ => prec.right(PREC.ASSIGNMENT, seq(
      field('left', $._assignment_left_expression),
      field('operator', choice(
        '=',
        '*=',
        '/=',
        '%=',
        '+=',
        '-=',
        '<<=',
        '>>=',
        '&=',
        '^=',
        '|=',
      )),
      field('right', $.expression),
    )),

    pointer_expression: $ => prec.left(PREC.CAST, seq(
      field('operator', choice('*', '&')),
      field('argument', $.expression),
    )),

    unary_expression: $ => prec.left(PREC.UNARY, seq(
      field('operator', choice('!', '~', '-', '+')),
      field('argument', $.expression),
    )),

    binary_expression: $ => {
      const table = [
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULTIPLY],
        ['/', PREC.MULTIPLY],
        ['%', PREC.MULTIPLY],
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['|', PREC.INCLUSIVE_OR],
        ['^', PREC.EXCLUSIVE_OR],
        ['&', PREC.BITWISE_AND],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
        ['>', PREC.RELATIONAL],
        ['>=', PREC.RELATIONAL],
        ['<=', PREC.RELATIONAL],
        ['<', PREC.RELATIONAL],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', $.expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $.expression),
        ));
      }));
    },

    update_expression: $ => {
      const argument = field('argument', $.expression);
      const operator = field('operator', choice('--', '++'));
      return prec.right(PREC.UNARY, choice(
        seq(operator, argument),
        seq(argument, operator),
      ));
    },

    cast_expression: $ => prec(PREC.CAST, seq(
      '(',
      field('type', $.type_descriptor),
      ')',
      field('value', $.expression),
    )),

    type_descriptor: $ => seq(
      repeat($.type_qualifier),
      field('type', $.type_specifier),
      repeat($.type_qualifier),
      field('declarator', optional($._abstract_declarator)),
    ),

    sizeof_expression: $ => prec(PREC.SIZEOF, seq(
      'sizeof',
      choice(
        field('value', $.expression),
        seq('(', field('type', $.type_descriptor), ')'),
      ),
    )),

    alignof_expression: $ => prec(PREC.SIZEOF, seq(
      choice('__alignof__', '__alignof', '_alignof', 'alignof', '_Alignof'),
      seq('(', field('type', $.type_descriptor), ')'),
    )),

    offsetof_expression: $ => prec(PREC.OFFSETOF, seq(
      'offsetof',
      seq('(', field('type', $.type_descriptor), ',', field('member', $._field_identifier), ')'),
    )),

    generic_expression: $ => prec(PREC.CALL, seq(
      '_Generic',
      '(',
      $.expression,
      ',',
      commaSep1(seq($.type_descriptor, ':', $.expression)),
      ')',
    )),

    subscript_expression: $ => prec(PREC.SUBSCRIPT, seq(
      field('argument', $.expression),
      '[',
      field('index', $.expression),
      ']',
    )),

    call_expression: $ => prec(PREC.CALL, seq(
      field('function', $.expression),
      field('arguments', $.argument_list),
      optional(field('virtual_arguments', $.virtual_argument)),
    )),

    gnu_asm_expression: $ => prec(PREC.CALL, seq(
      choice('asm', '__asm__', '__asm'),
      repeat($.gnu_asm_qualifier),
      '(',
      field('assembly_code', $._string),
      optional(seq(
        field('output_operands', $.gnu_asm_output_operand_list),
        optional(seq(
          field('input_operands', $.gnu_asm_input_operand_list),
          optional(seq(
            field('clobbers', $.gnu_asm_clobber_list),
            optional(field('goto_labels', $.gnu_asm_goto_list)),
          )),
        )),
      )),
      ')',
    )),

    gnu_asm_qualifier: _ => choice(
      'volatile',
      '__volatile__',
      'inline',
      'goto',
    ),

    gnu_asm_output_operand_list: $ => seq(
      ':',
      commaSep(field('operand', $.gnu_asm_output_operand)),
    ),

    gnu_asm_output_operand: $ => seq(
      optional(seq(
        '[',
        field('symbol', $.identifier),
        ']',
      )),
      field('constraint', $.string_literal),
      '(',
      field('value', $.expression),
      ')',
    ),

    gnu_asm_input_operand_list: $ => seq(
      ':',
      commaSep(field('operand', $.gnu_asm_input_operand)),
    ),

    gnu_asm_input_operand: $ => seq(
      optional(seq(
        '[',
        field('symbol', $.identifier),
        ']',
      )),
      field('constraint', $.string_literal),
      '(',
      field('value', $.expression),
      ')',
    ),

    gnu_asm_clobber_list: $ => seq(
      ':',
      commaSep(field('register', $._string)),
    ),

    gnu_asm_goto_list: $ => seq(
      ':',
      commaSep(field('label', $.identifier)),
    ),

    extension_expression: $ => seq('__extension__', $.expression),

    // The compound_statement is added to parse macros taking statements as arguments, e.g. MYFORLOOP(1, 10, i, { foo(i); bar(i); })
    argument_list: $ => seq('(', commaSep(choice($.expression, $.compound_statement)), ')'),

    field_expression: $ => seq(
      prec(PREC.FIELD, seq(
        field('argument', $.expression),
        field('operator', choice('.', '->')),
      )),
      field('field', $._field_identifier),
    ),

    compound_literal_expression: $ => seq(
      '(',
      field('type', $.type_descriptor),
      ')',
      field('value', $.initializer_list),
    ),

    parenthesized_expression: $ => seq(
      '(',
      choice($.expression, $.comma_expression, $.compound_statement),
      ')',
    ),

    initializer_list: $ => seq(
      '{',
      commaSep(choice(
        $.initializer_pair,
        $.expression,
        $.initializer_list,
      )),
      optional(','),
      '}',
    ),

    initializer_pair: $ => choice(
      seq(
        field('designator', repeat1(choice(
          $.subscript_designator,
          $.field_designator,
          $.subscript_range_designator,
        ))),
        '=',
        field('value', choice($.expression, $.initializer_list)),
      ),
      seq(
        field('designator', $._field_identifier),
        ':',
        field('value', choice($.expression, $.initializer_list)),
      ),
    ),

    subscript_designator: $ => seq('[', $.expression, ']'),

    subscript_range_designator: $ => seq('[', field('start', $.expression), '...', field('end', $.expression), ']'),

    field_designator: $ => seq('.', $._field_identifier),

    number_literal: _ => {
      const separator = '\'';
      const hex = /[0-9a-fA-F]/;
      const decimal = /[0-9]/;
      const hexDigits = seq(repeat1(hex), repeat(seq(separator, repeat1(hex))));
      const decimalDigits = seq(repeat1(decimal), repeat(seq(separator, repeat1(decimal))));
      return token(seq(
        optional(/[-\+]/),
        optional(choice(/0[xX]/, /0[bB]/)),
        choice(
          seq(
            choice(
              decimalDigits,
              seq(/0[bB]/, decimalDigits),
              seq(/0[xX]/, hexDigits),
            ),
            optional(seq('.', optional(hexDigits))),
          ),
          seq('.', decimalDigits),
        ),
        optional(seq(
          /[eEpP]/,
          optional(seq(
            optional(/[-\+]/),
            hexDigits,
          )),
        )),
        /[uUlLwWfFbBdD]*/,
      ));
    },

    char_literal: $ => seq(
      choice('L\'', 'u\'', 'U\'', 'u8\'', '\''),
      repeat1(choice(
        $.escape_sequence,
        alias(token.immediate(/[^\n']/), $.character),
      )),
      '\'',
    ),

    // Must concatenate at least 2 nodes, one of which must be a string_literal.
    // Identifier is added to parse macros that are strings, like PRIu64.
    concatenated_string: $ => prec.right(seq(
      choice(
        seq($.identifier, $.string_literal),
        seq($.string_literal, $.string_literal),
        seq($.string_literal, $.identifier),
      ),
      repeat(choice($.string_literal, $.identifier)),
    )),

    string_literal: $ => seq(
      choice('L"', 'u"', 'U"', 'u8"', '"'),
      repeat(choice(
        alias(token.immediate(prec(1, /[^\\"\n]+/)), $.string_content),
        $.escape_sequence,
      )),
      '"',
    ),

    escape_sequence: _ => token(prec(1, seq(
      '\\',
      choice(
        /[^xuU]/,
        /\d{2,3}/,
        /x[0-9a-fA-F]{1,4}/,
        /u[0-9a-fA-F]{4}/,
        /U[0-9a-fA-F]{8}/,
      ),
    ))),

    system_lib_string: _ => token(seq(
      '<',
      repeat(choice(/[^>\n]/, '\\>')),
      '>',
    )),

    true: _ => token(choice('TRUE', 'true')),
    false: _ => token(choice('FALSE', 'false')),
    null: _ => choice('NULL', 'nullptr'),

    identifier: _ =>
      /(\p{XID_Start}|\$|_|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})(\p{XID_Continue}|\$|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})*/,

    _type_identifier: $ => alias(
      $.identifier,
      $.type_identifier,
    ),
    _field_identifier: $ => alias($.identifier, $.field_identifier),
    _statement_identifier: $ => alias($.identifier, $.statement_identifier),

    _empty_declaration: $ => seq(
      $.type_specifier,
      ';',
    ),

    macro_type_specifier: $ => prec.dynamic(-1, seq(
      field('name', $.identifier),
      '(',
      field('type', $.type_descriptor),
      ')',
    )),

    // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890
    comment: _ => token(choice(
      seq('//', /[^@]/, /(\\+(.|\r?\n)|[^\\\n])*/),
      seq(
        '/*',
        /[^@]/,
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/',
      ),
    )),
  },
});

module.exports.PREC = PREC;

/**
 *
 * @param {string} suffix
 *
 * @param {RuleBuilder<string>} content
 *
 * @param {number} precedence
 *
 * @returns {RuleBuilders<string, string>}
 */
function preprocIf(suffix, content, precedence = 0) {
  /**
   *
   * @param {GrammarSymbols<string>} $
   *
   * @returns {ChoiceRule}
   */
  function alternativeBlock($) {
    return choice(
      suffix ? alias($['preproc_else' + suffix], $.preproc_else) : $.preproc_else,
      suffix ? alias($['preproc_elif' + suffix], $.preproc_elif) : $.preproc_elif,
      suffix ? alias($['preproc_elifdef' + suffix], $.preproc_elifdef) : $.preproc_elifdef,
    );
  }

  return {
    ['preproc_if' + suffix]: $ => prec(precedence, seq(
      preprocessor('if'),
      field('condition', $._preproc_expression),
      '\n',
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
      preprocessor('endif'),
    )),

    ['preproc_ifdef' + suffix]: $ => prec(precedence, seq(
      choice(preprocessor('ifdef'), preprocessor('ifndef')),
      field('name', $.identifier),
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
      preprocessor('endif'),
    )),

    ['preproc_else' + suffix]: $ => prec(precedence, seq(
      preprocessor('else'),
      repeat(content($)),
    )),

    ['preproc_elif' + suffix]: $ => prec(precedence, seq(
      preprocessor('elif'),
      field('condition', $._preproc_expression),
      '\n',
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
    )),

    ['preproc_elifdef' + suffix]: $ => prec(precedence, seq(
      choice(preprocessor('elifdef'), preprocessor('elifndef')),
      field('name', $.identifier),
      repeat(content($)),
      field('alternative', optional(alternativeBlock($))),
    )),
  };
}

/**
 * Creates a preprocessor regex rule
 *
 * @param {RegExp | Rule | string} command
 *
 * @returns {AliasRule}
 */
function preprocessor(command) {
  return alias(new RegExp('#[ \t]*' + command), '#' + command);
}

/**
 * Creates a rule to optionally match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {ChoiceRule}
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {SeqRule}
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

/**
 * Creates a rule in an annotation
 *
 * @param {Rule} rule
 *
 * @returns {ChoiceRule}
 */
function annotation(rule) {
  return choice(
    seq('//@', rule, '\r?\n'),
    seq('/*@', rule, '*/'),
  );
}
