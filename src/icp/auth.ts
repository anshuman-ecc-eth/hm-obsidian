import { Ed25519KeyIdentity } from "@icp-sdk/core/identity";
import { Principal } from "@icp-sdk/core/principal";

export interface BindingStorage {
  getBindingData(): string | null;
  setBindingData(data: string): void;
  clearBindingData(): void;
}

export interface BindingInfo {
  boundUserPrincipal: string | null;
}

export class PluginBinding {
  private keyIdentity: Ed25519KeyIdentity | null = null;
  private boundUserPrincipal: string | null = null;
  private storage: BindingStorage;

  constructor(storage: BindingStorage) {
    this.storage = storage;
  }

  getOrCreateIdentity(): Ed25519KeyIdentity {
    if (this.keyIdentity) return this.keyIdentity;

    const stored = this.storage.getBindingData();
    if (stored) {
      try {
        const raw: unknown = JSON.parse(stored);
        const data = raw as Record<string, unknown>;
        if (typeof data.identity === "string") {
          this.keyIdentity = Ed25519KeyIdentity.fromJSON(data.identity);
        }
        if (typeof data.boundUser === "string") {
          this.boundUserPrincipal = data.boundUser;
        }
      } catch {
        // Stored data is corrupt, generate fresh
      }
    }

    if (!this.keyIdentity) {
      this.keyIdentity = Ed25519KeyIdentity.generate();
      this.persist();
    }

    return this.keyIdentity;
  }

  getPrincipal(): Principal | null {
    if (!this.keyIdentity) return null;
    return this.keyIdentity.getPrincipal();
  }

  getPrincipalText(): string | null {
    const p = this.getPrincipal();
    return p ? p.toText() : null;
  }

  isBound(): boolean {
    return this.boundUserPrincipal !== null;
  }

  getBoundUser(): string | null {
    return this.boundUserPrincipal;
  }

  persistBoundUser(userPrincipal: string | null): void {
    this.boundUserPrincipal = userPrincipal;
    this.persist();
  }

  clearBinding(): void {
    this.boundUserPrincipal = null;
    this.persist();
  }

  getIdentity(): Ed25519KeyIdentity | null {
    return this.keyIdentity;
  }

  private persist(): void {
    const data = JSON.stringify({
      identity: this.keyIdentity ? JSON.stringify(this.keyIdentity.toJSON()) : null,
      boundUser: this.boundUserPrincipal,
    });
    this.storage.setBindingData(data);
  }
}
