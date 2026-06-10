import { App, Modal } from "obsidian";

export class UploadProgressModal extends Modal {
  private titleText: string;
  private subtitleText: string;
  private progressEl!: HTMLElement;
  private statusEl!: HTMLElement;

  constructor(app: App, subtitle: string, title?: string) {
    super(app);
    this.titleText = title ?? "Hyvmind Sync";
    this.subtitleText = subtitle;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: this.titleText });
    contentEl.createEl("p", { text: this.subtitleText });

    this.statusEl = contentEl.createEl("p", {
      text: "Initializing...",
      cls: "hyvmind-upload-status",
    });
    this.statusEl.setAttribute("aria-live", "polite");
    this.statusEl.setAttribute("aria-atomic", "true");

    this.progressEl = contentEl.createDiv({
      cls: "hyvmind-progress-bar",
    });

    const progressFill = this.progressEl.createDiv({
      cls: "hyvmind-progress-fill",
    });
    progressFill.setAttribute("role", "progressbar");
    progressFill.setAttribute("aria-valuenow", "0");
    progressFill.setAttribute("aria-valuemin", "0");
    progressFill.setAttribute("aria-valuemax", "100");
    progressFill.setAttribute("aria-label", "Sync progress");
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
