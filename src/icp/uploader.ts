import { TFile, TFolder, Vault } from "obsidian";
import { ICPAgent } from "./agent";

export interface UploadProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  stage: "scanning" | "uploading";
}

export type UploadCallback = (progress: UploadProgress) => void;

interface FileItem {
  name: string;
  content?: string;
}

interface FolderItem {
  name: string;
  files?: FileItem[];
  folders?: FolderItem[];
}

export class FolderUploader {
  private vault: Vault;
  private agent: ICPAgent;

  constructor(vault: Vault, agent: ICPAgent) {
    this.vault = vault;
    this.agent = agent;
  }

  async uploadFolder(
    folder: TFolder,
    onProgress?: UploadCallback
  ): Promise<{ success: boolean; message: string }> {
    try {
      onProgress?.({
        totalFiles: 0,
        processedFiles: 0,
        currentFile: "Scanning folder structure...",
        stage: "scanning",
      });

      const folderStructure = await this.scanFolder(folder);
      const allFiles = this.countFiles(folderStructure);

      onProgress?.({
        totalFiles: allFiles,
        processedFiles: 0,
        currentFile: "Uploading to Hyvmind...",
        stage: "uploading",
      });

      const json = JSON.stringify({ folders: [folderStructure] });
      await this.agent.storeNotesData(json);

      onProgress?.({
        totalFiles: allFiles,
        processedFiles: allFiles,
        currentFile: "Done",
        stage: "uploading",
      });

      return { success: true, message: `Imported ${allFiles} files into Hyvmind notes` };
    } catch (error) {
      return {
        success: false,
        message: `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async scanFolder(folder: TFolder): Promise<FolderItem> {
    const fileItems: FileItem[] = [];
    const folderItems: FolderItem[] = [];

    for (const child of folder.children) {
      if (child instanceof TFolder) {
        const sub = await this.scanFolder(child);
        folderItems.push(sub);
      } else if (child instanceof TFile && child.extension === "md") {
        const content = await this.vault.cachedRead(child);
        fileItems.push({ name: child.basename, content });
      }
    }

    const result: FolderItem = { name: folder.name || "" };
    if (fileItems.length > 0) result.files = fileItems;
    if (folderItems.length > 0) result.folders = folderItems;
    return result;
  }

  private countFiles(item: FolderItem): number {
    let count = item.files?.length ?? 0;
    for (const sub of item.folders ?? []) {
      count += this.countFiles(sub);
    }
    return count;
  }
}
