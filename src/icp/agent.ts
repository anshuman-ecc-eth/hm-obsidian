import { HttpAgent, Actor } from "@icp-sdk/core/agent";
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity";
import { Principal } from "@icp-sdk/core/principal";
import { HyvmindActor } from "../types/canister";

const idlFactory = ({ IDL }: { IDL: IDL }) => {
  return IDL.Service({
    requestPluginBinding: IDL.Func([IDL.Principal, IDL.Principal], [], []),
    getPendingPluginBindings: IDL.Func([], [IDL.Vec(IDL.Principal)], ["query"]),
    approvePluginBinding: IDL.Func([IDL.Principal], [], []),
    getPluginBindingStatus: IDL.Func([], [IDL.Bool], ["query"]),
    getBoundPluginKeys: IDL.Func([], [IDL.Vec(IDL.Principal)], ["query"]),
    revokePluginBinding: IDL.Func([IDL.Principal], [], []),
    getMyPrincipal: IDL.Func([], [IDL.Principal], ["query"]),
    storeNotesData: IDL.Func([IDL.Text], [], []),
    getNotesData: IDL.Func([], [IDL.Opt(IDL.Text)], ["query"]),
    initializeAccessControl: IDL.Func([], [], []),
    isCallerApproved: IDL.Func([], [IDL.Bool], ["query"]),
    requestApproval: IDL.Func([], [], []),
    getCallerUserProfile: IDL.Func([], [IDL.Opt(IDL.Record({ name: IDL.Text, socialUrl: IDL.Opt(IDL.Text) }))], ["query"]),
    saveCallerUserProfile: IDL.Func([IDL.Record({ name: IDL.Text, socialUrl: IDL.Opt(IDL.Text) })], [], []),
  });
};

function toText(p: unknown): string {
  if (p && typeof (p as { toText(): string }).toText === "function") return (p as { toText(): string }).toText();
  return String(p);
}

function getRootKey(): Uint8Array | undefined {
  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "IC_ROOT_KEY" && value) {
        return Uint8Array.from(atob(value));
      }
    }
  } catch {
    // Cookie not available or parsing failed
  }
  return undefined;
}

export class ICPAgent {
  private agent: HttpAgent | null = null;
  private actor: HyvmindActor | null = null;
  private canisterId: string;
  private host: string;

  constructor(canisterId: string, host: string) {
    this.canisterId = canisterId;
    this.host = host;
  }

  async createAuthenticatedActor(identity: Ed25519KeyIdentity): Promise<void> {
    const rootKey = getRootKey();

    this.agent = await HttpAgent.create({
      identity,
      host: this.host,
      rootKey: rootKey,
    });

    if (!rootKey && this.host.includes("localhost")) {
      await this.agent.fetchRootKey();
    }

    this.actor = Actor.createActor(idlFactory, {
      agent: this.agent,
      canisterId: Principal.fromText(this.canisterId),
    });
  }

  getActor(): HyvmindActor | null {
    return this.actor;
  }

  updateConfig(canisterId: string, host: string): void {
    this.canisterId = canisterId;
    this.host = host;
    this.actor = null;
    this.agent = null;
  }

  async requestPluginBinding(pluginPubKeyText: string, userPrincipalText: string): Promise<void> {
    if (!this.actor) throw new Error("Actor not initialized");
    const pluginKey = Principal.fromText(pluginPubKeyText);
    const userPrincipal = Principal.fromText(userPrincipalText);
    await this.actor.requestPluginBinding(pluginKey, userPrincipal);
  }

  async getPendingPluginBindings(): Promise<string[]> {
    if (!this.actor) throw new Error("Actor not initialized");
    const result: unknown[] = await this.actor.getPendingPluginBindings();
    return result.map(toText);
  }

  async approvePluginBinding(pluginPubKeyText: string): Promise<void> {
    if (!this.actor) throw new Error("Actor not initialized");
    await this.actor.approvePluginBinding(Principal.fromText(pluginPubKeyText));
  }

  async getPluginBindingStatus(): Promise<boolean> {
    if (!this.actor) throw new Error("Actor not initialized");
    return await this.actor.getPluginBindingStatus();
  }

  async getBoundPluginKeys(): Promise<string[]> {
    if (!this.actor) throw new Error("Actor not initialized");
    const result: unknown[] = await this.actor.getBoundPluginKeys();
    return result.map(toText);
  }

  async revokePluginBinding(pluginKeyText: string): Promise<void> {
    if (!this.actor) throw new Error("Actor not initialized");
    await this.actor.revokePluginBinding(Principal.fromText(pluginKeyText));
  }

  async storeNotesData(json: string): Promise<void> {
    if (!this.actor) throw new Error("Actor not initialized");
    await this.actor.storeNotesData(json);
  }

  async getNotesData(): Promise<string | null> {
    if (!this.actor) throw new Error("Actor not initialized");
    const result = await this.actor.getNotesData();
    return result ?? null;
  }

  async isCallerApproved(): Promise<boolean> {
    if (!this.actor) throw new Error("Actor not initialized");
    return await this.actor.isCallerApproved();
  }

  async initializeAccessControl(): Promise<void> {
    if (!this.actor) throw new Error("Actor not initialized");
    await this.actor.initializeAccessControl();
  }

  async requestApproval(): Promise<void> {
    if (!this.actor) throw new Error("Actor not initialized");
    await this.actor.requestApproval();
  }

  async saveUserProfile(name: string): Promise<void> {
    if (!this.actor) throw new Error("Actor not initialized");
    await this.actor.saveCallerUserProfile({ name, socialUrl: null });
  }

  async getUserProfile(): Promise<{ name: string; socialUrl: string | null } | null> {
    if (!this.actor) throw new Error("Actor not initialized");
    return await this.actor.getCallerUserProfile();
  }
}
