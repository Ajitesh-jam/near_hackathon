import React, { useState, useEffect } from "react";
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  KeyPairString,
  nearToYocto,
} from "near-api-js";

const PRIVATE_KEY = (import.meta.env?.VITE_PRIVATE_KEY ||
  process.env?.REACT_APP_PRIVATE_KEY) as KeyPairString;
const ACCOUNT_ID = (import.meta.env?.VITE_ACCOUNT_ID ||
  process.env?.REACT_APP_ACCOUNT_ID) as string;

interface SubAccount {
  address: string;
  privateKey: string;
  createdAt: string;
}

export default function SubaccountDashboard() {
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const provider = new JsonRpcProvider({
    url: "https://test.rpc.fastnear.com",
  });

  useEffect(() => {
    const saved = localStorage.getItem("near_sub_accounts");
    if (saved) setSubAccounts(JSON.parse(saved));
  }, []);

  const handleCreate = async () => {
    if (!PRIVATE_KEY || !ACCOUNT_ID) return alert("Check .env file!");
    setLoading(true);
    try {
      const account = new Account(ACCOUNT_ID, provider, PRIVATE_KEY);
      const prefix = Date.now().toString();
      const keyPair = KeyPair.fromRandom("ed25519");
      const publicKey = keyPair.getPublicKey().toString();

      await account.createSubAccount({
        accountOrPrefix: prefix,
        publicKey,
        nearToTransfer: nearToYocto("0.05"),
      });

      const newAcc: SubAccount = {
        address: `${prefix}.${ACCOUNT_ID}`,
        privateKey: keyPair.toString(),
        createdAt: new Date().toLocaleString(),
      };

      const updatedList = [newAcc, ...subAccounts];
      setSubAccounts(updatedList);
      localStorage.setItem("near_sub_accounts", JSON.stringify(updatedList));
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (targetId: string, targetKey: string) => {
    if (
      !confirm(
        `Are you sure you want to delete ${targetId}? Remaining funds will be sent to ${ACCOUNT_ID}`,
      )
    )
      return;

    setProcessingId(targetId);
    try {
      // 1. Setup the account object for the sub-account we want to delete
      const accountToDelete = new Account(
        targetId,
        provider,
        targetKey as KeyPairString,
      );

      // 2. Delete the account from blockchain (Your logic)
      await accountToDelete.deleteAccount(ACCOUNT_ID);

      // 3. Update local storage and UI
      const updatedList = subAccounts.filter((acc) => acc.address !== targetId);
      setSubAccounts(updatedList);
      localStorage.setItem("near_sub_accounts", JSON.stringify(updatedList));

      alert("Account deleted successfully!");
    } catch (error: any) {
      console.error(error);
      alert(`Deletion failed: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="dashboard-container">
      <header className="dash-header">
        <div>
          <h1>NEAR Account Manager</h1>
          <p>
            Master Account: <strong>{ACCOUNT_ID}</strong>
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="main-action-btn"
        >
          {loading ? "Creating..." : "+ New Subaccount"}
        </button>
      </header>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Address</th>
              <th>Created</th>
              <th>Private Key</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subAccounts.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ textAlign: "center", padding: "40px" }}
                >
                  No accounts found.
                </td>
              </tr>
            ) : (
              subAccounts.map((acc) => (
                <tr key={acc.address}>
                  <td className="addr-cell">{acc.address}</td>
                  <td>{acc.createdAt}</td>
                  <td className="key-cell">
                    <code>{acc.privateKey.slice(0, 12)}...</code>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      onClick={() => copy(acc.address)}
                      className="icon-btn"
                    >
                      Copy ID
                    </button>
                    <button
                      onClick={() => copy(acc.privateKey)}
                      className="icon-btn"
                    >
                      Copy Key
                    </button>
                    <button
                      onClick={() => handleDelete(acc.address, acc.privateKey)}
                      className="icon-btn danger"
                      disabled={processingId === acc.address}
                    >
                      {processingId === acc.address ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .dashboard-container { padding: 40px; max-width: 1000px; margin: 0 auto; font-family: sans-serif; }
        .dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .main-action-btn { background: #00ec97; color: #000; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        .table-container { border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f9f9f9; padding: 12px; text-align: left; font-size: 13px; color: #666; }
        td { padding: 12px; border-top: 1px solid #eee; font-size: 14px; }
        .addr-cell { color: #0072ce; font-weight: bold; }
        .key-cell code { background: #f4f4f4; padding: 3px 6px; border-radius: 4px; }
        .icon-btn { margin-left: 5px; padding: 5px 10px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; }
        .icon-btn.danger { color: #fff; background: #ff4d4f; border: none; }
        .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
