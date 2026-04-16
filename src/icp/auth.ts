/**
 * Internet Identity authentication module
 * Handles login/logout using @icp-sdk/auth
 */

import { AuthClient } from "@icp-sdk/auth/client";
import { Identity } from "@icp-sdk/core/identity";
import { Principal } from "@icp-sdk/core/principal";

// 8 hours in nanoseconds (max recommended delegation expiry)
const DEFAULT_MAX_TIME_TO_LIVE = BigInt(8) * BigInt(3_600_000_000_000);

export interface AuthState {
  client: AuthClient | null;
  identity: Identity | null;
  principal: Principal | null;
  isAuthenticated: boolean;
}

export class ICPAuth {
  private state: AuthState = {
    client: null,
    identity: null,
    principal: null,
    isAuthenticated: false,
  };

  private identityProviderUrl: string;

  constructor(identityProviderUrl: string) {
    this.identityProviderUrl = identityProviderUrl;
  }

  /**
   * Initialize the AuthClient
   */
  async init(): Promise<void> {
    this.state.client = await AuthClient.create();
    
    // Check if already authenticated
    const isAuthenticated = await this.state.client.isAuthenticated();
    if (isAuthenticated) {
      this.state.identity = this.state.client.getIdentity();
      this.state.principal = this.state.identity.getPrincipal();
      this.state.isAuthenticated = true;
    }
  }

  /**
   * Login with Internet Identity
   */
  async login(): Promise<Identity> {
    if (!this.state.client) {
      throw new Error("AuthClient not initialized");
    }

    return new Promise((resolve, reject) => {
      this.state.client!.login({
        identityProvider: this.identityProviderUrl,
        maxTimeToLive: DEFAULT_MAX_TIME_TO_LIVE,
        onSuccess: () => {
          const identity = this.state.client!.getIdentity();
          const principal = identity.getPrincipal();
          
          // Check for anonymous principal (indicates auth failure)
          if (principal.toText() === "2vxsx-fae") {
            reject(new Error("Authentication failed: anonymous principal"));
            return;
          }

          this.state.identity = identity;
          this.state.principal = principal;
          this.state.isAuthenticated = true;
          
          resolve(identity);
        },
        onError: (error) => {
          reject(new Error(`Login failed: ${error}`));
        },
      });
    });
  }

  /**
   * Logout and clear identity
   */
  async logout(): Promise<void> {
    if (!this.state.client) {
      return;
    }

    await this.state.client.logout();
    this.state.identity = null;
    this.state.principal = null;
    this.state.isAuthenticated = false;
  }

  /**
   * Get current identity
   */
  getIdentity(): Identity | null {
    return this.state.identity;
  }

  /**
   * Get current principal
   */
  getPrincipal(): Principal | null {
    return this.state.principal;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  /**
   * Update the identity provider URL
   */
  setIdentityProviderUrl(url: string): void {
    this.identityProviderUrl = url;
  }
}

/**
 * Get the II URL based on current environment
 */
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
