// import { useState } from "react";
// import { useNearWallet } from "near-connect-hooks";
// import { KeyPair } from "near-api-js";

// export const CreateAccountButton = () => {
//   const { signedAccountId, callFunction } = useNearWallet();
//   const [status, setStatus] = useState("");

//   const handleCreateAccount = async () => {
//     if (!signedAccountId) {
//       alert("Please connect your wallet first!");
//       return;
//     }

//     try {
//       setStatus("Generating keys...");

//       // 1. Generate a new keypair (just like your script)
//       const keyPair = KeyPair.fromRandom("ed25519");
//       const publicKey = keyPair.getPublicKey().toString();
//       const newAccountId = `user-${Date.now()}.testnet`;

//       setStatus(`Creating ${newAccountId}...`);

//       // 2. Use callFunction from the hook
//       // This sends the transaction to the 'testnet' helper contract
//       await callFunction({
//         contractId: "testnet",
//         method: "create_account",
//         args: {
//           new_account_id: newAccountId,
//           new_public_key: publicKey,
//         },
//         gas: "300000000000000", // 300 Tgas
//         deposit: "0", // The testnet helper creates it for free on testnet
//       });

//       // 3. Success! Note the private key for the user
//       console.log("Success! Private Key:", keyPair.toString());
//       setStatus(`Created! Account: ${newAccountId}`);

//       // IMPORTANT: In a real app, you must give this private key to the user
//       // or save it securely, otherwise they lose access to the new account!
//       alert(`Account created! Save this Private Key: ${keyPair.toString()}`);
//     } catch (error) {
//       console.error(error);
//       setStatus("Error creating account.");
//     }
//   };

//   return (
//     <div>
//       <button onClick={handleCreateAccount} disabled={!signedAccountId}>
//         Create Sub-Account
//       </button>
//       {status && <p>{status}</p>}
//     </div>
//   );
// };

import React, { useState } from "react";
// Import members directly - no 'keyStores' namespace needed
import { Account, JsonRpcProvider, KeyPair, nearToYocto } from "near-api-js";

// Ensure your .env has these variables
const PRIVATE_KEY = (import.meta.env.VITE_PRIVATE_KEY ||
  process.env.REACT_APP_PRIVATE_KEY) as string;
const ACCOUNT_ID =
  import.meta.env.VITE_ACCOUNT_ID || process.env.REACT_APP_ACCOUNT_ID || "";

export const CreateAccountButton = () => {
  const [loading, setLoading] = useState(false);

  console.log("VITE_KEY:", import.meta.env?.VITE_PRIVATE_KEY);
  const handleAction = async () => {
    if (!PRIVATE_KEY || !ACCOUNT_ID) {
      return alert("Missing Environment Variables: Check your .env file.");
    }

    setLoading(true);
    try {
      // 1. Connection Setup
      const provider = new JsonRpcProvider({
        url: "https://test.rpc.fastnear.com",
      });

      // 2. Modern Account Setup (Signer is handled internally by passing the private key)
      const account = new Account(ACCOUNT_ID, provider, PRIVATE_KEY as any);

      // 3. Generate new credentials
      const newAccountId = `user-${Date.now()}.testnet`;
      const newKeyPair = KeyPair.fromRandom("ed25519");
      const publicKey = newKeyPair.getPublicKey().toString();

      // --- SCRIPT LOGIC ---

      // Attempt Option 1: Basic Create
      await account.createAccount({
        newAccountId,
        publicKey,
        nearToTransfer: nearToYocto("0"),
      });

      console.log(`Created ${newAccountId} with key ${newKeyPair.toString()}`);
      alert(
        `Success! Created ${newAccountId}\nPrivate Key: ${newKeyPair.toString()}`,
      );
    } catch (error: any) {
      console.error("Action failed:", error);
      // Handle the common "testnet helper" errors gracefully
      alert(error.message || "Account creation failed. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleAction}
      disabled={loading}
      style={{
        padding: "12px 24px",
        backgroundColor: loading ? "#666" : "#00C08B",
        color: "white",
        border: "none",
        borderRadius: "8px",
        fontWeight: "bold",
        cursor: loading ? "not-allowed" : "pointer",
      }}
    >
      {loading ? "Creating..." : "Run Create Account Script"}
    </button>
  );
};
