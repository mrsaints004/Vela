import {walletSigner} from '../browser-wallet';
import { Contract, toUtf8Bytes, toUtf8String } from "ethers";

// ERC-8004 IdentityRegistry — same address on BSC mainnet & all EVM chains
export const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
// BSC Testnet
export const IDENTITY_REGISTRY_TESTNET = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

const IDENTITY_ABI = [
  // Register with URI and metadata
  "function register(string agentURI, tuple(string metadataKey, bytes metadataValue)[] metadata) external returns (uint256)",
  // Register with URI only
  "function register(string agentURI) external returns (uint256)",
  // Register bare
  "function register() external returns (uint256)",
  // Get metadata
  "function getMetadata(uint256 agentId, string metadataKey) external view returns (bytes)",
  // Set metadata
  "function setMetadata(uint256 agentId, string metadataKey, bytes metadataValue) external",
  // Owner of (ERC-721)
  "function ownerOf(uint256 tokenId) external view returns (address)",
  // Balance
  "function balanceOf(address owner) external view returns (uint256)",
  // Token by index
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  // Events
  "event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

export interface AgentMetadata {
  name: string;
  description: string;
  capabilities: string[];
  version: string;
  serviceEndpoint?: string;
}

export interface AgentIdentity {
  agentId: number;
  owner: string;
  uri: string;
  metadata: AgentMetadata;
  registryAddress: string;
  chainId: number;
}

function getRegistry(useTestnet = false) {
  return useTestnet ? IDENTITY_REGISTRY_TESTNET : IDENTITY_REGISTRY;
}

/**
 * Register a new agent on-chain via ERC-8004 IdentityRegistry.
 * Returns the minted agent NFT ID.
 */
export async function registerAgent(
  metadata: AgentMetadata,
  useTestnet = false
): Promise<{ agentId: number; txHash: string }> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Wallet not available");
  }

  const {signer,provider,address} = await walletSigner(useTestnet ? 97 : 56);
  if(await provider.getBalance(address)===0n) throw new Error("You need BNB on the selected network for identity registration gas.");
  const registryAddress = getRegistry(useTestnet);
  if(await provider.getCode(registryAddress)==="0x") throw new Error("IdentityRegistry contract is unavailable on this network.");
  const contract = new Contract(registryAddress, IDENTITY_ABI, signer);

  // Build the agent URI as a data URI containing JSON metadata
  const agentURI = `data:application/json;base64,${utf8Base64(JSON.stringify({
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    active: false,
    x402Support: false,
    services: [],
    supportedTrust: [],
    name: metadata.name,
    description: metadata.description,
    capabilities: metadata.capabilities,
    version: metadata.version,
    serviceEndpoint: metadata.serviceEndpoint || "",
    platform: "Vela — Tokenized Stock Execution Intelligence",
    chain: "BSC",
    providers: ["bStocks", "Ondo", "xStocks"],
  }))}`;


  // Build metadata entries
  const metadataEntries = [
    {
      metadataKey: "name",
      metadataValue: toUtf8Bytes(metadata.name),
    },
    {
      metadataKey: "description",
      metadataValue: toUtf8Bytes(metadata.description),
    },
    {
      metadataKey: "capabilities",
      metadataValue: toUtf8Bytes(JSON.stringify(metadata.capabilities)),
    },
    {
      metadataKey: "version",
      metadataValue: toUtf8Bytes(metadata.version),
    },
  ];

  // Call register(string, tuple[])
  const tx = await contract["register(string,(string,bytes)[])"](agentURI, metadataEntries);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Agent registration did not confirm.");

  // Extract agent ID from Transfer event
  let agentId: number|null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (log.address.toLowerCase()===registryAddress.toLowerCase() && parsed && parsed.name === "Transfer" && /^0x0{40}$/i.test(String(parsed.args[0])) && String(parsed.args[1]).toLowerCase()===address.toLowerCase()) {
        agentId = Number(parsed.args[2]); // tokenId
        break;
      }
    } catch {
      // Not our event
    }
  }

  if (agentId===null || !Number.isSafeInteger(agentId)) throw new Error("Registration confirmed but no agent ID was found. Check the transaction before retrying.");
  return { agentId, txHash: receipt.hash };
}

/**
 * Look up an agent's metadata from the registry.
 */
export async function getAgentIdentity(
  agentId: number,
  useTestnet = false
): Promise<AgentIdentity | null> {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }

  const {provider} = await walletSigner(useTestnet ? 97 : 56);
  const registryAddress = getRegistry(useTestnet);
  const contract = new Contract(registryAddress, IDENTITY_ABI, provider);

  try {
    const owner = await contract.ownerOf(agentId);

    const [nameBytes, descBytes, capBytes, versionBytes] = await Promise.all([
      contract.getMetadata(agentId, "name").catch(() => "0x"),
      contract.getMetadata(agentId, "description").catch(() => "0x"),
      contract.getMetadata(agentId, "capabilities").catch(() => "0x"),
      contract.getMetadata(agentId, "version").catch(() => "0x"),
    ]);

    const decode = (b: string) => {
      try { return toUtf8String(b); } catch { return ""; }
    };

    let capabilities: string[] = [];
    try { capabilities = JSON.parse(decode(capBytes)); } catch { /* */ }

    return {
      agentId,
      owner,
      uri: "",
      metadata: {
        name: decode(nameBytes) || "Vela Agent",
        description: decode(descBytes) || "",
        capabilities,
        version: decode(versionBytes) || "0.1.0",
      },
      registryAddress,
      chainId: useTestnet ? 97 : 56,
    };
  } catch {
    return null;
  }
}

/**
 * Find all agent IDs owned by the connected wallet.
 */
export async function getOwnedAgents(
  useTestnet = false
): Promise<number[]> {
  if (typeof window === "undefined" || !window.ethereum) {
    return [];
  }

  const {signer} = await walletSigner(useTestnet ? 97 : 56);
  const address = await signer.getAddress();
  const registryAddress = getRegistry(useTestnet);
  const contract = new Contract(registryAddress, IDENTITY_ABI, signer);

  try {
    const balance = Number(await contract.balanceOf(address));
    const ids: number[] = [];

    for (let i = 0; i < balance; i++) {
      const tokenId = Number(await contract.tokenOfOwnerByIndex(address, i));
      ids.push(tokenId);
    }

    return ids;
  } catch {
    return [];
  }
}

export function utf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
