import { BaseFileSystem, FileSystem } from '../core/file_system.d.ts';
import { ApiError } from '../core/api_error.d.ts';
export default class FolderAdapter extends BaseFileSystem implements FileSystem {
    private _wrapped;
    private _folder;
    constructor(folder: string, wrapped: FileSystem);
    initialize(cb: (e?: ApiError) => void): void;
    getName(): string;
    isReadOnly(): boolean;
    supportsProps(): boolean;
    supportsSynch(): boolean;
    supportsLinks(): boolean;
    static isAvailable(): boolean;
}
