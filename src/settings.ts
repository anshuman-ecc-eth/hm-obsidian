import { App, PluginSettingTab, Setting } from "obsidian";
import HyvmindPlugin from "../main";

export interface HyvmindSettings {
  /** Canister ID for the Hyvmind backend */
  canisterId: string;
  /** Internet Identity URL (local or mainnet) */
  identityProviderUrl: string;
  /** ICP network host (optional, defaults to mainnet) */
  host: string;
  /** User's display name for Hyvmind */
  userName: string;
}

export const DEFAULT_SETTINGS: HyvmindSettings = {
  canisterId: "019b8930-ebee-7341-a82a-915c8016db5d",
  identityProviderUrl: "https://id.ai",
  host: "https://icp-api.io",
  userName: "",
};

export class HyvmindSettingTab extends PluginSettingTab {
  plugin: HyvmindPlugin;

  constructor(app: App, plugin: HyvmindPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Settings" });

    // Canister ID setting
    new Setting(containerEl)
      .setName("Canister ID")
      .setDesc("The canister ID of the Hyvmind backend")
      .addText((text) =>
        text
          .setPlaceholder("Enter canister ID")
          .setValue(this.plugin.settings.canisterId)
          .onChange(async (value) => {
            this.plugin.settings.canisterId = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // Identity Provider URL setting
    new Setting(containerEl)
      .setName("Identity Provider URL")
      .setDesc("Internet Identity URL (use http://id.ai.localhost:8000 for local development)")
      .addText((text) =>
        text
          .setPlaceholder("https://id.ai")
          .setValue(this.plugin.settings.identityProviderUrl)
          .onChange(async (value) => {
            this.plugin.settings.identityProviderUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // Host setting
    new Setting(containerEl)
      .setName("ICP Host")
      .setDesc("ICP network host (use http://localhost:8000 for local development)")
      .addText((text) =>
        text
          .setPlaceholder("https://icp-api.io")
          .setValue(this.plugin.settings.host)
          .onChange(async (value) => {
            this.plugin.settings.host = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // User Name setting
    new Setting(containerEl)
      .setName("Display Name")
      .setDesc("Your display name for Hyvmind (will be used when creating your user profile)")
      .addText((text) =>
        text
          .setPlaceholder("Enter your name")
          .setValue(this.plugin.settings.userName)
          .onChange(async (value) => {
            this.plugin.settings.userName = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // Info section
    containerEl.createEl("h3", { text: "Environment presets" });

    const presetContainer = containerEl.createDiv({ cls: "hyvmind-preset-container" });

    const mainnetBtn = presetContainer.createEl("button", {
      text: "Use Mainnet",
      cls: "hyvmind-preset-btn",
    });
    this.plugin.registerDomEvent(mainnetBtn, "click", async () => {
      this.plugin.settings.identityProviderUrl = "https://id.ai";
      this.plugin.settings.host = "https://icp-api.io";
      await this.plugin.saveSettings();
      this.display(); // Refresh UI
    });

    const localBtn = presetContainer.createEl("button", {
      text: "Use Local",
      cls: "hyvmind-preset-btn",
    });
    this.plugin.registerDomEvent(localBtn, "click", async () => {
      this.plugin.settings.identityProviderUrl = "http://id.ai.localhost:8000";
      this.plugin.settings.host = "http://localhost:8000";
      await this.plugin.saveSettings();
      this.display(); // Refresh UI
    });
  }
}
