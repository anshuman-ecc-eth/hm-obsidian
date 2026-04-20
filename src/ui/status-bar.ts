/**
 * Status bar component for showing ICP connection status
 */

export class ConnectionStatusBar {
  private element: HTMLElement;
  private isConnected: boolean = false;
  private principal: string | null = null;

  constructor(container: HTMLElement) {
    this.element = container.createEl("span", {
      cls: "hyvmind-status-bar",
    });
    this.updateDisplay();
  }

  /**
   * Set connection status
   */
  setConnected(principal: string | null): void {
    this.isConnected = true;
    this.principal = principal;
    this.updateDisplay();
  }

  /**
   * Set disconnected status
   */
  setDisconnected(): void {
    this.isConnected = false;
    this.principal = null;
    this.updateDisplay();
  }

  /**
   * Update the display
   */
  private updateDisplay(): void {
    this.element.empty();

    if (this.isConnected && this.principal) {
      // Show connected status with truncated principal
      const shortPrincipal = `${this.principal.slice(0, 8)}...${this.principal.slice(-4)}`;
      this.element.setText(`🟢 Hyvmind: ${shortPrincipal}`);
      this.element.title = `Connected as ${this.principal}`;
      this.element.addClass("hyvmind-status-connected");
      this.element.removeClass("hyvmind-status-disconnected");
    } else {
      // Show disconnected status
      this.element.setText("⚪ hyvmind: Not connected");
      this.element.title = "Click 'authenticate in settings' command to authenticate";
      this.element.addClass("hyvmind-status-disconnected");
      this.element.removeClass("hyvmind-status-connected");
    }
  }

  /**
   * Get the HTMLElement
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Check if currently connected
   */
  isCurrentlyConnected(): boolean {
    return this.isConnected;
  }
}
