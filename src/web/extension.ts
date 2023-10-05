// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { VSCSystem, findTsConfig } from './ts_internals';
import * as ts from 'typescript';
import { loopUntilReady } from './asynchronous-fs';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('typescript-compiler-web is now active!');
	let disposable = vscode.commands.registerCommand('typescript-compiler-web.tsc', async () => {
		// Find the tsconfig.json file in the root of the workspace
		const tsconfigFiles = await findTsConfig();

		// Read the contents of the tsconfig file
		const tsconfigFile = tsconfigFiles[0];
		const tsconfig = await vscode.workspace.fs.readFile(tsconfigFile);
		const tsconfigContent = new TextDecoder().decode(tsconfig);

		// Parse the tsconfig file
		const tsconfigJson = ts.parseConfigFileTextToJson(tsconfigFile.path, tsconfigContent);

		// Get the folder of the tsconfig file
		const tsconfigFolder = tsconfigFile.with({ path: tsconfigFile.path.replace(/\/[^\/]+$/, '') });

		// Create a host for the compiler
		let sys = new VSCSystem(tsconfigFolder);

		try {
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Window,
				title: 'Compiling TypeScript',
				cancellable: false,
			}, async () => {
				const parsedConfig: ts.ParsedCommandLine = await loopUntilReady(
					() => ts.parseJsonConfigFileContent(
						tsconfigJson.config,
						sys,
						tsconfigFolder.path,
						tsconfigJson.config.options,
						'tsconfig.json'
					)
				);

				// Replace some of the options
				const compilerOptions = parsedConfig.options;
				// compilerOptions.module = ts.ModuleKind[compilerOptions.module ?? "esnext"];
				// compilerOptions.target = ts.ScriptTarget[compilerOptions.target ?? "esnext"];

				// Prepare the files beforehand
				for (const fileName of parsedConfig.fileNames) {
					try {
						sys.readFile(fileName);
					} catch (e) {
						// Ignore errors
					}
				}

				await sys.awaitLastPromise();

				// Compile the project
				let program: ts.Program;
				do {
					program = await loopUntilReady(() =>
						ts.createProgram(parsedConfig.fileNames, parsedConfig.options, ts.createIncrementalCompilerHost(parsedConfig.options, sys)));

					// Get the diagnostics
					const diagnostics = ts.getPreEmitDiagnostics(program);

					if (!diagnostics.length) {
						break;
					}

					if (!await sys.awaitLastPromise()) {
						break;
					}
				} while (true);

				// Write files to disk
				let emitResult: ts.EmitResult;
				do {
					emitResult = await loopUntilReady(() => program.emit());
					const diagnostics = emitResult.diagnostics;
					if (!diagnostics.length || !await sys.awaitLastPromise()) {
						break;
					}
				} while (true);

				await sys.awaitLastPromise();
			});
			vscode.window.showInformationMessage('TypeScript compilation complete!');
		}
		catch (reason) {
			vscode.window.showErrorMessage(`TypeScript compilation failed: ${reason}`);
		}
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
