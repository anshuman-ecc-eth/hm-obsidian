import { App, Modal, ButtonComponent } from "obsidian";

export class TokenInstructionsModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.empty();

    contentEl.createEl("h2", { text: "Get your delegation token" });

    contentEl.createEl("p", {
      text: "Follow these steps to get a token from hyvmind.app:",
    });

    const olEl = contentEl.createEl("ol");
    olEl.setAttr("start", "1");

    const step1 = [
      { text: "Open ", isCode: false },
      { text: "hyvmind.app/obsidian-token", isCode: true },
      { text: " in your browser (Chrome, Safari, Firefox, Edge — not inside Obsidian)" },
    ];
    this.createStep(olEl, step1);

    const step2 = [
      { text: "Sign in with your passkey, Apple, Google, or Microsoft account (if not already signed in)" },
    ];
    this.createStep(olEl, step2);

    const step3 = [
      { text: "Click ", isCode: false },
      { text: "Copy", isStrong: true },
      { text: " to copy your token, then paste it into the field below" },
    ];
    this.createStep(olEl, step3);

    contentEl.createEl("div", { cls: "hyvmind-auth-note" }).setText(
      "Tokens expire after 30 days. When yours expires, repeat these steps to get a new one."
    );

    const btnContainer = contentEl.createDiv({ cls: "hyvmind-auth-buttons" });

    const openBtn = new ButtonComponent(btnContainer);
    openBtn.setButtonText("Open hyvmind.app/obsidian-token");
    openBtn.setCta();
    openBtn.onClick(() => {
      window.open("https://hyvmind.app/obsidian-token", "_blank");
    });

    const closeBtn = new ButtonComponent(btnContainer);
    closeBtn.setButtonText("Close");
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
