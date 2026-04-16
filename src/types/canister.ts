/**
 * TypeScript types for the Hyvmind canister interface
 * Based on the Candid interface from the Motoko backend
 */

export type NodeId = string;

export type NodeType = 
  | "curation" 
  | "swarm" 
  | "location" 
  | "lawEntity" 
  | "interpEntity";

export interface CustomAttribute {
  key: string;
  value: string;
}

export interface SourceGraphNodeInput {
  name: string;
  nodeType: NodeType;
  jurisdiction: string | null;
  tags: string[];
  content: string | null;
  parentName: string | null;
  attributes: CustomAttribute[];
}

export interface SourceGraphEdgeInput {
  sourceName: string;
  targetName: string;
  edgeLabel: string;
  bidirectional: boolean;
}

export interface PublishSourceGraphInput {
  nodes: SourceGraphNodeInput[];
  edges: SourceGraphEdgeInput[];
}

export type PublishResult =
  | { success: { message: string } }
  | { noChanges: null }
  | { error: string };

/**
 * Candid interface for the backend actor
 */
export interface HyvmindActor {
  publishSourceGraph(input: PublishSourceGraphInput): Promise<PublishResult>;
  initializeAccessControl(): Promise<void>;
  isCallerApproved(): Promise<boolean>;
  requestApproval(): Promise<void>;
  getCallerUserProfile(): Promise<{ name: string; socialUrl: string | null } | null>;
  saveCallerUserProfile(profile: { name: string; socialUrl: string | null }): Promise<void>;
}

/**
 * Graph node for internal processing
 */
export interface GraphNode {
  id: string;
  name: string;
  nodeType: NodeType;
  parentId: string | null;
  path: string;
  content?: string;
  isFolder: boolean;
}

/**
 * Folder structure for parsing
 */
export interface FolderEntry {
  name: string;
  path: string;
  isFolder: boolean;
  children: FolderEntry[];
  content?: string;
}
