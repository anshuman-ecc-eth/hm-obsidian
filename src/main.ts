import { Plugin, TFolder, TAbstractFile, Notice, Menu, Modal, App } from "obsidian";
import { HyvmindSettings, DEFAULT_SETTINGS, HyvmindSettingTab } from "./settings";
import { PluginBinding, BindingStorage } from "./icp/auth";
import { ICPAgent } from "./icp/agent";
import { FolderUploader } from "./icp/uploader";
import { ConnectionStatusBar } from "./ui/status-bar";

class PluginBindingStorage implements BindingStorage {
  constructor(private plugin: HyvmindPlugin) {}

  getBindingData(): string | null {
    return this.plugin.settings.bindingData || null;
  }

  setBindingData(data: string): void {
    this.plugin.settings.bindingData = data;
    void this.plugin.saveSettings();
  }

  clearBindingData(): void {
    this.plugin.settings.bindingData = "";
    this.plugin.settings.principal = null;
    void this.plugin.saveSettings();
  }
}

export default class HyvmindPlugin extends Plugin {
  settings!: HyvmindSettings;
  binding!: PluginBinding;
  agent!: ICPAgent;
  uploader!: FolderUploader;
  statusBar!: ConnectionStatusBar;

  async onload() {
    await this.loadSettings();

    const bindingStorage = new PluginBindingStorage(this);
    this.binding = new PluginBinding(bindingStorage);
    this.agent = new ICPAgent(this.settings.canisterId, this.settings.host);
    this.uploader = new FolderUploader(this.app.vault, this.agent);

    const identity = this.binding.getOrCreateIdentity();
    await this.agent.createAuthenticatedActor(identity);

    if (this.binding.isBound()) {
      this.settings.principal = this.binding.getBoundUser();
    }

    this.addSettingTab(new HyvmindSettingTab(this.app, this));

    const statusBarItem = this.addStatusBarItem();
    this.statusBar = new ConnectionStatusBar(statusBarItem);
    this.updateStatusBar();

    this.addRibbonIcon("upload-cloud", "Hyvmind uploader", () => {
      this.showUploadMenu();
    });

    this.addCommand({
      id: "upload-current-folder",
      name: "Upload current folder to hyvmind",
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
              .setTitle("Upload to hyvmind")
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
    this.agent.updateConfig(this.settings.canisterId, this.settings.host);
  }

  private async uploadFolder(folder: TFolder): Promise<void> {
    if (!this.binding.isBound()) {
      new Notice("Please bind the plugin to your hyvmind account in settings first");
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
    if (this.binding.isBound()) {
      const user = this.binding.getBoundUser();
      this.statusBar.setConnected(user ? user.slice(0, 8) : "bound");
    } else {
      this.statusBar.setDisconnected();
    }
  }

  private sanitizeForNotice(text: string): string {
    return text.replace(/<[^>]*>/g, "").slice(0, 200);
  }

  private showUploadMenu(): void {
    const menu = new Menu();

    if (this.binding.isBound()) {
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
          .setTitle("Configure binding in settings")
          .setIcon("settings")
          .onClick(() => {
            new Notice("Please bind the plugin in hyvmind settings first");
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

    contentEl.createEl("h2", { text: `Uploading to hyvmind` });
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
