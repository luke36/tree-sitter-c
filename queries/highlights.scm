(identifier) @variable

((identifier) @constant
 (#match? @constant "^[A-Z][A-Z\\d_]*$"))

"break" @keyword
"case" @keyword
"const" @keyword
"continue" @keyword
"default" @keyword
"do" @keyword
"else" @keyword
"enum" @keyword
"extern" @keyword
"for" @keyword
"if" @keyword
"inline" @keyword
"return" @keyword
"sizeof" @keyword
"static" @keyword
"struct" @keyword
"switch" @keyword
"typedef" @keyword
"union" @keyword
"volatile" @keyword
"while" @keyword

"#define" @keyword
"#elif" @keyword
"#else" @keyword
"#endif" @keyword
"#if" @keyword
"#ifdef" @keyword
"#ifndef" @keyword
"#include" @keyword
(preproc_directive) @keyword

"With" @keyword
"Given"
"Require" @keyword
"Ensure" @keyword
"where" @keyword
"which" @keyword
"implies" @keyword
"exists" @keyword
"forall" @keyword
"Inv" @keyword
"Assert" @keyword
"by" @keyword
"Import" @keyword
"Coq" @keyword
"Extern" @keyword
"Field" @keyword
"Record" @keyword
"data_at" @keyword
"undef_data_at" @keyword
"field_address" @keyword
"@mark" @keyword
"include" @keyword
"strategies" @keyword


"--" @operator
"-" @operator
"-=" @operator
"->" @operator
"=" @operator
"!=" @operator
"*" @operator
"&" @operator
"&&" @operator
"+" @operator
"++" @operator
"+=" @operator
"<" @operator
"==" @operator
">" @operator
"||" @operator

"=>" @operator
"<=>" @operator
"#" @operator
"@" @operator

"." @delimiter
";" @delimiter
"::" @delimiter
":=" @delimiter

(string_literal) @string
(system_lib_string) @string

(null) @constant
(number_literal) @number
(char_literal) @number

(true) @constant
(false) @constant
(int_max_assertion) @constant
(int_min_assertion) @constant

(field_identifier) @property
(statement_identifier) @label
(type_identifier) @type
(primitive_type) @type
(sized_type_specifier) @type

(z_atype) @type
(nat_atype) @type
(bool_atype) @type
(list_atype) @type
(prod_atype) @type
(prop_atype) @type
(assertion_atype) @type

(call_expression
  function: (identifier) @function)
(call_expression
  function: (field_expression
    field: (field_identifier) @function))
(function_declarator
  declarator: (identifier) @function)
(preproc_function_def
  name: (identifier) @function.special)

(call_assertion
  function: (identifier) @function)

(comment) @comment


(struct_specifier name: (type_identifier) @name body:(_)) @definition.class

(declaration type: (union_specifier name: (type_identifier) @name)) @definition.class

(function_declarator declarator: (identifier) @name) @definition.function

(type_definition declarator: (type_identifier) @name) @definition.type

(enum_specifier name: (type_identifier) @name) @definition.type

(term_decl
  variable: (_) :* @name)

(definitional_identifier (_) @name)

(atype_decl
  variable: (_) :* @name) @definition.type

(implicit_atype_decl
  variable: (_) :* @name) @definition.type

(bracket_exist_decl
  variable: (_) :* @name)

(extern_alias_annotation
  variable: (_) @name)

(record_field
  field: (_) @name)

(extern_record_annotation
  record: (_) @name) @definition.type

(extern_record_annotation
  constructor: (_) @name)
