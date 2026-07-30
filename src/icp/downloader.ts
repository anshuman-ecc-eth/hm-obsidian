import { Vault, TFolder, normalizePath } from "obsidian";
import { ICPAgent } from "./agent";

interface FolderItem {
  name: string;
  content?: string;
  folders?: FolderItem[];
}

export class FolderDownloader {
  private vault: Vault;
  private agent: ICPAgent;

  constructor(vault: Vault, agent: ICPAgent) {
    this.vault = vault;
    this.agent = agent;
  }

  async processPendingPush(json: string, importFolderName: string): Promise<void> {
    const data = JSON.parse(json) as { folders: FolderItem[] };
    if (!data.folders || data.folders.length === 0) return;

    await this.ensureFolderExists(importFolderName);

    const counter = { processed: 0 };
    for (const item of data.folders) {
      await this.createItem(importFolderName, item, counter, 0);
    }
  }

  private async ensureFolderExists(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (this.vault.getAbstractFileByPath(normalized) instanceof TFolder) return;
    const parent = normalized.substring(0, normalized.lastIndexOf("/"));
    if (parent && parent !== normalized) {
      await this.ensureFolderExists(parent);
    }
    await this.vault.createFolder(normalized);
  }

  private async createItem(
    parentPath: string,
    item: FolderItem,
    counter: { processed: number },
    totalFiles: number,
    onProgress?: (progress: {
      totalFiles: number;
      processedFiles: number;
      currentFile: string;
      stage: string;
    }) => void
  ): Promise<void> {
    const itemPath = normalizePath(`${parentPath}/${item.name}`);

    if (item.content !== undefined) {
      const parentDir = itemPath.substring(0, itemPath.lastIndexOf("/"));
      if (parentDir) {
        await this.ensureFolderExists(parentDir);
      }
      try {
        await this.vault.create(itemPath, item.content);
      } catch {
        // File already exists, skip
      }
      counter.processed++;
      onProgress?.({
        totalFiles,
        processedFiles: counter.processed,
        currentFile: itemPath,
        stage: "downloading",
      });
    }

    if (item.folders !== undefined) {
      await this.ensureFolderExists(itemPath);
      for (const child of item.folders) {
        await this.createItem(itemPath, child, counter, totalFiles, onProgress);
      }
    }
  }

}
