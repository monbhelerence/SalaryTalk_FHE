# SalaryTalk_FHE

SalaryTalk_FHE is a cutting-edge application that enables confidential salary negotiations using Zama's Fully Homomorphic Encryption (FHE) technology. By allowing both employers and job seekers to submit their encrypted salary expectations, this platform facilitates a secure and seamless negotiation process that respects user privacy while ensuring data integrity.

## The Problem

In today's competitive job market, salary negotiations can often lead to uncomfortable situations for both employers and candidates. Traditional negotiation methods require sharing sensitive financial expectations, which can expose individuals to bias, judgment, and potential exploitation. Cleartext data in these discussions is dangerous, as it can be intercepted or misused, leading to unfavorable outcomes and eroded trust between parties. There is a pressing need for a solution that allows for honest, secure, and private salary discussions without compromising the candidates' or employers' confidential information.

## The Zama FHE Solution

Leveraging Zama's FHE technology, SalaryTalk_FHE addresses the privacy concerns of salary negotiations by allowing users to perform computations on encrypted data. This means that all salary expectations are encrypted before they are shared with the system, which can then determine if there's an overlap in expectations without ever revealing the actual values. Using the fhevm, SalaryTalk_FHE processes encrypted inputs to ensure that sensitive financial information remains confidential throughout the negotiation process.

## Key Features

- 🔒 **Confidential Negotiation**: Employers and candidates share encrypted salary expectations, ensuring privacy.
- 🛠️ **Automatic Matching**: The system automatically assesses whether salary expectations align without revealing individual figures.
- 🔄 **Bidirectional Interface**: Both parties can input their expectations into a user-friendly interface.
- ❌ **Social Pressure Reduction**: By anonymizing the negotiation process, users can avoid the awkwardness typically associated with discussing salaries.
- ⚖️ **Fair Play**: The system promotes fairness in negotiations, mitigating biases related to disclosed salary history or expectations.

## Technical Architecture & Stack

SalaryTalk_FHE is built using the following technical stack:

- **Frontend**: JavaScript, HTML, CSS
- **Backend**: Node.js
- **Privacy Engine**: Zama’s fhevm for secure processing of encrypted data
- **Database**: NoSQL Database (e.g., MongoDB) for storing non-sensitive metadata

## Smart Contract / Core Logic (Code Snippet)

The following pseudo-code illustrates a simplified example of how SalaryTalk_FHE might leverage Zama's FHE technology in a negotiation scenario:

```solidity
// Solidity smart contract for SalaryTalk_FHE
pragma solidity ^0.8.0;

import "Zama/library.sol"; // Hypothetical import for Zama's library

contract SalaryTalk {
    function negotiateSalary(uint64 encryptedExpectationA, uint64 encryptedExpectationB) public returns (bool) {
        // Decrypt expectations
        uint64 decryptedA = TFHE.decrypt(encryptedExpectationA);
        uint64 decryptedB = TFHE.decrypt(encryptedExpectationB);
        
        // Check for overlap
        if (decryptedA > decryptedB) {
            return false; // No match
        }
        return true; // Match found
    }
}
```

## Directory Structure

```plaintext
SalaryTalk_FHE/
├── .sol                        # Solidity smart contract
├── src/
│   ├── index.html             # Frontend HTML
│   ├── app.js                 # JavaScript file for app logic
│   └── styles.css             # CSS for styling
├── server/
│   ├── server.js              # Node.js backend server
│   └── routes.js              # Routing for salary negotiation logic
└── README.md                  # Project documentation
```

## Installation & Setup

To set up SalaryTalk_FHE, follow these prerequisites and steps:

### Prerequisites

- Node.js installed on your machine
- Access to a NoSQL compatible database (e.g., MongoDB)

### Installation Steps

1. Clone the repository (without commands).
2. Navigate to the project directory.
3. Install the necessary dependencies using npm:

   ```bash
   npm install
   ```

4. Install the Zama library using npm:

   ```bash
   npm install fhevm
   ```

## Build & Run

Once the environment setup is complete, you can build and run the application using the following commands:

1. Start the backend server:
   ```bash
   node server/server.js
   ```

2. Open the frontend in your browser:
   ```bash
   npx http-server src
   ```

Visit the application in your browser to start confidential salary negotiations.

## Acknowledgements

We would like to extend our deepest gratitude to Zama for providing the open-source FHE primitives that make SalaryTalk_FHE possible. Their commitment to advancing privacy-preserving technologies has enabled us to create a secure platform that redefines salary negotiations. 

With Zama's innovative technology at the core of our application, SalaryTalk_FHE not only protects sensitive information but also fosters a culture of transparency and trust in the hiring process. 

Together, let’s pave the way for a future where privacy and negotiation go hand in hand!


