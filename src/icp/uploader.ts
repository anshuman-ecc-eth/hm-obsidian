/**
 * Folder-to-graph conversion and upload module
 * Handles recursive folder scanning and uploading to Hyvmind
 */

import { TFile, TFolder, Vault } from "obsidian";
import {
  SourceGraphNodeInput,
  SourceGraphEdgeInput,
  PublishSourceGraphInput,
  FolderEntry,
} from "../types/canister";
import { ICPAgent } from "./agent";

// Approximate payload limit (2MB minus some overhead)
const PAYLOAD_LIMIT_BYTES = 1_800_000;

// Hardcoded tag for imported content
const IMPORT_TAG = "obsidian-import";

export interface UploadProgress {
  totalFiles: number;
  processedFiles: number;
  currentFile: string;
  stage: "scanning" | "converting" | "uploading";
}

export type UploadCallback = (progress: UploadProgress) => void;

export class FolderUploader {
  private vault: Vault;
  private agent: ICPAgent;

  constructor(vault: Vault, agent: ICPAgent) {
    this.vault = vault;
    this.agent = agent;
  }

  /**
   * Upload a folder to Hyvmind
   */
  async uploadFolder(
    folder: TFolder,
    onProgress?: UploadCallback
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Stage 1: Scan folder structure
      onProgress?.({
        totalFiles: 0,
        processedFiles: 0,
        currentFile: "Scanning folder structure...",
        stage: "scanning",
      });

      const folderEntry = await this.scanFolder(folder);
      const allFiles = this.collectAllFiles(folderEntry);

      // Stage 2: Convert to graph
      onProgress?.({
        totalFiles: allFiles.length,
        processedFiles: 0,
        currentFile: "Converting to graph format...",
        stage: "converting",
      });

      const graph = this.convertToGraph(folderEntry);

      // Check payload size and split if needed
      const payload = JSON.stringify(graph);
      const payloadSize = new Blob([payload]).size;

      if (payloadSize > PAYLOAD_LIMIT_BYTES) {
        // Split into batches
        return await this.uploadInBatches(graph, onProgress);
      }

      // Stage 3: Upload
      onProgress?.({
        totalFiles: allFiles.length,
        processedFiles: allFiles.length,
        currentFile: "Uploading to Hyvmind...",
        stage: "uploading",
      });

      const result = await this.agent.publishSourceGraph(graph);

      if ("success" in result) {
        return { success: true, message: result.success.message };
      } else if ("noChanges" in result) {
        return { success: true, message: "No changes to upload" };
      } else if ("error" in result) {
        return { success: false, message: `Error: ${result.error}` };
      }

      return { success: false, message: "Unknown error" };
    } catch (error) {
      return {
        success: false,
        message: `Upload failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Upload large graphs in batches
   */
  private async uploadInBatches(
    graph: PublishSourceGraphInput,
    onProgress?: UploadCallback
  ): Promise<{ success: boolean; message: string }> {
    // Split nodes into batches
    const batches: SourceGraphNodeInput[][] = [];
    let currentBatch: SourceGraphNodeInput[] = [];
    let currentBatchSize = 0;

    for (const node of graph.nodes) {
      const nodeSize = new Blob([JSON.stringify(node)]).size;

      if (currentBatchSize + nodeSize > PAYLOAD_LIMIT_BYTES && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [node];
        currentBatchSize = nodeSize;
      } else {
        currentBatch.push(node);
        currentBatchSize += nodeSize;
      }
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    // Upload each batch
    let totalUploaded = 0;
    const totalBatches = batches.length;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      onProgress?.({
        totalFiles: graph.nodes.length,
        processedFiles: totalUploaded,
        currentFile: `Uploading batch ${i + 1} of ${totalBatches}...`,
        stage: "uploading",
      });

      // For intermediate batches, we only upload the nodes
      // The edges will be uploaded with the final batch
      const isLastBatch = i === batches.length - 1;
      const batchGraph: PublishSourceGraphInput = {
        nodes: batch,
        edges: isLastBatch ? graph.edges : [],
      };

      const result = await this.agent.publishSourceGraph(batchGraph);

      if ("error" in result) {
        return {
          success: false,
          message: `Batch ${i + 1} failed: ${result.error}`,
        };
      }

      totalUploaded += batch.length;
    }

    return {
      success: true,
      message: `Successfully uploaded ${graph.nodes.length} nodes in ${totalBatches} batches`,
    };
  }

  /**
   * Recursively scan a folder
   */
  private async scanFolder(folder: TFolder, path = ""): Promise<FolderEntry> {
    const entry: FolderEntry = {
      name: folder.name,
      path: path || folder.name,
      isFolder: true,
      children: [],
    };

    for (const child of folder.children) {
      if (child instanceof TFolder) {
        // Recursively scan subfolders
        const childEntry = await this.scanFolder(child, `${entry.path}/${child.name}`);
        entry.children.push(childEntry);
      } else if (child instanceof TFile && child.extension === "md") {
        // Read markdown file content
        const content = await this.vault.cachedRead(child);
        entry.children.push({
          name: child.basename,
          path: `${entry.path}/${child.name}`,
          isFolder: false,
          children: [],
          content,
        });
      }
      // Non-markdown files are ignored
    }

    return entry;
  }

  /**
   * Collect all files from folder tree
   */
  private collectAllFiles(entry: FolderEntry): FolderEntry[] {
    const files: FolderEntry[] = [];

    if (!entry.isFolder) {
      files.push(entry);
    }

    for (const child of entry.children) {
      if (child.isFolder) {
        files.push(...this.collectAllFiles(child));
      } else {
        files.push(child);
      }
    }

    return files;
  }

  /**
   * Convert folder structure to source graph
   *
   * Mapping:
   * - Root folder → curation
   * - Level 1 subfolders → swarm (with "obsidian-import" tag)
   * - Level 2+ subfolders → location
   * - .md files → lawEntity (filename)
   * - File content → interpEntity (connected to lawEntity)
   */
  private convertToGraph(rootFolder: FolderEntry): PublishSourceGraphInput {
    const nodes: SourceGraphNodeInput[] = [];
    const edges: SourceGraphEdgeInput[] = [];

    // Create curation from root folder
    const curationName = rootFolder.name;
    nodes.push({
      name: curationName,
      nodeType: "curation",
      jurisdiction: null,
      tags: [],
      content: null,
      parentName: null,
      attributes: [],
    });

    // Process each level 1 child
    for (const level1Child of rootFolder.children) {
      if (level1Child.isFolder) {
        // Level 1 folder → swarm
        const swarmName = level1Child.name;
        nodes.push({
          name: swarmName,
          nodeType: "swarm",
          jurisdiction: null,
          tags: [IMPORT_TAG],
          content: null,
          parentName: curationName,
          attributes: [],
        });

        // Create edge: curation → swarm
        edges.push({
          sourceName: curationName,
          targetName: swarmName,
          edgeLabel: "contains",
          bidirectional: false,
        });

        // Process level 2+ children recursively
        this.processSubfolder(level1Child, swarmName, nodes, edges);
      } else {
        // Level 1 file → directly under curation
        this.processFile(level1Child, curationName, nodes, edges);
      }
    }

    return { nodes, edges };
  }

  /**
   * Process subfolders (level 2+) as locations
   */
  private processSubfolder(
    folder: FolderEntry,
    parentName: string,
    nodes: SourceGraphNodeInput[],
    edges: SourceGraphEdgeInput[]
  ): void {
    const locationName = folder.name;

    nodes.push({
      name: locationName,
      nodeType: "location",
      jurisdiction: null,
      tags: [],
      content: null,
      parentName: parentName,
      attributes: [],
    });

    // Create edge: parent → location
    edges.push({
      sourceName: parentName,
      targetName: locationName,
      edgeLabel: "contains",
      bidirectional: false,
    });

    // Process children
    for (const child of folder.children) {
      if (child.isFolder) {
        // Nested folder → another location
        this.processSubfolder(child, locationName, nodes, edges);
      } else {
        // File → lawEntity + interpEntity
        this.processFile(child, locationName, nodes, edges);
      }
    }
  }

  /**
   * Process a file into lawEntity + interpEntity
   */
  private processFile(
    file: FolderEntry,
    parentName: string,
    nodes: SourceGraphNodeInput[],
    edges: SourceGraphEdgeInput[]
  ): void {
    const lawEntityName = file.name;

    // Create lawEntity from filename
    nodes.push({
      name: lawEntityName,
      nodeType: "lawEntity",
      jurisdiction: null,
      tags: [],
      content: null,
      parentName: parentName,
      attributes: [],
    });

    // Create edge: parent → lawEntity
    edges.push({
      sourceName: parentName,
      targetName: lawEntityName,
      edgeLabel: "contains",
      bidirectional: false,
    });

    // Create interpEntity from file content
    if (file.content) {
      const interpEntityName = `${lawEntityName} (content)`;

      nodes.push({
        name: interpEntityName,
        nodeType: "interpEntity",
        jurisdiction: null,
        tags: [],
        content: file.content,
        parentName: lawEntityName,
        attributes: [],
      });

      // Create edge: lawEntity → interpEntity
      edges.push({
        sourceName: lawEntityName,
        targetName: interpEntityName,
        edgeLabel: "interprets",
        bidirectional: false,
      });
    }
  }
}
