/**
 * Hyvmind plugin settings
 */

import { App, PluginSettingTab, Setting, TextAreaComponent, Notice, Modal, ButtonComponent } from "obsidian";
import { TokenInstructionsModal } from "./ui/token-modal";
import type HyvmindPlugin from "./main";

export interface HyvmindSettings {
  canisterId: string;
  identityProviderUrl: string;
  host: string;
  userName: string;
  delegationToken: string;
  tokenExpiryDays: "1" | "7" | "30";
  principal: string | null;
}

export const DEFAULT_SETTINGS: HyvmindSettings = {
  canisterId: "019b8930-ebee-7341-a82a-915c8016db5d",
  identityProviderUrl: "https://id.ai",
  host: "https://icp-api.io",
  userName: "",
  delegationToken: "",
  tokenExpiryDays: "7",
  principal: null,
};

class DeleteConfirmModal extends Modal {
  private onConfirm: () => void;

  constructor(app: App, onConfirm: () => void) {
    super(app);
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Delete token?" });
    contentEl.createEl("p", {
      text: "You will need to re-authenticate to use the plugin again.",
    });

    const btnContainer = contentEl.createDiv({ cls: "hyvmind-confirm-buttons" });

    const cancelBtn = new ButtonComponent(btnContainer);
    cancelBtn.setButtonText("Cancel");
    cancelBtn.onClick(() => this.close());

    const deleteBtn = new ButtonComponent(btnContainer);
    deleteBtn.setButtonText("Delete");
    deleteBtn.setWarning();
    deleteBtn.onClick(() => {
      this.onConfirm();
      this.close();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class HyvmindSettingTab extends PluginSettingTab {
  plugin: HyvmindPlugin;
  private tokenInput!: TextAreaComponent;
  private tokenStatusEl!: HTMLElement;
  private deleteBtn!: HTMLButtonElement;

  constructor(app: App, plugin: HyvmindPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl).setHeading().setName("Settings");

    new Setting(containerEl)
      .setName("Canister ID")
      .setDesc("The canister ID of the hyvmind backend")
      .addText((text) =>
        text
          .setPlaceholder("Enter canister ID")
          .setValue(this.plugin.settings.canisterId)
          .onChange((value) => {
            this.plugin.settings.canisterId = value.trim();
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Identity provider URL")
      .setDesc("Internet Identity URL (use http://id.ai.localhost:8000 for local development)")
      .addText((text) =>
        text
          .setPlaceholder("https://id.ai")
          .setValue(this.plugin.settings.identityProviderUrl)
          .onChange((value) => {
            this.plugin.settings.identityProviderUrl = value.trim();
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("ICP host")
      .setDesc("ICP network host (use http://localhost:8000 for local development)")
      .addText((text) =>
        text
          .setPlaceholder("https://icp-api.io")
          .setValue(this.plugin.settings.host)
          .onChange((value) => {
            this.plugin.settings.host = value.trim();
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Display name")
      .setDesc("Your display name for hyvmind (will be used when creating your user profile)")
      .addText((text) =>
        text
          .setPlaceholder("Enter your name")
          .setValue(this.plugin.settings.userName)
          .onChange((value) => {
            this.plugin.settings.userName = value.trim();
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setHeading().setName("Authentication");

    const authDescEl = containerEl.createEl("div", {
      cls: "hyvmind-auth-desc",
    });
    authDescEl.createEl("p", {
      text: "To authenticate, you need a delegation token from Internet Identity.",
    });
    authDescEl.createEl("p", {
      text: "Since Obsidian cannot open the system browser directly, you must import a token manually.",
    });

    const helpLink = authDescEl.createEl("a", {
      href: "#",
      text: "How to get a token?",
    });
    helpLink.addEventListener("click", (e) => {
      e.preventDefault();
      new TokenInstructionsModal(this.app).open();
    });

    new Setting(containerEl)
      .setName("Delegation token")
      .setDesc("Paste your delegation token JSON here")
      .addTextArea((ta) => {
        ta.inputEl.rows = 4;
        ta.setPlaceholder("Paste your delegation token JSON here...");
        ta.setValue(this.plugin.settings.delegationToken);
        ta.onChange((value) => {
          this.plugin.settings.delegationToken = value.trim();
          void this.plugin.saveSettings();
        });
        this.tokenInput = ta;
      });

    const btnContainer = containerEl.createDiv({
      cls: "hyvmind-auth-buttons",
    });

    const importBtn = new ButtonComponent(btnContainer);
    importBtn.setButtonText("Import token");
    importBtn.setCta();
    importBtn.onClick(() => {
      const token = this.plugin.settings.delegationToken;
      if (!token) {
        new Notice("Please paste a delegation token first");
        return;
      }
      void this.handleImportToken();
    });

    const helpBtn = new ButtonComponent(btnContainer);
    helpBtn.setButtonText("?");
    helpBtn.setTooltip("How to get a token");
    helpBtn.onClick(() => {
      new TokenInstructionsModal(this.app).open();
    });

    new Setting(containerEl)
      .setName("Token expiry")
      .setDesc("Choose how long your imported token should be valid for")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("1", "1 day")
          .addOption("7", "7 days")
          .addOption("30", "30 days");
        dropdown.setValue(this.plugin.settings.tokenExpiryDays);
        dropdown.onChange((value) => {
          this.plugin.settings.tokenExpiryDays = value as "1" | "7" | "30";
          void this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Token status")
      .setDesc("Current authentication status");

    this.tokenStatusEl = containerEl.createEl("div", {
      cls: "hyvmind-token-status",
    });
    this.updateTokenStatus();

    const deleteBtn = new ButtonComponent(btnContainer);
    deleteBtn.setButtonText("Delete token");
    deleteBtn.setWarning();
    deleteBtn.onClick(() => {
      if (!this.plugin.auth.isAuthenticated()) {
        new Notice("No token to delete");
        return;
      }
      new DeleteConfirmModal(this.app, () => {
        void this.handleDeleteToken();
      }).open();
    });
    this.deleteBtn = deleteBtn.buttonEl;

    new Setting(containerEl).setHeading().setName("Environment presets");

    const presetContainer = containerEl.createDiv({ cls: "hyvmind-preset-container" });

    const mainnetBtn = new ButtonComponent(presetContainer);
    mainnetBtn.setButtonText("Use mainnet");
    mainnetBtn.onClick(() => {
      this.plugin.settings.identityProviderUrl = "https://id.ai";
      this.plugin.settings.host = "https://icp-api.io";
      void this.plugin.saveSettings();
      this.display();
    });

    const localBtn = new ButtonComponent(presetContainer);
    localBtn.setButtonText("Use local");
    localBtn.onClick(() => {
      this.plugin.settings.identityProviderUrl = "http://id.ai.localhost:8000";
      this.plugin.settings.host = "http://localhost:8000";
      void this.plugin.saveSettings();
      this.display();
    });
  }

  private async handleImportToken(): Promise<void> {
    try {
      const identity = await this.plugin.auth.importDelegationToken(
        this.plugin.settings.delegationToken
      );
      const principal = identity.getPrincipal().toText();
      this.plugin.settings.principal = principal;
      await this.plugin.saveSettings();
      await this.plugin.agent.createAuthenticatedActor(identity);
      this.updateTokenStatus();
      new Notice("Token imported successfully!");
    } catch (err) {
      new Notice(
        `Failed to import token: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async handleDeleteToken(): Promise<void> {
    await this.plugin.auth.logout();
    this.plugin.settings.delegationToken = "";
    this.plugin.settings.principal = null;
    await this.plugin.saveSettings();
    this.tokenInput.setValue("");
    this.updateTokenStatus();
    new Notice("Token deleted");
  }

  private updateTokenStatus(): void {
    const tokenInfo = this.plugin.auth.getTokenInfo();

    this.tokenStatusEl.empty();

    const statusSpan = this.tokenStatusEl.createEl("span", {
      cls: "hyvmind-status",
    });

    if (tokenInfo.isExpired) {
      statusSpan.addClass("hyvmind-status-expired");
      statusSpan.setText("Expired");
      this.deleteBtn.removeAttribute("disabled");
    } else if (tokenInfo.valid && tokenInfo.principal) {
      statusSpan.addClass("hyvmind-status-valid");
      const expiryStr = tokenInfo.expiry
        ? ` until ${tokenInfo.expiry.toLocaleDateString()}`
        : "";
      statusSpan.setText(`Valid${expiryStr}`);

      this.tokenStatusEl.createEl("span", {
        cls: "hyvmind-principal",
        text: `${tokenInfo.principal.slice(0, 8)}...`,
      });
      this.deleteBtn.removeAttribute("disabled");
    } else {
      statusSpan.addClass("hyvmind-status-none");
      statusSpan.setText("No token");
      this.deleteBtn.setAttribute("disabled", "true");
    }
  }
}
