/**
 * Hyvmind Uploader Plugin for Obsidian
 * Uploads folders to Hyvmind ICP app as source graphs
 */

import { Plugin, TFolder, TAbstractFile, Notice, Menu, Modal, App } from "obsidian";
import { HyvmindSettings, DEFAULT_SETTINGS, HyvmindSettingTab } from "./settings";
import { ICPAuth, TokenStorage } from "./icp/auth";
import { ICPAgent } from "./icp/agent";
import { FolderUploader } from "./icp/uploader";
import { ConnectionStatusBar } from "./ui/status-bar";

class PluginTokenStorage implements TokenStorage {
  constructor(private plugin: HyvmindPlugin) {}

  getDelegationToken(): string | null {
    return this.plugin.settings.delegationToken || null;
  }

  setDelegationToken(token: string): void {
    this.plugin.settings.delegationToken = token;
    void this.plugin.saveSettings();
  }

  clearDelegationToken(): void {
    this.plugin.settings.delegationToken = "";
    void this.plugin.saveSettings();
  }
}

export default class HyvmindPlugin extends Plugin {
  settings!: HyvmindSettings;
  auth!: ICPAuth;
  agent!: ICPAgent;
  uploader!: FolderUploader;
  statusBar!: ConnectionStatusBar;

  async onload() {
    await this.loadSettings();

    const tokenStorage = new PluginTokenStorage(this);
    this.auth = new ICPAuth(this.settings.identityProviderUrl, tokenStorage);
    this.agent = new ICPAgent(this.settings.canisterId, this.settings.host);
    this.uploader = new FolderUploader(this.app.vault, this.agent);

    await this.auth.init();

    if (this.auth.isAuthenticated()) {
      const identity = this.auth.getIdentity();
      if (identity) {
        await this.agent.createAuthenticatedActor(identity);
      }
    }

    this.addSettingTab(new HyvmindSettingTab(this.app, this));

    const statusBarItem = this.addStatusBarItem();
    this.statusBar = new ConnectionStatusBar(statusBarItem);
    this.updateStatusBar();

    this.addRibbonIcon("upload-cloud", "Hyvmind uploader", () => {
      this.showUploadMenu();
    });

    this.addCommand({
      id: "disconnect-from-icp",
      name: "Disconnect from ICP",
      callback: () => {
        void this.disconnectFromICP();
      },
    });

    this.addCommand({
      id: "upload-current-folder",
      name: "Upload current folder to Hyvmind",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          if (!checking) {
            const folder = file.parent;
            if (folder) {
              void this.uploadFolder(folder);
            }
          }
          return true;
        }
        return false;
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, abstractFile: TAbstractFile) => {
        if (abstractFile instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle("Upload to Hyvmind")
              .setIcon("upload-cloud")
              .onClick(() => {
                void this.uploadFolder(abstractFile);
              });
          });
        }
      })
    );
  }

  onunload() {
    // Cleanup handled by register* methods
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.auth.setIdentityProviderUrl(this.settings.identityProviderUrl);
    this.agent.updateConfig(this.settings.canisterId, this.settings.host);
  }

  private async disconnectFromICP(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      new Notice("Not connected to ICP");
      return;
    }

    await this.auth.logout();
    this.settings.delegationToken = "";
    this.settings.principal = null;
    await this.saveSettings();
    this.agent.updateConfig(this.settings.canisterId, this.settings.host);
    this.updateStatusBar();
    new Notice("Disconnected from ICP");
  }

  private async uploadFolder(folder: TFolder): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      new Notice("Please import a token in Settings to authenticate first");
      return;
    }

    const progressModal = new UploadProgressModal(this.app, folder.name);
    progressModal.open();

    try {
      const result = await this.uploader.uploadFolder(folder, (progress) => {
        progressModal.updateProgress(progress);
      });

      progressModal.close();

      if (result.success) {
        new Notice(`✓ ${result.message}`);
      } else {
        new Notice(`✗ ${result.message}`);
      }
    } catch (error) {
      progressModal.close();
      console.error("Upload failed:", error);
      new Notice(`Upload failed: ${this.sanitizeForNotice(error instanceof Error ? error.message : String(error))}`);
    }
  }

  private updateStatusBar(): void {
    if (this.auth.isAuthenticated()) {
      const principal = this.auth.getPrincipal()?.toText() || this.settings.principal;
      this.statusBar.setConnected(principal);
    } else {
      this.statusBar.setDisconnected();
    }
  }

  private sanitizeForNotice(text: string): string {
    return text.replace(/<[^>]*>/g, "").slice(0, 200);
  }

  private showUploadMenu(): void {
    const menu = new Menu();

    if (this.auth.isAuthenticated()) {
      menu.addItem((item) =>
        item
          .setTitle("Disconnect from ICP")
          .setIcon("log-out")
          .onClick(() => {
            void this.disconnectFromICP();
          })
      );

      menu.addSeparator();

      menu.addItem((item) =>
        item
          .setTitle("Upload current folder")
          .setIcon("upload-cloud")
          .onClick(() => {
            const file = this.app.workspace.getActiveFile();
            if (file && file.parent) {
              void this.uploadFolder(file.parent);
            } else {
              new Notice("No folder selected");
            }
          })
      );
    } else {
      menu.addItem((item) =>
        item
          .setTitle("Authenticate in settings")
          .setIcon("settings")
          .onClick(() => {
            // This will open the settings tab - user needs to import token there
            new Notice("Please import a token in the Hyvmind settings");
          })
      );
    }

    menu.showAtPosition({ x: 0, y: 0 });
  }
}

class UploadProgressModal extends Modal {
  private folderName: string;
  private progressEl!: HTMLElement;
  private statusEl!: HTMLElement;

  constructor(app: App, folderName: string) {
    super(app);
    this.folderName = folderName;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: `Uploading to Hyvmind` });
    contentEl.createEl("p", { text: `Folder: ${this.folderName}` });

    this.statusEl = contentEl.createEl("p", {
      text: "Initializing...",
      cls: "hyvmind-upload-status",
    });
    this.statusEl.setAttribute("aria-live", "polite");
    this.statusEl.setAttribute("aria-atomic", "true");

    this.progressEl = contentEl.createEl("div", {
      cls: "hyvmind-progress-bar",
    });

    const progressFill = this.progressEl.createEl("div", {
      cls: "hyvmind-progress-fill",
    });
    progressFill.setAttribute("role", "progressbar");
    progressFill.setAttribute("aria-valuenow", "0");
    progressFill.setAttribute("aria-valuemin", "0");
    progressFill.setAttribute("aria-valuemax", "100");
    progressFill.setAttribute("aria-label", "Upload progress");
  }

  updateProgress(progress: {
    totalFiles: number;
    processedFiles: number;
    currentFile: string;
    stage: string;
  }): void {
    this.statusEl.setText(`${progress.stage}: ${progress.currentFile}`);

    const fill = this.progressEl.querySelector(".hyvmind-progress-fill");
    if (fill && progress.totalFiles > 0) {
      const percentage = (progress.processedFiles / progress.totalFiles) * 100;
      (fill as HTMLElement).style.setProperty("--progress-width", `${percentage}%`);
      fill.setAttribute("aria-valuenow", Math.round(percentage).toString());
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
