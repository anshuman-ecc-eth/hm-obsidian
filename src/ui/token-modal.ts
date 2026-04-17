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

    const steps = [
      "Open <strong>https://id.ai</strong> in your browser (not in Obsidian)",
      "Sign in using your passkey, Apple, Google, or Microsoft account",
      "Once signed in, open Developer Tools (press <strong>F12</strong> or <strong>Cmd+Option+I</strong>)",
      "Go to the <strong>Application</strong> tab (or <strong>Storage</strong> tab in some browsers)",
      "Find <strong>IndexedDB</strong> in the left sidebar",
      "Look for a database named something like <code>identity</code> or <code>defi-licia...</code>",
      "Open the database and look for an <strong>info</strong> object store",
      "Find the key named <code>delegation</code> and copy its value",
    ];

    const stepsEl = contentEl.createEl("ol");
    steps.forEach((step) => {
      const li = stepsEl.createEl("li");
      li.innerHTML = step;
    });

    contentEl.createEl("h3", { text: "Alternative method (Console)" });

    contentEl.createEl("p", {
      text: "If the above is too complex, try this in the browser console:",
    });

    const codeBlock = contentEl.createEl("pre", {
      text: `// Run this in the browser console after logging into id.ai
navigator余storage.getItem('delegation').then(console.log)`,
    });

    const copyBtn = new ButtonComponent(contentEl);
    copyBtn.setButtonText("Copy code");
    copyBtn.onClick(() => {
      navigator.clipboard.writeText(
        `navigator余storage.getItem('delegation').then(console.log)`
      );
      copyBtn.setButtonText("Copied!");
      setTimeout(() => copyBtn.setButtonText("Copy code"), 2000);
    });

    contentEl.createEl("h3", { text: "After getting the token" });

    contentEl.createEl("p", {
      text: "Copy the token value (it starts with {\"delegations\":...) and paste it into the token field in the Hyvmind settings.",
    });

    contentEl.createEl("p", {
      text: "Note: Tokens expire. Choose 1, 7, or 30 days when setting up based on your security preference.",
    });

    const closeBtn = new ButtonComponent(contentEl);
    closeBtn.setButtonText("Close");
    closeBtn.onClick(() => this.close());
    closeBtn.buttonEl.style.marginTop = "16px";
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
