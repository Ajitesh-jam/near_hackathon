// // src/components/WalletButton.tsx
// import { useNearWallet } from "near-connect-hooks";

// export const WalletButton = () => {
//   const { signedAccountId, loading, signIn, signOut } = useNearWallet();

//   if (loading) {
//     return <button disabled>Connecting...</button>;
//   }

//   return (
//     <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
//       {signedAccountId ? (
//         <>
//           <span className="account-id">
//             {/* Show a truncated version of the NEAR address */}
//             {signedAccountId}
//           </span>
//           <button onClick={() => signOut()} className="btn-signout">
//             Sign Out
//           </button>
//         </>
//       ) : (
//         <button onClick={() => signIn()} className="btn-signin">
//           Connect NEAR Wallet
//         </button>
//       )}
//     </div>
//   );
// };

// src/components/WalletButton.tsx
import { useNearWallet } from "near-connect-hooks";

export const WalletButton = () => {
  const { signedAccountId, loading, signIn, signOut } = useNearWallet();

  // Helper to make long NEAR addresses readable
  const formatAddress = (id: string) => {
    return id.length > 20 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;
  };

  if (loading) {
    return (
      <button className="near-btn loading" disabled>
        Connecting...
      </button>
    );
  }

  return (
    <div className="near-wallet-wrapper">
      {signedAccountId ? (
        <div className="account-container">
          <span className="account-id" title={signedAccountId}>
            {formatAddress(signedAccountId)}
          </span>
          <button onClick={() => signOut()} className="near-btn signout">
            Sign Out
          </button>
        </div>
      ) : (
        <button onClick={() => signIn()} className="near-btn signin">
          Connect Wallet
        </button>
      )}

      <style>{`
        .near-wallet-wrapper {
          display: flex;
          align-items: center;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .account-container {
          display: flex;
          align-items: center;
          background: #f4f4f4;
          padding: 4px 4px 4px 12px;
          border-radius: 50px;
          border: 1px solid #e5e5e5;
        }

        .account-id {
          font-size: 0.9rem;
          font-weight: 600;
          color: #333;
          margin-right: 12px;
        }

        .near-btn {
          padding: 8px 18px;
          border-radius: 40px;
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.9rem;
        }

        .signin {
          background-color: #000;
          color: #fff;
        }

        .signin:hover {
          background-color: #222;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .signout {
          background-color: #fff;
          color: #ff4d4d;
          border: 1px solid #ff4d4d;
        }

        .signout:hover {
          background-color: #fff1f1;
        }

        .loading {
          background-color: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
