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
        const parsed: { identity?: string; boundUser?: string } = JSON.parse(stored) as { identity?: string; boundUser?: string };
        if (parsed.identity) {
          this.keyIdentity = Ed25519KeyIdentity.fromJSON(parsed.identity);
        }
        if (parsed.boundUser) {
          this.boundUserPrincipal = parsed.boundUser;
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
