/**
 * Hyvmind plugin settings
 */

import { App, PluginSettingTab, Setting, TextAreaComponent, Notice } from "obsidian";
import HyvmindPlugin from "../main";
import { TokenInstructionsModal } from "./ui/token-modal";

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

    new Setting(containerEl).setHeading().setName("settings");

    new Setting(containerEl)
      .setName("Canister ID")
      .setDesc("The canister ID of the Hyvmind backend")
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
      .setDesc("Your display name for Hyvmind (will be used when creating your user profile)")
      .addText((text) =>
        text
          .setPlaceholder("Enter your name")
          .setValue(this.plugin.settings.userName)
          .onChange((value) => {
            this.plugin.settings.userName = value.trim();
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setHeading().setName("authentication");

    const authDescEl = containerEl.createEl("div", {
      cls: "hyvmind-auth-desc",
    });
    authDescEl.innerHTML =
      "To authenticate, you need a delegation token from Internet Identity. " +
      "Since Obsidian cannot open the system browser directly, you must import a token manually. " +
      '<a href="#">How to get a token?</a>';
    authDescEl.querySelector("a")?.addEventListener("click", (e) => {
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

    const btnContainer = containerEl.createEl("div", {
      cls: "hyvmind-auth-buttons",
    });

    const importBtn = btnContainer.createEl("button", {
      text: "Import token",
      cls: "hyvmind-auth-btn hyvmind-import-btn",
    });
    importBtn.addEventListener("click", async () => {
      const token = this.plugin.settings.delegationToken;
      if (!token) {
        new Notice("Please paste a delegation token first");
        return;
      }
      try {
        const identity = await this.plugin.auth.importDelegationToken(token);
        const principal = identity.getPrincipal().toText();
        this.plugin.settings.principal = principal;
        await this.plugin.saveSettings();
        await this.plugin.agent.createAuthenticatedActor(identity);
        this.updateTokenStatus();
        new Notice("Token imported successfully!");
      } catch (err) {
        new Notice(`Failed to import token: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    const helpBtn = btnContainer.createEl("button", {
      text: "?",
      cls: "hyvmind-auth-btn hyvmind-help-btn",
      attr: { title: "How to get a token" },
    });
    helpBtn.addEventListener("click", () => {
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

    new Setting(containerEl).setName("Token status").setDesc("Current authentication status");

    this.tokenStatusEl = containerEl.createEl("div", {
      cls: "hyvmind-token-status",
    });
    this.updateTokenStatus();

    const deleteBtn = btnContainer.createEl("button", {
      text: "Delete token",
      cls: "hyvmind-auth-btn hyvmind-delete-btn",
    });
    deleteBtn.addEventListener("click", async () => {
      if (!this.plugin.auth.isAuthenticated()) {
        new Notice("No token to delete");
        return;
      }
      if (confirm("Are you sure you want to delete your token? You will need to re-authenticate.")) {
        await this.plugin.auth.logout();
        this.plugin.settings.delegationToken = "";
        this.plugin.settings.principal = null;
        await this.plugin.saveSettings();
        this.tokenInput.setValue("");
        this.updateTokenStatus();
        new Notice("Token deleted");
      }
    });
    this.deleteBtn = deleteBtn;

    new Setting(containerEl).setHeading().setName("environment presets");

    const presetContainer = containerEl.createDiv({ cls: "hyvmind-preset-container" });

    const mainnetBtn = presetContainer.createEl("button", {
      text: "Use mainnet",
      cls: "hyvmind-preset-btn",
    });
    mainnetBtn.addEventListener("click", () => {
      this.plugin.settings.identityProviderUrl = "https://id.ai";
      this.plugin.settings.host = "https://icp-api.io";
      void this.plugin.saveSettings();
      this.display();
    });

    const localBtn = presetContainer.createEl("button", {
      text: "Use local",
      cls: "hyvmind-preset-btn",
    });
    localBtn.addEventListener("click", () => {
      this.plugin.settings.identityProviderUrl = "http://id.ai.localhost:8000";
      this.plugin.settings.host = "http://localhost:8000";
      void this.plugin.saveSettings();
      this.display();
    });
  }

  private updateTokenStatus(): void {
    const tokenInfo = this.plugin.auth.getTokenInfo();

    if (tokenInfo.isExpired) {
      this.tokenStatusEl.innerHTML =
        '<span class="hyvmind-status hyvmind-status-expired">Expired</span>';
      this.deleteBtn.removeAttribute("disabled");
    } else if (tokenInfo.valid && tokenInfo.principal) {
      const expiryStr = tokenInfo.expiry
        ? ` until ${tokenInfo.expiry.toLocaleDateString()}`
        : "";
      this.tokenStatusEl.innerHTML =
        `<span class="hyvmind-status hyvmind-status-valid">Valid${expiryStr}</span> ` +
        `<span class="hyvmind-principal">${tokenInfo.principal.slice(0, 8)}...</span>`;
      this.deleteBtn.removeAttribute("disabled");
    } else {
      this.tokenStatusEl.innerHTML =
        '<span class="hyvmind-status hyvmind-status-none">No token</span>';
      this.deleteBtn.setAttribute("disabled", "true");
    }
  }
}
