import { Vault } from "obsidian";
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

  async downloadFolder(
    importFolderName: string,
    onProgress?: (progress: {
      totalFiles: number;
      processedFiles: number;
      currentFile: string;
      stage: string;
    }) => void
  ): Promise<{ success: boolean; message: string }> {
    try {
      onProgress?.({
        totalFiles: 0,
        processedFiles: 0,
        currentFile: "Downloading from Hyvmind...",
        stage: "downloading",
      });

      const json = await this.agent.getNotesData();
      if (!json) {
        return { success: true, message: "No notes found on Hyvmind" };
      }

      const data = JSON.parse(json) as { folders: FolderItem[] };
      if (!data.folders || data.folders.length === 0) {
        return { success: true, message: "No notes found on Hyvmind" };
      }

      const allFiles = data.folders.reduce(
        (sum, item) => sum + this.countFiles(item),
        0
      );

      onProgress?.({
        totalFiles: allFiles,
        processedFiles: 0,
        currentFile: "Writing files...",
        stage: "downloading",
      });

      try {
        await this.vault.createFolder(importFolderName);
      } catch {
        // Folder already exists
      }

      const counter = { processed: 0 };
      for (const item of data.folders) {
        await this.createItem(importFolderName, item, counter, allFiles, onProgress);
      }

      await this.agent.storeNotesData("");

      return {
        success: true,
        message: `Downloaded ${allFiles} files from Hyvmind into "${importFolderName}"`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Download failed: ${error instanceof Error ? error.message : String(error)}`,
      };
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

    if (item.folders && item.folders.length > 0) {
      try {
        await this.vault.createFolder(itemPath);
      } catch {
        // Folder already exists, skip
      }
      for (const child of item.folders) {
        await this.createItem(itemPath, child, counter, totalFiles, onProgress);
      }
    }
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
