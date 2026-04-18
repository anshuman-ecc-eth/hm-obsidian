/**
 * Internet Identity authentication module
 * Handles login/logout and manual token import/export
 */

import { AuthClient } from "@icp-sdk/auth/client";
import { Identity } from "@icp-sdk/core/identity";
import { Principal } from "@icp-sdk/core/principal";

const KEY_DELEGATION = "delegation";

interface AuthClientStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

interface DelegationInfo {
  delegations: Array<{
    delegation: {
      pubkey: Uint8Array;
      expiration: bigint;
      targets?: Principal[];
    };
    signature: Uint8Array;
  }>;
}

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
  private identity: Identity | null = null;
  private principal: Principal | null = null;
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
        const tokenData = JSON.parse(storedToken);

    const customStorage: AuthClientStorage = {
      get: (key: string) => {
        if (key === KEY_DELEGATION) {
          return Promise.resolve(tokenData);
        }
        return Promise.resolve(null);
      },
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    };

        this.client = await AuthClient.create({ storage: customStorage });

        const isAuth = await this.client.isAuthenticated();
        if (isAuth) {
          this.identity = this.client.getIdentity();
          this.principal = this.identity.getPrincipal();
          this.isAuthenticatedFlag = true;
          return;
        }
      } catch (err) {
        console.warn("Failed to restore token, will need to re-import:", err);
      }
    }

    this.client = await AuthClient.create();
  }

  async importDelegationToken(tokenJson: string): Promise<Identity> {
    const parsed = JSON.parse(tokenJson);

    if (!parsed || !parsed.delegations) {
      throw new Error("Invalid delegation token format");
    }

    this.storage.setDelegationToken(tokenJson);

    const customStorage: AuthClientStorage = {
      get: (key: string) => {
        if (key === KEY_DELEGATION) {
          return Promise.resolve(parsed);
        }
        return Promise.resolve(null);
      },
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    };

    this.client = await AuthClient.create({ storage: customStorage });

    const isAuth = await this.client.isAuthenticated();
    if (!isAuth) {
      throw new Error("Failed to authenticate with provided token");
    }

    this.identity = this.client.getIdentity();
    this.principal = this.identity.getPrincipal();
    this.isAuthenticatedFlag = true;

    return this.identity;
  }

  getTokenInfo(): TokenInfo {
    if (!this.client || !this.principal) {
      return {
        valid: false,
        expiry: null,
        principal: null,
        isExpired: true,
      };
    }

    let expiry: Date | null = null;
    let isExpired = true;

    try {
      const chain = (this.client as unknown as { _chain?: DelegationInfo })._chain;
      if (chain && chain.delegations && chain.delegations.length > 0) {
        const lastDel = chain.delegations[chain.delegations.length - 1];
        const expirationNs = lastDel.delegation.expiration;
        expiry = new Date(Number(expirationNs / BigInt(1_000_000)));
        isExpired = expiry < new Date();
      }
    } catch {
      isExpired = true;
    }

    return {
      valid: this.isAuthenticatedFlag && !isExpired,
      expiry,
      principal: this.principal.toText(),
      isExpired,
    };
  }

  isAuthenticated(): boolean {
    return this.isAuthenticatedFlag;
  }

  getIdentity(): Identity | null {
    return this.identity;
  }

  getPrincipal(): Principal | null {
    return this.principal;
  }

  async logout(): Promise<void> {
    if (this.client) {
      await this.client.logout();
    }
    this.identity = null;
    this.principal = null;
    this.isAuthenticatedFlag = false;
    this.storage.clearDelegationToken();
  }

  setIdentityProviderUrl(url: string): void {
    this.identityProviderUrl = url;
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
