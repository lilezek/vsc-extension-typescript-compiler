import * as vscode from 'vscode';

export class NotReadyError extends Error {
    constructor(private promise: Thenable<unknown>) {
        super('Not ready, wait for the promise to resolve.');
    }

    static isNotReadyError(error: Error): error is NotReadyError {
        return error.message === 'File is not ready yet.';
    }

    async waitUntilReady() {
        await this.promise;
    }
}

export async function loopUntilReady<T>(f: () => T): Promise<T> {
    while (true) {
        try {
            return f();
        } catch (e: unknown) {
            if (e instanceof NotReadyError) {
                console.log('Waiting for the file to be ready.');
                await e.waitUntilReady();
            } else {
                throw e;
            }
        }
    }
}

const fs = vscode.workspace.fs;

/**
 * It turns a asynchronous file system into a synchronous one. 
 * It works by caching the results of the asynchronous file system.
 * 
 * If a file is not ready yet, we will throw an error.
 */
export class AsyncFS {
    private cacheFiles = new Map<string, string | null>();
    private cacheDirectories = new Map<string, Array<[string, vscode.FileType]>>();
    private promises: Array<Thenable<unknown>> = [];

    constructor() { }

    readFile(path: string): string | null {
        const file = this.cacheFiles.get(path);
        if (file === undefined) {
            const file = fs.readFile(vscode.Uri.file(path)).then((buffer) => {
                const content = new TextDecoder().decode(buffer);
                this.cacheFiles.set(path, content);
                return content;
            }, (error) => {
                console.error(error);
                this.cacheFiles.set(path, null);
                return null;
            });

            this.promises.push(file);

            throw new NotReadyError(file);
        }

        return file;
    }

    fileExists(path: string) {
        return this.readFile(path) !== null;
    }

    writeFile(path: string, data: string) {
        const dataArray = new TextEncoder().encode(data);
        const file = fs.writeFile(vscode.Uri.file(path), dataArray).then(() => {
            this.cacheFiles.set(path, data);
        }, (error) => {
            console.error(error);
            this.cacheFiles.set(path, null);
        });

        this.promises.push(file);
        return file;
    }

    readDirectory(path: string) {
        const directory = this.cacheDirectories.get(path);
        if (directory === undefined) {
            const directory = fs.readDirectory(vscode.Uri.file(path)).then((files) => {
                this.cacheDirectories.set(path, files);
                return files;
            }, (error) => {
                this.cacheDirectories.set(path, []);
                return [];
            });
            this.promises.push(directory);

            throw new NotReadyError(directory);
        }

        return directory;
    }

    directoryExists(path: string) {
        return this.readDirectory(path) !== null;
    }

    async awaitLastPromise() {
        if (!this.promises.length) {
            return false;
        }

        await Promise.all(this.promises);
        this.promises = [];
        return true;
    }
}