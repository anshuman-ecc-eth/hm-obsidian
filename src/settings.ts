import { App, PluginSettingTab, Setting, Notice, ButtonComponent } from "obsidian";
import type HyvmindPlugin from "./main";

export interface HyvmindSettings {
  canisterId: string;
  host: string;

  userPrincipal: string;
  bindingData: string;
  principal: string | null;

  importFolderName: string;
}

export const DEFAULT_SETTINGS: HyvmindSettings = {
  canisterId: "4p5ty-yyaaa-aaaam-qfana-cai",
  host: "https://icp-api.io",

  userPrincipal: "",
  bindingData: "",
  principal: null,

  importFolderName: "Hyvmind",
};

export class HyvmindSettingTab extends PluginSettingTab {
  plugin: HyvmindPlugin;
  private bindingStatusEl!: HTMLElement;

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
      .setName("Host")
      .setDesc("Network host")
      .addText((text) =>
        text
          .setPlaceholder("https://icp-api.io")
          .setValue(this.plugin.settings.host)
          .onChange((value) => {
            this.plugin.settings.host = value.trim();
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setHeading().setName("Import");

    new Setting(containerEl)
      .setName("Import folder name")
      .setDesc("Folder name in vault root where downloaded notes will be placed")
      .addText((text) =>
        text
          .setPlaceholder("Hyvmind")
          .setValue(this.plugin.settings.importFolderName)
          .onChange((value) => {
            this.plugin.settings.importFolderName = value.trim() || "Hyvmind";
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setHeading().setName("Plugin binding");

    const descEl = containerEl.createDiv({ cls: "hyvmind-auth-desc" });
    descEl.createEl("p", {
      text: "Link this plugin to your Hyvmind account so uploads appear in your notes.",
    });

    new Setting(containerEl)
      .setName("Your Hyvmind principal")
      .setDesc("Copy this from Hyvmind.app settings → plugin binding")
      .addText((text) =>
        text
          .setPlaceholder("Your principal ID")
          .setValue(this.plugin.settings.userPrincipal)
          .onChange((value) => {
            this.plugin.settings.userPrincipal = value.trim();
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Plugin principal")
      .setDesc("Your plugin's identity — share this when binding")
      .addText((text) =>
        text
          .setValue(this.plugin.binding.getPrincipalText() || "")
          .setDisabled(true)
      );

    const btnContainer = containerEl.createDiv({ cls: "hyvmind-auth-buttons" });

    const bindBtn = new ButtonComponent(btnContainer);
    bindBtn.setButtonText("Request");
    bindBtn.setCta();
    bindBtn.onClick(() => {
      void this.handleRequestBinding();
    });

    new Setting(containerEl)
      .setName("Binding status")
      .setDesc("Current binding state");

    this.bindingStatusEl = containerEl.createDiv({
      cls: "hyvmind-token-status",
    });
    this.updateBindingStatus();

    const clearBtn = new ButtonComponent(btnContainer);
    clearBtn.setButtonText("Clear");
    clearBtn.setWarning();
    clearBtn.onClick(() => {
      this.plugin.binding.clearBinding();
      this.plugin.settings.principal = null;
      void this.plugin.saveSettings();
      this.updateBindingStatus();
      new Notice("Local binding cleared (identity preserved)");
    });

    this.addPrivacySection(containerEl);

    new Setting(containerEl)
      .setName("Manual binding")
      .setDesc("If auto-check fails, paste your principal here and confirm")
      .addText((text) =>
        text
          .setPlaceholder("Your principal ID")
          .setValue(this.plugin.settings.userPrincipal)
          .onChange((value) => {
            this.plugin.settings.userPrincipal = value.trim();
            void this.plugin.saveSettings();
          })
      );

    const manualBindBtn = new ButtonComponent(btnContainer);
    manualBindBtn.setButtonText("Confirm");
    manualBindBtn.onClick(() => {
      const principal = this.plugin.settings.userPrincipal;
      if (!principal) {
        new Notice("Enter your Hyvmind principal first");
        return;
      }
      this.plugin.binding.persistBoundUser(principal);
      this.plugin.settings.principal = principal;
      void this.plugin.saveSettings();
      this.updateBindingStatus();
      new Notice("Binding confirmed manually");
    });

  }

  private async handleRequestBinding(): Promise<void> {
    const userPrincipal = this.plugin.settings.userPrincipal;
    if (!userPrincipal) {
      new Notice("Please enter your Hyvmind principal first");
      return;
    }

    const identity = this.plugin.binding.getIdentity();
    if (!identity) {
      new Notice("Plugin identity not initialized");
      return;
    }

    try {
      await this.plugin.agent.requestPluginBinding(
        identity.getPrincipal().toText(),
        userPrincipal,
      );
      new Notice("Binding request sent! Approve it in Hyvmind.app settings");
    } catch (err) {
      new Notice(
        `Failed to request binding: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private addPrivacySection(containerEl: HTMLElement): void {
    containerEl.createEl("hr");
    new Setting(containerEl).setName("Privacy notice").setHeading();
    containerEl.createEl("p", {
      text: "Folder contents are sent to Hyvmind's frontend canister.",
      cls: "hyvmind-privacy-notice",
    });
  }

  private updateBindingStatus(): void {
    this.bindingStatusEl.empty();
    const span = this.bindingStatusEl.createSpan({ cls: "hyvmind-status" });

    if (this.plugin.binding.isBound()) {
      span.addClass("hyvmind-status-valid");
      const boundUser = this.plugin.binding.getBoundUser();
      span.setText(`Bound to ${boundUser ? boundUser.slice(0, 8) + "..." : "user"}`);
    } else {
      span.addClass("hyvmind-status-none");
      span.setText("Not bound");
    }
  }
}
