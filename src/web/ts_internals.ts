import * as vscode from 'vscode';
import * as ts from 'typescript';
import { AsyncFS } from './asynchronous-fs';
import { minimatch } from 'minimatch';
import sha256 from './sha256';


export async function findTsConfig(path?: string) {
    const files = await vscode.workspace.findFiles('**/tsconfig.json', '**/node_modules/**');

    return files;
}

export class VSCSystem implements ts.System {
    private fs: AsyncFS;

    args: string[] = [];
    newLine: string = '\n';
    useCaseSensitiveFileNames: boolean = true;

    constructor(private projectRoot: vscode.Uri) {
        this.fs = new AsyncFS();
    }

    private getUri(relPath: string) {
        if (relPath.startsWith(this.projectRoot.toString())) {
            return vscode.Uri.parse(relPath);
        }
        if (relPath.startsWith('/')) {
            return this.projectRoot.with({ path: relPath });
        }
        return this.projectRoot.with({
            path: `${this.projectRoot.path}/${relPath}`
        });
    }

    write(s: string): void {
        throw new Error('Method write not implemented.' + JSON.stringify(arguments));
    }
    writeOutputIsTTY?(): boolean {
        throw new Error('Method writeOutputIsTTY not implemented.' + JSON.stringify(arguments));
    }
    getWidthOfTerminal?(): number {
        throw new Error('Method getWidthOfTerminal not implemented.' + JSON.stringify(arguments));
    }
    readFile(path: string, encoding?: string | undefined): string | undefined {
        return this.fs.readFile(this.getUri(path)) ?? undefined;
    }
    getFileSize?(path: string): number {
        throw new Error('Method getFileSize not implemented.' + JSON.stringify(arguments));
    }
    writeFile(path: string, data: string, writeByteOrderMark?: boolean | undefined): void {
        this.fs.writeFile(this.getUri(path), data);
    }
    resolvePath(path: string): string {
        throw new Error('Method resolvePath not implemented.' + JSON.stringify(arguments));
    }
    fileExists(path: string): boolean {
        return this.fs.fileExists(this.getUri(path));
    }
    directoryExists(path: string): boolean {
        return this.fs.directoryExists(this.getUri(path));
    }
    createDirectory(path: string): void {
        throw new Error('Method createDirectory not implemented.' + JSON.stringify(arguments));
    }
    getExecutingFilePath(): string {
        return this.projectRoot.path;
    }
    getCurrentDirectory(): string {
        return this.projectRoot.path;
    }
    getDirectories(rootDir: string): string[] {
        const files: string[] = [];
        const ls = this.fs.readDirectory(this.getUri(rootDir));

        if (!ls) {
            return [];
        }

        for (const [path, type] of ls) {
            if (type === vscode.FileType.Directory) {
                files.push(`${this.getUri(rootDir)}/${path}`);
            }
        }

        return files;
    }
    readDirectory(rootDir: string, extensions?: readonly string[] | undefined, excludes?: readonly string[] | undefined, includes?: readonly string[] | undefined, depth?: number | undefined): string[] {
        if (depth === 0) {
            return [];
        }

        const files: string[] = [];
        const ls = this.fs.readDirectory(this.getUri(rootDir));

        if (!ls) {
            return [];
        }

        for (const [path, type] of ls) {
            if (type === vscode.FileType.File) {
                if (extensions && extensions.length > 0 && !extensions.some((extension) => path.endsWith(extension))) {
                    continue;
                }

                const excluded = (excludes ?? []).some((exclude) => {
                    const relativePath = vscode.workspace.asRelativePath(`${rootDir}/${path}`);
                    if (minimatch(relativePath, exclude)) {
                        return true;
                    }
                });

                if (excluded) {
                    continue;
                }

                const included = (includes ?? []).every((include) => {
                    // Get the relative path
                    const relativePath = vscode.workspace.asRelativePath(`${rootDir}/${path}`);
                    if (minimatch(relativePath, include)) {
                        return true;
                    }
                });

                if (!included) {
                    continue;
                }

                files.push(`${rootDir}/${path}`);
            } else if (type === vscode.FileType.Directory) {
                files.push(...this.readDirectory(`${rootDir}/${path}`, extensions, excludes, includes, depth ? depth - 1 : undefined));
            }
        }

        return files;
    }
    getModifiedTime?(path: string): Date | undefined {
        throw new Error('Method getModifiedTime not implemented.' + JSON.stringify(arguments));
    }
    setModifiedTime?(path: string, time: Date): void {
        throw new Error('Method setModifiedTime not implemented.' + JSON.stringify(arguments));
    }
    deleteFile?(path: string): void {
        throw new Error('Method deleteFile not implemented.' + JSON.stringify(arguments));
    }
    createHash?(data: string): string {
        return sha256.hex(data);
    }
    createSHA256Hash?(data: string): string {
        return sha256.hex(data);
    }
    exit(exitCode?: number | undefined): void {
        throw new Error('Method exit not implemented.' + JSON.stringify(arguments));
    }
    setTimeout?(callback: (...args: any[]) => void, ms: number, ...args: any[]) {
        throw new Error('Method setTimeout not implemented.' + JSON.stringify(arguments));
    }
    clearTimeout?(timeoutId: any): void {
        throw new Error('Method clearTimeout not implemented.' + JSON.stringify(arguments));
    }
    clearScreen?(): void {
        throw new Error('Method clearScreen not implemented.' + JSON.stringify(arguments));
    }
    base64decode?(input: string): string {
        throw new Error('Method base64decode not implemented.' + JSON.stringify(arguments));
    }
    base64encode?(input: string): string {
        throw new Error('Method base64encode not implemented.' + JSON.stringify(arguments));
    }

    awaitLastPromise() {
        return this.fs.awaitLastPromise();
    }
}