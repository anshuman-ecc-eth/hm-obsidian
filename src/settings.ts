import { App, PluginSettingTab, Setting, Notice, ButtonComponent } from "obsidian";
import type HyvmindPlugin from "./main";

export interface HyvmindSettings {
  canisterId: string;
  host: string;

  userPrincipal: string;
  bindingData: string;
  principal: string | null;
}

export const DEFAULT_SETTINGS: HyvmindSettings = {
  canisterId: "4p5ty-yyaaa-aaaam-qfana-cai",
  host: "https://icp-api.io",

  userPrincipal: "",
  bindingData: "",
  principal: null,
};

export class HyvmindSettingTab extends PluginSettingTab {
  plugin: HyvmindPlugin;
  private bindingStatusEl!: HTMLElement;
  private staleBindingsEl!: HTMLElement;

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

    new Setting(containerEl).setHeading().setName("Plugin binding");

    const descEl = containerEl.createEl("div", { cls: "hyvmind-auth-desc" });
    descEl.createEl("p", {
      text: "Link this plugin to your hyvmind account so uploads appear in your notes.",
    });

    new Setting(containerEl)
      .setName("Your hyvmind principal")
      .setDesc("Copy this from hyvmind.app settings → plugin binding")
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
    bindBtn.setButtonText("Request binding");
    bindBtn.setCta();
    bindBtn.onClick(() => {
      void this.handleRequestBinding();
    });

    new Setting(containerEl)
      .setName("Binding status")
      .setDesc("Current binding state");

    this.bindingStatusEl = containerEl.createEl("div", {
      cls: "hyvmind-token-status",
    });
    this.updateBindingStatus();

    const clearBtn = new ButtonComponent(btnContainer);
    clearBtn.setButtonText("Clear local binding");
    clearBtn.setWarning();
    clearBtn.onClick(() => {
      this.plugin.binding.clearBinding();
      this.plugin.settings.principal = null;
      void this.plugin.saveSettings();
      this.updateBindingStatus();
      new Notice("Local binding cleared (identity preserved)");
    });

    const staleBtn = new ButtonComponent(btnContainer);
    staleBtn.setButtonText("Check stale bindings");
    staleBtn.onClick(() => {
      void this.handleCheckStaleBindings();
    });

    this.addStaleBindingsUI(containerEl);

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
    manualBindBtn.setButtonText("Confirm binding manually");
    manualBindBtn.onClick(() => {
      const principal = this.plugin.settings.userPrincipal;
      if (!principal) {
        new Notice("Enter your hyvmind principal first");
        return;
      }
      this.plugin.binding.persistBoundUser(principal);
      this.plugin.settings.principal = principal;
      void this.plugin.saveSettings();
      this.updateBindingStatus();
      new Notice("Binding confirmed manually");
    });

    new Setting(containerEl).setHeading().setName("Environment presets");

    const presetContainer = containerEl.createDiv({ cls: "hyvmind-preset-container" });

    new ButtonComponent(presetContainer)
      .setButtonText("Use mainnet")
      .onClick(() => {
        this.plugin.settings.host = "https://icp-api.io";
        void this.plugin.saveSettings();
        this.display();
      });

    new ButtonComponent(presetContainer)
      .setButtonText("Use local")
      .onClick(() => {
        this.plugin.settings.host = "http://localhost:8000";
        void this.plugin.saveSettings();
        this.display();
      });
  }

  private async handleRequestBinding(): Promise<void> {
    const userPrincipal = this.plugin.settings.userPrincipal;
    if (!userPrincipal) {
      new Notice("Please enter your hyvmind principal first");
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
      new Notice("Binding request sent! Approve it in hyvmind.app settings");
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
      text: "Folder contents are sent to the hyvmind backend",
      cls: "hyvmind-privacy-notice",
    });
  }

  private addStaleBindingsUI(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("Stale plugin keys")
      .setDesc("Old plugin keys still bound to your account on the backend");

    this.staleBindingsEl = containerEl.createEl("div", {
      cls: "hyvmind-token-status",
    });
    this.staleBindingsEl.setText("Click 'check stale bindings' above");
  }

  private async handleCheckStaleBindings(): Promise<void> {
    try {
      const boundKeys = await this.plugin.agent.getBoundPluginKeys();
      const currentKey = this.plugin.binding.getPrincipalText();
      const staleKeys = currentKey
        ? boundKeys.filter((k) => k !== currentKey)
        : boundKeys;

      this.staleBindingsEl.empty();

      if (staleKeys.length === 0) {
        const span = this.staleBindingsEl.createEl("span", { cls: "hyvmind-status hyvmind-status-valid" });
        span.setText("No stale bindings found");
        return;
      }

      for (const key of staleKeys) {
        const row = this.staleBindingsEl.createDiv({ cls: "hyvmind-stale-key-row" });
        row.createEl("span", {
          text: key.slice(0, 16) + "...",
          cls: "hyvmind-stale-key-text",
          attr: { title: key },
        });

        const revokeBtn = new ButtonComponent(row);
        revokeBtn.setButtonText("Revoke");
        revokeBtn.setWarning();
        revokeBtn.onClick(() => {
          void this.handleRevokeBinding(key, row);
        });
      }
    } catch (err) {
      new Notice(
        `Failed to check stale bindings: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async handleRevokeBinding(pluginKey: string, rowEl: HTMLElement): Promise<void> {
    try {
      await this.plugin.agent.revokePluginBinding(pluginKey);
      rowEl.remove();
      new Notice("Stale binding revoked");
    } catch (err) {
      new Notice(
        `Failed to revoke binding: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private updateBindingStatus(): void {
    this.bindingStatusEl.empty();
    const span = this.bindingStatusEl.createEl("span", { cls: "hyvmind-status" });

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
