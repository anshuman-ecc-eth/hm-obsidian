import { AuthClient } from "@icp-sdk/auth/client";
import { Ed25519KeyIdentity, DelegationChain, DelegationIdentity } from "@icp-sdk/core/identity";
import { Principal } from "@icp-sdk/core/principal";

export interface TokenInfo {
  valid: boolean;
  expiry: Date | null;
  principal: string | null;
  isExpired: boolean;
}

export interface TokenStorage {
  getDelegationToken(): string | null;
  setDelegationToken(token: string): void;
  clearDelegationToken(): void;
}

export class ICPAuth {
  private client: AuthClient | null = null;
  private identity: DelegationIdentity | null = null;
  private _principal: Principal | null = null;
  private isAuthenticatedFlag = false;
  private identityProviderUrl: string;
  private storage: TokenStorage;

  constructor(identityProviderUrl: string, storage: TokenStorage) {
    this.identityProviderUrl = identityProviderUrl;
    this.storage = storage;
  }

  async init(): Promise<void> {
    const storedToken = this.storage.getDelegationToken();

    if (storedToken) {
      try {
        const parsed = JSON.parse(storedToken);

        if (parsed.identity && parsed.delegation) {
          const key = Ed25519KeyIdentity.fromJSON(parsed.identity);
          const chain = DelegationChain.fromJSON(parsed.delegation);
          const identity = DelegationIdentity.fromDelegation(key, chain);

          const expiry = this.getChainExpiry(identity);
          if (!expiry || expiry > new Date()) {
            this.identity = identity;
            this._principal = identity.getPrincipal();
            this.isAuthenticatedFlag = true;
            return;
          }
        }
      } catch (err) {
        console.warn("Failed to restore token, will need to re-import:", err);
      }
    }

    this.client = await AuthClient.create();
  }

  async importDelegationToken(tokenJson: string): Promise<DelegationIdentity> {
    const parsed = JSON.parse(tokenJson);

    if (parsed.identity && parsed.delegation) {
      const key = Ed25519KeyIdentity.fromJSON(parsed.identity);
      const chain = DelegationChain.fromJSON(parsed.delegation);
      const identity = DelegationIdentity.fromDelegation(key, chain);

      this.storage.setDelegationToken(tokenJson);
      this.identity = identity;
      this._principal = identity.getPrincipal();
      this.isAuthenticatedFlag = true;

      return identity;
    }

    if (parsed.delegations) {
      throw new Error(
        "This token format is no longer supported. Please get a new token from hyvmind.app/obsidian-token"
      );
    }

    throw new Error(
      "Invalid token format. Expected { identity, delegation } from hyvmind.app/obsidian-token"
    );
  }

  getTokenInfo(): TokenInfo {
    if (!this._principal) {
      return {
        valid: false,
        expiry: null,
        principal: null,
        isExpired: true,
      };
    }

    const expiry = this.getChainExpiry(this.identity);
    const isExpired = expiry ? expiry <= new Date() : false;

    return {
      valid: this.isAuthenticatedFlag && !isExpired,
      expiry,
      principal: this._principal.toText(),
      isExpired,
    };
  }

  isAuthenticated(): boolean {
    return this.isAuthenticatedFlag;
  }

  getIdentity(): DelegationIdentity | null {
    return this.identity;
  }

  getPrincipal(): Principal | null {
    return this._principal;
  }

  async logout(): Promise<void> {
    this.identity = null;
    this._principal = null;
    this.isAuthenticatedFlag = false;
    this.storage.clearDelegationToken();
  }

  setIdentityProviderUrl(url: string): void {
    this.identityProviderUrl = url;
  }

  private getChainExpiry(identity: DelegationIdentity | null): Date | null {
    if (!identity) {
      return null;
    }

    try {
      const chain = identity.getDelegation();
      if (chain && chain.delegations.length > 0) {
        const lastDel = chain.delegations[chain.delegations.length - 1];
        if (lastDel) {
          const expirationNs = lastDel.delegation.expiration;
          return new Date(Number(expirationNs / BigInt(1_000_000)));
        }
      }
    } catch {
      // Fall through
    }

    return null;
  }
}

export function getIdentityProviderUrl(customUrl?: string): string {
  if (customUrl) {
    return customUrl;
  }

  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");

  if (isLocal) {
    return "http://id.ai.localhost:8000";
  }
  return "https://id.ai";
}
