export type NodeId = string;

export interface FolderEntry {
  name: string;
  path: string;
  isFolder: boolean;
  children: FolderEntry[];
  content?: string;
}

export interface HyvmindActor {
  requestPluginBinding(pluginPubKey: unknown, forPrincipal: unknown): Promise<void>;
  getPendingPluginBindings(): Promise<unknown[]>;
  approvePluginBinding(pluginPubKey: unknown): Promise<void>;
  getPluginBindingStatus(): Promise<boolean>;
  getMyPrincipal(): Promise<unknown>;
  getBoundPluginKeys(): Promise<unknown[]>;
  revokePluginBinding(pluginKey: unknown): Promise<void>;
  storeNotesData(json: string): Promise<void>;
  getNotesData(): Promise<string | null>;
  initializeAccessControl(): Promise<void>;
  isCallerApproved(): Promise<boolean>;
  requestApproval(): Promise<void>;
  getCallerUserProfile(): Promise<{ name: string; socialUrl: string | null } | null>;
  saveCallerUserProfile(profile: { name: string; socialUrl: string | null }): Promise<void>;
  pushToVault(json: string): Promise<void>;
  hasPendingVaultPush(): Promise<boolean>;
  getAndClearPendingVaultPush(): Promise<string | null>;
}
