// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { VSCSystem, findTsConfig } from './ts_internals';
import * as ts from 'typescript';
import { loopUntilReady } from './asynchronous-fs';

const sysFolders = new Map<string, VSCSystem>();

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('typescript-compiler is now active!');
	let disposable = vscode.commands.registerCommand('typescript-compiler.tsc', async () => {
		// Find the tsconfig.json file in the root of the workspace
		const tsconfigFiles = await findTsConfig();

		// Read the contents of the tsconfig file
		const tsconfigFile = tsconfigFiles[0];
		const tsconfig = await vscode.workspace.fs.readFile(tsconfigFile);
		const tsconfigContent = new TextDecoder().decode(tsconfig);

		// Parse the tsconfig file
		const tsconfigJson = ts.parseConfigFileTextToJson(tsconfigFile.path, tsconfigContent);

		// Get the folder of the tsconfig file
		const tsconfigFolder = tsconfigFile.path.replace(/\/[^\/]+$/, '');

		// Create a host for the compiler
		let sys: VSCSystem;
		if (sysFolders.has(tsconfigFolder)) {
			sys = sysFolders.get(tsconfigFolder)!;
		} else {
			sys = new VSCSystem(tsconfigFolder);
			sysFolders.set(tsconfigFolder, sys);
		}

		// Replace some of the options
		const compilerOptions = tsconfigJson.config.compilerOptions;
		compilerOptions.module = ts.ModuleKind[compilerOptions.module];
		compilerOptions.target = ts.ScriptTarget[compilerOptions.target];

		const promise = vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: 'Compiling TypeScript',
			cancellable: false,
		}, async () => {
			const parsedConfig = await loopUntilReady(
				() => ts.parseJsonConfigFileContent(
					tsconfigJson.config,
					sys,
					tsconfigFolder,
					compilerOptions,
					'tsconfig.json'
				)
			);

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

				console.log('compilerOptions', program.getCompilerOptions());

				emitResult = await loopUntilReady(() => program.emit());
				const diagnostics = emitResult.diagnostics;
				console.warn('diagnostics', diagnostics);

				if (!diagnostics.length || !await sys.awaitLastPromise()) {
					break;
				}
			} while (true);

			await sys.awaitLastPromise();
		});

		promise.then(() => {
			vscode.window.showInformationMessage('TypeScript compilation complete!');
		}, (reason) => {
			vscode.window.showErrorMessage(`TypeScript compilation failed: ${reason}`);
		});
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
