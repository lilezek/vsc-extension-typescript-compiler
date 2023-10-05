# typescript-compiler-web README

This is a standalone extension for compiling TypeScript. It is slow and probably inefficient, but it works in web without the need of a terminal.

## Features

This extension can compile TypeScript without any installation and it is compatible with the web version of vsc.

## Extension Settings

N/A

## Known Issues

1. We don't support include/exclude paths in 'tsconfig.json'.
2. The compiler version bundled with this extension is 5.2.2. We do not support more versions.

## Release Notes

Users appreciate release notes as you update your extension.

### 0.1.0

We support now other Uri's than "file". This means this extension now should work even in web.

### 0.0.1

Initial release of TypeScript compiler.