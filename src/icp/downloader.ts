import { Vault, normalizePath } from "obsidian";
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

    try {
      await this.vault.adapter.mkdir(normalizePath(importFolderName));
    } catch {
      // Folder already exists
    }

    const counter = { processed: 0 };
    for (const item of data.folders) {
      await this.createItem(importFolderName, item, counter, 0);
    }
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
    const itemPath = `${parentPath}/${item.name}`;

    if (item.content !== undefined) {
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
      try {
        await this.vault.adapter.mkdir(normalizePath(itemPath));
      } catch {
        // Folder already exists, skip
      }
      for (const child of item.folders) {
        await this.createItem(itemPath, child, counter, totalFiles, onProgress);
      }
    }
  }

}
