import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface SalaryOffer {
  id: string;
  role: string;
  employerOffer: number;
  candidateExpectation: number;
  timestamp: number;
  creator: string;
  isMatch: boolean;
  isVerified: boolean;
  decryptedValue?: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<SalaryOffer[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newOfferData, setNewOfferData] = useState({ role: "", employerOffer: "", candidateExpectation: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVerified, setFilterVerified] = useState(false);
  const [userHistory, setUserHistory] = useState<SalaryOffer[]>([]);
  const [stats, setStats] = useState({ total: 0, matches: 0, verified: 0 });

  const { initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevm = async () => {
      if (isConnected && !isInitialized) {
        try {
          await initialize();
        } catch (error) {
          console.error('FHEVM init failed:', error);
        }
      }
    };
    initFhevm();
  }, [isConnected, isInitialized, initialize]);

  useEffect(() => {
    if (isConnected) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    const userOffers = offers.filter(offer => offer.creator.toLowerCase() === address?.toLowerCase());
    setUserHistory(userOffers);
    
    const total = offers.length;
    const matches = offers.filter(o => o.isMatch).length;
    const verified = offers.filter(o => o.isVerified).length;
    setStats({ total, matches, verified });
  }, [offers, address]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setLoading(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const offersList: SalaryOffer[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          const match = businessData.publicValue1 === businessData.publicValue2;
          
          offersList.push({
            id: businessId,
            role: businessData.name,
            employerOffer: Number(businessData.publicValue1) || 0,
            candidateExpectation: Number(businessData.publicValue2) || 0,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            isMatch: match,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading offer:', e);
        }
      }
      
      setOffers(offersList);
    } catch (e) {
      console.error('Load data failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const createOffer = async () => {
    if (!isConnected || !address) return;
    
    setCreatingOffer(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating encrypted salary offer..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("No contract");
      
      const employerValue = parseInt(newOfferData.employerOffer) || 0;
      const candidateValue = parseInt(newOfferData.candidateExpectation) || 0;
      const businessId = `offer-${Date.now()}`;
      
      const encryptedResult = await encrypt(await contract.getAddress(), address, employerValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newOfferData.role,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        employerValue,
        candidateValue,
        "Salary negotiation offer"
      );
      
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Offer created with FHE encryption!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewOfferData({ role: "", employerOffer: "", candidateExpectation: "" });
    } catch (e: any) {
      const errorMsg = e.message?.includes("rejected") ? "Transaction rejected" : "Creation failed";
      setTransactionStatus({ visible: true, status: "error", message: errorMsg });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally {
      setCreatingOffer(false);
    }
  };

  const decryptOffer = async (offerId: string) => {
    if (!isConnected || !address) return;
    
    try {
      const contractRead = await getContractReadOnly();
      const contractWrite = await getContractWithSigner();
      if (!contractRead || !contractWrite) return;
      
      const businessData = await contractRead.getBusinessData(offerId);
      if (businessData.isVerified) {
        setTransactionStatus({ visible: true, status: "success", message: "Already verified on-chain" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return;
      }
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(offerId);
      
      await verifyDecryption(
        [encryptedValueHandle],
        await contractRead.getAddress(),
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(offerId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "success", message: "Decryption verified on-chain!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      
      await loadData();
    } catch (e: any) {
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (contract) {
        await contract.isAvailable();
        setTransactionStatus({ visible: true, status: "success", message: "FHE system available!" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      }
    } catch (e) {
      console.error('Availability check failed:', e);
    }
  };

  const filteredOffers = offers.filter(offer => {
    const matchesSearch = offer.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = !filterVerified || offer.isVerified;
    return matchesSearch && matchesFilter;
  });

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>SalaryTalk FHE 💰</h1>
            <span>Confidential Salary Negotiation</span>
          </div>
          <ConnectButton />
        </header>
        
        <div className="connection-prompt">
          <div className="prompt-content">
            <div className="prompt-icon">🔐</div>
            <h2>Connect Wallet to Start</h2>
            <p>Private salary negotiation powered by Fully Homomorphic Encryption</p>
            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>Encrypted Offers</h3>
                <p>Employer offers encrypted with Zama FHE</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎯</div>
                <h3>Auto-Matching</h3>
                <p>System detects salary range overlaps privately</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🤝</div>
                <h3>No Awkwardness</h3>
                <p>Avoid negotiation博弈尴尬 with privacy</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Loading salary offers...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <h1>SalaryTalk FHE 💰</h1>
          <span>隱私薪酬談判 | Confidential Salary Negotiation</span>
        </div>
        
        <div className="header-actions">
          <button onClick={checkAvailability} className="status-btn">
            Check FHE Status
          </button>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            + New Offer
          </button>
          <ConnectButton />
        </div>
      </header>

      <div className="main-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Offers</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.matches}</div>
            <div className="stat-label">Successful Matches</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.verified}</div>
            <div className="stat-label">FHE Verified</div>
          </div>
        </div>

        <div className="controls-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={filterVerified}
              onChange={(e) => setFilterVerified(e.target.checked)}
            />
            Show Verified Only
          </label>
        </div>

        <div className="offers-grid">
          {filteredOffers.map((offer) => (
            <div key={offer.id} className={`offer-card ${offer.isMatch ? 'match' : ''} ${offer.isVerified ? 'verified' : ''}`}>
              <div className="card-header">
                <h3>{offer.role}</h3>
                <div className="status-badges">
                  {offer.isMatch && <span className="badge match">💰 Match!</span>}
                  {offer.isVerified && <span className="badge verified">🔐 Verified</span>}
                </div>
              </div>
              
              <div className="salary-info">
                <div className="salary-item">
                  <span>Employer Offer:</span>
                  <strong>{offer.isVerified && offer.decryptedValue ? `${offer.decryptedValue}` : '🔒 Encrypted'}</strong>
                </div>
                <div className="salary-item">
                  <span>Candidate Expectation:</span>
                  <strong>{offer.candidateExpectation}</strong>
                </div>
              </div>

              <div className="card-footer">
                <button 
                  onClick={() => decryptOffer(offer.id)}
                  disabled={offer.isVerified}
                  className={`verify-btn ${offer.isVerified ? 'verified' : ''}`}
                >
                  {offer.isVerified ? '✅ Verified' : '🔓 Verify'}
                </button>
                <span className="creator">{offer.creator.slice(0, 6)}...{offer.creator.slice(-4)}</span>
              </div>
            </div>
          ))}
        </div>

        {filteredOffers.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">💼</div>
            <h3>No salary offers found</h3>
            <p>Create the first confidential salary negotiation offer</p>
            <button onClick={() => setShowCreateModal(true)} className="create-btn">
              Create First Offer
            </button>
          </div>
        )}

        <div className="user-history">
          <h3>Your Negotiation History ({userHistory.length})</h3>
          <div className="history-list">
            {userHistory.map((offer, index) => (
              <div key={index} className="history-item">
                <span className="role">{offer.role}</span>
                <span className={`outcome ${offer.isMatch ? 'success' : 'pending'}`}>
                  {offer.isMatch ? '✅ Match' : '⏳ Pending'}
                </span>
                <span className="date">{new Date(offer.timestamp * 1000).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>

        <footer className="app-footer">
          <p>SalaryTalk FHE - Confidential Salary Negotiation Platform</p>
          <p>Powered by Zama FHE Technology | 避免博弈尴尬，保护隐私薪酬谈判</p>
        </footer>
      </div>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-modal">
            <div className="modal-header">
              <h2>Create Confidential Offer</h2>
              <button onClick={() => setShowCreateModal(false)} className="close-btn">×</button>
            </div>
            
            <div className="modal-body">
              <div className="fhe-notice">
                <strong>FHE Encryption Active 🔐</strong>
                <p>Employer offer will be encrypted using Zama FHE technology</p>
              </div>

              <div className="form-group">
                <label>Job Role *</label>
                <input
                  type="text"
                  value={newOfferData.role}
                  onChange={(e) => setNewOfferData({...newOfferData, role: e.target.value})}
                  placeholder="e.g., Senior Developer"
                />
              </div>

              <div className="form-group">
                <label>Employer Offer (Encrypted) *</label>
                <input
                  type="number"
                  value={newOfferData.employerOffer}
                  onChange={(e) => setNewOfferData({...newOfferData, employerOffer: e.target.value})}
                  placeholder="Salary amount"
                />
                <span className="input-hint">FHE Encrypted Integer</span>
              </div>

              <div className="form-group">
                <label>Candidate Expectation (Public) *</label>
                <input
                  type="number"
                  value={newOfferData.candidateExpectation}
                  onChange={(e) => setNewOfferData({...newOfferData, candidateExpectation: e.target.value})}
                  placeholder="Expected salary"
                />
                <span className="input-hint">Public Comparison Value</span>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="cancel-btn">Cancel</button>
              <button 
                onClick={createOffer}
                disabled={creatingOffer || isEncrypting || !newOfferData.role || !newOfferData.employerOffer || !newOfferData.candidateExpectation}
                className="submit-btn"
              >
                {creatingOffer || isEncrypting ? "Encrypting..." : "Create Offer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {transactionStatus.visible && (
        <div className="notification-toast">
          <div className={`toast-content ${transactionStatus.status}`}>
            <div className="toast-icon">
              {transactionStatus.status === 'pending' && '⏳'}
              {transactionStatus.status === 'success' && '✅'}
              {transactionStatus.status === 'error' && '❌'}
            </div>
            <span>{transactionStatus.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;


