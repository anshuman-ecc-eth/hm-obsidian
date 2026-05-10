import { TFile, TFolder, Vault } from "obsidian";
import { ICPAgent } from "./agent";

export interface UploadProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  stage: "scanning" | "uploading";
}

export type UploadCallback = (progress: UploadProgress) => void;

interface FolderItem {
  name: string;
  content?: string;
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
    const children: FolderItem[] = [];

    for (const child of folder.children) {
      if (child instanceof TFolder) {
        const sub = await this.scanFolder(child);
        children.push(sub);
      } else if (child instanceof TFile && child.extension === "md") {
        const content = await this.vault.cachedRead(child);
        children.push({ name: child.basename, content });
      }
    }

    return {
      name: folder.name || "",
      folders: children.length > 0 ? children : undefined,
    };
  }

  private countFiles(item: FolderItem): number {
    let count = 0;
    for (const child of item.folders ?? []) {
      if (child.content !== undefined) {
        count++;
      }
      count += this.countFiles(child);
    }
    return count;
  }
}
