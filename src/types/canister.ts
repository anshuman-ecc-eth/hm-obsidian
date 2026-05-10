export type NodeId = string;

export interface FolderEntry {
  name: string;
  path: string;
  isFolder: boolean;
  children: FolderEntry[];
  content?: string;
}

export interface HyvmindActor {
  requestPluginBinding(pluginPubKey: string, forPrincipal: string): Promise<void>;
  getPendingPluginBindings(): Promise<string[]>;
  approvePluginBinding(pluginPubKey: string): Promise<void>;
  getPluginBindingStatus(): Promise<boolean>;
  getMyPrincipal(): Promise<string>;
  storeNotesData(json: string): Promise<void>;
  getNotesData(): Promise<string | null>;
  initializeAccessControl(): Promise<void>;
  isCallerApproved(): Promise<boolean>;
  requestApproval(): Promise<void>;
  getCallerUserProfile(): Promise<{ name: string; socialUrl: string | null } | null>;
  saveCallerUserProfile(profile: { name: string; socialUrl: string | null }): Promise<void>;
}
