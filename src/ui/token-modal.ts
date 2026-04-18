/**
 * Token instructions modal
 * Shows user how to get a delegation token from id.ai
 */

import { App, Modal, ButtonComponent } from "obsidian";

export class TokenInstructionsModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.empty();

    contentEl.createEl("h2", { text: "How to get a delegation token" });

    contentEl.createEl("ol", (olEl) => {
      const steps = [
        { text: "Open " },
        { text: "https://id.ai", isCode: true },
        { text: " in your browser (not in Obsidian)" },
      ];
      this.createStep(olEl, steps);

      const step2 = [{ text: "Sign in using your passkey, Apple, Google, or Microsoft account" }];
      this.createStep(olEl, step2);

      const step3 = [
        { text: "Once signed in, open Developer Tools (press " },
        { text: "F12", isStrong: true },
        { text: " or " },
        { text: "Cmd+Option+I", isStrong: true },
        { text: ")" },
      ];
      this.createStep(olEl, step3);

      const step4 = [
        { text: 'Go to the ' },
        { text: "Application", isStrong: true },
        { text: " tab (or " },
        { text: "Storage", isStrong: true },
        { text: " tab in some browsers)" },
      ];
      this.createStep(olEl, step4);

      const step5 = [{ text: "Find " }, { text: "IndexedDB", isCode: true }, { text: " in the left sidebar" }];
      this.createStep(olEl, step5);

      const step6 = [
        { text: 'Look for a database named something like ' },
        { text: "identity", isCode: true },
        { text: " or " },
        { text: "dfinity...", isCode: true },
      ];
      this.createStep(olEl, step6);

      const step7 = [
        { text: 'Open the database and look for an ' },
        { text: "info", isCode: true },
        { text: " object store" },
      ];
      this.createStep(olEl, step7);

      const step8 = [
        { text: 'Find the key named ' },
        { text: "delegation", isCode: true },
        { text: " and copy its value" },
      ];
      this.createStep(olEl, step8);
    });

    contentEl.createEl("h3", { text: "Alternative method (Console)" });

    contentEl.createEl("p", {
      text: "If the above is too complex, try this in the browser console:",
    });

    contentEl.createEl("pre", {
      cls: "hyvmind-code-block",
      text: `navigator.storage.getItem('delegation').then(console.log)`,
    });

    const copyBtn = new ButtonComponent(contentEl);
    copyBtn.setButtonText("Copy code");
    copyBtn.onClick(() => {
      navigator.clipboard.writeText(
        `navigator.storage.getItem('delegation').then(console.log)`
      ).then(() => {
        copyBtn.setButtonText("Copied!");
        setTimeout(() => copyBtn.setButtonText("Copy code"), 2000);
      }).catch(() => {
        // Clipboard write failed silently
      });
    });

    contentEl.createEl("h3", { text: "After getting the token" });

    contentEl.createEl("p", {
      text: 'Copy the token value (it starts with {"delegations":...) and paste it into the token field in the Hyvmind settings.',
    });

    contentEl.createEl("p", {
      text: "Note: Tokens expire. Choose 1, 7, or 30 days when setting up based on your security preference.",
    });

    const closeBtn = new ButtonComponent(contentEl);
    closeBtn.setButtonText("Close");
    closeBtn.setClass("hyvmind-modal-close");
    closeBtn.onClick(() => this.close());
  }

  private createStep(
    parent: HTMLElement,
    parts: Array<{ text: string; isStrong?: boolean; isCode?: boolean }>
  ): void {
    const li = parent.createEl("li");
    for (const part of parts) {
      if (part.isStrong) {
        li.createEl("strong", { text: part.text });
      } else if (part.isCode) {
        li.createEl("code", { text: part.text });
      } else {
        li.createEl("span", { text: part.text });
      }
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
