export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111");
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x1d355800fFA522d654cFd5186B6eE213aA292e75";
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/events";
export const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`;

// Optional public demo recipient wallet. Set this to a separate MetaMask test account.
export const DEMO_STUDENT_ADDRESS = process.env.NEXT_PUBLIC_DEMO_STUDENT_ADDRESS || "";
