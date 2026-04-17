/**
 * Hyvmind Uploader Plugin for Obsidian
 * Uploads folders to Hyvmind ICP app as source graphs
 */

import {
  Plugin,
  TFolder,
  Notice,
  Menu,
  Modal,
  App,
} from "obsidian";
import { HyvmindSettings, DEFAULT_SETTINGS, HyvmindSettingTab } from "./settings";
import { ICPAuth } from "./icp/auth";
import { ICPAgent } from "./icp/agent";
import { FolderUploader } from "./icp/uploader";
import { ConnectionStatusBar } from "./ui/status-bar";

export default class HyvmindPlugin extends Plugin {
  settings!: HyvmindSettings;
  auth!: ICPAuth;
  agent!: ICPAgent;
  uploader!: FolderUploader;
  statusBar!: ConnectionStatusBar;

  async onload() {
    await this.loadSettings();

    // Initialize ICP modules
    this.auth = new ICPAuth(this.settings.identityProviderUrl);
    this.agent = new ICPAgent(this.settings.canisterId, this.settings.host);
    this.uploader = new FolderUploader(this.app.vault, this.agent);

    // Initialize auth client
    await this.auth.init();
    if (this.auth.isAuthenticated()) {
      const identity = this.auth.getIdentity();
      if (identity) {
        await this.agent.createAuthenticatedActor(identity);
      }
    }

    // Add settings tab
    this.addSettingTab(new HyvmindSettingTab(this.app, this));

    // Add status bar
    const statusBarItem = this.addStatusBarItem();
    this.statusBar = new ConnectionStatusBar(statusBarItem);
    this.updateStatusBar();

    // Add ribbon icon
    this.addRibbonIcon("upload-cloud", "Hyvmind Uploader", () => {
      this.showConnectOrUploadMenu();
    });

    // Register commands
    this.addCommand({
      id: "connect-to-icp",
      name: "Connect to ICP",
      callback: () => this.connectToICP(),
    });

    this.addCommand({
      id: "disconnect-from-icp",
      name: "Disconnect from ICP",
      callback: () => this.disconnectFromICP(),
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

    // Register folder context menu
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, folder: TFolder) => {
        if (folder instanceof TFolder) {
          menu.addItem((item) => {
            item
              .setTitle("Upload to Hyvmind")
              .setIcon("upload-cloud")
              .onClick(() => { void this.uploadFolder(folder); });
          });
        }
      })
    );

    // Plugin loaded - no console logging in production (per Obsidian guidelines)
  }

  onunload() {
    // Plugin unloaded - cleanup handled by register* methods
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);

    // Update ICP modules with new settings
    this.auth.setIdentityProviderUrl(this.settings.identityProviderUrl);
    this.agent.updateConfig(this.settings.canisterId, this.settings.host);
  }

  /**
   * Connect to ICP with Internet Identity
   */
  private async connectToICP(): Promise<void> {
    try {
      new Notice("Opening Internet Identity...");

      const identity = await this.auth.login();
      await this.agent.createAuthenticatedActor(identity);

      // Initialize access control if needed
      try {
        await this.agent.initializeAccessControl();
      } catch {
        // Already initialized, ignore
      }

      // Save user profile if name is set
      if (this.settings.userName) {
        try {
          await this.agent.saveUserProfile(this.settings.userName);
        } catch {
          // Profile may already exist, ignore
        }
      }

      this.updateStatusBar();
      new Notice("Connected to ICP successfully!");
    } catch (error) {
      console.error("Connection failed:", error);
      new Notice(`Connection failed: ${this.sanitizeForNotice(error instanceof Error ? error.message : String(error))}`);
    }
  }

  /**
   * Disconnect from ICP
   */
  private async disconnectFromICP(): Promise<void> {
    await this.auth.logout();
    this.agent.updateConfig(this.settings.canisterId, this.settings.host);
    this.updateStatusBar();
    new Notice("Disconnected from ICP");
  }

  /**
   * Upload a folder to Hyvmind
   */
  private async uploadFolder(folder: TFolder): Promise<void> {
    // Check if authenticated
    if (!this.auth.isAuthenticated()) {
      new Notice("Please connect to ICP first");
      await this.connectToICP();
      return;
    }

    // Show progress modal
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

  /**
   * Update status bar display
   */
  private updateStatusBar(): void {
    if (this.auth.isAuthenticated()) {
      const principal = this.auth.getPrincipal()?.toText() || null;
      this.statusBar.setConnected(principal);
    } else {
      this.statusBar.setDisconnected();
    }
  }

  /**
   * Sanitize text for display in Notices to prevent XSS
   */
  private sanitizeForNotice(text: string): string {
    // Remove HTML tags and limit length
    return text
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .slice(0, 200); // Limit length
  }

  /**
   * Show connect or upload menu
   */
  private showConnectOrUploadMenu(): void {
    const menu = new Menu();

    if (!this.auth.isAuthenticated()) {
      menu.addItem((item) =>
        item
          .setTitle("Connect to ICP")
          .setIcon("log-in")
          .onClick(() => { void this.connectToICP(); })
      );
    } else {
      menu.addItem((item) =>
        item
          .setTitle("Disconnect from ICP")
          .setIcon("log-out")
          .onClick(() => { void this.disconnectFromICP(); })
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
    }

    menu.showAtPosition({ x: 0, y: 0 });
  }
}

/**
 * Upload progress modal
 */
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
    // Accessibility: Live region for screen readers
    this.statusEl.setAttribute("aria-live", "polite");
    this.statusEl.setAttribute("aria-atomic", "true");

    this.progressEl = contentEl.createEl("div", {
      cls: "hyvmind-progress-bar",
    });

    // Accessibility: Progress bar with ARIA attributes
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

    // Use scoped querySelector instead of global getElementById
    const fill = this.progressEl.querySelector(".hyvmind-progress-fill");
    if (fill && progress.totalFiles > 0) {
      const percentage = (progress.processedFiles / progress.totalFiles) * 100;
      (fill as HTMLElement).style.width = `${percentage}%`;
      // Update ARIA value for accessibility
      fill.setAttribute("aria-valuenow", Math.round(percentage).toString());
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
