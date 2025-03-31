# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial implementation of JSON Schema to Zod conversion
- Support for basic types (string, number, integer, boolean, null, object, array)
- String validations (minLength, maxLength, pattern)
- Number validations (minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf)
- Array validations (minItems, maxItems, uniqueItems)
- Object validations (required properties, additionalProperties)
- Schema composition (const, enum, anyOf, allOf, oneOf)
- Dual module support (CommonJS and ESM)
- GitHub Actions CI workflow
- GitHub Actions publish workflow